-- ROLLBACK for 20260906_collapse_recurring_chains.sql.
--
-- Pure UPDATE from the backup tables the forward migration wrote. No row was
-- deleted, so nothing needs recreating. Safe to run more than once.
--
-- Restores: every dated recurring post's status, people_interested, expires_at
-- and next_occurrence_at, and every repointed thread's original post_id.
--
-- Does NOT re-narrow posts_status_check (leaving 'archived' legal is harmless
-- and avoids failing if any row elsewhere has since used it). To also revert
-- that, run the ALTER at the bottom — it will fail if any archived row remains,
-- which is the correct behaviour.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.recurring_backfill_backup_20260906') IS NULL THEN
    RAISE EXCEPTION 'Backup table missing — cannot roll back safely.';
  END IF;
END
$guard$;

-- 1. Threads back to their original posts.
UPDATE threads t
SET post_id = b.original_post_id
FROM recurring_backfill_threads_backup_20260906 b
WHERE t.id = b.thread_id
  AND t.post_id <> b.original_post_id;

-- 2. Posts back to their pre-migration values.
UPDATE posts p
SET status             = b.status,
    people_interested  = b.people_interested,
    expires_at         = b.expires_at,
    next_occurrence_at = b.next_occurrence_at
FROM recurring_backfill_backup_20260906 b
WHERE p.id = b.id
  AND (p.status             IS DISTINCT FROM b.status
    OR p.people_interested  IS DISTINCT FROM b.people_interested
    OR p.expires_at         IS DISTINCT FROM b.expires_at
    OR p.next_occurrence_at IS DISTINCT FROM b.next_occurrence_at);

COMMIT;

-- Optional, only once nothing is archived anywhere:
-- ALTER TABLE posts DROP CONSTRAINT posts_status_check;
-- ALTER TABLE posts ADD CONSTRAINT posts_status_check
--   CHECK (status = ANY (ARRAY['pending','approved','rejected','hidden','closed','deleted']));
