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

    // Bug A1: Remove duplicate commitments — keep the earliest created per (user_id, label)
    await client.query(`
      DELETE FROM commitments
      WHERE id NOT IN (
        SELECT DISTINCT ON (user_id, label) id
        FROM commitments
        ORDER BY user_id, label, created_at ASC
      );
    `);
    // Bug A1: Enforce uniqueness — safe to add now that duplicates are removed above
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'commitments_user_id_label_unique'
        ) THEN
          ALTER TABLE commitments ADD CONSTRAINT commitments_user_id_label_unique UNIQUE (user_id, label);
        END IF;
      END $$;
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

    // Task #56: auth strengthening — password policy + email verification + reset tokens
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_weak boolean NOT NULL DEFAULT false;`);
    // Grandfather legacy users: if email_verified did not exist before this
    // migration, every existing row predates the verification requirement.
    // Backfill them to verified=true (with verified_at = now) so they retain
    // self-service password reset. Without this, /auth/forgot-password (which
    // is gated on emailVerified to prevent silent token loss to typo'd
    // addresses) would lock every pre-existing account out of recovery, and
    // /auth/resend-verification is auth-gated so they couldn't escape.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'email_verified'
        ) THEN
          ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
          UPDATE users SET email_verified = true, email_verified_at = now();
        END IF;
      END $$;
    `);
    // Idempotent fallbacks for fresh DBs / partial prior runs.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id"          text         PRIMARY KEY,
        "user_id"     text         NOT NULL,
        "token_hash"  text         NOT NULL UNIQUE,
        "expires_at"  timestamptz  NOT NULL,
        "used_at"     timestamptz,
        "created_at"  timestamptz  NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens (user_id);`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id"          text         PRIMARY KEY,
        "user_id"     text         NOT NULL,
        "token_hash"  text         NOT NULL UNIQUE,
        "expires_at"  timestamptz  NOT NULL,
        "used_at"     timestamptz,
        "created_at"  timestamptz  NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);`);

    // Social/passwordless sign-in: nullable password_hash (for Google/magic-link
    // only accounts), Google subject claim, and magic-link tokens table.
    await client.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_google_sub_unique'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_google_sub_unique UNIQUE (google_sub);
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
        "id"          text         PRIMARY KEY,
        "email"       text         NOT NULL,
        "token_hash"  text         NOT NULL UNIQUE,
        "expires_at"  timestamptz  NOT NULL,
        "used_at"     timestamptz,
        "created_at"  timestamptz  NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS magic_link_tokens_email_idx ON magic_link_tokens (email);`);

    logger.info("Startup migrations applied");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — aborting server start");
    throw err;
  } finally {
    client.release();
  }
}
