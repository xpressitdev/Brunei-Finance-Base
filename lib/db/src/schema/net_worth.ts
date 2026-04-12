import { pgTable, text, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const netWorthSnapshotsTable = pgTable("net_worth_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  month: text("month").notNull(),
  netWorth: numeric("net_worth", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  userMonthUnique: unique("net_worth_snapshots_user_month_unique").on(t.userId, t.month),
}));

export const insertNetWorthSnapshotSchema = createInsertSchema(netWorthSnapshotsTable).omit({ createdAt: true, updatedAt: true });
export type InsertNetWorthSnapshot = z.infer<typeof insertNetWorthSnapshotSchema>;
export type NetWorthSnapshot = typeof netWorthSnapshotsTable.$inferSelect;

export const ASSET_CATEGORIES = ["Savings", "Property", "Vehicle", "Investment", "Business", "Other"] as const;
export type AssetCategory = typeof ASSET_CATEGORIES[number];

export const assetEntriesTable = pgTable("asset_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  category: text("category").notNull().$type<AssetCategory>(),
  name: text("name").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
  month: text("month").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAssetEntrySchema = createInsertSchema(assetEntriesTable).omit({ createdAt: true, updatedAt: true });
export type InsertAssetEntry = z.infer<typeof insertAssetEntrySchema>;
export type AssetEntry = typeof assetEntriesTable.$inferSelect;
