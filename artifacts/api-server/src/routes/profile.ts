import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, req.userId!)).limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    currency: profile.currency,
    region: profile.region,
    locale: profile.locale,
    language: profile.language,
    payday: profile.payday,
    monthlyIncome: profile.monthlyIncome,
    migrationNoticeDismissed: profile.migrationNoticeDismissed ?? false,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  });
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
  if (parsed.data.region != null) updateData.region = parsed.data.region;
  if (parsed.data.locale != null) updateData.locale = parsed.data.locale;
  if (parsed.data.language != null) updateData.language = parsed.data.language;

  const [updated] = await db.update(profilesTable).set(updateData).where(eq(profilesTable.userId, req.userId!)).returning();
  if (!updated) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({
    id: updated.id,
    userId: updated.userId,
    fullName: updated.fullName,
    currency: updated.currency,
    region: updated.region,
    locale: updated.locale,
    language: updated.language,
    payday: updated.payday,
    monthlyIncome: updated.monthlyIncome,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.post("/profile/dismiss-migration-notice", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db.update(profilesTable).set({ migrationNoticeDismissed: true }).where(eq(profilesTable.userId, req.userId!));
  res.json({ ok: true });
});

export default router;
