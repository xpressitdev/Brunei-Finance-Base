import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userSubscriptionsTable } from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

export function getSubscriptionStatus(
  user: { createdAt: Date },
  sub: { status: string; endDate: Date | null } | null
) {
  const now = new Date();
  const trialEndsAt = new Date(user.createdAt.getTime() + 45 * 24 * 60 * 60 * 1000);

  if (sub && (sub.status === "active" || sub.status === "payment_failed")) {
    if (!sub.endDate || sub.endDate > now) {
      return { status: "active" as const, daysRemaining: null, trialEndsAt };
    }
    return { status: "expired" as const, daysRemaining: 0, trialEndsAt };
  }

  const msRemaining = trialEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  if (daysRemaining > 0) {
    return { status: "trial" as const, daysRemaining, trialEndsAt };
  }

  return { status: "expired" as const, daysRemaining: 0, trialEndsAt };
}

export async function requireAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [sub] = await db.select().from(userSubscriptionsTable).where(eq(userSubscriptionsTable.userId, userId)).limit(1);

  const { status } = getSubscriptionStatus(user, sub ?? null);

  if (status === "expired") {
    res.status(403).json({ error: "Trial expired. Please subscribe to continue.", code: "TRIAL_EXPIRED" });
    return;
  }

  next();
}
