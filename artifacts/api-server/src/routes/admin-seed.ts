import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { timingSafeEqual } from "crypto";
import {
  db,
  usersTable,
  profilesTable,
  accountsTable,
  transactionsTable,
  commitmentsTable,
  debtsTable,
  goalsTable,
  netWorthSnapshotsTable,
  insightsTable,
  monthlyBudgetsTable,
  incomeSourcesTable,
  paydayPromptsTable,
} from "@workspace/db";

const router: IRouter = Router();

const DEMO_EMAIL = "test@example.com";
const DEMO_PASSWORD = "Password123!";
const DEMO_FULL_NAME = "Aiman Test";

const CAT = {
  salary: "f1000000-0000-4000-8000-000000000001",
  groc:   "0580956b-de53-4219-ac43-989a137fda1e",
  dining: "305f179f-f27d-464a-b02a-11700aa908bb",
  coffee: "a0984a67-bd96-488a-b452-e9aef8319479",
  fuel:   "b2baac4d-e5a4-4ee8-af57-1d30be1c6e13",
  bills:  "6f0ea787-4c36-48e1-ab94-a342cadb1c2a",
  enter:  "81c97cae-46bc-4fdb-b03d-39e36a36101c",
  sub:    "906cfdec-b3d8-4bf6-a62d-17eaa77ac85a",
  phone:  "406c851a-c40e-4e7f-b684-2790b8c9d1eb",
  tx:     "30670755-a27e-48cb-b7aa-9cec03bf3e40",
  shop:   "534851c0-2f47-4f91-9bf4-9e327cc05781",
  debt:   "dd2dea2f-dc71-4311-9803-5ed336385840",
};

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type TxnSeed = {
  date: string;
  amount: number;
  type: "credit" | "debit" | "expense";
  categoryId: string;
  accountId: string;
  description: string;
  merchant: string;
};

