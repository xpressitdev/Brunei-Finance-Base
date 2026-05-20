import { Router, type IRouter } from "express";
import { eq, and, lte, sql } from "drizzle-orm";
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

// Raw SQL results come back with snake_case column names from PostgreSQL
function formatRawAsset(a: Record<string, unknown>) {
  return {
    id: a.id as string,
    userId: a.user_id as string,
    category: a.category as string,
    name: a.name as string,
    value: a.value as string,
    month: a.month as string,
    createdAt: new Date(a.created_at as string).toISOString(),
    updatedAt: new Date(a.updated_at as string).toISOString(),
  };
}

router.get("/assets", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListAssetsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  if (qp.data.month) {
    // Carry-forward: for the given month, return the most recent entry for each
    // (name, category) pair that exists up to and including that month.
    // This makes assets persistent — once entered they remain visible in future months.
    if (!MONTH_RE.test(qp.data.month)) {
      res.status(400).json({ error: "month must be in YYYY-MM format" }); return;
    }
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (name, category) *
      FROM asset_entries
      WHERE user_id = ${req.userId} AND month <= ${qp.data.month}
      ORDER BY name, category, month DESC, updated_at DESC, id DESC
    `);
    res.json((rows.rows as Record<string, unknown>[]).map(formatRawAsset));
    return;
  }

  // No month filter — return all entries for this user
  const entries = await db.select().from(assetEntriesTable)
    .where(eq(assetEntriesTable.userId, req.userId!));
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
