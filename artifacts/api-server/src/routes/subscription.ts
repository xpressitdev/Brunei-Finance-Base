import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionPlansTable, userSubscriptionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/subscription/plans", requireAuth, async (_req, res): Promise<void> => {
  const plans = await db.select().from(subscriptionPlansTable);
  res.json(plans.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    billingInterval: p.billingInterval,
    features: p.features,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  })));
});

router.get("/subscription/current", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [sub] = await db.select().from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.userId, req.userId!)).limit(1);

  if (!sub) {
    res.status(404).json({ error: "No active subscription" });
    return;
  }

  const [plan] = await db.select().from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, sub.planId)).limit(1);

  res.json({
    id: sub.id,
    userId: sub.userId,
    planId: sub.planId,
    planName: plan?.name ?? "Unknown",
    status: sub.status,
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  });
});

export default router;
