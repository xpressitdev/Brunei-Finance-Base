import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userAchievementsTable = pgTable("user_achievements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  achievementKey: text("achievement_key").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("unique_user_achievement").on(table.userId, table.achievementKey),
]);

export type UserAchievement = typeof userAchievementsTable.$inferSelect;
