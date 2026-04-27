/**
 * pre-push.mjs — runs before drizzle-kit push
 *
 * Step 1: Deduplicate commitments per (user_id, label), keeping the
 *         earliest-created row. Must run BEFORE the unique constraint is
 *         applied so drizzle-kit push can add the constraint cleanly.
 *
 * Step 2: Clean orphaned user-scoped rows whose users.id no longer exists.
 *         Must run BEFORE the cascade FK constraints are created so
 *         drizzle-kit push can add them without a "violates foreign key"
 *         error. The cleanup SQL is idempotent (NOT EXISTS guards) and
 *         runs in its own transaction, so it is safe on already-clean DBs.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const orphanCleanupSql = readFileSync(
  join(__dirname, "../../artifacts/api-server/scripts/cleanup-orphan-user-data.sql"),
  "utf8",
);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Step 1 — commitments dedup
  const dedup = await pool.query(`
    DELETE FROM commitments
    WHERE id NOT IN (
      SELECT DISTINCT ON (user_id, label) id
      FROM commitments
      ORDER BY user_id, label, created_at ASC
    );
  `);
  console.log(`[pre-push] Commitments dedup applied (${dedup.rowCount} duplicate rows removed)`);

  // Step 2 — orphaned user-scoped rows.
  // The SQL file wraps itself in BEGIN/COMMIT and prints BEFORE/AFTER counts,
  // so we just send it through as a single multi-statement query.
  await pool.query(orphanCleanupSql);
  console.log("[pre-push] Orphan-user-data cleanup applied (idempotent)");
} finally {
  await pool.end();
}
