import { pgTable, text, integer, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const PAYDAY_PROMPT_STATES = ["pending", "confirmed", "skipped", "remind_tomorrow"] as const;
export type PaydayPromptState = typeof PAYDAY_PROMPT_STATES[number];

export const paydayPromptsTable = pgTable("payday_prompts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  state: text("state").notNull().default("pending"),
  remindAfterDate: date("remind_after_date"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("payday_prompts_user_year_month_idx").on(table.userId, table.year, table.month),
]);

export const insertPaydayPromptSchema = createInsertSchema(paydayPromptsTable).omit({ createdAt: true, updatedAt: true });
export type InsertPaydayPrompt = z.infer<typeof insertPaydayPromptSchema>;
export type PaydayPrompt = typeof paydayPromptsTable.$inferSelect;
