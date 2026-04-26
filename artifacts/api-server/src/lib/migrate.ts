import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS start_date date;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "asset_entries" (
        "id"           text           PRIMARY KEY,
        "user_id"      text           NOT NULL,
        "category"     text           NOT NULL,
        "name"         text           NOT NULL,
        "value"        numeric(14, 2) NOT NULL,
        "month"        text           NOT NULL,
        "created_at"   timestamptz    NOT NULL DEFAULT now(),
        "updated_at"   timestamptz    NOT NULL DEFAULT now()
      );
    `);
    await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance numeric(14,2) NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS next_billing_date timestamptz;`);
    await client.query(`ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS pocket_order_id text;`);
    await client.query(`
      DELETE FROM subscription_plans WHERE id = '9bae83c8-878b-40ad-bfcc-5b1fbcbc5fa9';
    `);
    await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'BN';`);
    await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en-BN';`);
    await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';`);
    await client.query(`
      UPDATE profiles SET region = 'BN', locale = 'en-BN', language = 'en'
      WHERE (region IS NULL OR region = '')
         OR (locale IS NULL OR locale = '')
         OR (language IS NULL OR language = '');
    `);
    await client.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS migration_source text;`);
    await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS migration_notice_dismissed boolean NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_debt_id text;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;`);
    await client.query(`UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL;`);

    // Bug A1: Remove duplicate commitments — keep the earliest created per (user_id, label).
    // The unique constraint is added separately via schema migration after this dedupe runs.
    await client.query(`
      DELETE FROM commitments
      WHERE id NOT IN (
        SELECT DISTINCT ON (user_id, label) id
        FROM commitments
        ORDER BY user_id, label, created_at ASC
      );
    `);

    // Bug A2: Backfill linked_debt_id on legacy payday_prompt debit transactions
    // that pre-date M1.6 (created before linked_debt_id was being set).
    // Match by amount to the user's debt with the same monthly_payment.
    await client.query(`
      UPDATE transactions t
      SET linked_debt_id = (
        SELECT d.id
        FROM debts d
        WHERE d.user_id = t.user_id
          AND d.monthly_payment::numeric = t.amount::numeric
        LIMIT 1
      )
      WHERE t.source = 'payday_prompt'
        AND t.type = 'debit'
        AND (t.linked_debt_id IS NULL OR t.linked_debt_id = '')
        AND EXISTS (
          SELECT 1 FROM debts d
          WHERE d.user_id = t.user_id
            AND d.monthly_payment::numeric = t.amount::numeric
        );
    `);

    logger.info("Startup migrations applied");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — aborting server start");
    throw err;
  } finally {
    client.release();
  }
}
