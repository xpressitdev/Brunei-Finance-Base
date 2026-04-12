import { pgTable, text, numeric, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const debtsTable = pgTable("debts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  debtType: text("debt_type").notNull(),
  lender: text("lender").notNull(),
  outstandingBalance: numeric("outstanding_balance", { precision: 12, scale: 2 }).notNull(),
  monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 7, scale: 4 }),
  targetExtraPayment: numeric("target_extra_payment", { precision: 12, scale: 2 }),
  startDate: date("start_date"),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const debtScenariosTable = pgTable("debt_scenarios", {
  id: text("id").primaryKey(),
  debtId: text("debt_id").notNull(),
  extraMonthlyPayment: numeric("extra_monthly_payment", { precision: 12, scale: 2 }).notNull(),
  estimatedMonthsSaved: integer("estimated_months_saved"),
  estimatedPayoffDate: timestamp("estimated_payoff_date", { withTimezone: true }),
  basePayoffMonths: integer("base_payoff_months"),
  newPayoffMonths: integer("new_payoff_months"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDebtSchema = createInsertSchema(debtsTable).omit({ createdAt: true, updatedAt: true });
export type InsertDebt = z.infer<typeof insertDebtSchema>;
export type Debt = typeof debtsTable.$inferSelect;

export const insertDebtScenarioSchema = createInsertSchema(debtScenariosTable).omit({ createdAt: true });
export type InsertDebtScenario = z.infer<typeof insertDebtScenarioSchema>;
export type DebtScenario = typeof debtScenariosTable.$inferSelect;
