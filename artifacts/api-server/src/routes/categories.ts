import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, categoriesTable } from "@workspace/db";
import { CreateCategoryBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    isDefault: c.isDefault,
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
  const [cat] = await db.insert(categoriesTable).values({
    id: uuidv4(),
    name: parsed.data.name,
    kind: parsed.data.kind,
    isDefault: false,
  }).returning();
  res.status(201).json(formatCategory(cat));
});

export default router;
