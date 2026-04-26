import { pgTable, text, integer, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commitmentsTable = pgTable("commitments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDay: integer("due_day"),
  recurrence: text("recurrence").notNull().default("monthly"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique("commitments_user_id_label_unique").on(table.userId, table.label),
]);

export const insertCommitmentSchema = createInsertSchema(commitmentsTable).omit({ createdAt: true, updatedAt: true });
export type InsertCommitment = z.infer<typeof insertCommitmentSchema>;
export type Commitment = typeof commitmentsTable.$inferSelect;
