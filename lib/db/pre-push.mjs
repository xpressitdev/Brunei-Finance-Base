/**
 * pre-push.mjs — runs before drizzle-kit push
 *
 * Migration N: Remove duplicate commitments per (user_id, label), keeping the
 * earliest-created row. Must run BEFORE the unique constraint is applied so
 * that drizzle-kit push (Migration N+1) can add the constraint cleanly.
 */
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    DELETE FROM commitments
    WHERE id NOT IN (
      SELECT DISTINCT ON (user_id, label) id
      FROM commitments
      ORDER BY user_id, label, created_at ASC
    );
  `);
  console.log(`[pre-push] Commitments deduplication applied (${result.rowCount} duplicate rows removed)`);
} finally {
  await pool.end();
}
