import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: text("account_id"),
  categoryId: text("category_id"),
  date: timestamp("date", { withTimezone: true }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  merchant: text("merchant"),
  source: text("source").notNull().default("manual"),
  notes: text("notes"),
  importedRowId: text("imported_row_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
