import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatProfile(profile: typeof profilesTable.$inferSelect) {
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    currency: profile.currency,
    locale: profile.locale ?? null,
    payday: profile.payday,
    monthlyIncome: profile.monthlyIncome,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

router.get("/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, req.userId!)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(formatProfile(profile));
});

router.put("/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.fullName != null) updateData.fullName = parsed.data.fullName;
  if (parsed.data.payday != null) updateData.payday = parsed.data.payday;
  if (parsed.data.monthlyIncome != null) updateData.monthlyIncome = parsed.data.monthlyIncome;
  if (parsed.data.currency != null) updateData.currency = parsed.data.currency;
  if (parsed.data.locale !== undefined) updateData.locale = parsed.data.locale;

  const [updated] = await db.update(profilesTable).set(updateData).where(eq(profilesTable.userId, req.userId!)).returning();
  if (!updated) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(formatProfile(updated));
});

export default router;
