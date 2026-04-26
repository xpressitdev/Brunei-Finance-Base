/**
 * Migration: Remove duplicate loan entries from commitments table
 *
 * Loan types (car_loan, personal_loan, house_financing, credit_card) were
 * incorrectly exposed in both onboarding Step 3 (commitments) AND Step 5 (debts),
 * causing double-counting in the "Remaining this month" dashboard calculation.
 *
 * This script:
 *  - In DRY_RUN mode (default): prints what would happen, no writes
 *  - In DESTRUCTIVE mode (MIGRATION_DRY_RUN=false): deletes/converts the rows
 *
 * Usage:
 *   pnpm --filter @workspace/scripts tsx src/migrate-loan-commitments.ts
 *
 * To run destructive mode (REVIEW DRY-RUN OUTPUT FIRST):
 *   MIGRATION_DRY_RUN=false pnpm --filter @workspace/scripts tsx src/migrate-loan-commitments.ts
 */

import pg from "pg";

const { Pool } = pg;

const DRY_RUN = process.env["MIGRATION_DRY_RUN"] !== "false";

// All known labels written by onboarding presets across all 3 locales
const LOAN_LABEL_TO_DEBT_TYPE: Record<string, string> = {
  // EN
  "Car Loan": "car_loan",
  "Personal Loan": "personal_loan",
  "House Financing": "mortgage",
  "Credit Card": "credit_card",
  // MS
  "Pinjaman Kereta": "car_loan",
  "Pinjaman Peribadi": "personal_loan",
  "Pembiayaan Rumah": "mortgage",
  "Kad Kredit": "credit_card",
  // ID
  "Kredit Kendaraan": "car_loan",
  "Pinjaman Pribadi": "personal_loan",
  "KPR": "mortgage",
  "Kartu Kredit": "credit_card",
};

const LOAN_LABELS = Object.keys(LOAN_LABEL_TO_DEBT_TYPE);

type CommitmentRow = {
  id: string;
  user_id: string;
  user_email: string;
  label: string;
  amount: string;
};

type DebtRow = {
  id: string;
  user_id: string;
  debt_type: string;
  lender: string;
  monthly_payment: string;
};

type MigrationAction = {
  user_id: string;
  user_email: string;
  commitment_id: string;
  commitment_type: string;
  commitment_monthly_payment: string;
  matching_debt_id: string | null;
  matching_debt_monthly_payment: string | null;
  action: "delete" | "convert";
  notes: string;
};

