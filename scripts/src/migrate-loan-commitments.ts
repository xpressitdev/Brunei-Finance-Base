/**
 * Migration: Remove duplicate loan entries from commitments table
 *
 * Loan types (car_loan, personal_loan, house_financing, credit_card) were
 * incorrectly exposed in both onboarding Step 3 (commitments) AND Step 5 (debts),
 * causing double-counting in the "Remaining this month" dashboard calculation.
 *
 * This script:
 *  - In DRY_RUN mode (default): prints what would happen, no writes
 *  - In DESTRUCTIVE mode (MIGRATION_DRY_RUN=false): executes the migration
 *
 * Usage:
 *   pnpm --filter @workspace/scripts tsx src/migrate-loan-commitments.ts
 *
 * To run destructive mode (REVIEW DRY-RUN OUTPUT FIRST):
 *   MIGRATION_DRY_RUN=false pnpm --filter @workspace/scripts tsx src/migrate-loan-commitments.ts
 *
 * ── DEDUPLICATION LOGIC ──────────────────────────────────────────────────────
 * Commitments are grouped by (user_id, loan_type). For each group:
 *
 *   Case A — matching debt already exists:
 *     Delete ALL commitments in the group. The debt stays; we just remove the
 *     double-counted commitment.
 *
 *   Case B — no matching debt:
 *     Convert only the FIRST commitment (earliest created_at) into a new debt
 *     row (outstanding_balance=0, migration_source='commitment_auto_migrated').
 *     Delete the remaining commitments as "delete_duplicate" — no extra debt rows.
 *
 * "First" is defined as earliest created_at. This is deterministic because
 * created_at is set by the database default (now()) at INSERT time and
 * commitments are inserted sequentially by the onboarding wizard.
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
  created_at: string;
};

type DebtRow = {
  id: string;
  user_id: string;
  debt_type: string;
  lender: string;
  monthly_payment: string;
};

// "delete"          — commitment has a matching debt; just delete the commitment
// "convert"         — first commitment of a type with no matching debt; create debt + delete commitment
// "delete_duplicate"— extra commitments of the same type with no matching debt; delete only, no debt created
type ActionKind = "delete" | "convert" | "delete_duplicate";

type MigrationAction = {
  user_id: string;
  user_email: string;
  commitment_id: string;
  commitment_type: string;
  commitment_monthly_payment: string;
  matching_debt_id: string | null;
  matching_debt_monthly_payment: string | null;
  action: ActionKind;
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
    const placeholders = LOAN_LABELS.map((_, i) => `$${i + 1}`).join(", ");

    // ORDER BY created_at ensures group[0] is always the earliest row —
    // this makes the "first commitment to convert" choice deterministic.
    const { rows: commitments } = await client.query<CommitmentRow>(`
      SELECT c.id, c.user_id, u.email AS user_email, c.label, c.amount, c.created_at
      FROM commitments c
      JOIN users u ON u.id = c.user_id
      WHERE c.label IN (${placeholders})
      ORDER BY c.user_id, c.label, c.created_at ASC
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

    // ── GROUP commitments by (user_id, loan_type) ────────────────────────────
    // Key: "<user_id>:<debt_type>"  Value: commitments in ascending created_at order
    const groups = new Map<string, CommitmentRow[]>();
    for (const c of commitments) {
      const debtType = LOAN_LABEL_TO_DEBT_TYPE[c.label];
      if (!debtType) continue;
      const key = `${c.user_id}:${debtType}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const actions: MigrationAction[] = [];
    const anomalies: string[] = [];
    let statsDelete = 0;
    let statsConvert = 0;
    let statsDeleteDuplicate = 0;

    for (const [key, group] of groups) {
      const [user_id, debtType] = key.split(":");
      const matchingDebt = debts.find(d => d.user_id === user_id && d.debt_type === debtType);

      if (matchingDebt) {
        // ── Case A: matching debt exists — delete every commitment in the group ──
        for (const c of group) {
          const commitmentAmt = parseFloat(c.amount);
          const debtAmt = parseFloat(matchingDebt.monthly_payment);
          let notes = "";
          if (Math.abs(commitmentAmt - debtAmt) > 0.01) {
            const msg = `⚠️  ANOMALY: amount mismatch for ${c.user_email} label "${c.label}" — commitment=${c.amount}, debt=${matchingDebt.monthly_payment}`;
            anomalies.push(msg);
            notes = `ANOMALY: amount mismatch — commitment=${c.amount}, debt=${matchingDebt.monthly_payment}`;
          }
          statsDelete++;
          actions.push({
            user_id: c.user_id,
            user_email: c.user_email,
            commitment_id: c.id,
            commitment_type: debtType,
            commitment_monthly_payment: c.amount,
            matching_debt_id: matchingDebt.id,
            matching_debt_monthly_payment: matchingDebt.monthly_payment,
            action: "delete",
            notes,
          });
        }
      } else {
        // ── Case B: no matching debt — convert first, delete rest as duplicates ──
        const [first, ...rest] = group;

        // Convert the earliest commitment to a new debt row
        statsConvert++;
        const firstNotes = rest.length > 0
          ? `First of ${group.length} duplicates — will create new debt with outstanding_balance=0`
          : "Will create new debt with outstanding_balance=0";
        actions.push({
          user_id: first.user_id,
          user_email: first.user_email,
          commitment_id: first.id,
          commitment_type: debtType,
          commitment_monthly_payment: first.amount,
          matching_debt_id: null,
          matching_debt_monthly_payment: null,
          action: "convert",
          notes: firstNotes,
        });

        // Delete remaining duplicates without creating extra debt rows
        for (const c of rest) {
          statsDeleteDuplicate++;
          actions.push({
            user_id: c.user_id,
            user_email: c.user_email,
            commitment_id: c.id,
            commitment_type: debtType,
            commitment_monthly_payment: c.amount,
            matching_debt_id: null,
            matching_debt_monthly_payment: null,
            action: "delete_duplicate",
            notes: `Duplicate of ${first.id} — deleted without creating a debt row`,
          });
        }
      }
    }

    // ── Print dry-run table ───────────────────────────────────────────────────
    console.log("AFFECTED ROWS:");
    console.log("-".repeat(136));
    const header = [
      "user_email".padEnd(32),
      "commitment_id".padEnd(38),
      "type".padEnd(16),
      "c_amount".padEnd(10),
      "debt_id".padEnd(38),
      "d_payment".padEnd(10),
      "action".padEnd(16),
      "notes",
    ].join(" | ");
    console.log(header);
    console.log("-".repeat(136));

    for (const a of actions) {
      const row = [
        (a.user_email ?? "").substring(0, 31).padEnd(32),
        a.commitment_id.padEnd(38),
        a.commitment_type.padEnd(16),
        a.commitment_monthly_payment.padEnd(10),
        (a.matching_debt_id ?? "null").padEnd(38),
        (a.matching_debt_monthly_payment ?? "null").padEnd(10),
        a.action.padEnd(16),
        a.notes,
      ].join(" | ");
      console.log(row);
    }

    console.log();
    console.log("SUMMARY:");
    console.log(`  Total affected users:                     ${new Set(actions.map(a => a.user_id)).size}`);
    console.log(`  Commitments to DELETE (debt exists):      ${statsDelete}`);
    console.log(`  Commitments to CONVERT (first, no debt):  ${statsConvert}`);
    console.log(`  Commitments DELETE_DUPLICATE (no debt):   ${statsDeleteDuplicate}  ← would have created extra debt rows in the buggy version`);
    console.log(`  Anomalies:                                ${anomalies.length}`);

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
      console.log("To execute: MIGRATION_DRY_RUN=false pnpm --filter @workspace/scripts exec tsx src/migrate-loan-commitments.ts");
      return;
    }

    // ── DESTRUCTIVE MODE ─────────────────────────────────────────────────────
    console.log();
    console.log("⚠️  EXECUTING DESTRUCTIVE MIGRATION...");

    const { v4: uuidv4 } = await import("uuid");

    await client.query("BEGIN");
    try {
      for (const a of actions) {
        if (a.action === "delete" || a.action === "delete_duplicate") {
          // delete_duplicate: remove the extra commitment row; no debt created
          await client.query(`DELETE FROM commitments WHERE id = $1`, [a.commitment_id]);
        } else {
          // convert: insert new debt with outstanding_balance=0, then delete commitment
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
