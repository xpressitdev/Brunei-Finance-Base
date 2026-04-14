import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sum } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, monthlyBudgetsTable, categoriesTable, transactionsTable } from "@workspace/db";
import { UpsertBudgetBody, ListBudgetsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { requireAccess } from "../lib/access";

const router: IRouter = Router();

router.get("/budgets", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListBudgetsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const budgets = await db.select().from(monthlyBudgetsTable)
    .where(and(eq(monthlyBudgetsTable.userId, req.userId!), eq(monthlyBudgetsTable.month, qp.data.month)));

  const [year, mo] = qp.data.month.split("-").map(Number);
  const start = new Date(year, mo - 1, 1);
  const end = new Date(year, mo, 1);

  const result = await Promise.all(budgets.map(async (b) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, b.categoryId)).limit(1);
    const [spendRow] = await db.select({ total: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, req.userId!),
        eq(transactionsTable.categoryId, b.categoryId),
        eq(transactionsTable.type, "debit"),
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end),
      ));
    return {
      id: b.id,
      userId: b.userId,
      categoryId: b.categoryId,
      categoryName: cat?.name ?? "Unknown",
      month: b.month,
      plannedAmount: b.plannedAmount,
      actualAmount: spendRow?.total ?? "0",
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }));

  res.json(result);
});

router.post("/budgets", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpsertBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(monthlyBudgetsTable)
    .where(and(
      eq(monthlyBudgetsTable.userId, req.userId!),
      eq(monthlyBudgetsTable.categoryId, parsed.data.categoryId),
      eq(monthlyBudgetsTable.month, parsed.data.month),
    )).limit(1);

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, parsed.data.categoryId)).limit(1);

  let budget;
  if (existing.length > 0) {
    const [updated] = await db.update(monthlyBudgetsTable)
      .set({ plannedAmount: parsed.data.plannedAmount })
      .where(eq(monthlyBudgetsTable.id, existing[0].id))
      .returning();
    budget = updated;
  } else {
    const [created] = await db.insert(monthlyBudgetsTable).values({
      id: uuidv4(),
      userId: req.userId!,
      categoryId: parsed.data.categoryId,
      month: parsed.data.month,
      plannedAmount: parsed.data.plannedAmount,
      actualAmount: "0",
    }).returning();
    budget = created;
  }

  res.json({
    id: budget.id,
    userId: budget.userId,
    categoryId: budget.categoryId,
    categoryName: cat?.name ?? "Unknown",
    month: budget.month,
    plannedAmount: budget.plannedAmount,
    actualAmount: budget.actualAmount,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  });
});

export default router;
