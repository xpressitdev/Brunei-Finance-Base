import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("email_verification_tokens_user_idx").on(t.userId),
}));

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("password_reset_tokens_user_idx").on(t.userId),
}));

// Magic-link (passwordless) sign-in tokens. Indexed by email (lowercase)
// rather than userId because the link can also create a new account on
// first use — the user may not exist yet when the token is issued.
export const magicLinkTokensTable = pgTable("magic_link_tokens", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index("magic_link_tokens_email_idx").on(t.email),
}));

export type EmailVerificationToken = typeof emailVerificationTokensTable.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
export type MagicLinkToken = typeof magicLinkTokensTable.$inferSelect;
