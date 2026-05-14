import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  profilesTable,
  accountsTable,
  transactionsTable,
  monthlyBudgetsTable,
  commitmentsTable,
  goalsTable,
  debtsTable,
  insightsTable,
  paydayPromptsTable,
  userAchievementsTable,
  feedbackTable,
  netWorthSnapshotsTable,
  assetEntriesTable,
  uploadedDocumentsTable,
  agentConversations,
} from "@workspace/db";
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

// Salary bounds shared with the client. Anything <= 0 is invalid (negative or
// missing income breaks every downstream calc), and we cap at BND 1,000,000 to
// stop fat-finger inputs producing display-breaking numbers.
const MIN_MONTHLY_INCOME = 0.01;
const MAX_MONTHLY_INCOME = 1_000_000;

router.put("/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.monthlyIncome != null) {
    const n = Number(parsed.data.monthlyIncome);
    if (!Number.isFinite(n) || n < MIN_MONTHLY_INCOME || n > MAX_MONTHLY_INCOME) {
      res.status(400).json({
        error: `Monthly income must be between ${MIN_MONTHLY_INCOME} and ${MAX_MONTHLY_INCOME.toLocaleString()}.`,
        code: "INVALID_MONTHLY_INCOME",
      });
      return;
    }
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

router.post("/profile/reset-data", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const deleted: Record<string, number> = {};

  await db.transaction(async (tx) => {
    // Delete in dependency order. Tables with FKs that don't cascade need to go first.
    const wipes = [
      ["transactions", transactionsTable] as const,
      ["uploadedDocuments", uploadedDocumentsTable] as const, // cascades to importedTransactionRows
      ["budgets", monthlyBudgetsTable] as const,
      ["commitments", commitmentsTable] as const,
      ["goals", goalsTable] as const,
      ["debts", debtsTable] as const, // cascades to debtScenarios
      ["insights", insightsTable] as const,
      ["paydayPrompts", paydayPromptsTable] as const,
      ["achievements", userAchievementsTable] as const,
      ["feedback", feedbackTable] as const,
      ["assets", assetEntriesTable] as const,
      ["netWorthSnapshots", netWorthSnapshotsTable] as const,
      ["accounts", accountsTable] as const,
      ["agentConversations", agentConversations] as const, // cascades to agentMessages
    ];

    for (const [label, table] of wipes) {
      const result = await tx.delete(table).where(eq(table.userId, userId)).returning({ id: table.id });
      deleted[label] = result.length;
    }
  });

  req.log.info({ userId, deleted }, "User data reset complete");
  res.json({ ok: true, deleted });
});

export default router;
