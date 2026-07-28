import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// The app is free — the subscription_plans table and Pocket Pay columns were
// dropped. user_subscriptions is kept because GET /subscription/current still
// reads it for API compatibility.
export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull(),
  status: text("status").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;
