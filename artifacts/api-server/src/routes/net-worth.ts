import { Router, type IRouter } from "express";
import { eq, and, like, asc } from "drizzle-orm";
import { db, netWorthSnapshotsTable } from "@workspace/db";
import { ListNetWorthSnapshotsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

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

export default router;
