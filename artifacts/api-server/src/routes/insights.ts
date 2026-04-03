import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sum } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, insightsTable, transactionsTable, categoriesTable, debtsTable, profilesTable, commitmentsTable } from "@workspace/db";
import { GenerateInsightsBody, ListInsightsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

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

router.post("/insights/generate", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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
    if (debtRatio > 40) {
      newInsights.push({ id: uuidv4(), userId: req.userId!, month, title: "High Debt Load", message: `Your debt repayments are ${debtRatio.toFixed(1)}% of your income. Consider reducing debt to free up cash flow.`, severity: "warning" });
    } else if (debtRatio > 0) {
      newInsights.push({ id: uuidv4(), userId: req.userId!, month, title: "Debt-to-Income", message: `Your monthly debt payments are ${debtRatio.toFixed(1)}% of your income.`, severity: "info" });
    }

    const remaining = monthlyIncome - totalCommitments - totalSpent;
    if (remaining < 0) {
      newInsights.push({ id: uuidv4(), userId: req.userId!, month, title: "Overspent This Month", message: `You have overspent your income by BND ${Math.abs(remaining).toFixed(2)} this month.`, severity: "warning" });
    } else {
      newInsights.push({ id: uuidv4(), userId: req.userId!, month, title: "Remaining Budget", message: `You have BND ${remaining.toFixed(2)} remaining after commitments and spending this month.`, severity: remaining > monthlyIncome * 0.1 ? "success" : "info" });
    }
  }

  const catSpend: Record<string, number> = {};
  for (const txn of txns) {
    const key = txn.categoryId ?? "uncategorized";
    catSpend[key] = (catSpend[key] ?? 0) + parseFloat(txn.amount);
  }
  const topCatId = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];
  if (topCatId) {
    let catName = "Uncategorized";
    if (topCatId[0] !== "uncategorized") {
      const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, topCatId[0])).limit(1);
      catName = cat?.name ?? catName;
    }
    newInsights.push({ id: uuidv4(), userId: req.userId!, month, title: "Top Spending Category", message: `Your biggest spending category is ${catName} at BND ${topCatId[1].toFixed(2)}.`, severity: "info" });
  }

  if (newInsights.length > 0) {
    await db.insert(insightsTable).values(newInsights);
  }

  res.json(newInsights.map(i => ({ ...i, createdAt: new Date().toISOString() })));
});

export default router;
