-- Step 5 of docs/recurring-posts-and-boosting.md.
--
-- generate_recurring_posts no longer INSERTs a child post per occurrence. One
-- durable listing carries a rolling date, so this is now a pure UPDATE that
-- moves next_occurrence_at and expires_at forward on the listing itself.
--
-- What went away, and why:
--
--   * The INSERT. 53 clones produced 3 interest clicks between them; the
--     listing they were cloned from keeps its interest, threads and history.
--
--   * `UPDATE threads SET post_id = new_post_id`. It existed only to drag
--     conversations onto each new clone. There are no clones, so threads stay
--     attached to the listing and nothing needs repointing.
--
--   * The `new_time` rewriting. The card renders the real date from
--     next_occurrence_at ("Next: Sunday 6 September"); the free-text `time`
--     column stays as the host wrote it. Parsing it is explicitly ruled out —
--     one live post's `time` reads "Based on pill".
--
--   * The "is this the latest expired post in the chain?" self-join. With one
--     row per listing there is no chain to disambiguate.
--
-- BOTH dates move. expires_at is not decorative: the feed query
-- (app/page.tsx) and sitemap.ts filter on `expires_at > now()`, so a listing
-- whose expiry stopped moving would vanish from the feed no matter what
-- next_occurrence_at said.
--
-- The roll-forward itself is next_occurrence_after(), shared with the
-- chain-collapse backfill (20260906_next_occurrence_helper.sql) so the two
-- cannot drift apart.

CREATE OR REPLACE FUNCTION generate_recurring_posts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  WITH rolled AS (
    SELECT
      p.id,
      next_occurrence_after(
        -- Prefer the real occurrence date. Fall back to expiry-minus-a-day for
        -- any listing the backfill did not reach; that was always the same
        -- quantity, just stored less honestly.
        coalesce(p.next_occurrence_at::date, p.expires_at::date - 1),
        p.recurrence_rule,
        CURRENT_DATE
      ) AS next_date
    FROM posts p
    WHERE p.recurrence_rule IS NOT NULL
      AND p.status = 'approved'
      AND p.expires_at IS NOT NULL
      -- Standing offers use a 2099 sentinel expiry and have no fixed date.
      -- They must never be given one: having no date is exactly why they stay
      -- out of "Happening soon".
      AND p.expires_at < '2098-01-01'
      -- Only listings whose occurrence has actually passed.
      AND p.expires_at < NOW()
  )
  UPDATE posts p
  SET next_occurrence_at = r.next_date::timestamptz,
      expires_at         = (r.next_date + 1)::timestamptz
  FROM rolled r
  WHERE p.id = r.id;
END;
$$;

COMMENT ON FUNCTION generate_recurring_posts() IS
  'Rolls each dated recurring listing forward in place. UPDATE only — never inserts, so the new-post notification trigger cannot fire and threads stay attached to the listing.';
