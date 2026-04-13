import {
  db,
  pool,
  categoriesTable,
  subscriptionPlansTable,
  usersTable,
  profilesTable,
  commitmentsTable,
  debtsTable,
} from "@workspace/db";
import { count, eq } from "drizzle-orm";
import { logger } from "./logger";

const CATEGORIES = [
  { id: "0580956b-de53-4219-ac43-989a137fda1e", name: "Groceries", kind: "expense", isDefault: true },
  { id: "305f179f-f27d-464a-b02a-11700aa908bb", name: "Dining", kind: "expense", isDefault: true },
  { id: "30670755-a27e-48cb-b7aa-9cec03bf3e40", name: "Transport", kind: "expense", isDefault: true },
  { id: "3308c452-f790-43c5-81ab-b0234371907b", name: "Other", kind: "expense", isDefault: true },
  { id: "406c851a-c40e-4e7f-b684-2790b8c9d1eb", name: "Phone and Internet", kind: "expense", isDefault: true },
  { id: "45db0580-c39f-40b3-8e69-d2186fa18463", name: "Education", kind: "expense", isDefault: true },
  { id: "534851c0-2f47-4f91-9bf4-9e327cc05781", name: "Shopping", kind: "expense", isDefault: true },
  { id: "6f0ea787-4c36-48e1-ab94-a342cadb1c2a", name: "Bills and Utilities", kind: "expense", isDefault: true },
  { id: "7667206b-e2fc-4e27-b180-c35f98f923ce", name: "Insurance and Takaful", kind: "expense", isDefault: true },
  { id: "81c97cae-46bc-4fdb-b03d-39e36a36101c", name: "Entertainment", kind: "expense", isDefault: true },
  { id: "a1e10b08-d085-4c38-bd6c-e9fad03a4adb", name: "Health", kind: "expense", isDefault: true },
  { id: "afd87a7d-a3c3-4ad3-b5fe-f7612fe05e4b", name: "Family Support", kind: "expense", isDefault: true },
  { id: "b2baac4d-e5a4-4ee8-af57-1d30be1c6e13", name: "Fuel", kind: "expense", isDefault: true },
  { id: "dd2dea2f-dc71-4311-9803-5ed336385840", name: "Debt Repayment", kind: "expense", isDefault: true },
  { id: "ed3d2b26-81fa-4aaf-b7ac-c96f8734d17a", name: "Savings", kind: "savings", isDefault: true },
];

const PLANS = [
  {
    id: "9bae83c8-878b-40ad-bfcc-5b1fbcbc5fa9",
    name: "Free",
    price: "0.00",
    billingInterval: "monthly",
    features: ["Up to 50 transactions/month", "Basic budgeting", "1 account"],
  },
  {
    id: "965eca59-2f7a-415f-b9b7-2588ec9cfb2c",
    name: "Premium",
    price: "9.90",
    billingInterval: "monthly",
    features: [
      "Unlimited transactions",
      "PDF & screenshot import",
      "Debt scenarios",
      "AI insights",
      "Priority support",
    ],
  },
];

const HAKEM_USER_ID = "48cdc97e-088c-456b-bcd0-c88b526a6d60";

const HAKEM_USER = {
  id: HAKEM_USER_ID,
  email: "hakemshahbirin@live.com",
  passwordHash: "$2b$12$Q4lRQqadA7.kFiHe7.ts4uCrDS8E3bYl.qgoIIc6BCOO04ZO0ITmi",
  onboardingCompleted: true,
};

const HAKEM_PROFILE = {
  id: "0537cf4e-b6bd-42d1-8774-df4e5d62e4d2",
  userId: HAKEM_USER_ID,
  fullName: "Hakem Shah",
  currency: "BND",
  payday: 22,
  monthlyIncome: "5026.62",
};

const HAKEM_COMMITMENTS = [
  { id: "f2fa2d2e-b1a8-4047-a025-e2412a5f67b8", userId: HAKEM_USER_ID, label: "Car Loan", amount: "754.00", dueDay: 1, recurrence: "monthly" },
  { id: "d6f9d9ce-ae03-47ef-b64b-5cc0412497c7", userId: HAKEM_USER_ID, label: "Harris DES School fee", amount: "165.00", dueDay: 1, recurrence: "monthly" },
  { id: "3ea50612-c30c-40cd-a100-081c480da9f4", userId: HAKEM_USER_ID, label: "Haidar Rising Star School fee", amount: "350.00", dueDay: 1, recurrence: "monthly" },
  { id: "22277e66-f468-4aac-ab46-8369577db6e6", userId: HAKEM_USER_ID, label: "DST Bill", amount: "85.00", dueDay: 1, recurrence: "monthly" },
  { id: "cee5c01e-54b2-4165-a999-d249d1959bb2", userId: HAKEM_USER_ID, label: "DST Infinity Bill", amount: "128.00", dueDay: 1, recurrence: "monthly" },
  { id: "22aa7f4a-f35f-42f1-a346-14f0567fbddc", userId: HAKEM_USER_ID, label: "ChatGPT", amount: "30.00", dueDay: 1, recurrence: "monthly" },
  { id: "eff96e20-750f-4fa3-bfed-6b5c754b64b2", userId: HAKEM_USER_ID, label: "Google Gemini", amount: "30.00", dueDay: 1, recurrence: "monthly" },
  { id: "c272a485-9c3a-4a39-8050-3648349ab437", userId: HAKEM_USER_ID, label: "Netflix", amount: "25.00", dueDay: 1, recurrence: "monthly" },
];

const HAKEM_DEBTS = [
  {
    id: "9ba541e4-3859-4d1d-b080-530af1cfea1d",
    userId: HAKEM_USER_ID,
    debtType: "personal_loan",
    lender: "BIBD Tawarruq Loan 1",
    outstandingBalance: "65931.47",
    monthlyPayment: "1533.29",
  },
  {
    id: "c4b65414-63bf-4da9-be04-cd5ae41aa249",
    userId: HAKEM_USER_ID,
    debtType: "personal_loan",
    lender: "BIBD Tawarruq Loan 2",
    outstandingBalance: "42245.28",
    monthlyPayment: "640.08",
  },
];

async function seedHakemData() {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, HAKEM_USER.email));
  if (existing.length > 0) return;

  await db.insert(usersTable).values(HAKEM_USER).onConflictDoNothing();
  await db.insert(profilesTable).values(HAKEM_PROFILE).onConflictDoNothing();
  await db.insert(commitmentsTable).values(HAKEM_COMMITMENTS).onConflictDoNothing();
  await db.insert(debtsTable).values(HAKEM_DEBTS).onConflictDoNothing();

  logger.info("Seeded Hakem's account data");
}

async function ensureSessionsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");
    `);
    logger.info("Sessions table ready");
  } finally {
    client.release();
  }
}

export async function seedIfEmpty() {
  try {
    await ensureSessionsTable();

    const [{ value: catCount }] = await db.select({ value: count() }).from(categoriesTable);
    if (catCount === 0) {
      await db.insert(categoriesTable).values(CATEGORIES).onConflictDoNothing();
      logger.info({ count: CATEGORIES.length }, "Seeded categories");
    }

    const [{ value: planCount }] = await db.select({ value: count() }).from(subscriptionPlansTable);
    if (planCount === 0) {
      await db.insert(subscriptionPlansTable).values(PLANS).onConflictDoNothing();
      logger.info({ count: PLANS.length }, "Seeded subscription plans");
    }

    await seedHakemData();
  } catch (err) {
    logger.error({ err }, "Seed failed — continuing startup");
  }
}
