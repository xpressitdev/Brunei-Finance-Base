import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, usersTable, profilesTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

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
    currency: "BND",
    payday: 1,
    monthlyIncome: "0",
  });

  req.session.userId = userId;

  const profile = {
    id: profileId,
    userId,
    fullName,
    currency: "BND",
    payday: 1,
    monthlyIncome: "0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  res.status(201).json({
    user: {
      id: userId,
      email: email.toLowerCase(),
      onboardingCompleted: false,
      profile,
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

  res.json({
    user: {
      id: user.id,
      email: user.email,
      onboardingCompleted: user.onboardingCompleted,
      profile: profile ? {
        id: profile.id,
        userId: profile.userId,
        fullName: profile.fullName,
        currency: profile.currency,
        payday: profile.payday,
        monthlyIncome: profile.monthlyIncome,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      } : null,
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
    profile: profile ? {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      currency: profile.currency,
      payday: profile.payday,
      monthlyIncome: profile.monthlyIncome,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    } : null,
  });
});

export default router;
