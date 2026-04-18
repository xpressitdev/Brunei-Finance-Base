import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db, transactionsTable, commitmentsTable, debtsTable, profilesTable, categoriesTable, accountsTable } from "@workspace/db";
import { GetDashboardSummaryQueryParams, GetSpendingByCategoryQueryParams, GetRecentTransactionsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const { month } = qp.data;
  const [year, mo] = month.split("-").map(Number);
  const start = new Date(year, mo - 1, 1);
  const end = new Date(year, mo, 1);

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, req.userId!)).limit(1);
  const monthlyIncome = profile ? profile.monthlyIncome : "0";

  const commitments = await db.select().from(commitmentsTable).where(eq(commitmentsTable.userId, req.userId!));
  const totalCommitments = commitments.reduce((s, c) => s + parseFloat(c.amount), 0);

  const debitTxns = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, req.userId!),
    eq(transactionsTable.type, "debit"),
    gte(transactionsTable.date, start),
    lte(transactionsTable.date, end),
  ));

  const totalSpent = debitTxns.reduce((s, t) => s + parseFloat(t.amount), 0);

  const creditTxns = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, req.userId!),
    eq(transactionsTable.type, "credit"),
    gte(transactionsTable.date, start),
    lte(transactionsTable.date, end),
  ));

  const actualIncomeThisMonth = creditTxns.reduce((s, t) => s + parseFloat(t.amount), 0);

  const income = parseFloat(monthlyIncome);

  const debts = await db.select().from(debtsTable).where(eq(debtsTable.userId, req.userId!));
  const totalDebtPayment = debts.reduce((s, d) => s + parseFloat(d.monthlyPayment), 0);
  const debtToIncomeRatio = income > 0 ? (totalDebtPayment / income) * 100 : 0;

  const remaining = income - totalCommitments - totalSpent - totalDebtPayment;

  const allTxns = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, req.userId!),
    gte(transactionsTable.date, start),
    lte(transactionsTable.date, end),
  ));

  res.json({
    month,
    monthlyIncome,
    totalCommitments: totalCommitments.toFixed(2),
    totalSpent: totalSpent.toFixed(2),
    remaining: remaining.toFixed(2),
    totalDebtMonthlyPayment: totalDebtPayment.toFixed(2),
    totalDebtPayments: totalDebtPayment.toFixed(2),
    debtToIncomeRatio: debtToIncomeRatio.toFixed(2),
    transactionCount: allTxns.length,
    actualIncomeThisMonth: actualIncomeThisMonth.toFixed(2),
  });
});

router.get("/dashboard/spending-by-category", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = GetSpendingByCategoryQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const { month } = qp.data;
  const [year, mo] = month.split("-").map(Number);
  const start = new Date(year, mo - 1, 1);
  const end = new Date(year, mo, 1);

  const txns = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, req.userId!),
    eq(transactionsTable.type, "debit"),
    gte(transactionsTable.date, start),
    lte(transactionsTable.date, end),
  ));

  const catSpend: Record<string, { total: number; catId: string | null }> = {};
  for (const txn of txns) {
    const key = txn.categoryId ?? "__uncategorized__";
    if (!catSpend[key]) catSpend[key] = { total: 0, catId: txn.categoryId };
    catSpend[key].total += parseFloat(txn.amount);
  }

  const categoryIds = Object.values(catSpend)
    .map((v) => v.catId)
    .filter((id): id is string => id !== null);

  const categoryRows = categoryIds.length > 0
    ? await db.select({ id: categoriesTable.id, name: categoriesTable.name })
        .from(categoriesTable)
        .where(inArray(categoriesTable.id, categoryIds))
    : [];

  const categoryMap = new Map(categoryRows.map((c) => [c.id, c.name]));

  const totalSpent = Object.values(catSpend).reduce((s, v) => s + v.total, 0);

  const result = Object.entries(catSpend).map(([, { total, catId }]) => {
    const catName = catId ? (categoryMap.get(catId) ?? "Uncategorized") : "Uncategorized";
    return {
      categoryId: catId,
      categoryName: catName,
      totalSpent: total.toFixed(2),
      percentage: totalSpent > 0 ? parseFloat(((total / totalSpent) * 100).toFixed(2)) : 0,
    };
  });

  res.json(result.sort((a, b) => parseFloat(b.totalSpent) - parseFloat(a.totalSpent)));
});

router.get("/dashboard/recent-transactions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = GetRecentTransactionsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const limit = qp.data.limit ?? 10;

  const rows = await db
    .select({
      id: transactionsTable.id,
      userId: transactionsTable.userId,
      accountId: transactionsTable.accountId,
      categoryId: transactionsTable.categoryId,
      date: transactionsTable.date,
      amount: transactionsTable.amount,
      type: transactionsTable.type,
      description: transactionsTable.description,
      merchant: transactionsTable.merchant,
      source: transactionsTable.source,
      notes: transactionsTable.notes,
      createdAt: transactionsTable.createdAt,
      updatedAt: transactionsTable.updatedAt,
      categoryName: categoriesTable.name,
      accountName: accountsTable.name,
    })
    .from(transactionsTable)
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .leftJoin(
      accountsTable,
      and(
        eq(transactionsTable.accountId, accountsTable.id),
        eq(accountsTable.userId, transactionsTable.userId),
      ),
    )
    .where(eq(transactionsTable.userId, req.userId!))
    .orderBy(transactionsTable.date)
    .limit(limit);

  res.json(rows.map((t) => ({
    id: t.id,
    userId: t.userId,
    accountId: t.accountId,
    categoryId: t.categoryId,
    categoryName: t.categoryName ?? null,
    accountName: t.accountName ?? null,
    date: t.date.toISOString(),
    amount: t.amount,
    type: t.type,
    description: t.description,
    merchant: t.merchant,
    source: t.source,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

export default router;
