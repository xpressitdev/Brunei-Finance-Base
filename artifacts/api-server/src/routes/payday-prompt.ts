import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  paydayPromptsTable,
  profilesTable,
  debtsTable,
  transactionsTable,
  accountsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { requireAccess } from "../lib/access";

const router: IRouter = Router();

/** Returns the effective payday for a given year/month, clamped to the last day of that month. */
function effectivePayday(payday: number, year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
  return Math.min(payday, lastDay);
}

/** Returns { year, month, day } in the server's local timezone. */
function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * GET /api/payday-prompt/current
 * Returns the active payday prompt for the current user, or null if no banner should show.
 */
router.get("/payday-prompt/current", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!profile || !profile.payday || parseFloat(profile.monthlyIncome) <= 0) {
    res.json(null);
    return;
  }

  const { year, month, day } = todayParts();
  const effectivePd = effectivePayday(profile.payday, year, month);

  if (day < effectivePd) {
    res.json(null);
    return;
  }

  // Find or create the prompt for this month
  let [prompt] = await db
    .select()
    .from(paydayPromptsTable)
    .where(and(eq(paydayPromptsTable.userId, userId), eq(paydayPromptsTable.year, year), eq(paydayPromptsTable.month, month)))
    .limit(1);

  if (!prompt) {
    const [created] = await db.insert(paydayPromptsTable).values({
      id: uuidv4(),
      userId,
      year,
      month,
      state: "pending",
    }).returning();
    prompt = created;
  }

  if (prompt.state === "confirmed" || prompt.state === "skipped") {
    res.json(null);
    return;
  }

  if (prompt.state === "remind_tomorrow" && prompt.remindAfterDate) {
    const remindAfter = new Date(prompt.remindAfterDate);
    const today = new Date(year, month - 1, day);
    if (today <= remindAfter) {
      res.json(null);
      return;
    }
    // Revert to pending
    await db.update(paydayPromptsTable)
      .set({ state: "pending", remindAfterDate: null })
      .where(eq(paydayPromptsTable.id, prompt.id));
    prompt = { ...prompt, state: "pending", remindAfterDate: null };
  }

  // Fetch active debts
  const debts = await db
    .select()
    .from(debtsTable)
    .where(eq(debtsTable.userId, userId));

  const activeDebts = debts.filter(d => parseFloat(d.monthlyPayment) > 0);

  res.json({
    id: prompt.id,
    state: prompt.state,
    year: prompt.year,
    month: prompt.month,
    payday: profile.payday,
    monthlyIncome: profile.monthlyIncome,
    debts: activeDebts,
  });
});

/**
 * POST /api/payday-prompt/:id/confirm
 * Creates all provided transactions and marks the prompt as confirmed.
 */
interface ConfirmTxn {
  type: "credit" | "debit";
  amount: string;
  accountId?: string | null;
  description: string;
  date: string;
  notes?: string | null;
}

router.post("/payday-prompt/:id/confirm", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const promptId = req.params.id;

  const [prompt] = await db.select().from(paydayPromptsTable)
    .where(and(eq(paydayPromptsTable.id, promptId), eq(paydayPromptsTable.userId, userId)))
    .limit(1);

  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }
  if (prompt.state === "confirmed") { res.status(409).json({ error: "Already confirmed" }); return; }

  const { transactions } = req.body as { transactions: ConfirmTxn[] };
  if (!Array.isArray(transactions)) { res.status(400).json({ error: "transactions must be an array" }); return; }

  await db.transaction(async (tx) => {
    for (const t of transactions) {
      const [inserted] = await tx.insert(transactionsTable).values({
        id: uuidv4(),
        userId,
        date: new Date(t.date),
        amount: t.amount,
        type: t.type,
        description: t.description,
        accountId: t.accountId ?? null,
        notes: t.notes ?? null,
        source: "payday_prompt",
      }).returning();

      if (inserted.accountId) {
        const balanceDelta = inserted.type === "credit"
          ? sql`${accountsTable.balance} + ${inserted.amount}::numeric`
          : sql`${accountsTable.balance} - ${inserted.amount}::numeric`;
        await tx.update(accountsTable)
          .set({ balance: balanceDelta })
          .where(and(eq(accountsTable.id, inserted.accountId), eq(accountsTable.userId, userId)));
      }
    }

    await tx.update(paydayPromptsTable)
      .set({ state: "confirmed", confirmedAt: new Date() })
      .where(eq(paydayPromptsTable.id, promptId));
  });

  res.json({ ok: true });
});

/**
 * POST /api/payday-prompt/:id/skip
 * Skips the payday prompt for this month.
 */
router.post("/payday-prompt/:id/skip", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const promptId = req.params.id;

  const [prompt] = await db.select().from(paydayPromptsTable)
    .where(and(eq(paydayPromptsTable.id, promptId), eq(paydayPromptsTable.userId, userId)))
    .limit(1);

  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  await db.update(paydayPromptsTable).set({ state: "skipped" }).where(eq(paydayPromptsTable.id, promptId));
  res.json({ ok: true });
});

/**
 * POST /api/payday-prompt/:id/remind-tomorrow
 * Hides the banner until tomorrow.
 */
router.post("/payday-prompt/:id/remind-tomorrow", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const promptId = req.params.id;

  const [prompt] = await db.select().from(paydayPromptsTable)
    .where(and(eq(paydayPromptsTable.id, promptId), eq(paydayPromptsTable.userId, userId)))
    .limit(1);

  if (!prompt) { res.status(404).json({ error: "Prompt not found" }); return; }

  const { year, month, day } = todayParts();
  const todayDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  await db.update(paydayPromptsTable)
    .set({ state: "remind_tomorrow", remindAfterDate: todayDateStr })
    .where(eq(paydayPromptsTable.id, promptId));

  res.json({ ok: true });
});

export default router;
