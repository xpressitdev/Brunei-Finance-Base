import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, categoriesTable } from "@workspace/db";
import { CreateCategoryBody, UpdateCategoryBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

// Money fields are wire-serialized as strings (pg numeric). Mirror the OpenAPI
// pattern at the route boundary so non-conformant payloads are rejected.
const MONEY_RE = /^\d+(\.\d{1,2})?$/;
function validateMoneyString(v: string | undefined, field: string): string | null {
  if (v === undefined) return null;
  if (typeof v !== "string" || !MONEY_RE.test(v)) {
    return `${field} must be a non-negative decimal with up to 2 fractional digits`;
  }
  return null;
}

function formatCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    isDefault: c.isDefault,
    defaultBudget: c.defaultBudget ?? "0",
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/categories", requireAuth, async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable);
  res.json(categories.map(formatCategory));
});

router.post("/categories", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const moneyErr = validateMoneyString(parsed.data.defaultBudget, "defaultBudget");
  if (moneyErr) {
    res.status(400).json({ error: moneyErr });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values({
    id: uuidv4(),
    name: parsed.data.name,
    kind: parsed.data.kind,
    isDefault: false,
    defaultBudget: parsed.data.defaultBudget ?? "0",
  }).returning();
  res.status(201).json(formatCategory(cat));
});

router.patch("/categories/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  // System defaults can't be renamed or have their kind changed, but their
  // monthly default budget IS editable so users can budget their staples.
  if (existing.isDefault && (parsed.data.name !== undefined || parsed.data.kind !== undefined)) {
    res.status(403).json({ error: "Default categories cannot be renamed or re-typed" });
    return;
  }
  const moneyErr = validateMoneyString(parsed.data.defaultBudget, "defaultBudget");
  if (moneyErr) {
    res.status(400).json({ error: moneyErr });
    return;
  }
  const updates: Partial<typeof categoriesTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.kind !== undefined) updates.kind = parsed.data.kind;
  if (parsed.data.defaultBudget !== undefined) updates.defaultBudget = parsed.data.defaultBudget;
  const [cat] = await db
    .update(categoriesTable)
    .set(updates)
    .where(eq(categoriesTable.id, req.params.id))
    .returning();
  res.json(formatCategory(cat));
});

router.delete("/categories/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
