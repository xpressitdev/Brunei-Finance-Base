import { pgTable, text, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const incomeSourcesTable = pgTable("income_sources", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  expectedMonthlyAmount: numeric("expected_monthly_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIncomeSourceSchema = createInsertSchema(incomeSourcesTable).omit({ createdAt: true, updatedAt: true });
export type InsertIncomeSource = z.infer<typeof insertIncomeSourceSchema>;
export type IncomeSource = typeof incomeSourcesTable.$inferSelect;
