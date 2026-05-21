import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, assetEntriesTable } from "@workspace/db";
import { CreateAssetBody, UpdateAssetBody, ListAssetsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const MONTH_RE = /^\d{4}-\d{2}$/;
const ASSET_CATEGORIES_SET = new Set(["Savings", "Property", "Vehicle", "Investment", "Business", "Other"]);

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

// --- Grid editor endpoints ---

// GET /assets/matrix?months=12
// Returns the grid view: distinct (name, category) rows × the last N months of explicit entries.
// Cells with no explicit entry are omitted; the client carries forward the latest prior value.
router.get("/assets/matrix", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const monthsParam = Math.min(Math.max(parseInt(String(req.query.months ?? "12"), 10) || 12, 1), 60);
  const endMonth = currentMonth();
  const startMonth = shiftMonth(endMonth, -(monthsParam - 1));

  // Window months for the grid columns (ascending oldest → newest).
  const months: string[] = [];
  for (let i = 0; i < monthsParam; i++) months.push(shiftMonth(startMonth, i));

  // Distinct (name, category) rows the user has ever recorded.
  const rowsRes = await db.execute(sql`
    SELECT DISTINCT name, category
    FROM asset_entries
    WHERE user_id = ${req.userId}
    ORDER BY category, name
  `);
  const rowKeys = (rowsRes.rows as Array<{ name: string; category: string }>);

  // All explicit entries within the visible window.
  const winRes = await db.execute(sql`
    SELECT id, name, category, month, value
    FROM asset_entries
    WHERE user_id = ${req.userId} AND month >= ${startMonth} AND month <= ${endMonth}
    ORDER BY name, category, month ASC, updated_at ASC, id ASC
  `);
  type Row = { id: string; name: string; category: string; month: string; value: string };
  const winRows = winRes.rows as Row[];

  // Build cell map keyed by `${name}|${category}|${month}`. When multiple entries exist in the
  // same cell (race condition / pre-grid history), keep the latest (last in our ASC ordering).
  const cellMap = new Map<string, { id: string; value: string }>();
  for (const r of winRows) {
    cellMap.set(`${r.name}|${r.category}|${r.month}`, { id: r.id, value: r.value });
  }

  // Latest entry strictly before the window (for carry-forward seed) per (name, category).
  const seedRes = await db.execute(sql`
    SELECT DISTINCT ON (name, category) name, category, value, month
    FROM asset_entries
    WHERE user_id = ${req.userId} AND month < ${startMonth}
    ORDER BY name, category, month DESC, updated_at DESC, id DESC
  `);
  const seedMap = new Map<string, { value: string; month: string }>();
  for (const r of seedRes.rows as Array<{ name: string; category: string; value: string; month: string }>) {
    seedMap.set(`${r.name}|${r.category}`, { value: r.value, month: r.month });
  }

  const rows = rowKeys.map((rk) => {
    const entries: Record<string, { id: string; value: string }> = {};
    for (const m of months) {
      const cell = cellMap.get(`${rk.name}|${rk.category}|${m}`);
      if (cell) entries[m] = cell;
    }
    const seed = seedMap.get(`${rk.name}|${rk.category}`);
    return {
      name: rk.name,
      category: rk.category,
      entries,
      ...(seed ? { seedValue: seed.value, seedMonth: seed.month } : {}),
    };
  });

  res.json({ months, rows });
});

// PUT /assets/cell — upsert by (user, name, category, month).
router.put("/assets/cell", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = req.body as { name?: unknown; category?: unknown; month?: unknown; value?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const month = typeof body.month === "string" ? body.month : "";
  const value = typeof body.value === "string" ? body.value : "";

  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (!ASSET_CATEGORIES_SET.has(category)) { res.status(400).json({ error: "invalid category" }); return; }
  if (!MONTH_RE.test(month)) { res.status(400).json({ error: "month must be YYYY-MM" }); return; }
  const num = parseFloat(value);
  if (!isFinite(num) || num < 0) { res.status(400).json({ error: "value must be a non-negative number" }); return; }

  // Atomic upsert backed by the (user_id, name, category, month) unique constraint.
  // ON CONFLICT updates the existing cell deterministically; no race window for double-inserts.
  const result = await db.insert(assetEntriesTable)
    .values({
      id: uuidv4(),
      userId: req.userId!,
      category: category as never,
      name,
      value,
      month,
    })
    .onConflictDoUpdate({
      target: [assetEntriesTable.userId, assetEntriesTable.name, assetEntriesTable.category, assetEntriesTable.month],
      set: { value, updatedAt: new Date() },
    })
    .returning();
  const row = result[0];
  // Heuristic: if createdAt === updatedAt (same ms), treat as freshly created → 201; else 200.
  const isNew = row.createdAt.getTime() === row.updatedAt.getTime();
  res.status(isNew ? 201 : 200).json(formatAsset(row));
});

// DELETE /assets/cell?name=&category=&month= — remove the explicit entry at that cell so it
// reverts to carry-forward inheritance.
router.delete("/assets/cell", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const name = typeof req.query.name === "string" ? req.query.name : "";
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const month = typeof req.query.month === "string" ? req.query.month : "";

  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (!ASSET_CATEGORIES_SET.has(category)) { res.status(400).json({ error: "invalid category" }); return; }
  if (!MONTH_RE.test(month)) { res.status(400).json({ error: "month must be YYYY-MM" }); return; }

  await db.delete(assetEntriesTable).where(and(
    eq(assetEntriesTable.userId, req.userId!),
    eq(assetEntriesTable.name, name),
    eq(assetEntriesTable.category, category as never),
    eq(assetEntriesTable.month, month),
  ));
  res.sendStatus(204);
});

export default router;
