import { Router, type IRouter } from "express";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, accountsTable, transactionsTable } from "@workspace/db";
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
    balance: a.balance,
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
    name: parsed.data.name,
    type: parsed.data.type,
    bankName: parsed.data.bankName ?? null,
    balance: parsed.data.balance ?? "0",
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
  if (body.data.balance != null) updateData.balance = body.data.balance;

  const [updated] = await db.update(accountsTable).set(updateData)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.userId!)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(formatAccount(updated));
});

router.get("/accounts/:id/balance-history", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const rawDays = Number(req.query.days ?? 30);
  const days = isNaN(rawDays) || rawDays < 1 ? 30 : Math.min(rawDays, 365);

  const [account] = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, id), eq(accountsTable.userId, req.userId!)))
    .limit(1);
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }

  const currentBalance = parseFloat(account.balance ?? "0");

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const allTxns = await db.select({
    date: transactionsTable.date,
    amount: transactionsTable.amount,
    type: transactionsTable.type,
  })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.accountId, id),
      eq(transactionsTable.userId, req.userId!),
    ))
    .orderBy(asc(transactionsTable.date));

  function netDelta(t: { amount: string; type: string }): number {
    const amt = parseFloat(t.amount ?? "0");
    return t.type === "credit" ? amt : t.type === "debit" ? -amt : 0;
  }

  const futureNet = allTxns
    .filter(t => t.date > endOfToday)
    .reduce((sum, t) => sum + netDelta(t), 0);
  const balanceEndOfToday = currentBalance - futureNet;

  const dailyDeltas = new Map<string, number>();
  for (const t of allTxns) {
    if (t.date > endOfToday) continue;
    const key = t.date.toISOString().slice(0, 10);
    dailyDeltas.set(key, (dailyDeltas.get(key) ?? 0) + netDelta(t));
  }

  const todayKey = endOfToday.toISOString().slice(0, 10);
  const balanceByDay = new Map<string, number>();
  balanceByDay.set(todayKey, balanceEndOfToday);

  for (let i = 1; i < days; i++) {
    const d = new Date(endOfToday);
    d.setDate(endOfToday.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    const prev = new Date(endOfToday);
    prev.setDate(endOfToday.getDate() - i + 1);
    const prevKey = prev.toISOString().slice(0, 10);

    const prevBalance = balanceByDay.get(prevKey)!;
    const delta = dailyDeltas.get(prevKey) ?? 0;
    balanceByDay.set(key, Math.round((prevBalance - delta) * 100) / 100);
  }

  const result: { date: string; balance: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endOfToday);
    d.setDate(endOfToday.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, balance: balanceByDay.get(key) ?? 0 });
  }

  res.json(result);
});

router.delete("/accounts/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(accountsTable).where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.userId!)));
  res.sendStatus(204);
});

export default router;
