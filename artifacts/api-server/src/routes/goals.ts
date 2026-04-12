import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, goalsTable } from "@workspace/db";
import { CreateGoalBody, UpdateGoalBody, UpdateGoalParams, DeleteGoalParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatGoal(g: typeof goalsTable.$inferSelect) {
  return {
    id: g.id,
    userId: g.userId,
    title: g.title,
    category: g.category,
    targetAmount: g.targetAmount,
    savedAmount: g.savedAmount,
    deadline: g.deadline ?? null,
    notes: g.notes ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

router.get("/goals", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const items = await db.select().from(goalsTable).where(eq(goalsTable.userId, req.userId!));
  res.json(items.map(formatGoal));
});

router.post("/goals", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(goalsTable).values({
    id: uuidv4(),
    userId: req.userId!,
    title: parsed.data.title,
    category: parsed.data.category ?? "savings",
    targetAmount: parsed.data.targetAmount,
    savedAmount: parsed.data.savedAmount ?? "0",
    deadline: parsed.data.deadline ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(formatGoal(item));
});

router.patch("/goals/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateGoalBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (body.data.title != null) updateData.title = body.data.title;
  if (body.data.category != null) updateData.category = body.data.category;
  if (body.data.targetAmount != null) updateData.targetAmount = body.data.targetAmount;
  if (body.data.savedAmount != null) updateData.savedAmount = body.data.savedAmount;
  if (body.data.deadline !== undefined) updateData.deadline = body.data.deadline;
  if (body.data.notes !== undefined) updateData.notes = body.data.notes;

  const [updated] = await db.update(goalsTable).set(updateData)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, req.userId!)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Goal not found" }); return; }
  res.json(formatGoal(updated));
});

router.delete("/goals/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(goalsTable).where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, req.userId!)));
  res.sendStatus(204);
});

export default router;
