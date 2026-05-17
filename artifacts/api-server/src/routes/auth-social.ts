import { Router, type IRouter, type Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import {
  db,
  usersTable,
  profilesTable,
  magicLinkTokensTable,
} from "@workspace/db";
import {
  appBaseUrl,
  buildMagicLinkUrl,
  devOnlyUrl,
  hashToken,
  issueToken,
  sendMagicLinkEmail,
} from "../lib/email";

// Build the public base URL from the incoming request's protocol + host. We
// rely on Express `trust proxy` being set so req.protocol reflects the
// X-Forwarded-Proto header from the Replit shared proxy (always https in
// production). This lets each regional subdomain (duitplan.com,
// my.duitplan.com, id.duitplan.com) drive its own OAuth round-trip and
// magic-link host without a separate APP_BASE_URL per region.
//
// Falls back to the static APP_BASE_URL helper only when there is no Host
// header (e.g. internal test harnesses), so production behavior is always
// driven by the user's actual subdomain.
function requestBaseUrl(req: Request): string {
  const host = req.get("host");
  if (!host) return appBaseUrl();
  // Strip trailing dot/whitespace; reject if it doesn't look like a host —
  // a bogus Host header would otherwise let an attacker steer the OAuth
  // callback at a domain we don't own. We restrict to the duitplan family
  // and the Replit dev domain; anything else falls back to APP_BASE_URL.
  const normalized = host.toLowerCase().trim();
  const allowed =
    normalized === "duitplan.com" ||
    normalized.endsWith(".duitplan.com") ||
    normalized.endsWith(".replit.app") ||
    normalized.endsWith(".replit.dev") ||
    normalized.startsWith("localhost");
  if (!allowed) return appBaseUrl();
  return `${req.protocol}://${normalized}`;
}

// Social and passwordless sign-in routes (Google OAuth + email magic link).
// Kept separate from the email/password routes in auth.ts so the file stays
// focused, but both routers mount under /api at the same level.

const router: IRouter = Router();

const MAGIC_LINK_TTL_MIN = 15;

function googleClient(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set to use Google sign-in.",
    );
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

// Google requires the redirect_uri sent in /start (the auth-url request) and
// /callback (the token-exchange request) to match byte-for-byte. Centralize
// the construction so the two routes can never drift.
function googleRedirectUri(req: Request): string {
  return `${requestBaseUrl(req)}/api/auth/google/callback`;
}

// Pick the post-login landing page based on onboarding state. New users always
// land in onboarding; returning users skip straight to the dashboard.
function postLoginPath(onboardingCompleted: boolean): string {
  return onboardingCompleted ? "/dashboard" : "/onboarding";
}

// Find-or-create the application user for a verified third-party identity.
// Auto-links by email: if an email/password account already exists with the
// same address, we adopt it (set googleSub, mark verified) so the user does
// not end up with two parallel accounts. The Google email is considered
// verified — Google has already done the round-trip.
// Returns true when an error is a Postgres unique-violation (SQLSTATE 23505).
// Used to recover from races where two concurrent first-logins race on the
// users.email or users.google_sub unique constraint — the loser just re-reads.
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}

async function findOrCreateUserByGoogle(args: {
  googleSub: string;
  email: string;
  fullName: string;
}): Promise<{ userId: string; onboardingCompleted: boolean }> {
  const email = args.email.toLowerCase();

  // 1. Existing Google-linked account
  const [bySub] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.googleSub, args.googleSub))
    .limit(1);
  if (bySub) {
    return { userId: bySub.id, onboardingCompleted: bySub.onboardingCompleted };
  }

  // 2. Existing email/password account → auto-link. Concurrent first
  // Google-logins for the same email race here: the first wins, the second
  // either hits the unique violation on google_sub (already linked by row 1)
  // or — if it raced past step 1 — sees the freshly-linked row on re-read.
  const [byEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (byEmail) {
    try {
      await db
        .update(usersTable)
        .set({
          googleSub: args.googleSub,
          emailVerified: true,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, byEmail.id));
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Another request linked this google_sub to the same row — fine.
    }
    return { userId: byEmail.id, onboardingCompleted: byEmail.onboardingCompleted };
  }

  // 3. New user — create user + default profile. If two requests race here
  // for the same email/sub, one inserts and the other gets 23505; recover
  // by re-fetching the winning row.
  const userId = uuidv4();
  try {
    await db.insert(usersTable).values({
      id: userId,
      email,
      passwordHash: null,
      passwordWeak: false,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      googleSub: args.googleSub,
      onboardingCompleted: false,
    });
    await db.insert(profilesTable).values({
      id: uuidv4(),
      userId,
      fullName: args.fullName || email.split("@")[0]!,
      currency: "BND",
      region: "BN",
      locale: "en-BN",
      language: "en",
      payday: 1,
      monthlyIncome: "0",
    });
    return { userId, onboardingCompleted: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [winner] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (!winner) throw err;
    return { userId: winner.id, onboardingCompleted: winner.onboardingCompleted };
  }
}

// Find-or-create by email for magic-link sign-in. Same idea as above, but
// without an external identity to link — the email itself is the proof
// (the user just clicked a single-use link delivered to that address).
async function findOrCreateUserByEmail(email: string): Promise<{ userId: string; onboardingCompleted: boolean }> {
  const lower = email.toLowerCase();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, lower))
    .limit(1);
  if (existing) {
    // Clicking a magic link delivered to this address proves ownership,
    // so flip the verified flag if it wasn't already set.
    if (!existing.emailVerified) {
      await db
        .update(usersTable)
        .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(usersTable.id, existing.id));
    }
    return { userId: existing.id, onboardingCompleted: existing.onboardingCompleted };
  }

  const userId = uuidv4();
  try {
    await db.insert(usersTable).values({
      id: userId,
      email: lower,
      passwordHash: null,
      passwordWeak: false,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      onboardingCompleted: false,
    });
    await db.insert(profilesTable).values({
      id: uuidv4(),
      userId,
      fullName: lower.split("@")[0]!,
      currency: "BND",
      region: "BN",
      locale: "en-BN",
      language: "en",
      payday: 1,
      monthlyIncome: "0",
    });
    return { userId, onboardingCompleted: false };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Race: another magic-link verify for the same email created the user
    // between our SELECT and INSERT. Re-fetch and use that row.
    const [winner] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, lower))
      .limit(1);
    if (!winner) throw err;
    return { userId: winner.id, onboardingCompleted: winner.onboardingCompleted };
  }
}

