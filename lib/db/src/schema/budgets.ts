import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const monthlyBudgetsTable = pgTable("monthly_budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  categoryId: text("category_id").notNull(),
  month: text("month").notNull(),
  plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull(),
  actualAmount: numeric("actual_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMonthlyBudgetSchema = createInsertSchema(monthlyBudgetsTable).omit({ createdAt: true, updatedAt: true });
export type InsertMonthlyBudget = z.infer<typeof insertMonthlyBudgetSchema>;
export type MonthlyBudget = typeof monthlyBudgetsTable.$inferSelect;
