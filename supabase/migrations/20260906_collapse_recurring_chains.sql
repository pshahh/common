-- Collapse dated recurring chains onto their root post.
-- Step 4 of docs/recurring-posts-and-boosting.md.
--
-- Verified against docs/pre-migration-snapshot-2026-09-04-rerun.md.
-- Run ONLY with cron job 2 (generate-recurring-posts) disabled — the guard below
-- enforces it rather than trusting it.
--
-- Reversible by supabase/migrations/20260906_collapse_recurring_chains_rollback.sql,
-- which is a pure UPDATE from the backup table this migration writes first.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. 'archived' is not currently a legal status.
--
-- posts_status_check allows only pending/approved/rejected/hidden/closed/deleted.
-- Without this the soft-delete below fails outright. Widening the constraint is
-- additive: no existing row changes meaning.
-- ---------------------------------------------------------------------------
ALTER TABLE posts DROP CONSTRAINT posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text, 'approved'::text, 'rejected'::text,
    'hidden'::text, 'closed'::text, 'deleted'::text, 'archived'::text
  ]));

-- ---------------------------------------------------------------------------
-- 1. Derive the plan.
-- ---------------------------------------------------------------------------

-- Every dated recurring post, tagged with its chain root. Standing offers
-- (2099 sentinel expiry) are excluded and never touched.
CREATE TEMP TABLE _chain ON COMMIT DROP AS
SELECT
  coalesce(p.parent_post_id, p.id) AS root,
  p.id,
  p.status,
  coalesce(p.people_interested, 0) AS interest,
  p.expires_at
FROM posts p
WHERE p.recurrence_rule IS NOT NULL
  AND p.expires_at < '2098-01-01';

-- A chain survives only if it still has at least one approved post.
-- The other seven are finished, not dormant — archived wholesale, nothing
-- carried forward. See "Dead chains" in the 3 September snapshot doc.
CREATE TEMP TABLE _surviving ON COMMIT DROP AS
SELECT root
FROM _chain
GROUP BY root
HAVING count(*) FILTER (WHERE status = 'approved') > 0;

-- What each survivor inherits.
--
-- Normal case: the chain still has a live occurrence. That is the row the feed
-- shows today, so the survivor takes its occurrence date and expiry unchanged
-- and nothing visible moves.
--
-- Lapsed case: the chain has approved posts but every occurrence has expired,
-- because cron job 2 has been frozen since 4 September and nothing regenerated
-- them. Rolling the date forward by whole recurrence intervals until it lands
-- on or after today reproduces exactly what job 2 would have written had it
-- been running. The alternative -- treating a chain that lapsed by hours as
-- dead -- would archive a live listing and orphan its threads.
--
-- Occurrence date is always expiry MINUS ONE DAY: generate_recurring_posts
-- sets new_expiry := (next_date + INTERVAL '1 day').
CREATE TEMP TABLE _plan ON COMMIT DROP AS
WITH latest_approved AS (
  SELECT DISTINCT ON (c.root)
         c.root,
         c.expires_at,
         p.recurrence_rule
    FROM _chain c
    JOIN _surviving s ON s.root = c.root
    JOIN posts p ON p.id = c.id
   WHERE c.status = 'approved'
   ORDER BY c.root, c.expires_at DESC
),
resolved AS (
  SELECT la.root,
         (la.expires_at > now()) AS is_live,
         (la.expires_at::date - 1) AS last_occurrence,
         CASE la.recurrence_rule
           WHEN 'weekly'   THEN 7
           WHEN 'biweekly' THEN 14
           WHEN 'monthly'  THEN 30
           ELSE 7
         END AS interval_days
    FROM latest_approved la
)
SELECT res.root,
       res.is_live,
       (SELECT sum(c.interest) FROM _chain c WHERE c.root = res.root) AS chain_interest,
       CASE
         WHEN res.is_live THEN res.last_occurrence
         ELSE res.last_occurrence + (
                res.interval_days * GREATEST(
                  ceil((CURRENT_DATE - res.last_occurrence)::numeric / res.interval_days),
                  1
                )::int
              )
       END AS next_occurrence_date
  FROM resolved res;

