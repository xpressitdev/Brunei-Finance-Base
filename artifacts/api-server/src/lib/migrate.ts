import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS start_date date;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_entries (
        id           text           PRIMARY KEY,
        user_id      text           NOT NULL,
        category     text           NOT NULL,
        name         text           NOT NULL,
        value        numeric(14, 2) NOT NULL,
        month        text           NOT NULL,
        created_at   timestamptz    NOT NULL DEFAULT now(),
        updated_at   timestamptz    NOT NULL DEFAULT now()
      );
    `);
    logger.info("Startup migrations applied (debts.start_date, asset_entries)");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — aborting server start");
    throw err;
  } finally {
    client.release();
  }
}
