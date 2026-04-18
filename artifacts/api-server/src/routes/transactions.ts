import { Router, type IRouter } from "express";
import { eq, and, ilike, gte, lte, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, transactionsTable, categoriesTable, accountsTable } from "@workspace/db";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  UpdateTransactionParams,
  GetTransactionParams,
  DeleteTransactionParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { requireAccess } from "../lib/access";

const router: IRouter = Router();

async function formatTransaction(t: typeof transactionsTable.$inferSelect) {
  let categoryName: string | null = null;
  if (t.categoryId) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId)).limit(1);
    categoryName = cat?.name ?? null;
  }
  let accountName: string | null = null;
  if (t.accountId) {
    const [acc] = await db.select().from(accountsTable).where(and(eq(accountsTable.id, t.accountId), eq(accountsTable.userId, t.userId))).limit(1);
    accountName = acc?.name ?? null;
  }
  return {
    id: t.id,
    userId: t.userId,
    accountId: t.accountId,
    categoryId: t.categoryId,
    categoryName,
    accountName,
    date: t.date.toISOString(),
    amount: t.amount,
    type: t.type,
    description: t.description,
    merchant: t.merchant,
    source: t.source,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get("/transactions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListTransactionsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const conditions = [eq(transactionsTable.userId, req.userId!)];

  if (qp.data.month) {
    const [year, mo] = qp.data.month.split("-").map(Number);
    const start = new Date(year, mo - 1, 1);
    const end = new Date(year, mo, 1);
    conditions.push(gte(transactionsTable.date, start));
    conditions.push(lte(transactionsTable.date, end));
  }
  if (qp.data.categoryId) conditions.push(eq(transactionsTable.categoryId, qp.data.categoryId));
  if (qp.data.accountId) conditions.push(eq(transactionsTable.accountId, qp.data.accountId));
  if (qp.data.type) conditions.push(eq(transactionsTable.type, qp.data.type));
  if (qp.data.search) conditions.push(ilike(transactionsTable.description, `%${qp.data.search}%`));

  const txns = await db.select().from(transactionsTable).where(and(...conditions)).orderBy(transactionsTable.date);
  const result = await Promise.all(txns.map(formatTransaction));
  res.json(result);
});

router.post("/transactions", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const txn = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(transactionsTable).values({
      id: uuidv4(),
      userId: req.userId!,
      date: new Date(parsed.data.date),
      amount: parsed.data.amount,
      type: parsed.data.type,
      description: parsed.data.description,
      merchant: parsed.data.merchant ?? null,
      categoryId: parsed.data.categoryId ?? null,
      accountId: parsed.data.accountId ?? null,
      notes: parsed.data.notes ?? null,
      source: "manual",
    }).returning();

    if (inserted.accountId) {
      const balanceDelta = inserted.type === "credit"
        ? sql`${accountsTable.balance} + ${inserted.amount}::numeric`
        : sql`${accountsTable.balance} - ${inserted.amount}::numeric`;
      await tx.update(accountsTable)
        .set({ balance: balanceDelta })
        .where(and(eq(accountsTable.id, inserted.accountId), eq(accountsTable.userId, req.userId!)));
    }

    return inserted;
  });

  res.status(201).json(await formatTransaction(txn));
});

router.get("/transactions/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [txn] = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, req.userId!)))
    .limit(1);
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(await formatTransaction(txn));
});

router.patch("/transactions/:id", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateTransactionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(transactionsTable)
      .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, req.userId!)))
      .limit(1);
    if (!existing) return null;

    const newAmount = body.data.amount != null ? body.data.amount : existing.amount;
    const newType = body.data.type != null ? body.data.type : existing.type;
    const newAccountId = body.data.accountId !== undefined ? body.data.accountId : existing.accountId;

    const balanceAffected =
      String(newAmount) !== String(existing.amount) ||
      newType !== existing.type ||
      newAccountId !== existing.accountId;

    if (balanceAffected && existing.accountId) {
      const reverseDelta = existing.type === "credit"
        ? sql`${accountsTable.balance} - ${existing.amount}::numeric`
        : sql`${accountsTable.balance} + ${existing.amount}::numeric`;
      await tx.update(accountsTable)
        .set({ balance: reverseDelta })
        .where(and(eq(accountsTable.id, existing.accountId), eq(accountsTable.userId, req.userId!)));
    }

    const updateData: Record<string, unknown> = {};
    if (body.data.date != null) updateData.date = new Date(body.data.date);
    if (body.data.amount != null) updateData.amount = body.data.amount;
    if (body.data.type != null) updateData.type = body.data.type;
    if (body.data.description != null) updateData.description = body.data.description;
    if (body.data.merchant !== undefined) updateData.merchant = body.data.merchant;
    if (body.data.categoryId !== undefined) updateData.categoryId = body.data.categoryId;
    if (body.data.accountId !== undefined) updateData.accountId = body.data.accountId;
    if (body.data.notes !== undefined) updateData.notes = body.data.notes;

    const [row] = await tx.update(transactionsTable).set(updateData)
      .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, req.userId!)))
      .returning();

    if (balanceAffected && newAccountId) {
      const applyDelta = newType === "credit"
        ? sql`${accountsTable.balance} + ${newAmount}::numeric`
        : sql`${accountsTable.balance} - ${newAmount}::numeric`;
      await tx.update(accountsTable)
        .set({ balance: applyDelta })
        .where(and(eq(accountsTable.id, newAccountId), eq(accountsTable.userId, req.userId!)));
    }

    return row;
  });

  if (!updated) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(await formatTransaction(updated));
});

router.delete("/transactions/:id", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.transaction(async (tx) => {
    const [txn] = await tx.select().from(transactionsTable)
      .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, req.userId!)))
      .limit(1);

    if (txn?.accountId) {
      const reverseDelta = txn.type === "credit"
        ? sql`${accountsTable.balance} - ${txn.amount}::numeric`
        : sql`${accountsTable.balance} + ${txn.amount}::numeric`;
      await tx.update(accountsTable)
        .set({ balance: reverseDelta })
        .where(and(eq(accountsTable.id, txn.accountId), eq(accountsTable.userId, req.userId!)));
    }

    await tx.delete(transactionsTable)
      .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, req.userId!)));
  });

  res.sendStatus(204);
});

export default router;
