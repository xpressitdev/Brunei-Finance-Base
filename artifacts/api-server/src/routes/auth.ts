import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  profilesTable,
  emailVerificationTokensTable,
  passwordResetTokensTable,
} from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  VerifyEmailBody,
  ChangePasswordBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { checkPasswordPolicy, isWeakPassword } from "../lib/password";
import {
  buildPasswordResetUrl,
  buildVerificationUrl,
  devOnlyUrl,
  hashToken,
  issueToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../lib/email";

const router: IRouter = Router();

const VERIFY_TTL_MIN = 24 * 60;
const RESET_TTL_MIN = 60;

function serializeProfile(profile: typeof profilesTable.$inferSelect | null) {
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    currency: profile.currency,
    region: profile.region,
    locale: profile.locale,
    language: profile.language,
    payday: profile.payday,
    monthlyIncome: profile.monthlyIncome,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function serializeAuthUser(user: typeof usersTable.$inferSelect, profile: typeof profilesTable.$inferSelect | null) {
  return {
    id: user.id,
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
    emailVerified: user.emailVerified,
    passwordWeak: user.passwordWeak,
    profile: serializeProfile(profile),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fullName, email, password } = parsed.data;

  const policy = checkPasswordPolicy(password);
  if (!policy.ok) {
    res.status(400).json({ error: policy.reason ?? "Password does not meet requirements." });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const profileId = uuidv4();

  await db.insert(usersTable).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    passwordWeak: false,
    emailVerified: false,
    onboardingCompleted: false,
  });

  await db.insert(profilesTable).values({
    id: profileId,
    userId,
    fullName,
    currency: "BND",
    region: "BN",
    locale: "en-BN",
    language: "en",
    payday: 1,
    monthlyIncome: "0",
  });

  const issued = issueToken(VERIFY_TTL_MIN);
  await db.insert(emailVerificationTokensTable).values({
    id: uuidv4(),
    userId,
    tokenHash: issued.tokenHash,
    expiresAt: issued.expiresAt,
  });
  const verifyUrl = buildVerificationUrl(issued.token);
  sendVerificationEmail({ to: email.toLowerCase(), url: verifyUrl });
  req.log.info({ userId, email: email.toLowerCase() }, "Issued verification email");

  req.session.userId = userId;

  const now = new Date().toISOString();
  const profile = {
    id: profileId,
    userId,
    fullName,
    currency: "BND",
    region: "BN",
    locale: "en-BN",
    language: "en",
    payday: 1,
    monthlyIncome: "0",
    createdAt: now,
    updatedAt: now,
  };

  res.status(201).json({
    user: {
      id: userId,
      email: email.toLowerCase(),
      onboardingCompleted: false,
      emailVerified: false,
      passwordWeak: false,
      profile,
    },
    devVerificationUrl: devOnlyUrl(verifyUrl) ?? null,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  // Accounts created via Google or magic-link have no password hash. Reject
  // those at the same generic error to avoid leaking which sign-in method
  // an email is registered with — the user can fall back to "Continue with
  // Google" or "Email me a sign-in link" on the same page.
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // We can only assess legacy password strength when we have the plaintext
  // (i.e. on a successful login). Persist the flag so the client can prompt
  // the user to update on this and future sessions until they rotate.
  const weak = isWeakPassword(password);
  if (weak !== user.passwordWeak) {
    await db.update(usersTable).set({ passwordWeak: weak, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    user.passwordWeak = weak;
  }

  req.session.userId = user.id;

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, user.id)).limit(1);

  res.json({
    user: serializeAuthUser(user, profile ?? null),
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, user.id)).limit(1);
  res.json(serializeAuthUser(user, profile ?? null));
});

// Always returns 200 with the same shape, regardless of whether the email
// belongs to a real account. This avoids leaking which addresses are
// registered. Reset is also gated on email verification — typo'd addresses
// would otherwise silently never reach the user.
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  let devUrl: string | undefined;
  if (user && user.emailVerified) {
    const issued = issueToken(RESET_TTL_MIN);
    await db.insert(passwordResetTokensTable).values({
      id: uuidv4(),
      userId: user.id,
      tokenHash: issued.tokenHash,
      expiresAt: issued.expiresAt,
    });
    const url = buildPasswordResetUrl(issued.token);
    sendPasswordResetEmail({ to: user.email, url });
    devUrl = devOnlyUrl(url);
    req.log.info({ userId: user.id }, "Issued password reset");
  } else if (user && !user.emailVerified) {
    req.log.info({ userId: user.id }, "Password reset requested for unverified email — no email sent");
  } else {
    req.log.info({ email }, "Password reset requested for unknown email");
  }

  res.json({ ok: true, devResetUrl: devUrl ?? null });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const policy = checkPasswordPolicy(parsed.data.password);
  if (!policy.ok) {
    res.status(400).json({ error: policy.reason ?? "Password does not meet requirements." });
    return;
  }
  const tokenHash = hashToken(parsed.data.token);
  const [row] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        gt(passwordResetTokensTable.expiresAt, new Date()),
        isNull(passwordResetTokensTable.usedAt),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.update(usersTable)
    .set({ passwordHash, passwordWeak: false, updatedAt: new Date() })
    .where(eq(usersTable.id, row.userId));
  await db.update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, row.id));
  res.json({ ok: true });
});

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokenHash = hashToken(parsed.data.token);
  const [row] = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(
      and(
        eq(emailVerificationTokensTable.tokenHash, tokenHash),
        gt(emailVerificationTokensTable.expiresAt, new Date()),
        isNull(emailVerificationTokensTable.usedAt),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(400).json({ error: "This verification link is invalid or has expired. Request a new one from settings." });
    return;
  }
  await db.update(usersTable)
    .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, row.userId));
  await db.update(emailVerificationTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokensTable.id, row.id));
  res.json({ ok: true });
});

router.post("/auth/resend-verification", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.emailVerified) {
    res.json({ ok: true });
    return;
  }
  const issued = issueToken(VERIFY_TTL_MIN);
  await db.insert(emailVerificationTokensTable).values({
    id: uuidv4(),
    userId: user.id,
    tokenHash: issued.tokenHash,
    expiresAt: issued.expiresAt,
  });
  const url = buildVerificationUrl(issued.token);
  sendVerificationEmail({ to: user.email, url });
  req.log.info({ userId: user.id, devUrl: devOnlyUrl(url) }, "Resent verification email");
  res.json({ ok: true });
});

router.post("/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const policy = checkPasswordPolicy(parsed.data.newPassword);
  if (!policy.ok) {
    res.status(400).json({ error: policy.reason ?? "Password does not meet requirements." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  // Accounts created via Google or magic-link have no current password to
  // verify — they can't change a password they never set. Surface a 400
  // explaining the situation rather than letting bcrypt.compare(null) throw.
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!user.passwordHash) {
    res.status(400).json({ error: "Your account has no password set. Use the 'set password' option in settings instead." });
    return;
  }
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(usersTable)
    .set({ passwordHash, passwordWeak: false, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
