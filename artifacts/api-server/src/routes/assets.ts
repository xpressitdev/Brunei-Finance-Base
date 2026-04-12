import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, assetEntriesTable } from "@workspace/db";
import { CreateAssetBody, UpdateAssetBody, ListAssetsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const MONTH_RE = /^\d{4}-\d{2}$/;

const router: IRouter = Router();

function formatAsset(a: typeof assetEntriesTable.$inferSelect) {
  return {
    id: a.id,
    userId: a.userId,
    category: a.category,
    name: a.name,
    value: a.value,
    month: a.month,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

router.get("/assets", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListAssetsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const conditions = [eq(assetEntriesTable.userId, req.userId!)];
  if (qp.data.month) {
    if (!MONTH_RE.test(qp.data.month)) {
      res.status(400).json({ error: "month must be in YYYY-MM format" }); return;
    }
    conditions.push(eq(assetEntriesTable.month, qp.data.month));
  }

  const entries = await db.select().from(assetEntriesTable).where(and(...conditions));
  res.json(entries.map(formatAsset));
});

router.post("/assets", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateAssetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!MONTH_RE.test(parsed.data.month)) {
    res.status(400).json({ error: "month must be in YYYY-MM format" }); return;
  }

  const numericValue = parseFloat(parsed.data.value);
  if (isNaN(numericValue) || numericValue < 0) {
    res.status(400).json({ error: "value must be a non-negative number" }); return;
  }

  const [entry] = await db.insert(assetEntriesTable).values({
    id: uuidv4(),
    userId: req.userId!,
    category: parsed.data.category,
    name: parsed.data.name,
    value: parsed.data.value,
    month: parsed.data.month,
  }).returning();

  res.status(201).json(formatAsset(entry));
});

router.patch("/assets/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpdateAssetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { id } = req.params;
  const updates: Partial<typeof assetEntriesTable.$inferInsert> = {};
  if (parsed.data.category != null) updates.category = parsed.data.category;
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.value != null) {
    const numericValue = parseFloat(parsed.data.value);
    if (isNaN(numericValue) || numericValue < 0) {
      res.status(400).json({ error: "value must be a non-negative number" }); return;
    }
    updates.value = parsed.data.value;
  }
  if (parsed.data.month != null) {
    if (!MONTH_RE.test(parsed.data.month)) {
      res.status(400).json({ error: "month must be in YYYY-MM format" }); return;
    }
    updates.month = parsed.data.month;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" }); return;
  }

  const [updated] = await db.update(assetEntriesTable)
    .set(updates)
    .where(and(eq(assetEntriesTable.id, id), eq(assetEntriesTable.userId, req.userId!)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Asset not found" }); return; }
  res.json(formatAsset(updated));
});

router.delete("/assets/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  await db.delete(assetEntriesTable)
    .where(and(eq(assetEntriesTable.id, id), eq(assetEntriesTable.userId, req.userId!)));
  res.sendStatus(204);
});

export default router;
