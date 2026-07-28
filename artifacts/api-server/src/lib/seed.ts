import {
  db,
  pool,
  categoriesTable,
  usersTable,
  profilesTable,
  commitmentsTable,
  debtsTable,
  transactionsTable,
  goalsTable,
  monthlyBudgetsTable,
} from "@workspace/db";
import { count, eq } from "drizzle-orm";
import { logger } from "./logger";

const CATEGORIES = [
  { id: "0580956b-de53-4219-ac43-989a137fda1e", name: "Groceries", kind: "expense", isDefault: true },
  { id: "305f179f-f27d-464a-b02a-11700aa908bb", name: "Dining", kind: "expense", isDefault: true },
  { id: "30670755-a27e-48cb-b7aa-9cec03bf3e40", name: "Public transport", kind: "expense", isDefault: true },
  { id: "3308c452-f790-43c5-81ab-b0234371907b", name: "Other", kind: "expense", isDefault: true },
  { id: "406c851a-c40e-4e7f-b684-2790b8c9d1eb", name: "Phone and Internet", kind: "expense", isDefault: true },
  { id: "45db0580-c39f-40b3-8e69-d2186fa18463", name: "School supplies", kind: "expense", isDefault: true },
  { id: "534851c0-2f47-4f91-9bf4-9e327cc05781", name: "Shopping", kind: "expense", isDefault: true },
  { id: "6f0ea787-4c36-48e1-ab94-a342cadb1c2a", name: "Bills and Utilities", kind: "expense", isDefault: true },
  { id: "7667206b-e2fc-4e27-b180-c35f98f923ce", name: "Insurance and Takaful", kind: "expense", isDefault: true },
  { id: "81c97cae-46bc-4fdb-b03d-39e36a36101c", name: "Entertainment", kind: "expense", isDefault: true },
  { id: "a1e10b08-d085-4c38-bd6c-e9fad03a4adb", name: "Health", kind: "expense", isDefault: true },
  { id: "afd87a7d-a3c3-4ad3-b5fe-f7612fe05e4b", name: "Family Support", kind: "expense", isDefault: true },
  { id: "b2baac4d-e5a4-4ee8-af57-1d30be1c6e13", name: "Fuel", kind: "expense", isDefault: true },
  { id: "dd2dea2f-dc71-4311-9803-5ed336385840", name: "Debt Repayment", kind: "expense", isDefault: true },
  { id: "ed3d2b26-81fa-4aaf-b7ac-c96f8734d17a", name: "Savings", kind: "savings", isDefault: true },
  // Income categories — needed so users can tag credit rows (e.g. payroll
  // deposits) on the statement import review screen.
  { id: "f1000000-0000-4000-8000-000000000001", name: "Salary", kind: "income", isDefault: true },
  { id: "f1000000-0000-4000-8000-000000000002", name: "Other income", kind: "income", isDefault: true },
];

// ── Hakem (BN region) ─────────────────────────────────────────────────────────
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
  region: "BN",
  locale: "en-BN",
  language: "en",
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
  if (existing.length > 0) {
    // Ensure region fields are populated on existing profile
    await db.update(profilesTable)
      .set({ region: "BN", locale: "en-BN", language: "en", currency: "BND" })
      .where(eq(profilesTable.userId, HAKEM_USER_ID));
    return;
  }

  await db.insert(usersTable).values(HAKEM_USER).onConflictDoNothing();
  await db.insert(profilesTable).values(HAKEM_PROFILE).onConflictDoNothing();
  await db.insert(commitmentsTable).values(HAKEM_COMMITMENTS).onConflictDoNothing();
  await db.insert(debtsTable).values(HAKEM_DEBTS).onConflictDoNothing();

  logger.info("Seeded Hakem's account data");
}

// ── Test MY user ──────────────────────────────────────────────────────────────
const TEST_MY_USER_ID = "c1a2b3c4-d5e6-7890-abcd-111111111101";
const TEST_MY_PROFILE_ID = "c1a2b3c4-d5e6-7890-abcd-111111111102";

const TEST_MY_USER = {
  id: TEST_MY_USER_ID,
  email: "test-my@duitplan.dev",
  passwordHash: "$2b$12$ljN3hWqZMbwH48zaeo87U.irjthGpwE4rx.sNRMZq2H.J/5e1qdra",
  onboardingCompleted: true,
};