function buildTransactions(accSavings: string, accCurrent: string, accCard: string): TxnSeed[] {
  const exp = (date: string, amount: number, categoryId: string, accountId: string, description: string, merchant: string): TxnSeed =>
    ({ date, amount, type: "expense", categoryId, accountId, description, merchant });
  const deb = (date: string, amount: number, categoryId: string, accountId: string, description: string, merchant: string): TxnSeed =>
    ({ date, amount, type: "debit", categoryId, accountId, description, merchant });
  const inc = (date: string, amount: number, categoryId: string, accountId: string, description: string, merchant: string): TxnSeed =>
    ({ date, amount, type: "credit", categoryId, accountId, description, merchant });

  return [
    // ── MAY 2026 ──
    inc("2026-05-01", 3500, CAT.salary, accCurrent, "Salary May", "Employer Sdn Bhd"),
    inc("2026-05-12", 400,  CAT.salary, accCurrent, "Freelance project", "Cuci Xpress"),

    exp("2026-05-02", 62.40, CAT.groc, accCurrent, "Weekly groceries", "Hua Ho Manggis"),
    deb("2026-05-08", 48.10, CAT.groc, accCurrent, "Groceries", "Supa Save"),
    exp("2026-05-14", 78.55, CAT.groc, accCurrent, "Weekend stock-up", "Hua Ho Yayasan"),
    deb("2026-05-18", 61.00, CAT.groc, accCurrent, "Groceries", "Soon Lee"),

    exp("2026-05-03", 18.50, CAT.dining, accCard,    "Brunch with family", "Excapade"),
    deb("2026-05-09", 22.00, CAT.dining, accCard,    "Dinner", "I-Lotus"),
    exp("2026-05-15", 14.50, CAT.dining, accCurrent, "Lunch", "Aminah Arif"),
    exp("2026-05-19", 30.00, CAT.dining, accCard,    "Anniversary dinner", "Tasek Brasserie"),

    exp("2026-05-04", 6.50, CAT.coffee, accCurrent, "Latte", "Coffee Bean"),
    deb("2026-05-06", 5.80, CAT.coffee, accCurrent, "Iced coffee", "Starbucks Gadong"),
    exp("2026-05-11", 7.20, CAT.coffee, accCurrent, "Cappuccino", "Piccolo Cafe"),
    exp("2026-05-13", 5.50, CAT.coffee, accCurrent, "Latte", "Coffee Bean"),
    exp("2026-05-16", 6.80, CAT.coffee, accCurrent, "Brunch coffee", "Standard Chartered Cafe"),
    deb("2026-05-19", 6.20, CAT.coffee, accCurrent, "Iced latte", "Starbucks Times Sq"),

    exp("2026-05-05", 60.00, CAT.fuel, accCard, "Fill-up", "Shell Kiulap"),
    deb("2026-05-12", 60.00, CAT.fuel, accCard, "Fill-up", "Brunei Shell Mata-Mata"),
    exp("2026-05-18", 60.00, CAT.fuel, accCard, "Fill-up", "Shell Beribi"),

    deb("2026-05-05", 85.00, CAT.bills, accCurrent, "Electricity", "DST"),
    deb("2026-05-07", 25.00, CAT.bills, accCurrent, "Water", "PWD"),
    exp("2026-05-15", 55.00, CAT.bills, accCurrent, "TV licence", "RTB"),

    exp("2026-05-09", 45.00, CAT.enter, accCard, "Cinema night", "The Mall Cineplex"),
    deb("2026-05-17", 50.00, CAT.enter, accCard, "Concert tickets", "OneStop"),

    deb("2026-05-15", 32.00, CAT.sub, accCard, "Netflix + Spotify", "Netflix"),
    exp("2026-05-15", 30.00, CAT.sub, accCard, "iCloud + YouTube", "Apple"),

    deb("2026-05-07", 51.00, CAT.phone, accCurrent, "Internet bill", "Progresif"),

    exp("2026-05-06", 15.00, CAT.tx, accCurrent, "Dart ride", "Dart"),
    deb("2026-05-13", 18.00, CAT.tx, accCurrent, "Dart ride", "Dart"),
    exp("2026-05-17", 12.00, CAT.tx, accCurrent, "Dart ride", "Dart"),

    exp("2026-05-10", 45.00, CAT.shop, accCard, "New shirt", "Padini Concept"),
    deb("2026-05-16", 29.00, CAT.shop, accCard, "Books", "Best Eastern"),

    exp("2026-05-01", 420.00, CAT.debt, accCurrent, "Car loan", "BIBD"),
    exp("2026-05-01", 180.00, CAT.debt, accCurrent, "Personal loan", "Standard Chartered"),
    exp("2026-05-15", 80.00,  CAT.debt, accCurrent, "Credit card", "Baiduri"),

    // ── APRIL 2026 ──
    inc("2026-04-01", 3500, CAT.salary, accCurrent, "Salary Apr", "Employer Sdn Bhd"),
    inc("2026-04-20", 350,  CAT.salary, accCurrent, "Freelance", "Cuci Xpress"),
    exp("2026-04-03", 245.00, CAT.groc,   accCurrent, "Groceries (month)", "Hua Ho"),
    exp("2026-04-05", 95.00,  CAT.dining, accCard,    "Dining", "Various"),
    exp("2026-04-08", 33.00,  CAT.coffee, accCurrent, "Coffee", "Coffee Bean"),
    exp("2026-04-10", 180.00, CAT.fuel,   accCard,    "Fuel", "Shell"),
    exp("2026-04-15", 170.00, CAT.bills,  accCurrent, "Bills", "DST + PWD"),
    exp("2026-04-18", 110.00, CAT.enter,  accCard,    "Entertainment", "Cineplex"),
    exp("2026-04-15", 62.00,  CAT.sub,    accCard,    "Subscriptions", "Netflix"),
    exp("2026-04-07", 51.00,  CAT.phone,  accCurrent, "Internet", "Progresif"),
    exp("2026-04-01", 420.00, CAT.debt,   accCurrent, "Car loan", "BIBD"),
    exp("2026-04-01", 180.00, CAT.debt,   accCurrent, "Personal loan", "StanChart"),
    exp("2026-04-01", 80.00,  CAT.debt,   accCurrent, "Credit card", "Baiduri"),

    // ── MARCH 2026 ──
    inc("2026-03-01", 3500, CAT.salary, accCurrent, "Salary Mar", "Employer Sdn Bhd"),
    exp("2026-03-04", 280.00, CAT.groc,   accCurrent, "Groceries", "Hua Ho"),
    exp("2026-03-06", 105.00, CAT.dining, accCard,    "Dining", "Various"),
    exp("2026-03-09", 28.00,  CAT.coffee, accCurrent, "Coffee", "Coffee Bean"),
    exp("2026-03-12", 200.00, CAT.fuel,   accCard,    "Fuel", "Shell"),
    exp("2026-03-15", 155.00, CAT.bills,  accCurrent, "Bills", "DST + PWD"),
    exp("2026-03-01", 420.00, CAT.debt,   accCurrent, "Car loan", "BIBD"),
    exp("2026-03-01", 180.00, CAT.debt,   accCurrent, "Personal loan", "StanChart"),
    exp("2026-03-01", 80.00,  CAT.debt,   accCurrent, "Credit card", "Baiduri"),
  ];
}

