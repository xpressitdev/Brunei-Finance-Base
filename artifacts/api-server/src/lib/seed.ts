import { db, categoriesTable, subscriptionPlansTable } from "@workspace/db";
import { count } from "drizzle-orm";
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

export async function seedIfEmpty() {
  try {
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
  } catch (err) {
    logger.error({ err }, "Seed failed — continuing startup");
  }
}
