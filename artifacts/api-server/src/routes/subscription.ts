import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userSubscriptionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { getSubscriptionStatus } from "../lib/access";

const router: IRouter = Router();

// The app is free — payment/checkout endpoints have been removed.
// This status endpoint is kept for API compatibility.
router.get("/subscription/current", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [sub] = await db.select().from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.userId, req.userId!)).limit(1);

  const { status, daysRemaining, trialEndsAt } = getSubscriptionStatus(user, sub ?? null);

  res.json({
    status,
    daysRemaining,
    trialEndsAt: trialEndsAt.toISOString(),
    subscription: sub ? {
      id: sub.id,
      planId: sub.planId,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate?.toISOString() ?? null,
      nextBillingDate: sub.nextBillingDate?.toISOString() ?? null,
    } : null,
  });
});

export default router;
