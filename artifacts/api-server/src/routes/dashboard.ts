import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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

  // Only subtract debt payments for debts not yet reconciled this month
  // (debts are reconciled when a payday-prompt transaction with linked_debt_id is created)
  const reconciledDebtIds = new Set(
    debitTxns
      .filter(t => t.linkedDebtId !== null && t.linkedDebtId !== undefined)
      .map(t => t.linkedDebtId!)
  );
  const unreconciledDebtPayment = debts
    .filter(d => !reconciledDebtIds.has(d.id))
    .reduce((s, d) => s + parseFloat(d.monthlyPayment), 0);

  const remaining = income - totalCommitments - totalSpent - unreconciledDebtPayment;

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

  const rows = await db
    .select({
      categoryId: transactionsTable.categoryId,
      categoryName: categoriesTable.name,
      total: sql<string>`SUM(${transactionsTable.amount}::numeric)`,
    })
    .from(transactionsTable)
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(and(
      eq(transactionsTable.userId, req.userId!),
      eq(transactionsTable.type, "debit"),
      gte(transactionsTable.date, start),
      lte(transactionsTable.date, end),
    ))
    .groupBy(transactionsTable.categoryId, categoriesTable.name);

  const totalSpent = rows.reduce((s, r) => s + parseFloat(r.total ?? "0"), 0);

  const result = rows.map((r) => {
    const amount = parseFloat(r.total ?? "0");
    return {
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "Uncategorized",
      totalSpent: Math.round(amount * 100) / 100,
      percentage: totalSpent > 0
        ? Math.round((amount / totalSpent) * 10000) / 100
        : 0,
    };
  });

  res.json(result.sort((a, b) => b.totalSpent - a.totalSpent));
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
