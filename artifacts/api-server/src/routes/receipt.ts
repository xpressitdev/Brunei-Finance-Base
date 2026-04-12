import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/receipt/scan", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: "imageBase64 and mimeType are required" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

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
  "category": "one of: food, transport, shopping, utilities, healthcare, entertainment, education, or other"
}

Today's date is ${today}. If the date on the receipt is unclear, use today's date.
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

  res.json({
    merchant: parsed.merchant ?? null,
    amount: parsed.amount ?? null,
    date: parsed.date ?? null,
    description: parsed.description ?? null,
    category: parsed.category ?? null,
  });
});

export default router;
