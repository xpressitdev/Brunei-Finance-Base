import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  insightsTable,
  transactionsTable,
  categoriesTable,
  debtsTable,
  profilesTable,
  commitmentsTable,
  monthlyBudgetsTable,
} from "@workspace/db";
import { GenerateInsightsBody, ListInsightsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { requireAccess } from "../lib/access";

const router: IRouter = Router();

function safeDiv(num: number, denom: number): number | null {
  if (!denom || !isFinite(denom)) return null;
  const result = num / denom;
  return isFinite(result) ? result : null;
}

function normalizeMerchant(m: string | null): string {
  if (!m) return "";
  return m.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
}

router.get("/insights/computed", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListInsightsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const { month } = qp.data;
  const [year, mo] = month.split("-").map(Number);
  const userId = req.userId!;

  const thisMonthStart = new Date(year, mo - 1, 1);
  const thisMonthEnd   = new Date(year, mo,     1);
  const lastMonthStart = new Date(year, mo - 2, 1);
  const lastMonthEnd   = new Date(year, mo - 1, 1);
  const threeMonthsAgoStart = new Date(year, mo - 4, 1);

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  const monthlyIncome = profile ? parseFloat(profile.monthlyIncome) : 0;

  const allRecentTxns = await db.select().from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, userId),
      gte(transactionsTable.date, threeMonthsAgoStart),
      lte(transactionsTable.date, thisMonthEnd),
    ));

  const thisTxns = allRecentTxns.filter(t => t.date >= thisMonthStart && t.date < thisMonthEnd);
  const lastTxns = allRecentTxns.filter(t => t.date >= lastMonthStart && t.date < lastMonthEnd);
  const histTxns = allRecentTxns.filter(t => t.date >= threeMonthsAgoStart && t.date < lastMonthEnd);

  const thisDebits  = thisTxns.filter(t => t.type === "debit");
  const thisCredits = thisTxns.filter(t => t.type === "credit");
  const lastDebits  = lastTxns.filter(t => t.type === "debit");

  const thisSpent  = thisDebits.reduce((s, t) => s + parseFloat(t.amount), 0);
  const lastSpent  = lastDebits.reduce((s, t) => s + parseFloat(t.amount), 0);
  const creditIncome = thisCredits.reduce((s, t) => s + parseFloat(t.amount), 0);

  const hasLastMonthData = lastTxns.length > 0;
  const hasHistData = histTxns.length > 0;

  const totalIncome = monthlyIncome + creditIncome;

  // ── 1. Spending Trend ──────────────────────────────────────────────────
  const spendChangePct = hasLastMonthData && lastSpent > 0
    ? ((thisSpent - lastSpent) / lastSpent) * 100
    : null;
  const spendingTrend = {
    thisMonth: Math.round(thisSpent * 100) / 100,
    lastMonth: hasLastMonthData ? Math.round(lastSpent * 100) / 100 : null,
    changePct: spendChangePct !== null ? Math.round(spendChangePct * 10) / 10 : null,
    hasData: hasLastMonthData,
  };

  // ── 2. Category Anomalies ─────────────────────────────────────────────
  const thisByCategory: Record<string, number> = {};
  for (const t of thisDebits) {
    const k = t.categoryId ?? "__none__";
    thisByCategory[k] = (thisByCategory[k] ?? 0) + parseFloat(t.amount);
  }

  const histByCategory: Record<string, { total: number; months: Set<string> }> = {};
  for (const t of histTxns.filter(x => x.type === "debit")) {
    const k = t.categoryId ?? "__none__";
    const mKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    if (!histByCategory[k]) histByCategory[k] = { total: 0, months: new Set() };
    histByCategory[k].total += parseFloat(t.amount);
    histByCategory[k].months.add(mKey);
  }

  const catNames: Record<string, string> = {};
  const catIdsToFetch = [
    ...new Set([...Object.keys(thisByCategory), ...Object.keys(histByCategory)])
  ].filter(id => id !== "__none__" && id !== "uncategorized");
  if (catIdsToFetch.length > 0) {
    const cats = await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable);
    for (const c of cats) catNames[c.id] = c.name;
  }

  const anomalies: Array<{ categoryId: string; categoryName: string; thisMonth: number; avg3m: number; pctOver: number }> = [];
  for (const [catId, thisAmt] of Object.entries(thisByCategory)) {
    const hist = histByCategory[catId];
    if (!hist || hist.months.size === 0) continue;
    const avg3m = hist.total / 3;
    if (avg3m <= 0) continue;
    const pctOver = ((thisAmt - avg3m) / avg3m) * 100;
    if (pctOver >= 25) {
      anomalies.push({
        categoryId: catId,
        categoryName: catId === "__none__" ? "Uncategorized" : (catNames[catId] ?? "Unknown"),
        thisMonth: Math.round(thisAmt * 100) / 100,
        avg3m: Math.round(avg3m * 100) / 100,
        pctOver: Math.round(pctOver * 10) / 10,
      });
    }
  }
  anomalies.sort((a, b) => b.pctOver - a.pctOver);

  // ── 3. Subscription Creep ─────────────────────────────────────────────
  const merchantMonths: Record<string, Map<string, number[]>> = {};
  for (const t of allRecentTxns.filter(x => x.type === "debit" && x.merchant)) {
    const key = normalizeMerchant(t.merchant);
    if (!key) continue;
    const mKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    if (!merchantMonths[key]) merchantMonths[key] = new Map();
    const existing = merchantMonths[key].get(mKey) ?? [];
    existing.push(parseFloat(t.amount));
    merchantMonths[key].set(mKey, existing);
  }

  const thisMonthKey = month;
  const subscriptions: Array<{ merchant: string; amount: number }> = [];
  for (const [key, byMonth] of Object.entries(merchantMonths)) {
    if (!byMonth.has(thisMonthKey)) continue;
    const monthsPresent = byMonth.size;
    if (monthsPresent < 2) continue;
    const thisAmts = byMonth.get(thisMonthKey)!;
    const thisAvg = thisAmts.reduce((s, a) => s + a, 0) / thisAmts.length;
    let consistentCount = 0;
    for (const [mk, amts] of byMonth) {
      if (mk === thisMonthKey) continue;
      const avg = amts.reduce((s, a) => s + a, 0) / amts.length;
      if (Math.abs(avg - thisAvg) / Math.max(thisAvg, 1) <= 0.2) consistentCount++;
    }
    if (consistentCount >= 1) {
      const rawMerchant = allRecentTxns.find(t => normalizeMerchant(t.merchant) === key)?.merchant ?? key;
      subscriptions.push({ merchant: rawMerchant, amount: Math.round(thisAvg * 100) / 100 });
    }
  }
  const subscriptionTotal = subscriptions.reduce((s, x) => s + x.amount, 0);

  // ── 4. Savings Rate ───────────────────────────────────────────────────
  const savingsRate = totalIncome > 0
    ? Math.round(((totalIncome - thisSpent) / totalIncome) * 1000) / 10
    : null;

  // ── 5. Debt-to-Income ─────────────────────────────────────────────────
  const debts = await db.select().from(debtsTable).where(eq(debtsTable.userId, userId));
  const totalDebtPayment = debts.reduce((s, d) => s + parseFloat(d.monthlyPayment), 0);
  const dtiRatio = monthlyIncome > 0 ? Math.round((totalDebtPayment / monthlyIncome) * 1000) / 10 : null;

  // ── 6. Budget Adherence ───────────────────────────────────────────────
  const budgets = await db.select().from(monthlyBudgetsTable)
    .where(and(eq(monthlyBudgetsTable.userId, userId), eq(monthlyBudgetsTable.month, month)));
  const budgetTotal = budgets.length;
  const budgetOnTrack = budgets.filter(b => parseFloat(b.actualAmount) <= parseFloat(b.plannedAmount)).length;

  res.json({
    month,
    spendingTrend,
    categoryAnomalies: anomalies,
    subscriptions: {
      items: subscriptions,
      total: Math.round(subscriptionTotal * 100) / 100,
    },
    savingsRate: {
      income: Math.round(totalIncome * 100) / 100,
      spent: Math.round(thisSpent * 100) / 100,
      rate: savingsRate,
    },
    dti: {
      ratio: dtiRatio,
      monthlyPayment: Math.round(totalDebtPayment * 100) / 100,
      income: Math.round(monthlyIncome * 100) / 100,
    },
    budgetAdherence: {
      total: budgetTotal,
      onTrack: budgetOnTrack,
      overBudget: budgetTotal - budgetOnTrack,
      pct: budgetTotal > 0 ? Math.round((budgetOnTrack / budgetTotal) * 100) : null,
    },
  });
});

