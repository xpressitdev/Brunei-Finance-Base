import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { logger } from "./logger";

// Transactional email helper for DuitPlan.
//
// When RESEND_API_KEY is set, mail is sent via Resend
// (https://resend.com). When the key is missing, deliver() falls back to
// logging the message — so dev/QA can complete auth flows without real
// infra, and a missing prod key never silently breaks signup.
//
// Sender address is controlled by EMAIL_FROM (default: noreply@duitplan.com).
// Tokens are generated here as random bytes; only their SHA-256 hash is
// stored in the DB. The plaintext token is delivered to the user and
// presented back to /auth/verify-email or /auth/reset-password.

const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "DuitPlan <noreply@duitplan.com>";
}

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
  // SECURITY: bodyText contains single-use auth tokens (verification +
  // password-reset URLs). Never log it in production — anyone with log
  // access could hijack accounts. In non-production we surface the body
  // so QA can complete flows without a real inbox.
  const isProd = process.env.NODE_ENV === "production";

  if (resendClient) {
    // Fire-and-forget — auth routes don't await delivery so a slow SMTP
    // hop never blocks the HTTP response. Failures are logged for ops
    // follow-up but never thrown back to the user (would leak whether
    // an email exists).
    resendClient.emails
      .send({
        from: emailFrom(),
        to: args.to,
        subject: args.subject,
        text: args.bodyText,
      })
      .then((result) => {
        if (result.error) {
          logger.error(
            { to: args.to, subject: args.subject, err: result.error },
            "[email] Resend delivery failed",
          );
        } else {
          logger.info(
            { to: args.to, subject: args.subject, messageId: result.data?.id },
            "[email] Resend delivery accepted",
          );
        }
      })
      .catch((err: unknown) => {
        logger.error(
          { to: args.to, subject: args.subject, err },
          "[email] Resend delivery threw",
        );
      });
    return;
  }

  // No transport configured — fall back to logging so dev/QA still works.
  if (isProd) {
    logger.warn(
      { to: args.to, subject: args.subject },
      "[email] RESEND_API_KEY missing in production — email NOT sent",
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
