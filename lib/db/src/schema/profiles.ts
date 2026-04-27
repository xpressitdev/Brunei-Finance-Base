import { pgTable, text, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  currency: text("currency").notNull().default("BND"),
  region: text("region").notNull().default("BN"),
  locale: text("locale").notNull().default("en-BN"),
  language: text("language").notNull().default("en"),
  payday: integer("payday").notNull(),
  monthlyIncome: numeric("monthly_income", { precision: 12, scale: 2 }).notNull(),
  migrationNoticeDismissed: boolean("migration_notice_dismissed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ createdAt: true, updatedAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
