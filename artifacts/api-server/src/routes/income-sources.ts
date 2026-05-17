import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, incomeSourcesTable } from "@workspace/db";
import { CreateIncomeSourceBody, UpdateIncomeSourceBody, UpdateIncomeSourceParams, DeleteIncomeSourceParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function format(s: typeof incomeSourcesTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    expectedMonthlyAmount: s.expectedMonthlyAmount,
    notes: s.notes ?? null,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/income-sources", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const items = await db.select().from(incomeSourcesTable).where(eq(incomeSourcesTable.userId, req.userId!));
  res.json(items.map(format));
});

router.post("/income-sources", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateIncomeSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(incomeSourcesTable).values({
    id: uuidv4(),
    userId: req.userId!,
    name: parsed.data.name,
    expectedMonthlyAmount: parsed.data.expectedMonthlyAmount ?? "0",
    notes: parsed.data.notes ?? null,
    active: parsed.data.active ?? true,
  }).returning();
  res.status(201).json(format(item));
});

router.patch("/income-sources/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateIncomeSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateIncomeSourceBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (body.data.name != null) updateData.name = body.data.name;
  if (body.data.expectedMonthlyAmount != null) updateData.expectedMonthlyAmount = body.data.expectedMonthlyAmount;
  if (body.data.notes !== undefined) updateData.notes = body.data.notes;
  if (body.data.active != null) updateData.active = body.data.active;

  const [updated] = await db.update(incomeSourcesTable).set(updateData)
    .where(and(eq(incomeSourcesTable.id, params.data.id), eq(incomeSourcesTable.userId, req.userId!)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Income source not found" }); return; }
  res.json(format(updated));
});

router.delete("/income-sources/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteIncomeSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(incomeSourcesTable)
    .where(and(eq(incomeSourcesTable.id, params.data.id), eq(incomeSourcesTable.userId, req.userId!)));
  res.sendStatus(204);
});

export default router;
