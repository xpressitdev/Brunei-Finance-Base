import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionPlansTable, userSubscriptionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { getSubscriptionStatus } from "../lib/access";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const router: IRouter = Router();

const POCKET_MERCHANT_ID = process.env.POCKET_MERCHANT_ID ?? "DUITPLAN_MERCHANT";
const POCKET_TERMINAL_ID = process.env.POCKET_TERMINAL_ID ?? "DUITPLAN_TERMINAL";
const POCKET_API_KEY = process.env.POCKET_API_KEY ?? "";
const POCKET_API_BASE = process.env.POCKET_API_BASE ?? "https://home.pocket.com.bn/api";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://duitplan.replit.app";
const SUBSCRIPTION_PLAN_ID = "965eca59-2f7a-415f-b9b7-2588ec9cfb2c";
const MONTHLY_PRICE_BND = "10.00";

router.get("/subscription/current", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [sub] = await db.select().from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.userId, req.userId!)).limit(1);

  const { status, daysRemaining, trialEndsAt } = getSubscriptionStatus(user, sub ?? null);

  res.json({
    status,
    daysRemaining,
    trialEndsAt: trialEndsAt.toISOString(),
    subscription: sub ? {
      id: sub.id,
      planId: sub.planId,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate?.toISOString() ?? null,
      nextBillingDate: sub.nextBillingDate?.toISOString() ?? null,
    } : null,
  });
});

router.post("/subscription/checkout", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const orderId = `DUITPLAN-${req.userId!.substring(0, 8)}-${Date.now()}`;
  const returnUrl = `${APP_BASE_URL}/subscription/success`;
  const cancelUrl = `${APP_BASE_URL}/subscription/failed`;

  const checkoutPayload = {
    merchantId: POCKET_MERCHANT_ID,
    terminalId: POCKET_TERMINAL_ID,
    orderId,
    amount: MONTHLY_PRICE_BND,
    currency: "BND",
    description: "DuitPlan Monthly Subscription",
    returnUrl,
    cancelUrl,
    customerRef: req.userId!,
  };

  if (!POCKET_API_KEY) {
    res.status(503).json({
      error: "Payment gateway not configured",
      message: "Pocket Pay credentials are not yet set up. Please contact support.",
    });
    return;
  }

  try {
    const response = await fetch(`${POCKET_API_BASE}/checkout/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${POCKET_API_KEY}`,
      },
      body: JSON.stringify(checkoutPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "Payment gateway error", detail: errText });
      return;
    }

    const data = await response.json() as { checkoutUrl: string; sessionId?: string };
    res.json({ checkoutUrl: data.checkoutUrl, orderId });
  } catch (_err) {
    res.status(502).json({ error: "Failed to reach payment gateway" });
  }
});

router.post("/subscription/callback", async (req, res): Promise<void> => {
  const isProduction = process.env.NODE_ENV === "production";

  if (POCKET_API_KEY || isProduction) {
    const sig = req.headers["x-pocket-signature"] as string | undefined;
    if (!sig) {
      res.status(403).json({ error: "Missing signature" });
      return;
    }

    if (!POCKET_API_KEY) {
      res.status(503).json({ error: "Callback verification not configured" });
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Could not read request body for verification" });
      return;
    }

    const expected = crypto
      .createHmac("sha256", POCKET_API_KEY)
      .update(rawBody)
      .digest("hex");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      res.status(403).json({ error: "Invalid signature" });
      return;
    }
  }

  const { status, orderId, customerRef } = req.body as {
    status?: string;
    orderId?: string;
    customerRef?: string;
  };

  if (!customerRef || !orderId) {
    res.status(400).json({ error: "Missing required callback fields" });
    return;
  }

  const isSuccess = status === "SUCCESS" || status === "success";
  const isFailure = status === "FAILED" || status === "failed" || status === "CANCELLED" || status === "cancelled" || status === "DECLINED" || status === "declined";

  if (isSuccess) {
    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const existing = await db.select().from(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.userId, customerRef)).limit(1);

    if (existing.length > 0) {
      await db.update(userSubscriptionsTable)
        .set({
          status: "active",
          startDate: now,
          endDate,
          nextBillingDate: nextBilling,
          pocketOrderId: orderId,
        })
        .where(eq(userSubscriptionsTable.userId, customerRef));
    } else {
      await db.insert(userSubscriptionsTable).values({
        id: uuidv4(),
        userId: customerRef,
        planId: SUBSCRIPTION_PLAN_ID,
        status: "active",
        startDate: now,
        endDate,
        nextBillingDate: nextBilling,
        pocketOrderId: orderId,
      });
    }
  } else if (isFailure) {
    const existing = await db.select().from(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.userId, customerRef)).limit(1);

    if (existing.length > 0 && existing[0].status === "active") {
      await db.update(userSubscriptionsTable)
        .set({ status: "payment_failed", endDate: new Date() })
        .where(eq(userSubscriptionsTable.userId, customerRef));
    }
  }

  res.json({ received: true });
});

router.post("/subscription/activate-test", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }

  const now = new Date();
  const nextBilling = new Date(now);
  nextBilling.setMonth(nextBilling.getMonth() + 1);
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);

  const existing = await db.select().from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.userId, req.userId!)).limit(1);

  if (existing.length > 0) {
    await db.update(userSubscriptionsTable)
      .set({ status: "active", startDate: now, endDate, nextBillingDate: nextBilling })
      .where(eq(userSubscriptionsTable.userId, req.userId!));
  } else {
    await db.insert(userSubscriptionsTable).values({
      id: uuidv4(),
      userId: req.userId!,
      planId: SUBSCRIPTION_PLAN_ID,
      status: "active",
      startDate: now,
      endDate,
      nextBillingDate: nextBilling,
    });
  }

  res.json({ success: true });
});

export default router;