router.get("/insights", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListInsightsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const items = await db.select().from(insightsTable)
    .where(and(eq(insightsTable.userId, req.userId!), eq(insightsTable.month, qp.data.month)));

  res.json(items.map(i => ({
    id: i.id,
    userId: i.userId,
    month: i.month,
    title: i.title,
    message: i.message,
    severity: i.severity,
    createdAt: i.createdAt.toISOString(),
  })));
});

router.post("/insights/generate", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = GenerateInsightsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { month } = parsed.data;
  const [year, mo] = month.split("-").map(Number);
  const start = new Date(year, mo - 1, 1);
  const end = new Date(year, mo, 1);

  await db.delete(insightsTable).where(and(eq(insightsTable.userId, req.userId!), eq(insightsTable.month, month)));

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, req.userId!)).limit(1);
  const monthlyIncome = profile ? parseFloat(profile.monthlyIncome) : 0;

  const txns = await db.select().from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, req.userId!),
      eq(transactionsTable.type, "debit"),
      gte(transactionsTable.date, start),
      lte(transactionsTable.date, end),
    ));

  const totalSpent = txns.reduce((s, t) => s + parseFloat(t.amount), 0);
  const debts = await db.select().from(debtsTable).where(eq(debtsTable.userId, req.userId!));
  const totalDebtPayment = debts.reduce((s, d) => s + parseFloat(d.monthlyPayment), 0);
  const commitments = await db.select().from(commitmentsTable).where(eq(commitmentsTable.userId, req.userId!));
  const totalCommitments = commitments.reduce((s, c) => s + parseFloat(c.amount), 0);

  const newInsights: Array<{ id: string; userId: string; month: string; title: string; message: string; severity: string }> = [];

  if (monthlyIncome > 0) {
    const debtRatio = (totalDebtPayment / monthlyIncome) * 100;
    newInsights.push({
      id: uuidv4(), userId: req.userId!, month,
      title: debtRatio > 40 ? "High Debt Load" : "Debt-to-Income",
      message: debtRatio > 40
        ? `Your debt repayments are ${debtRatio.toFixed(1)}% of your income. Consider paying down high-interest debt first.`
        : `Your monthly debt payments are ${debtRatio.toFixed(1)}% of your income — within a manageable range.`,
      severity: debtRatio > 40 ? "warning" : "info",
    });

    const remaining = monthlyIncome - totalCommitments - totalSpent;
    newInsights.push({
      id: uuidv4(), userId: req.userId!, month,
      title: remaining < 0 ? "Overspent This Month" : "Cash Flow Summary",
      message: remaining < 0
        ? `You have overspent your income by BND ${Math.abs(remaining).toFixed(2)} this month. Review discretionary spending.`
        : `After commitments and spending, you have BND ${remaining.toFixed(2)} remaining this month.`,
      severity: remaining < 0 ? "warning" : remaining > monthlyIncome * 0.2 ? "success" : "info",
    });

    const savingsPct = ((monthlyIncome - totalSpent) / monthlyIncome) * 100;
    newInsights.push({
      id: uuidv4(), userId: req.userId!, month,
      title: "AI Savings Analysis",
      message: savingsPct >= 20
        ? `Great work — you're saving ${savingsPct.toFixed(1)}% of your income, above the 20% healthy benchmark.`
        : savingsPct > 0
        ? `You're saving ${savingsPct.toFixed(1)}% of income this month. Aim for 20%+ for long-term financial health.`
        : `Spending exceeds income this month. Focus on cutting non-essential expenses.`,
      severity: savingsPct >= 20 ? "success" : savingsPct > 0 ? "info" : "warning",
    });
  }

  const catSpend: Record<string, number> = {};
  for (const txn of txns) {
    const key = txn.categoryId ?? "uncategorized";
    catSpend[key] = (catSpend[key] ?? 0) + parseFloat(txn.amount);
  }
  const topCatEntry = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];
  if (topCatEntry) {
    let catName = "Uncategorized";
    if (topCatEntry[0] !== "uncategorized") {
      const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, topCatEntry[0])).limit(1);
      catName = cat?.name ?? catName;
    }
    newInsights.push({
      id: uuidv4(), userId: req.userId!, month,
      title: "Top Spending Category",
      message: `Your biggest spending category is ${catName} at BND ${topCatEntry[1].toFixed(2)}. Consider whether this aligns with your financial goals.`,
      severity: "info",
    });
  }

  if (newInsights.length > 0) {
    await db.insert(insightsTable).values(newInsights);
  }

  res.json(newInsights.map(i => ({ ...i, createdAt: new Date().toISOString() })));
});

export default router;