router.post("/admin/seed-demo", async (req, res): Promise<void> => {
  const expected = process.env.ADMIN_SEED_TOKEN;
  if (!expected || expected.length < 16) {
    res.status(503).json({ error: "Seed endpoint disabled: ADMIN_SEED_TOKEN not configured." });
    return;
  }
  const provided = req.header("x-admin-token") ?? "";
  if (!constantTimeEqual(provided, expected)) {
    req.log.warn({ ip: req.ip }, "admin seed: invalid token");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // 1. Reset existing demo user (idempotent).
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL)).limit(1);
    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id;
      // Cascading delete for owned data. Children first.
      await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
      await db.delete(monthlyBudgetsTable).where(eq(monthlyBudgetsTable.userId, userId));
      await db.delete(commitmentsTable).where(eq(commitmentsTable.userId, userId));
      await db.delete(debtsTable).where(eq(debtsTable.userId, userId));
      await db.delete(goalsTable).where(eq(goalsTable.userId, userId));
      await db.delete(netWorthSnapshotsTable).where(eq(netWorthSnapshotsTable.userId, userId));
      await db.delete(insightsTable).where(eq(insightsTable.userId, userId));
      await db.delete(incomeSourcesTable).where(eq(incomeSourcesTable.userId, userId));
      await db.delete(paydayPromptsTable).where(eq(paydayPromptsTable.userId, userId));
      await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
      // Reset user + profile to known state.
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
      await db
        .update(usersTable)
        .set({
          passwordHash,
          passwordWeak: false,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          onboardingCompleted: true,
          onboardedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));
      const profileExists = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
      if (profileExists.length > 0) {
        await db
          .update(profilesTable)
          .set({
            fullName: DEMO_FULL_NAME,
            currency: "BND",
            region: "BN",
            locale: "en-BN",
            language: "en",
            payday: 1,
            monthlyIncome: "3500",
            updatedAt: new Date(),
          })
          .where(eq(profilesTable.userId, userId));
      } else {
        await db.insert(profilesTable).values({
          id: uuidv4(),
          userId,
          fullName: DEMO_FULL_NAME,
          currency: "BND",
          region: "BN",
          locale: "en-BN",
          language: "en",
          payday: 1,
          monthlyIncome: "3500",
        });
      }
    } else {
      userId = uuidv4();
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
      await db.insert(usersTable).values({
        id: userId,
        email: DEMO_EMAIL,
        passwordHash,
        passwordWeak: false,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        onboardingCompleted: true,
        onboardedAt: new Date(),
      });
      await db.insert(profilesTable).values({
        id: uuidv4(),
        userId,
        fullName: DEMO_FULL_NAME,
        currency: "BND",
        region: "BN",
        locale: "en-BN",
        language: "en",
        payday: 1,
        monthlyIncome: "3500",
      });
    }

    // 2. Accounts.
    const accSavings = uuidv4();
    const accCurrent = uuidv4();
    const accCard = uuidv4();
    await db.insert(accountsTable).values([
      { id: accSavings, userId, name: "BIBD Savings",        type: "savings",     bankName: "BIBD",    balance: "8540.50" },
      { id: accCurrent, userId, name: "BIBD Current",        type: "current",     bankName: "BIBD",    balance: "1820.30" },
      { id: accCard,    userId, name: "Baiduri Credit Card", type: "credit_card", bankName: "Baiduri", balance: "-640.00" },
    ]);

    // 3. Income sources.
    await db.insert(incomeSourcesTable).values([
      { id: uuidv4(), userId, name: "Main employer salary", expectedMonthlyAmount: "3500", active: true },
      { id: uuidv4(), userId, name: "Freelance design",     expectedMonthlyAmount: "400",  active: true },
    ]);

    // 4. Commitments.
    await db.insert(commitmentsTable).values([
      { id: uuidv4(), userId, label: "Apartment rent",       amount: "650", dueDay: 1,  recurrence: "monthly" },
      { id: uuidv4(), userId, label: "Electricity (DST)",    amount: "85",  dueDay: 5,  recurrence: "monthly" },
      { id: uuidv4(), userId, label: "Internet (Progresif)", amount: "55",  dueDay: 7,  recurrence: "monthly" },
      { id: uuidv4(), userId, label: "Netflix + Spotify",    amount: "32",  dueDay: 15, recurrence: "monthly" },
    ]);

    // 5. Debts.
    const debtRows: (typeof debtsTable.$inferInsert)[] = [
      { id: uuidv4(), userId, debtType: "car_loan",      lender: "BIBD",                outstandingBalance: "14500", monthlyPayment: "420", interestRate: "4.5",  endDate: new Date("2029-08-01"), startDate: "2024-08-01" },
      { id: uuidv4(), userId, debtType: "credit_card",   lender: "Baiduri",             outstandingBalance: "640",   monthlyPayment: "80",  interestRate: "18.0", endDate: null,                  startDate: "2025-11-01" },
      { id: uuidv4(), userId, debtType: "personal_loan", lender: "Standard Chartered",  outstandingBalance: "3200",  monthlyPayment: "180", interestRate: "7.5",  endDate: new Date("2027-02-01"), startDate: "2025-02-01" },
    ];
    await db.insert(debtsTable).values(debtRows);

    // 6. Goals.
    await db.insert(goalsTable).values([
      { id: uuidv4(), userId, title: "Emergency fund", category: "savings",  targetAmount: "10000", savedAmount: "3200", deadline: "2026-12-31", notes: "3 months of expenses" },
      { id: uuidv4(), userId, title: "Umrah 2027",     category: "travel",   targetAmount: "6500",  savedAmount: "1100", deadline: "2027-03-01", notes: null },
      { id: uuidv4(), userId, title: "New laptop",     category: "purchase", targetAmount: "2400",  savedAmount: "800",  deadline: "2026-09-30", notes: null },
    ]);

    // 7. Net worth snapshots.
    await db.insert(netWorthSnapshotsTable).values([
      { id: uuidv4(), userId, month: "2025-12", netWorth: "-2100" },
      { id: uuidv4(), userId, month: "2026-01", netWorth: "-1450" },
      { id: uuidv4(), userId, month: "2026-02", netWorth: "-820" },
      { id: uuidv4(), userId, month: "2026-03", netWorth: "150" },
      { id: uuidv4(), userId, month: "2026-04", netWorth: "780" },
      { id: uuidv4(), userId, month: "2026-05", netWorth: "1620" },
    ]);

    // 8. Insights.
    await db.insert(insightsTable).values([
      { id: uuidv4(), userId, month: "2026-05", title: "Coffee spending crept up",     message: "You've spent BND 38 on coffee — 27% over your BND 30 monthly target. Brewing at home twice a week could cover your Netflix bill.", severity: "warning" },
      { id: uuidv4(), userId, month: "2026-05", title: "Net worth on the rise",        message: "Your net worth is up BND 840 vs last month — six straight months of growth. Keep going!",                                              severity: "positive" },
      { id: uuidv4(), userId, month: "2026-05", title: "Free trial: 38 days left",     message: "You're on the free 45-day trial. Upgrade to keep insights and statement imports after it ends.",                                      severity: "info" },
    ]);

    // 9. Monthly budgets (May snapshot).
    await db.insert(monthlyBudgetsTable).values([
      { id: uuidv4(), userId, categoryId: CAT.groc,   month: "2026-05", plannedAmount: "300", actualAmount: "250" },
      { id: uuidv4(), userId, categoryId: CAT.dining, month: "2026-05", plannedAmount: "100", actualAmount: "85"  },
      { id: uuidv4(), userId, categoryId: CAT.coffee, month: "2026-05", plannedAmount: "30",  actualAmount: "38"  },
      { id: uuidv4(), userId, categoryId: CAT.fuel,   month: "2026-05", plannedAmount: "400", actualAmount: "180" },
      { id: uuidv4(), userId, categoryId: CAT.bills,  month: "2026-05", plannedAmount: "200", actualAmount: "165" },
      { id: uuidv4(), userId, categoryId: CAT.enter,  month: "2026-05", plannedAmount: "300", actualAmount: "95"  },
      { id: uuidv4(), userId, categoryId: CAT.sub,    month: "2026-05", plannedAmount: "250", actualAmount: "62"  },
      { id: uuidv4(), userId, categoryId: CAT.phone,  month: "2026-05", plannedAmount: "51",  actualAmount: "51"  },
      { id: uuidv4(), userId, categoryId: CAT.tx,     month: "2026-05", plannedAmount: "150", actualAmount: "45"  },
    ]);

    // 10. Transactions.
    const txns = buildTransactions(accSavings, accCurrent, accCard);
    const txnRows = txns.map(t => ({
      id: uuidv4(),
      userId,
      accountId: t.accountId,
      categoryId: t.categoryId,
      date: new Date(t.date),
      amount: t.amount.toFixed(2),
      type: t.type,
      description: t.description,
      merchant: t.merchant,
      source: "manual" as const,
    }));
    // Chunk to keep query size manageable.
    const CHUNK = 50;
    for (let i = 0; i < txnRows.length; i += CHUNK) {
      await db.insert(transactionsTable).values(txnRows.slice(i, i + CHUNK));
    }

    req.log.info({ userId, txnCount: txnRows.length }, "admin seed: demo user seeded");
    res.json({
      ok: true,
      userId,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      counts: {
        accounts: 3,
        commitments: 4,
        debts: 3,
        goals: 3,
        netWorthSnapshots: 6,
        insights: 3,
        budgets: 9,
        transactions: txnRows.length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "admin seed: failed");
    res.status(500).json({ error: "Seed failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// Silence unused-import warnings if downstream tooling complains.
void inArray;

export default router;