// ===== Google OAuth =====

router.get("/auth/google/start", (req, res): void => {
  let client: OAuth2Client;
  try {
    client = googleClient(googleRedirectUri(req));
  } catch (err) {
    req.log.error({ err }, "Google OAuth not configured");
    res.redirect("/login?error=google_unavailable");
    return;
  }

  const state = randomBytes(32).toString("base64url");
  req.session.oauthState = state;

  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const expectedState = req.session.oauthState;

  // Always clear so a leaked state cannot be replayed
  req.session.oauthState = undefined;

  if (!code || !state || !expectedState || state !== expectedState) {
    req.log.warn({ hasCode: !!code, stateMatch: state === expectedState }, "Google OAuth state mismatch");
    res.redirect("/login?error=oauth_state");
    return;
  }

  let client: OAuth2Client;
  try {
    client = googleClient(googleRedirectUri(req));
  } catch (err) {
    req.log.error({ err }, "Google OAuth not configured");
    res.redirect("/login?error=google_unavailable");
    return;
  }

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new Error("Google response missing id_token");
    }
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error("Google id_token missing sub or email");
    }
    if (!payload.email_verified) {
      // Defence in depth — Google should only return verified emails for the
      // userinfo scope, but a hostile/spoofed token could lie. Refuse to
      // auto-link if Google itself says the address isn't verified.
      req.log.warn({ email: payload.email }, "Google returned unverified email");
      res.redirect("/login?error=google_unverified");
      return;
    }

    const { userId, onboardingCompleted } = await findOrCreateUserByGoogle({
      googleSub: payload.sub,
      email: payload.email,
      fullName: payload.name ?? "",
    });
    req.session.userId = userId;
    req.log.info({ userId, googleSub: payload.sub }, "Google sign-in succeeded");

    res.redirect(postLoginPath(onboardingCompleted));
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback failed");
    res.redirect("/login?error=oauth_failed");
  }
});

// ===== Magic link (passwordless email) =====

// Permissive RFC-5322-ish check — full validation happens implicitly when
// we deliver the email. Goal here is just to reject obvious garbage and
// normalize to lowercase before hashing tokens against it.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/auth/magic-link/request", async (req, res): Promise<void> => {
  const raw = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!raw || !EMAIL_RE.test(raw)) {
    res.status(400).json({ error: "Please enter a valid email." });
    return;
  }
  const email = raw;

  // We always respond 200 to avoid leaking which addresses are registered.
  // The token is keyed by email, not userId — the link works whether or
  // not an account already exists. On verify we find-or-create.
  const issued = issueToken(MAGIC_LINK_TTL_MIN);
  await db.insert(magicLinkTokensTable).values({
    id: uuidv4(),
    email,
    tokenHash: issued.tokenHash,
    expiresAt: issued.expiresAt,
  });
  const url = buildMagicLinkUrl(issued.token, requestBaseUrl(req));
  sendMagicLinkEmail({ to: email, url });
  req.log.info({ email }, "Issued magic link");

  res.json({ ok: true, devMagicLinkUrl: devOnlyUrl(url) ?? null });
});

router.get("/auth/magic-link/verify", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!token) {
    res.redirect("/login?error=magic_link_invalid");
    return;
  }

  const tokenHash = hashToken(token);

  // Atomically claim the token in a single UPDATE so concurrent verifies
  // for the same link cannot both succeed. Postgres serializes the row
  // update, so only one transaction sees usedAt IS NULL — the other gets
  // zero rows back and is rejected as invalid.
  const consumed = await db
    .update(magicLinkTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(magicLinkTokensTable.tokenHash, tokenHash),
        gt(magicLinkTokensTable.expiresAt, new Date()),
        isNull(magicLinkTokensTable.usedAt),
      ),
    )
    .returning();
  const row = consumed[0];
  if (!row) {
    res.redirect("/login?error=magic_link_invalid");
    return;
  }

  try {
    const { userId, onboardingCompleted } = await findOrCreateUserByEmail(row.email);
    req.session.userId = userId;
    req.log.info({ userId, email: row.email }, "Magic-link sign-in succeeded");
    res.redirect(postLoginPath(onboardingCompleted));
  } catch (err) {
    req.log.error({ err, email: row.email }, "Magic-link sign-in failed");
    res.redirect("/login?error=magic_link_failed");
  }
});

export default router;
