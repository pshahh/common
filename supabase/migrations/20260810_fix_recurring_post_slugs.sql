-- Fix: generate_recurring_posts() never set a slug on the posts it inserts,
-- because lib/slug.ts's generateSlug() is only called client-side from
-- CreatePostModal.tsx. The 20260723_backfill_post_slugs.sql migration was a
-- one-time fix for pre-existing NULL slugs, but every recurring post created
-- by this cron job since then (all recurrence_rule values, not just
-- biweekly) went right back to having slug = NULL.
--
-- This migration:
--   1. Patches generate_recurring_posts() to generate a slug on insert,
--      mirroring generateSlug()'s algorithm (same approach as the July 23
--      backfill).
--   2. Re-runs the backfill for posts affected since then.

CREATE OR REPLACE FUNCTION public.generate_recurring_posts()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  post_row RECORD;
  next_date DATE;
  interval_days INT;
  new_time TEXT;
  new_expiry TIMESTAMPTZ;
  new_post_id UUID;
  root_post_id UUID;
  new_slug TEXT;
BEGIN
  FOR post_row IN
    SELECT *
    FROM posts
    WHERE recurrence_rule IS NOT NULL
      AND status = 'approved'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
      AND expires_at < '2099-01-01'
  LOOP
    -- Determine the root parent
    root_post_id := COALESCE(post_row.parent_post_id, post_row.id);

    -- Skip if ANY unexpired approved/pending child already exists for this root
    IF EXISTS (
      SELECT 1 FROM posts child
      WHERE (child.parent_post_id = root_post_id OR child.id = root_post_id)
        AND child.status IN ('approved', 'pending')
        AND child.expires_at >= NOW()
    ) THEN
      CONTINUE;
    END IF;

    -- Only process the MOST RECENTLY expired post in this family
    IF post_row.id != (
      SELECT id FROM posts
      WHERE (parent_post_id = root_post_id OR id = root_post_id)
        AND recurrence_rule IS NOT NULL
        AND status = 'approved'
        AND expires_at < NOW()
      ORDER BY expires_at DESC
      LIMIT 1
    ) THEN
      CONTINUE;
    END IF;

    interval_days := CASE post_row.recurrence_rule
      WHEN 'weekly' THEN 7
      WHEN 'biweekly' THEN 14
      WHEN 'monthly' THEN 30
      ELSE 7
    END;

    next_date := (post_row.expires_at::date - INTERVAL '1 day')::date + (interval_days || ' days')::INTERVAL;

    WHILE next_date < CURRENT_DATE LOOP
      next_date := next_date + (interval_days || ' days')::INTERVAL;
    END LOOP;

    new_time := TO_CHAR(next_date, 'FMDay, FMDDth FMMonth');

    IF (LENGTH(post_row.time) - LENGTH(REPLACE(post_row.time, ',', ''))) >= 2 THEN
      new_time := new_time || ', ' || TRIM(SPLIT_PART(post_row.time, ',', 3));
    END IF;

    new_expiry := (next_date + INTERVAL '1 day')::TIMESTAMPTZ;

    -- Generate a slug the same way lib/slug.ts's generateSlug() does on the
    -- client, since this function inserts posts directly and bypasses
    -- CreatePostModal.tsx.
    new_slug := substr(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(post_row.title)), '[^a-z0-9\s-]', '', 'g'),
          '[\s-]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      1, 60
    ) || '-' || substr(md5(random()::text || post_row.id::text), 1, 4);

    INSERT INTO posts (
      title, location, latitude, longitude, time, notes, name,
      preference, user_id, status, expires_at,
      recurrence_rule, parent_post_id, people_interested, slug
    ) VALUES (
      post_row.title,
      post_row.location,
      post_row.latitude,
      post_row.longitude,
      new_time,
      post_row.notes,
      post_row.name,
      post_row.preference,
      post_row.user_id,
      'approved',
      new_expiry,
      post_row.recurrence_rule,
      root_post_id,
      0,
      new_slug
    )
    RETURNING id INTO new_post_id;

    -- Migrate active threads from the expired post to the new one
    UPDATE threads
    SET post_id = new_post_id
    WHERE post_id = post_row.id
      AND closed_at IS NULL
      AND array_length(participant_ids, 1) > 0;

  END LOOP;
END;
$function$;

-- Backfill posts that were generated after the July 23 backfill and are
-- still missing a slug.
update public.posts
set slug =
  substr(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(title)), '[^a-z0-9\s-]', '', 'g'),
        '[\s-]+', '-', 'g'
      ),
      '^-+|-+$', '', 'g'
    ),
    1, 60
  ) || '-' || substr(md5(random()::text || id::text), 1, 4)
where slug is null;
