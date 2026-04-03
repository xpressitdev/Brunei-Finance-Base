import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, debtsTable, debtScenariosTable } from "@workspace/db";
import {
  CreateDebtBody,
  UpdateDebtBody,
  UpdateDebtParams,
  DeleteDebtParams,
  SimulateDebtPayoffBody,
  SimulateDebtPayoffParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatDebt(d: typeof debtsTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    debtType: d.debtType,
    lender: d.lender,
    outstandingBalance: d.outstandingBalance,
    monthlyPayment: d.monthlyPayment,
    interestRate: d.interestRate,
    targetExtraPayment: d.targetExtraPayment,
    endDate: d.endDate?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

router.get("/debts", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const debts = await db.select().from(debtsTable).where(eq(debtsTable.userId, req.userId!));
  res.json(debts.map(formatDebt));
});

router.post("/debts", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateDebtBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [debt] = await db.insert(debtsTable).values({
    id: uuidv4(),
    userId: req.userId!,
    debtType: parsed.data.debtType,
    lender: parsed.data.lender,
    outstandingBalance: parsed.data.outstandingBalance,
    monthlyPayment: parsed.data.monthlyPayment,
    interestRate: parsed.data.interestRate ?? null,
  }).returning();

  res.status(201).json(formatDebt(debt));
});

router.patch("/debts/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateDebtParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateDebtBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (body.data.debtType != null) updateData.debtType = body.data.debtType;
  if (body.data.lender != null) updateData.lender = body.data.lender;
  if (body.data.outstandingBalance != null) updateData.outstandingBalance = body.data.outstandingBalance;
  if (body.data.monthlyPayment != null) updateData.monthlyPayment = body.data.monthlyPayment;
  if (body.data.interestRate !== undefined) updateData.interestRate = body.data.interestRate;
  if (body.data.targetExtraPayment !== undefined) updateData.targetExtraPayment = body.data.targetExtraPayment;

  const [updated] = await db.update(debtsTable).set(updateData)
    .where(and(eq(debtsTable.id, params.data.id), eq(debtsTable.userId, req.userId!)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Debt not found" }); return; }
  res.json(formatDebt(updated));
});

router.delete("/debts/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteDebtParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(debtsTable).where(and(eq(debtsTable.id, params.data.id), eq(debtsTable.userId, req.userId!)));
  res.sendStatus(204);
});

router.post("/debts/:id/simulate", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = SimulateDebtPayoffParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = SimulateDebtPayoffBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [debt] = await db.select().from(debtsTable)
    .where(and(eq(debtsTable.id, params.data.id), eq(debtsTable.userId, req.userId!)))
    .limit(1);
  if (!debt) { res.status(404).json({ error: "Debt not found" }); return; }

  const balance = parseFloat(debt.outstandingBalance);
  const basePayment = parseFloat(debt.monthlyPayment);
  const rate = debt.interestRate ? parseFloat(debt.interestRate) / 100 / 12 : 0;
  const extra = parseFloat(body.data.extraMonthlyPayment);

  function calcMonths(payment: number): number {
    if (payment <= 0) return 9999;
    if (rate === 0) return Math.ceil(balance / payment);
    let bal = balance;
    let months = 0;
    while (bal > 0 && months < 1200) {
      bal = bal * (1 + rate) - payment;
      months++;
    }
    return months;
  }

  const baseMonths = calcMonths(basePayment);
  const newMonths = calcMonths(basePayment + extra);
  const monthsSaved = Math.max(0, baseMonths - newMonths);

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + newMonths);

  const [scenario] = await db.insert(debtScenariosTable).values({
    id: uuidv4(),
    debtId: debt.id,
    extraMonthlyPayment: body.data.extraMonthlyPayment,
    estimatedMonthsSaved: monthsSaved,
    estimatedPayoffDate: payoffDate,
    basePayoffMonths: baseMonths,
    newPayoffMonths: newMonths,
  }).returning();

  res.json({
    id: scenario.id,
    debtId: scenario.debtId,
    extraMonthlyPayment: scenario.extraMonthlyPayment,
    estimatedMonthsSaved: scenario.estimatedMonthsSaved,
    estimatedPayoffDate: scenario.estimatedPayoffDate?.toISOString() ?? null,
    basePayoffMonths: scenario.basePayoffMonths,
    newPayoffMonths: scenario.newPayoffMonths,
    createdAt: scenario.createdAt.toISOString(),
  });
});

export default router;
