import sharp from "sharp";
import { openai } from "@workspace/integrations-openai-ai-server";

/**
 * Long SMS-thread screenshots are extremely tall (e.g. 540x11877). Vision
 * models downscale the whole image to fit their input size, making the text
 * unreadable. Slice tall images into overlapping segments so every message
 * stays legible; each segment is sent as its own image part.
 */
export async function prepareImageSlices(imageBase64: string): Promise<{ base64: string; mimeType: string }[]> {
  const buffer = Buffer.from(imageBase64, "base64");
  const img = sharp(buffer, { limitInputPixels: 100_000_000 }).rotate(); // respect EXIF orientation
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return [{ base64: imageBase64, mimeType: "image/jpeg" }];

  // Keep slices at roughly a 2:1 (h:w) aspect so the model preserves detail.
  const sliceHeight = Math.max(Math.round(width * 2), 800);
  if (height <= sliceHeight * 1.25) {
    return [{ base64: imageBase64, mimeType: "image/jpeg" }];
  }

  const overlap = Math.round(sliceHeight * 0.12); // avoid cutting a message in half
  const slices: { base64: string; mimeType: string }[] = [];
  let top = 0;
  while (top < height && slices.length < 16) {
    const h = Math.min(sliceHeight, height - top);
    const slice = await sharp(buffer, { limitInputPixels: 100_000_000 })
      .rotate()
      .extract({ left: 0, top, width, height: h })
      .jpeg({ quality: 85 })
      .toBuffer();
    slices.push({ base64: slice.toString("base64"), mimeType: "image/jpeg" });
    if (top + h >= height) break;
    top += sliceHeight - overlap;
  }
  return slices;
}

export interface ExtractedSmsTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: string; // "12.50"
  type: "debit" | "credit";
  category: string | null;
}

export interface SmsExtractionResult {
  kind: "sms" | "receipt" | "unknown";
  transactions: ExtractedSmsTransaction[];
}

/**
 * Extracts transactions from a bank-notification screenshot (BIBD / Baiduri
 * SMS or push-notification thread). One screenshot typically contains MANY
 * messages, each representing a single transaction. Non-transaction messages
 * (OTP codes, balance enquiries, promos, login alerts) are ignored.
 *
 * Also recognises a plain single-receipt photo and returns it as one row, so
 * callers can pass any image through the same path.
 */
export async function extractTransactionsFromImage(opts: {
  imageBase64: string;
  mimeType: string;
  categoryNames: string[];
}): Promise<SmsExtractionResult> {
  const today = new Date().toISOString().split("T")[0];
  const categoryNamesText = opts.categoryNames.length > 0
    ? opts.categoryNames.map((n) => `"${n}"`).join(", ")
    : "(no categories yet — use null)";

  // Slice tall screenshots so every SMS stays readable after model downscaling.
  const slices = await prepareImageSlices(opts.imageBase64).catch(() => [
    { base64: opts.imageBase64, mimeType: opts.mimeType },
  ]);

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          ...slices.map((s) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:${s.mimeType};base64,${s.base64}`,
              // Small SMS text needs high detail to be read reliably.
              detail: "high" as const,
            },
          })),
          {
            type: "text",
            text: `You are a bank transaction extractor for Brunei banks (BIBD, Baiduri).
The image is either (a) a screenshot of a bank SMS / notification thread containing MANY messages, or (b) a photo of a single purchase receipt.
If multiple images are attached, they are consecutive overlapping slices of ONE tall screenshot — treat them as a single thread and do not double-count messages that appear in two slices.

Extract EVERY distinct financial transaction and return ONLY valid JSON (no markdown) of this shape:
{
  "kind": "sms" | "receipt" | "unknown",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "short human description, e.g. 'Card purchase at GIANT SUPERSTORE'",
      "amount": "decimal string, e.g. '12.50'",
      "type": "debit" | "credit",
      "category": "EXACTLY one of these names verbatim or null: ${categoryNamesText}"
    }
  ]
}

Rules:
- BIBD SMS alerts look like: "Your account ...1234 has been debited BND 12.50 at GIANT SUPERSTORE on 27/07/26 ...". Parse each such message as one transaction.
- "debited" / purchase / payment / transfer out => type "debit". "credited" / received / deposit / salary => type "credit".
- IGNORE non-transaction messages: OTP / verification codes, balance enquiries, promotions, login alerts, declined transactions.
- If the same transaction appears twice in the thread (duplicate SMS), include it only once.
- Dates: Brunei SMS uses DD/MM/YY or DD/MM/YYYY. Convert to YYYY-MM-DD. If a message has no readable date, use ${today}.
- Amounts: strip "BND", commas and currency symbols; always two decimals.
- For "category": copy one of the listed names exactly (case-sensitive) or null. Never invent names.
- If the image is a single store receipt, return kind "receipt" with exactly one transaction (the total).
- If the image contains no readable transactions, return {"kind":"unknown","transactions":[]}.`,
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();

  let parsed: { kind?: string; transactions?: unknown } = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { kind: "unknown", transactions: [] };
  }

  const rawTxns = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  const transactions: ExtractedSmsTransaction[] = [];
  const seen = new Set<string>();

  for (const t of rawTxns as Array<Record<string, unknown>>) {
    const amountNum = Number(String(t.amount ?? "").replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(amountNum) || amountNum <= 0) continue;
    const amount = amountNum.toFixed(2);

    let date = String(t.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) {
      date = today;
    }

    const type = t.type === "credit" ? "credit" : "debit";
    const description = String(t.description ?? "").trim() || "Bank SMS transaction";
    const category = typeof t.category === "string" && t.category.trim() !== "" ? t.category : null;

    // In-image dedupe: the model is asked to dedupe, but enforce it anyway.
    const key = `${date}|${amount}|${type}|${description.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    transactions.push({ date, description, amount, type, category });
  }

  const kind = parsed.kind === "sms" || parsed.kind === "receipt" ? parsed.kind : "unknown";
  return { kind, transactions };
}
