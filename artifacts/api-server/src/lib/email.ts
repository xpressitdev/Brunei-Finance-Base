import { createHash, randomBytes } from "node:crypto";
import { logger } from "./logger";

// Lightweight email helper. No SMTP transport is currently configured for
// DuitPlan — the handoff doc explicitly defers transactional email until
// business mail infra is sorted. To keep the auth flows usable without
// blocking on infra, this module:
//   • generates secure tokens and their SHA-256 hashes (only the hash is
//     stored in the DB)
//   • builds the user-facing URL using APP_BASE_URL
//   • "sends" by logging the URL at INFO level so it's visible in dev/QA
//
// Swap the `deliver()` body with a real transport (nodemailer / Resend /
// SES) once credentials are available — the rest of the auth code is
// already token-shape compatible.

export interface IssuedToken {
  token: string;       // plaintext, send to the user
  tokenHash: string;   // store this in the DB
  expiresAt: Date;
}

export function issueToken(ttlMinutes: number): IssuedToken {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  return { token, tokenHash, expiresAt };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function appBaseUrl(): string {
  const fromEnv = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // dev fallback — frontend dev server proxies through the same origin
  return "http://localhost";
}

function deliver(args: { to: string; subject: string; bodyText: string }): void {
  // Replace this stub with a real transport when SMTP/Resend creds land.
  // SECURITY: bodyText contains single-use auth tokens (verification +
  // password-reset URLs). Never log it in production — anyone with log
  // access could hijack accounts. In non-production we surface the body
  // so QA can complete flows without a real inbox.
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    logger.info(
      { to: args.to, subject: args.subject },
      "[email] (no transport configured) would-send (body redacted)",
    );
  } else {
    logger.info(
      { to: args.to, subject: args.subject, body: args.bodyText },
      "[email] (no transport configured) would-send",
    );
  }
}

export function buildVerificationUrl(token: string): string {
  return `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export function buildPasswordResetUrl(token: string): string {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

export function sendVerificationEmail(args: { to: string; url: string }): void {
  deliver({
    to: args.to,
    subject: "Verify your DuitPlan email",
    bodyText:
      `Welcome to DuitPlan!\n\n` +
      `Confirm your email so we can keep your account secure and let you reset your password later if needed:\n\n` +
      `${args.url}\n\n` +
      `This link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
  });
}

export function sendPasswordResetEmail(args: { to: string; url: string }): void {
  deliver({
    to: args.to,
    subject: "Reset your DuitPlan password",
    bodyText:
      `Someone (hopefully you) asked to reset the password for this DuitPlan account.\n\n` +
      `Tap the link below to choose a new password. It expires in 60 minutes and can only be used once:\n\n` +
      `${args.url}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
  });
}

// In dev/test we also surface the URL to the caller so QA can complete the
// flow end-to-end without a real inbox. Production responses must NEVER
// include the URL — that would let anyone reset any account.
export function devOnlyUrl(url: string): string | undefined {
  return process.env.NODE_ENV === "production" ? undefined : url;
}
