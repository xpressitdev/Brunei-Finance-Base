import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const FEEDBACK_CATEGORIES = ["bug", "feature", "general", "praise"] as const;
export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number];

export const feedbackTable = pgTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  category: text("category").notNull().$type<FeedbackCategory>(),
  message: text("message").notNull(),
  rating: integer("rating"),
  page: text("page"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
