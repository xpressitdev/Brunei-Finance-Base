import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/onboarding/status", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    completed: user.onboardingCompleted,
    currentStep: user.onboardingCompleted ? null : 1,
  });
});

router.post("/onboarding/complete", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db.update(usersTable).set({ onboardingCompleted: true }).where(eq(usersTable.id, req.userId!));
  res.json({ completed: true, currentStep: null });
});

export default router;