const TEST_MY_PROFILE = {
  id: TEST_MY_PROFILE_ID,
  userId: TEST_MY_USER_ID,
  fullName: "Test User (MY)",
  currency: "MYR",
  region: "MY",
  locale: "ms-MY",
  language: "en",
  payday: 25,
  monthlyIncome: "7500.00",
};

const TEST_MY_TRANSACTIONS = [
  { id: "a1111111-0001-0000-0000-000000000001", userId: TEST_MY_USER_ID, date: new Date("2026-04-15"), amount: "7500.00", type: "income", description: "Monthly Salary", categoryId: null, source: "manual" },
  { id: "a1111111-0001-0000-0000-000000000002", userId: TEST_MY_USER_ID, date: new Date("2026-04-05"), amount: "185.50", type: "expense", description: "TM Unifi bill", categoryId: "6f0ea787-4c36-48e1-ab94-a342cadb1c2a", source: "manual" },
  { id: "a1111111-0001-0000-0000-000000000003", userId: TEST_MY_USER_ID, date: new Date("2026-04-08"), amount: "320.00", type: "expense", description: "Grocery run – Jaya Grocer", categoryId: "0580956b-de53-4219-ac43-989a137fda1e", source: "manual" },
  { id: "a1111111-0001-0000-0000-000000000004", userId: TEST_MY_USER_ID, date: new Date("2026-04-10"), amount: "88.00", type: "expense", description: "Grab rides – week", categoryId: "30670755-a27e-48cb-b7aa-9cec03bf3e40", source: "manual" },
  { id: "a1111111-0001-0000-0000-000000000005", userId: TEST_MY_USER_ID, date: new Date("2026-04-14"), amount: "55.00", type: "expense", description: "GSC Cinema – weekend outing", categoryId: "81c97cae-46bc-4fdb-b03d-39e36a36101c", source: "manual" },
];

const TEST_MY_DEBT = {
  id: "a1111111-0002-0000-0000-000000000001",
  userId: TEST_MY_USER_ID,
  debtType: "personal_loan",
  lender: "Maybank Personal Financing",
  outstandingBalance: "28500.00",
  monthlyPayment: "650.00",
};

const TEST_MY_GOAL = {
  id: "a1111111-0003-0000-0000-000000000001",
  userId: TEST_MY_USER_ID,
  title: "Emergency Fund 6 Months",
  category: "emergency",
  targetAmount: "45000.00",
  savedAmount: "12000.00",
  deadline: "2027-12-31",
};

const TEST_MY_BUDGET = {
  id: "a1111111-0004-0000-0000-000000000001",
  userId: TEST_MY_USER_ID,
  categoryId: "0580956b-de53-4219-ac43-989a137fda1e",
  month: "2026-04",
  plannedAmount: "400.00",
  actualAmount: "320.00",
};

async function seedTestMyData() {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, TEST_MY_USER.email));
  if (existing.length > 0) return;

  await db.insert(usersTable).values(TEST_MY_USER).onConflictDoNothing();
  await db.insert(profilesTable).values(TEST_MY_PROFILE).onConflictDoNothing();
  await db.insert(transactionsTable).values(TEST_MY_TRANSACTIONS).onConflictDoNothing();
  await db.insert(debtsTable).values(TEST_MY_DEBT).onConflictDoNothing();
  await db.insert(goalsTable).values(TEST_MY_GOAL).onConflictDoNothing();
  await db.insert(monthlyBudgetsTable).values(TEST_MY_BUDGET).onConflictDoNothing();

  logger.info("Seeded test-my@duitplan.dev account");
}

// ── Test ID user ──────────────────────────────────────────────────────────────
const TEST_ID_USER_ID = "d2b3c4d5-e6f7-8901-bcde-222222222201";
const TEST_ID_PROFILE_ID = "d2b3c4d5-e6f7-8901-bcde-222222222202";

const TEST_ID_USER = {
  id: TEST_ID_USER_ID,
  email: "test-id@duitplan.dev",
  passwordHash: "$2b$12$EMFKJU3fuvedDU8Rd7xOXOR8zfqTjFlyrEEnw5iTt6pLw9TEEdelC",
  onboardingCompleted: true,
};

const TEST_ID_PROFILE = {
  id: TEST_ID_PROFILE_ID,
  userId: TEST_ID_USER_ID,
  fullName: "Test User (ID)",
  currency: "IDR",
  region: "ID",
  locale: "id-ID",
  language: "en",
  payday: 25,
  monthlyIncome: "12000000.00",
};

