import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, feedbackTable } from "@workspace/db";

const router: IRouter = Router();

const VALID_CATEGORIES = ["bug", "feature", "general", "praise"] as const;

router.post("/feedback", async (req, res): Promise<void> => {
  const { category, message, rating, page, email } = req.body as {
    category: string;
    message: string;
    rating?: number | null;
    page?: string | null;
    email?: string | null;
  };

  if (!VALID_CATEGORIES.includes(category as any)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }

  if (!message || typeof message !== "string" || message.trim().length < 5) {
    res.status(400).json({ error: "Message must be at least 5 characters" });
    return;
  }

  if (rating != null && (typeof rating !== "number" || rating < 1 || rating > 5)) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  const userId = (req.session as any)?.userId ?? null;

  await db.insert(feedbackTable).values({
    id: uuidv4(),
    userId,
    category,
    message: message.trim(),
    rating: rating ?? null,
    page: page ?? null,
    email: email?.trim() || null,
  });

  res.status(201).json({ ok: true });
});

export default router;