async function main() {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  const client = await pool.connect();

  console.log("=".repeat(80));
  console.log(`MIGRATION: loan commitments → debts`);
  console.log(`MODE: ${DRY_RUN ? "DRY-RUN (no writes)" : "⚠️  DESTRUCTIVE — WRITING TO DATABASE"}`);
  console.log("=".repeat(80));
  console.log();

  try {
    // Build placeholder list for IN clause
    const placeholders = LOAN_LABELS.map((_, i) => `$${i + 1}`).join(", ");

    const { rows: commitments } = await client.query<CommitmentRow>(`
      SELECT c.id, c.user_id, u.email AS user_email, c.label, c.amount
      FROM commitments c
      JOIN users u ON u.id = c.user_id
      WHERE c.label IN (${placeholders})
      ORDER BY c.user_id, c.label
    `, LOAN_LABELS);

    if (commitments.length === 0) {
      console.log("✅ No affected commitment rows found. Nothing to migrate.");
      return;
    }

    const { rows: debts } = await client.query<DebtRow>(`
      SELECT id, user_id, debt_type, lender, monthly_payment
      FROM debts
      WHERE debt_type IN ('car_loan', 'personal_loan', 'mortgage', 'credit_card')
    `);

    const actions: MigrationAction[] = [];
    const anomalies: string[] = [];
    let statsDelete = 0;
    let statsConvert = 0;

    const userCommitmentCounts: Record<string, Record<string, number>> = {};

    for (const c of commitments) {
      const debtType = LOAN_LABEL_TO_DEBT_TYPE[c.label];
      if (!debtType) continue;

      // Check for duplicates of same loan type per user
      const key = `${c.user_id}:${debtType}`;
      userCommitmentCounts[key] = userCommitmentCounts[key] ?? {};
      userCommitmentCounts[key][c.id] = (userCommitmentCounts[key][c.id] ?? 0) + 1;

      const matchingDebt = debts.find(d => d.user_id === c.user_id && d.debt_type === debtType);

      let action: "delete" | "convert";
      let notes = "";

      if (matchingDebt) {
        action = "delete";
        statsDelete++;
        const commitmentAmt = parseFloat(c.amount);
        const debtAmt = parseFloat(matchingDebt.monthly_payment);
        if (Math.abs(commitmentAmt - debtAmt) > 0.01) {
          const msg = `⚠️  ANOMALY: commitment amount ${c.amount} ≠ debt monthly_payment ${matchingDebt.monthly_payment} for user ${c.user_id} (${c.user_email}), label "${c.label}"`;
          anomalies.push(msg);
          notes = `ANOMALY: amount mismatch — commitment=${c.amount}, debt=${matchingDebt.monthly_payment}`;
        }
      } else {
        action = "convert";
        statsConvert++;
        notes = "No matching debt row found — will create new debt with outstanding_balance=0";
      }

      actions.push({
        user_id: c.user_id,
        user_email: c.user_email,
        commitment_id: c.id,
        commitment_type: debtType,
        commitment_monthly_payment: c.amount,
        matching_debt_id: matchingDebt?.id ?? null,
        matching_debt_monthly_payment: matchingDebt?.monthly_payment ?? null,
        action,
        notes,
      });
    }

    // Check for duplicate commitment types per user (data corruption indicator)
    for (const [key, ids] of Object.entries(userCommitmentCounts)) {
      if (Object.keys(ids).length > 1) {
        anomalies.push(`⚠️  ANOMALY: user ${key.split(":")[0]} has multiple commitments of type ${key.split(":")[1]}`);
      }
    }

    // Print dry-run table
    console.log("AFFECTED ROWS:");
    console.log("-".repeat(120));
    const header = [
      "user_email".padEnd(32),
      "commitment_id".padEnd(38),
      "type".padEnd(16),
      "c_amount".padEnd(10),
      "debt_id".padEnd(38),
      "d_payment".padEnd(10),
      "action".padEnd(8),
      "notes",
    ].join(" | ");
    console.log(header);
    console.log("-".repeat(120));

    for (const a of actions) {
      const row = [
        (a.user_email ?? "").substring(0, 31).padEnd(32),
        a.commitment_id.padEnd(38),
        a.commitment_type.padEnd(16),
        a.commitment_monthly_payment.padEnd(10),
        (a.matching_debt_id ?? "null").padEnd(38),
        (a.matching_debt_monthly_payment ?? "null").padEnd(10),
        a.action.padEnd(8),
        a.notes,
      ].join(" | ");
      console.log(row);
    }

    console.log();
    console.log("SUMMARY:");
    console.log(`  Total affected users:          ${new Set(actions.map(a => a.user_id)).size}`);
    console.log(`  Commitments to DELETE:         ${statsDelete} (matching debt exists → delete commitment)`);
    console.log(`  Commitments to CONVERT:        ${statsConvert} (no matching debt → create debt, delete commitment)`);
    console.log(`  Anomalies:                     ${anomalies.length}`);

    if (anomalies.length > 0) {
      console.log();
      console.log("ANOMALY DETAILS:");
      for (const a of anomalies) console.log("  " + a);
      if (!DRY_RUN) {
        console.error("\n❌ Anomalies detected. Aborting destructive migration. Review anomalies above.");
        process.exit(1);
      }
    }

    if (DRY_RUN) {
      console.log();
      console.log("DRY-RUN COMPLETE. No database changes were made.");
      console.log("To execute destructive mode: MIGRATION_DRY_RUN=false pnpm --filter @workspace/scripts tsx src/migrate-loan-commitments.ts");
      return;
    }

    // ── DESTRUCTIVE MODE ─────────────────────────────────────────────────────
    console.log();
    console.log("⚠️  EXECUTING DESTRUCTIVE MIGRATION...");

    await client.query("BEGIN");
    try {
      for (const a of actions) {
        if (a.action === "delete") {
          await client.query(`DELETE FROM commitments WHERE id = $1`, [a.commitment_id]);
        } else {
          // Convert: insert new debt, then delete commitment
          const { v4: uuidv4 } = await import("uuid");
          await client.query(`
            INSERT INTO debts (id, user_id, debt_type, lender, outstanding_balance, monthly_payment, migration_source, created_at, updated_at)
            VALUES ($1, $2, $3, $4, '0', $5, 'commitment_auto_migrated', now(), now())
          `, [uuidv4(), a.user_id, a.commitment_type, a.commitment_type.replace(/_/g, " "), a.commitment_monthly_payment]);
          await client.query(`DELETE FROM commitments WHERE id = $1`, [a.commitment_id]);
        }
      }
      await client.query("COMMIT");
      console.log("✅ Migration complete.");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Migration failed — rolled back:", err);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
