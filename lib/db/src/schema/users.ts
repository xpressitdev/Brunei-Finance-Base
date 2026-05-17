import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  // Nullable: users who sign in only via Google or magic-link have no
  // password hash. Email/password users always have one.
  passwordHash: text("password_hash"),
  passwordWeak: boolean("password_weak").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  // Google OAuth "sub" claim (stable user ID from Google). Unique when set.
  // Null for users who have not linked Google.
  googleSub: text("google_sub").unique(),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
