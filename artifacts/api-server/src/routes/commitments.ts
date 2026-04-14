import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, commitmentsTable } from "@workspace/db";
import { CreateCommitmentBody, UpdateCommitmentBody, UpdateCommitmentParams, DeleteCommitmentParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { requireAccess } from "../lib/access";

const router: IRouter = Router();

function formatCommitment(c: typeof commitmentsTable.$inferSelect) {
  return {
    id: c.id,
    userId: c.userId,
    label: c.label,
    amount: c.amount,
    dueDay: c.dueDay,
    recurrence: c.recurrence,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/commitments", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const items = await db.select().from(commitmentsTable).where(eq(commitmentsTable.userId, req.userId!));
  res.json(items.map(formatCommitment));
});

router.post("/commitments", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCommitmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(commitmentsTable).values({
    id: uuidv4(),
    userId: req.userId!,
    label: parsed.data.label,
    amount: parsed.data.amount,
    dueDay: parsed.data.dueDay ?? null,
    recurrence: parsed.data.recurrence ?? "monthly",
  }).returning();
  res.status(201).json(formatCommitment(item));
});

router.patch("/commitments/:id", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateCommitmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateCommitmentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (body.data.label != null) updateData.label = body.data.label;
  if (body.data.amount != null) updateData.amount = body.data.amount;
  if (body.data.dueDay !== undefined) updateData.dueDay = body.data.dueDay;
  if (body.data.recurrence != null) updateData.recurrence = body.data.recurrence;

  const [updated] = await db.update(commitmentsTable).set(updateData)
    .where(and(eq(commitmentsTable.id, params.data.id), eq(commitmentsTable.userId, req.userId!)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Commitment not found" }); return; }
  res.json(formatCommitment(updated));
});

router.delete("/commitments/:id", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteCommitmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(commitmentsTable).where(and(eq(commitmentsTable.id, params.data.id), eq(commitmentsTable.userId, req.userId!)));
  res.sendStatus(204);
});

export default router;
