-- ============================================================================
-- Cleanup orphaned rows tied to deleted users (production)
--
-- Why this exists
-- ----------------
-- Several user-scoped tables (accounts, debts, commitments, transactions,
-- monthly_budgets, goals, profiles, …) reference users.id by value but have
-- NO foreign-key constraint with ON DELETE CASCADE. When a user row is
-- deleted directly, the children are left behind as orphans.
--
-- This script is idempotent (uses NOT EXISTS so it only touches truly
-- orphaned rows) and safe to re-run. It runs in a single transaction so a
-- failure midway rolls back everything.
--
-- HOW TO RUN (production)
-- ------------------------
-- Open a shell with the production DATABASE_URL exported, then:
--   psql "$DATABASE_URL" -f artifacts/api-server/scripts/cleanup-orphan-user-data.sql
--
-- The script prints orphan counts BEFORE and AFTER each step so you can
-- verify the result.
-- ============================================================================

BEGIN;

-- Show how many orphans exist before we start
SELECT 'BEFORE' AS phase, tbl, orphans
FROM (
  SELECT 'accounts'           AS tbl, COUNT(*) AS orphans FROM accounts            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = accounts.user_id)
  UNION ALL SELECT 'asset_entries',          COUNT(*) FROM asset_entries           WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = asset_entries.user_id)
  UNION ALL SELECT 'commitments',            COUNT(*) FROM commitments             WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = commitments.user_id)
  UNION ALL SELECT 'debts',                  COUNT(*) FROM debts                   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = debts.user_id)
  UNION ALL SELECT 'goals',                  COUNT(*) FROM goals                   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = goals.user_id)
  UNION ALL SELECT 'insights',               COUNT(*) FROM insights                WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = insights.user_id)
  UNION ALL SELECT 'monthly_budgets',        COUNT(*) FROM monthly_budgets         WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = monthly_budgets.user_id)
  UNION ALL SELECT 'payday_prompts',         COUNT(*) FROM payday_prompts          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = payday_prompts.user_id)
  UNION ALL SELECT 'profiles',               COUNT(*) FROM profiles                WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = profiles.user_id)
  UNION ALL SELECT 'transactions',           COUNT(*) FROM transactions            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = transactions.user_id)
  UNION ALL SELECT 'uploaded_documents',     COUNT(*) FROM uploaded_documents      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uploaded_documents.user_id)
  UNION ALL SELECT 'feedback (orphan link)', COUNT(*) FROM feedback                WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = feedback.user_id)
) s
ORDER BY orphans DESC, tbl;

-- ----------------------------------------------------------------------------
-- DELETE the orphans. Order doesn't matter because none of these tables
-- reference each other by FK in production.
-- ----------------------------------------------------------------------------

DELETE FROM monthly_budgets     WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = monthly_budgets.user_id);
DELETE FROM transactions        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = transactions.user_id);
DELETE FROM commitments         WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = commitments.user_id);
DELETE FROM debts               WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = debts.user_id);
DELETE FROM goals               WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = goals.user_id);
DELETE FROM insights            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = insights.user_id);
DELETE FROM accounts            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = accounts.user_id);
DELETE FROM asset_entries       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = asset_entries.user_id);
DELETE FROM payday_prompts      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = payday_prompts.user_id);
DELETE FROM uploaded_documents  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uploaded_documents.user_id);
DELETE FROM profiles            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = profiles.user_id);

-- ----------------------------------------------------------------------------
-- feedback: the message content can be valuable signal even when the author
-- is gone. Default behaviour: NULL out the orphan user_id so the link to the
-- deleted user is severed but the feedback text stays for the team.
--
-- If you would rather PURGE the feedback rows entirely, comment out the
-- UPDATE below and uncomment the DELETE.
-- ----------------------------------------------------------------------------

UPDATE feedback
   SET user_id = NULL
 WHERE user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = feedback.user_id);

-- DELETE FROM feedback
--  WHERE user_id IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = feedback.user_id);

-- Show the same counts AFTER cleanup — every row should read 0
SELECT 'AFTER' AS phase, tbl, orphans
FROM (
  SELECT 'accounts'           AS tbl, COUNT(*) AS orphans FROM accounts            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = accounts.user_id)
  UNION ALL SELECT 'asset_entries',          COUNT(*) FROM asset_entries           WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = asset_entries.user_id)
  UNION ALL SELECT 'commitments',            COUNT(*) FROM commitments             WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = commitments.user_id)
  UNION ALL SELECT 'debts',                  COUNT(*) FROM debts                   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = debts.user_id)
  UNION ALL SELECT 'goals',                  COUNT(*) FROM goals                   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = goals.user_id)
  UNION ALL SELECT 'insights',               COUNT(*) FROM insights                WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = insights.user_id)
  UNION ALL SELECT 'monthly_budgets',        COUNT(*) FROM monthly_budgets         WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = monthly_budgets.user_id)
  UNION ALL SELECT 'payday_prompts',         COUNT(*) FROM payday_prompts          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = payday_prompts.user_id)
  UNION ALL SELECT 'profiles',               COUNT(*) FROM profiles                WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = profiles.user_id)
  UNION ALL SELECT 'transactions',           COUNT(*) FROM transactions            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = transactions.user_id)
  UNION ALL SELECT 'uploaded_documents',     COUNT(*) FROM uploaded_documents      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uploaded_documents.user_id)
  UNION ALL SELECT 'feedback (orphan link)', COUNT(*) FROM feedback                WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = feedback.user_id)
) s
ORDER BY tbl;

COMMIT;
