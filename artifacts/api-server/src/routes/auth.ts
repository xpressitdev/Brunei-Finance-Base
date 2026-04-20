import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, usersTable, profilesTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatProfileRow(profile: typeof profilesTable.$inferSelect) {
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    currency: profile.currency,
    locale: profile.locale ?? null,
    payday: profile.payday,
    monthlyIncome: profile.monthlyIncome,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

const COUNTRY_MAP: Record<string, { currency: string; locale: string }> = {
  BN: { currency: "BND", locale: "en-BN" },
  MY: { currency: "MYR", locale: "en-MY" },
  ID: { currency: "IDR", locale: "id-ID" },
};

async function detectLocaleFromIp(ip: string): Promise<{ currency: string; locale: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const cleanIp = ip === "::1" || ip === "127.0.0.1" ? "" : ip;
    const url = cleanIp ? `https://ipapi.co/${cleanIp}/json/` : "https://ipapi.co/json/";
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json() as { country_code?: string };
    const code = data.country_code;
    return code ? (COUNTRY_MAP[code] ?? { currency: "USD", locale: "en-US" }) : null;
  } catch {
    return null;
  }
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fullName, email, password } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const profileId = uuidv4();

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ?? req.socket.remoteAddress ?? "";
  const geoResult = await detectLocaleFromIp(ip);
  const detectedCurrency = geoResult?.currency ?? "BND";
  const detectedLocale = geoResult?.locale ?? "en-BN";

  await db.insert(usersTable).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    onboardingCompleted: false,
  });

  await db.insert(profilesTable).values({
    id: profileId,
    userId,
    fullName,
    currency: detectedCurrency,
    locale: detectedLocale,
    payday: 1,
    monthlyIncome: "0",
  });

  req.session.userId = userId;

  res.status(201).json({
    user: {
      id: userId,
      email: email.toLowerCase(),
      onboardingCompleted: false,
      profile: {
        id: profileId,
        userId,
        fullName,
        currency: detectedCurrency,
        locale: detectedLocale,
        payday: 1,
        monthlyIncome: "0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.userId = user.id;

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, user.id)).limit(1);

  // If existing user has no locale yet, detect from IP and save (fire-and-forget)
  if (profile && !profile.locale) {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ?? req.socket.remoteAddress ?? "";
    detectLocaleFromIp(ip).then((geo) => {
      if (geo) {
        db.update(profilesTable).set({ currency: geo.currency, locale: geo.locale }).where(eq(profilesTable.userId, user.id)).catch(() => {});
      }
    }).catch(() => {});
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      onboardingCompleted: user.onboardingCompleted,
      profile: profile ? formatProfileRow(profile) : null,
    },
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

  res.json({
    id: user.id,
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
    profile: profile ? formatProfileRow(profile) : null,
  });
});

export default router;
