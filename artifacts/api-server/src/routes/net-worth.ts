import { Router, type IRouter } from "express";
import { eq, and, like, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, netWorthSnapshotsTable } from "@workspace/db";
import { UpsertNetWorthSnapshotBody, DeleteNetWorthSnapshotParams, ListNetWorthSnapshotsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const MONTH_RE = /^\d{4}-\d{2}$/;

const router: IRouter = Router();

function formatSnapshot(s: typeof netWorthSnapshotsTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    month: s.month,
    netWorth: s.netWorth,
    notes: s.notes ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/net-worth", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListNetWorthSnapshotsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const conditions = [eq(netWorthSnapshotsTable.userId, req.userId!)];
  if (qp.data.year) {
    conditions.push(like(netWorthSnapshotsTable.month, `${qp.data.year}-%`));
  }

  const snapshots = await db.select().from(netWorthSnapshotsTable)
    .where(and(...conditions))
    .orderBy(asc(netWorthSnapshotsTable.month));

  res.json(snapshots.map(formatSnapshot));
});

router.post("/net-worth", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpsertNetWorthSnapshotBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!MONTH_RE.test(parsed.data.month)) {
    res.status(400).json({ error: "month must be in YYYY-MM format" }); return;
  }

  const existing = await db.select().from(netWorthSnapshotsTable)
    .where(and(
      eq(netWorthSnapshotsTable.userId, req.userId!),
      eq(netWorthSnapshotsTable.month, parsed.data.month),
    )).limit(1);

  let snapshot;
  if (existing.length > 0) {
    const [updated] = await db.update(netWorthSnapshotsTable)
      .set({
        netWorth: parsed.data.netWorth,
        notes: parsed.data.notes ?? null,
      })
      .where(eq(netWorthSnapshotsTable.id, existing[0].id))
      .returning();
    snapshot = updated;
  } else {
    const [created] = await db.insert(netWorthSnapshotsTable).values({
      id: uuidv4(),
      userId: req.userId!,
      month: parsed.data.month,
      netWorth: parsed.data.netWorth,
      notes: parsed.data.notes ?? null,
    }).returning();
    snapshot = created;
  }

  res.json(formatSnapshot(snapshot));
});

router.delete("/net-worth/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteNetWorthSnapshotParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(netWorthSnapshotsTable)
    .where(and(eq(netWorthSnapshotsTable.id, params.data.id), eq(netWorthSnapshotsTable.userId, req.userId!)));
  res.sendStatus(204);
});

export default router;
