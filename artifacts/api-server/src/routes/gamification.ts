import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  userAchievementsTable,
  transactionsTable,
  debtsTable,
  monthlyBudgetsTable,
  uploadedDocumentsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

// ── Achievement definitions ───────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  {
    key: "first_setup",
    name: "First Setup",
    description: "Completed your account setup and onboarding",
    icon: "🚀",
    category: "milestone",
  },
  {
    key: "budget_starter",
    name: "Budget Starter",
    description: "Set up your first monthly budget",
    icon: "🎯",
    category: "milestone",
  },
  {
    key: "debt_aware",
    name: "Debt Aware",
    description: "Added your first loan or financing",
    icon: "💳",
    category: "milestone",
  },
  {
    key: "first_import",
    name: "First Import",
    description: "Imported a bank statement for the first time",
    icon: "📊",
    category: "milestone",
  },
  {
    key: "first_transaction",
    name: "First Transaction",
    description: "Logged your very first expense",
    icon: "✏️",
    category: "milestone",
  },
  {
    key: "habit_builder",
    name: "Habit Builder",
    description: "Logged at least 10 transactions in a single month",
    icon: "📝",
    category: "habit",
  },
  {
    key: "savings_builder",
    name: "Savings Builder",
    description: "Added a savings category to your budget",
    icon: "🏦",
    category: "habit",
  },
  {
    key: "smart_spender",
    name: "Smart Spender",
    description: "Stayed within budget for an entire month",
    icon: "✨",
    category: "habit",
  },
  {
    key: "debt_crusher",
    name: "Debt Crusher",
    description: "Tracked a loan for 3 or more months",
    icon: "💪",
    category: "habit",
  },
  {
    key: "statement_pro",
    name: "Statement Pro",
    description: "Imported 3 or more bank statements",
    icon: "🏅",
    category: "habit",
  },
];

// ── Monthly challenges (rotate by month) ──────────────────────────────────────

const MONTHLY_CHALLENGES = [
  {
    title: "Log 10 transactions",
    description: "Record at least 10 expenses or income entries this month.",
    unit: "transactions",
    target: 10,
  },
  {
    title: "Import your bank statement",
    description: "Upload your BIBD or Baiduri statement to automatically import transactions.",
    unit: "imports",
    target: 1,
  },
  {
    title: "Budget every category",
    description: "Set a monthly budget for at least 5 spending categories.",
    unit: "budgets",
    target: 5,
  },
  {
    title: "Track your debt",
    description: "Add all your active loans or financing to the Debts section.",
    unit: "debts",
    target: 1,
  },
];

// ── Helper: streak from transactions ─────────────────────────────────────────

async function calculateStreak(userId: string): Promise<{ current: number; longest: number }> {
  // Get distinct dates of transactions, ordered desc
  const rows = await db
    .selectDistinct({ date: sql<string>`DATE(${transactionsTable.date})` })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(sql`DATE(${transactionsTable.date}) DESC`);

  if (!rows.length) return { current: 0, longest: 0 };

  const dates = rows.map((r) => new Date(r.date as string));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = 0;
  let longest = 0;
  let streak = 0;

  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    d.setHours(0, 0, 0, 0);

    if (i === 0) {
      const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
      if (diff <= 1) {
        streak = 1;
      } else {
        break;
      }
    } else {
      const prev = new Date(dates[i - 1]);
      prev.setHours(0, 0, 0, 0);
      const diff = Math.round((prev.getTime() - d.getTime()) / 86400000);
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }
  }

  current = streak;

  // Also compute longest ever
  let runningStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const prev = new Date(dates[i - 1]);
    d.setHours(0, 0, 0, 0);
    prev.setHours(0, 0, 0, 0);
    const diff = Math.round((prev.getTime() - d.getTime()) / 86400000);
    if (diff === 1) {
      runningStreak++;
    } else {
      longest = Math.max(longest, runningStreak);
      runningStreak = 1;
    }
  }
  longest = Math.max(longest, runningStreak, current);

  return { current, longest };
}

// ── Helper: check which achievements should be unlocked ───────────────────────

