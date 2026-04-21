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
      WHERE region IS NULL OR region = '';
    `);
    logger.info("Startup migrations applied");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — aborting server start");
    throw err;
  } finally {
    client.release();
  }
}
