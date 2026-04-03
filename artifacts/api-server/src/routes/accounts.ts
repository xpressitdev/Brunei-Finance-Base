import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, accountsTable } from "@workspace/db";
import { CreateAccountBody, UpdateAccountBody, UpdateAccountParams, DeleteAccountParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatAccount(a: typeof accountsTable.$inferSelect) {
  return {
    id: a.id,
    userId: a.userId,
    name: a.name,
    type: a.type,
    bankName: a.bankName,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

router.get("/accounts", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const accounts = await db.select().from(accountsTable).where(eq(accountsTable.userId, req.userId!));
  res.json(accounts.map(formatAccount));
});

router.post("/accounts", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [account] = await db.insert(accountsTable).values({
    id: uuidv4(),
    userId: req.userId!,
    ...parsed.data,
  }).returning();
  res.status(201).json(formatAccount(account));
});

router.patch("/accounts/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateAccountBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (body.data.name != null) updateData.name = body.data.name;
  if (body.data.type != null) updateData.type = body.data.type;
  if (body.data.bankName !== undefined) updateData.bankName = body.data.bankName;

  const [updated] = await db.update(accountsTable).set(updateData)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.userId!)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(formatAccount(updated));
});

router.delete("/accounts/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(accountsTable).where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.userId!)));
  res.sendStatus(204);
});

export default router;