-- ---------------------------------------------------------------------------
-- 2. Guards. Fail loudly rather than half-migrating.
-- ---------------------------------------------------------------------------
DO $guard$
DECLARE
  n_surviving int;
  n_plan int;
  n_bad_root int;
  n_stale int;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 2 AND active) THEN
    RAISE EXCEPTION
      'cron job 2 (generate-recurring-posts) is ACTIVE. Disable it before backfilling.';
  END IF;

  SELECT count(*) INTO n_surviving FROM _surviving;
  SELECT count(*) INTO n_plan FROM _plan;

  -- Every surviving chain must produce exactly one plan row. The lapsed branch
  -- above means this can no longer silently drop a chain, but assert it anyway.
  IF n_surviving <> n_plan THEN
    RAISE EXCEPTION
      'Plan covers % of % surviving chains. Resolve manually.', n_plan, n_surviving;
  END IF;

  -- No survivor may end up with a next occurrence in the past.
  SELECT count(*) INTO n_stale FROM _plan WHERE next_occurrence_date < CURRENT_DATE;
  IF n_stale > 0 THEN
    RAISE EXCEPTION '% survivor(s) would get a next_occurrence_at in the past.', n_stale;
  END IF;

  IF n_surviving <> 7 THEN
    RAISE EXCEPTION
      'Expected 7 surviving chains, found %. Data moved since the snapshot — re-verify.',
      n_surviving;
  END IF;

  -- The survivor must itself be a viable listing. All 7 roots are approved.
  SELECT count(*) INTO n_bad_root
  FROM _plan pl JOIN posts p ON p.id = pl.root
  WHERE p.status <> 'approved';

  IF n_bad_root > 0 THEN
    RAISE EXCEPTION
      '% surviving chain(s) have a non-approved root; collapsing would hide the listing.',
      n_bad_root;
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 3. Backup, so rollback is an UPDATE and nothing depends on re-deriving state.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS recurring_backfill_backup_20260906;
CREATE TABLE recurring_backfill_backup_20260906 AS
SELECT
  p.id,
  p.status,
  p.people_interested,
  p.expires_at,
  p.next_occurrence_at,
  coalesce(p.parent_post_id, p.id) AS root,
  (p.id IN (SELECT root FROM _surviving)) AS is_survivor
FROM posts p
WHERE p.id IN (SELECT id FROM _chain);

DROP TABLE IF EXISTS recurring_backfill_threads_backup_20260906;
CREATE TABLE recurring_backfill_threads_backup_20260906 AS
SELECT t.id AS thread_id, t.post_id AS original_post_id
FROM threads t
WHERE t.post_id IN (SELECT id FROM _chain);

-- ---------------------------------------------------------------------------
-- 4. Collapse onto the survivor.
--
-- expires_at is rolled forward as well as next_occurrence_at. This is NOT
-- cosmetic: the feed query (app/page.tsx:550) and sitemap.ts both filter on
-- `expires_at > now()`, and all 7 roots expired between May and August. Setting
-- only next_occurrence_at would leave every survivor invisible and drop dated
-- recurring activities from the feed entirely (7 -> 0).
-- ---------------------------------------------------------------------------
UPDATE posts p
SET people_interested  = pl.chain_interest,
    next_occurrence_at = pl.next_occurrence_date::timestamptz,
    expires_at         = (pl.next_occurrence_date + 1)::timestamptz
FROM _plan pl
WHERE p.id = pl.root;

-- ---------------------------------------------------------------------------
-- 5. Repoint threads in surviving chains onto the survivor.
--
-- Threads attach to the listing, not the occurrence. Only surviving chains are
-- repointed: the 2 threads on dead chain dc61f646 already point at a deleted
-- root and stay where they are (they are 2 of the 12 pre-existing orphans).
-- No unique index on threads.post_id, so several threads may share a survivor.
-- ---------------------------------------------------------------------------
UPDATE threads t
SET post_id = c.root
FROM _chain c
WHERE t.post_id = c.id
  AND c.root IN (SELECT root FROM _surviving)
  AND t.post_id <> c.root;

-- ---------------------------------------------------------------------------
-- 6. Soft-delete. UPDATE only — no row is ever removed.
-- ---------------------------------------------------------------------------

-- 6a. Children of surviving chains.
UPDATE posts p
SET status = 'archived'
FROM _chain c
WHERE p.id = c.id
  AND c.root IN (SELECT root FROM _surviving)
  AND p.id <> c.root;

-- 6b. Dead chains, wholesale — root included, no surviving listing.
UPDATE posts p
SET status = 'archived'
FROM _chain c
WHERE p.id = c.id
  AND c.root NOT IN (SELECT root FROM _surviving);

COMMIT;
