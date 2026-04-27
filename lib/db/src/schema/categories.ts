import { pgTable, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  defaultBudget: numeric("default_budget", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ createdAt: true, updatedAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