const TEST_ID_TRANSACTIONS = [
  { id: "b2222222-0001-0000-0000-000000000001", userId: TEST_ID_USER_ID, date: new Date("2026-04-25"), amount: "12000000.00", type: "income", description: "Gaji Bulanan", categoryId: null, source: "manual" },
  { id: "b2222222-0001-0000-0000-000000000002", userId: TEST_ID_USER_ID, date: new Date("2026-04-05"), amount: "450000.00", type: "expense", description: "Tagihan Listrik & Internet", categoryId: "6f0ea787-4c36-48e1-ab94-a342cadb1c2a", source: "manual" },
  { id: "b2222222-0001-0000-0000-000000000003", userId: TEST_ID_USER_ID, date: new Date("2026-04-09"), amount: "850000.00", type: "expense", description: "Belanja di Superindo", categoryId: "0580956b-de53-4219-ac43-989a137fda1e", source: "manual" },
  { id: "b2222222-0001-0000-0000-000000000004", userId: TEST_ID_USER_ID, date: new Date("2026-04-11"), amount: "320000.00", type: "expense", description: "Ojek online – seminggu", categoryId: "30670755-a27e-48cb-b7aa-9cec03bf3e40", source: "manual" },
  { id: "b2222222-0001-0000-0000-000000000005", userId: TEST_ID_USER_ID, date: new Date("2026-04-16"), amount: "180000.00", type: "expense", description: "Bioskop CGV akhir pekan", categoryId: "81c97cae-46bc-4fdb-b03d-39e36a36101c", source: "manual" },
];

const TEST_ID_DEBT = {
  id: "b2222222-0002-0000-0000-000000000001",
  userId: TEST_ID_USER_ID,
  debtType: "personal_loan",
  lender: "KTA Bank Mandiri",
  outstandingBalance: "75000000.00",
  monthlyPayment: "2100000.00",
};

const TEST_ID_GOAL = {
  id: "b2222222-0003-0000-0000-000000000001",
  userId: TEST_ID_USER_ID,
  title: "Dana Darurat 6 Bulan",
  category: "emergency",
  targetAmount: "72000000.00",
  savedAmount: "18000000.00",
  deadline: "2027-12-31",
};

const TEST_ID_BUDGET = {
  id: "b2222222-0004-0000-0000-000000000001",
  userId: TEST_ID_USER_ID,
  categoryId: "0580956b-de53-4219-ac43-989a137fda1e",
  month: "2026-04",
  plannedAmount: "1000000.00",
  actualAmount: "850000.00",
};

async function seedTestIdData() {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, TEST_ID_USER.email));
  if (existing.length > 0) return;

  await db.insert(usersTable).values(TEST_ID_USER).onConflictDoNothing();
  await db.insert(profilesTable).values(TEST_ID_PROFILE).onConflictDoNothing();
  await db.insert(transactionsTable).values(TEST_ID_TRANSACTIONS).onConflictDoNothing();
  await db.insert(debtsTable).values(TEST_ID_DEBT).onConflictDoNothing();
  await db.insert(goalsTable).values(TEST_ID_GOAL).onConflictDoNothing();
  await db.insert(monthlyBudgetsTable).values(TEST_ID_BUDGET).onConflictDoNothing();

  logger.info("Seeded test-id@duitplan.dev account");
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

    // Backfill: ensure every default category exists by id, even if the table
    // was previously partially-pruned (e.g. by older onboarding flows that
    // deleted unselected defaults). Per-row onConflictDoNothing keeps existing
    // rows (and any user edits to defaultBudget) untouched.
    const [{ value: catCountBefore }] = await db.select({ value: count() }).from(categoriesTable);
    const inserted = await db
      .insert(categoriesTable)
      .values(CATEGORIES)
      .onConflictDoNothing()
      .returning({ id: categoriesTable.id });
    if (inserted.length > 0) {
      logger.info(
        { inserted: inserted.length, before: catCountBefore, total: CATEGORIES.length },
        catCountBefore === 0 ? "Seeded categories" : "Backfilled missing default categories",
      );
    }

    await seedHakemData();
    await seedTestMyData();
    await seedTestIdData();
  } catch (err) {
    logger.error({ err }, "Seed failed — continuing startup");
  }
}
