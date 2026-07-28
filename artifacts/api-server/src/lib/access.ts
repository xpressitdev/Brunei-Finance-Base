import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";

// DuitPlan is free for all users — there is no trial period or paid gating.
// The response shape is kept for API compatibility.
export function getSubscriptionStatus(
  user: { createdAt: Date },
  _sub: { status: string; endDate: Date | null } | null
) {
  const trialEndsAt = new Date(user.createdAt.getTime());
  return { status: "active" as const, daysRemaining: null, trialEndsAt };
}

// Free app: only authentication is required, no subscription check.
export async function requireAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