async function checkEligibleAchievements(userId: string): Promise<string[]> {
  const eligible: string[] = [];

  // first_setup: user has completed onboarding
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.onboardingCompleted) eligible.push("first_setup");

  // first_transaction
  const [txCount] = await db
    .select({ n: count() })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));
  if ((txCount?.n ?? 0) > 0) eligible.push("first_transaction");

  // habit_builder: 10+ transactions in any calendar month
  const monthRows = await db
    .select({ n: count(), month: sql<string>`TO_CHAR(${transactionsTable.date}, 'YYYY-MM')` })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .groupBy(sql`TO_CHAR(${transactionsTable.date}, 'YYYY-MM')`);
  if (monthRows.some((r) => (r.n ?? 0) >= 10)) eligible.push("habit_builder");

  // first_import
  const [importCount] = await db
    .select({ n: count() })
    .from(uploadedDocumentsTable)
    .where(eq(uploadedDocumentsTable.userId, userId));
  if ((importCount?.n ?? 0) >= 1) eligible.push("first_import");
  if ((importCount?.n ?? 0) >= 3) eligible.push("statement_pro");

  // budget_starter
  const [budgetCount] = await db
    .select({ n: count() })
    .from(monthlyBudgetsTable)
    .where(eq(monthlyBudgetsTable.userId, userId));
  if ((budgetCount?.n ?? 0) > 0) eligible.push("budget_starter");

  // savings_builder: has a savings budget
  const savingsBudgets = await db.execute(
    sql`SELECT COUNT(*) as n FROM monthly_budgets mb
        JOIN categories c ON c.id = mb.category_id
        WHERE mb.user_id = ${userId} AND c.kind = 'savings'`
  );
  const savingsCount = Number((savingsBudgets.rows[0] as any)?.n ?? 0);
  if (savingsCount > 0) eligible.push("savings_builder");

  // debt_aware
  const [debtCount] = await db
    .select({ n: count() })
    .from(debtsTable)
    .where(eq(debtsTable.userId, userId));
  if ((debtCount?.n ?? 0) > 0) eligible.push("debt_aware");

  return eligible;
}

// ── GET /gamification/summary ─────────────────────────────────────────────────

router.get("/gamification/summary", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.userId!;

  // Earned achievements
  const earned = await db
    .select()
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, userId));

  const earnedKeys = new Set(earned.map((e) => e.achievementKey));

  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: earnedKeys.has(a.key),
    unlockedAt: earned.find((e) => e.achievementKey === a.key)?.unlockedAt?.toISOString() ?? null,
  }));

  // Streak
  const streak = await calculateStreak(userId);

  // Monthly challenge: pick based on current month index
  const monthIdx = new Date().getMonth() % MONTHLY_CHALLENGES.length;
  const challengeDef = MONTHLY_CHALLENGES[monthIdx];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthStart = new Date(`${currentMonth}-01`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  let challengeProgress = 0;
  if (challengeDef.unit === "transactions") {
    const [row] = await db
      .select({ n: count() })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          gte(transactionsTable.date, monthStart),
          lte(transactionsTable.date, monthEnd)
        )
      );
    challengeProgress = Number(row?.n ?? 0);
  } else if (challengeDef.unit === "imports") {
    const [row] = await db
      .select({ n: count() })
      .from(uploadedDocumentsTable)
      .where(eq(uploadedDocumentsTable.userId, userId));
    challengeProgress = Math.min(Number(row?.n ?? 0), challengeDef.target);
  } else if (challengeDef.unit === "budgets") {
    const [row] = await db
      .select({ n: count() })
      .from(monthlyBudgetsTable)
      .where(
        and(
          eq(monthlyBudgetsTable.userId, userId),
          eq(monthlyBudgetsTable.month, currentMonth)
        )
      );
    challengeProgress = Number(row?.n ?? 0);
  } else if (challengeDef.unit === "debts") {
    const [row] = await db
      .select({ n: count() })
      .from(debtsTable)
      .where(eq(debtsTable.userId, userId));
    challengeProgress = Number(row?.n ?? 0);
  }

  res.json({
    streak,
    achievements,
    monthlyChallenge: {
      ...challengeDef,
      progress: Math.min(challengeProgress, challengeDef.target),
    },
    totalUnlocked: earned.length,
    totalAvailable: ACHIEVEMENTS.length,
  });
});

// ── POST /gamification/achievements/check ─────────────────────────────────────

router.post("/gamification/achievements/check", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.userId!;

  const eligible = await checkEligibleAchievements(userId);

  const existing = await db
    .select()
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, userId));
  const existingKeys = new Set(existing.map((e) => e.achievementKey));

  const toUnlock = eligible.filter((k) => !existingKeys.has(k));
  const newlyUnlocked: string[] = [];

  for (const key of toUnlock) {
    try {
      await db.insert(userAchievementsTable).values({
        id: uuidv4(),
        userId,
        achievementKey: key,
      });
      newlyUnlocked.push(key);
    } catch {
      // already exists (race condition) — ignore
    }
  }

  res.json({ newlyUnlocked, total: eligible.length });
});

export default router;
