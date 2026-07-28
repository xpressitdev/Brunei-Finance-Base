import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, categoriesTable, uploadedDocumentsTable, importedTransactionRowsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { extractTransactionsFromImage } from "../lib/smsExtract";

const router: IRouter = Router();

router.post("/receipt/scan", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: "imageBase64 and mimeType are required" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  // Pull the actual expense categories so the AI can pick from the real
  // envelope names (e.g. "Entertainment", custom names) — this is what
  // lets the saved transaction reduce the right budget envelope.
  const userCategories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.kind, "expense"));

  const categoryNamesList = userCategories.map((c) => c.name);
  const categoryNamesText = categoryNamesList.length > 0
    ? categoryNamesList.map((n) => `"${n}"`).join(", ")
    : "(no categories yet — return null for the category field)";

  // A "receipt" photo might actually be a screenshot of a bank SMS thread
  // containing MANY transactions (users screenshot their BIBD alerts instead
  // of photographing every receipt). Detect that case first and stage all
  // extracted transactions for review — the review flow flags duplicates.
  const smsResult = await extractTransactionsFromImage({
    imageBase64,
    mimeType,
    categoryNames: categoryNamesList,
  }).catch(() => null);

  if (smsResult) {
    req.log.info({ kind: smsResult.kind, count: smsResult.transactions.length }, "receipt scan pre-classification");
  }
  // Route to the review flow when the image is an SMS thread OR when more
  // than one transaction was found (regardless of classification).
  if (smsResult && (smsResult.kind === "sms" || smsResult.transactions.length > 1) && smsResult.transactions.length > 0) {
    const docId = uuidv4();
    const fileName = `sms_screenshot_${Date.now()}.jpg`;
    await db.insert(uploadedDocumentsTable).values({
      id: docId,
      userId: req.userId!,
      fileName,
      storagePath: `/receipt-scan/${docId}/${fileName}`,
      bankType: "bibd",
      parseStatus: "parsed",
    });
    await db.insert(importedTransactionRowsTable).values(smsResult.transactions.map((txn) => ({
      id: uuidv4(),
      uploadedDocumentId: docId,
      rawDate: txn.date,
      rawDescription: txn.description,
      rawAmount: txn.amount,
      normalizedDate: new Date(txn.date),
      normalizedDescription: txn.description,
      normalizedAmount: txn.amount,
      type: txn.type,
      categorySuggestion: txn.category ?? "",
      confidence: "0.9000",
      status: "parsed",
    })));
    res.json({
      merchant: null,
      amount: null,
      date: null,
      description: null,
      category: null,
      categoryId: null,
      uploadId: docId,
      transactionCount: smsResult.transactions.length,
    });
    return;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: "low",
            },
          },
          {
            type: "text",
            text: `You are a receipt data extractor. Extract the following from this receipt image and return ONLY a valid JSON object with no extra text:
{
  "merchant": "store name or null",
  "amount": "total amount as decimal string e.g. '12.50' or null",
  "date": "date in YYYY-MM-DD format or null",
  "description": "short description of what was purchased e.g. 'Groceries at Giant' or null",
  "category": "EXACTLY one of these category names verbatim, or null if none fit: ${categoryNamesText}"
}

Today's date is ${today}. If the date on the receipt is unclear, use today's date.
For "category", you MUST copy one of the listed names exactly (case-sensitive) — do not invent a new category, do not translate, do not abbreviate. If no listed category clearly fits, return null.
Only return the JSON object, no markdown, no explanation.`,
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  let parsed: Record<string, string | null> = {};
  try {
    const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = { merchant: null, amount: null, date: null, description: null, category: null };
  }

  // Resolve the AI-returned category name to the user's actual category id so
  // the frontend can pre-select it without a fuzzy-match round-trip.
  let categoryId: string | null = null;
  let categoryName: string | null = parsed.category ?? null;
  if (categoryName) {
    const lowered = categoryName.toLowerCase();
    // Exact, then case-insensitive only. Substring matching ("Health" ⊂
    // "Healthcare", "Bills" ⊂ "Bills and Utilities") is intentionally NOT
    // used — it could mis-route the saved transaction to the wrong envelope.
    const exact = userCategories.find((c) => c.name === categoryName);
    const ci = exact ?? userCategories.find((c) => c.name.toLowerCase() === lowered);
    if (ci) {
      categoryId = ci.id;
      categoryName = ci.name;
    } else {
      // AI hallucinated a name not in the user's list — drop it so the
      // expense form doesn't preselect a phantom category.
      categoryName = null;
    }
  }

  res.json({
    merchant: parsed.merchant ?? null,
    amount: parsed.amount ?? null,
    date: parsed.date ?? null,
    description: parsed.description ?? null,
    category: categoryName,
    categoryId,
  });
});

export default router;
