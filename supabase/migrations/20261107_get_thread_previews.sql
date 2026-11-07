-- Latest-message previews for the chat list, for many threads in one call.
--
-- get_thread_previews(thread_ids) returns, per thread the caller can see:
--   thread_id, sender_id, content, message_type, created_at  (latest message)
--   recent_sender_ids  (up to two most recent non-system senders other than
--                       the caller, newest first, for the group avatars)
--
-- SECURITY INVOKER on purpose: it reads public.messages under the caller's
-- own RLS, exactly like the thread view does, so participants only, and
-- whatever blocking hides there is hidden here too. Preview text is NOT
-- stored on threads, because a copied column would skip those rules.
--
-- One indexed lookup per thread (LATERAL ... LIMIT 1) rather than DISTINCT ON
-- over every message: DISTINCT ON reads each thread's whole history and runs
-- the messages RLS check on every row it reads. The recent-senders lookup
-- reads at most the latest 50 messages per thread.
--
-- messages.created_at is nullable, so ordering is DESC NULLS LAST and the new
-- index matches it exactly.
--
-- Purely additive. Reversible by
-- supabase/migrations/20261107_get_thread_previews_rollback.sql.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.messages') IS NULL OR to_regclass('public.threads') IS NULL THEN
    RAISE EXCEPTION 'messages/threads not found -- wrong database?';
  END IF;
  IF to_regprocedure('public.get_thread_previews(uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'public.get_thread_previews(uuid[]) already exists.';
  END IF;
END
$guard$;

CREATE INDEX IF NOT EXISTS idx_messages_thread_id_created_at
  ON public.messages (thread_id, created_at DESC NULLS LAST);

CREATE FUNCTION public.get_thread_previews(thread_ids uuid[])
RETURNS TABLE (
  thread_id uuid,
  sender_id uuid,
  content text,
  message_type text,
  created_at timestamptz,
  recent_sender_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT
    t.id,
    latest.sender_id,
    latest.content,
    latest.message_type,
    latest.created_at,
    COALESCE(recent.ids, '{}'::uuid[])
  FROM unnest(get_thread_previews.thread_ids) AS t(id)
  CROSS JOIN LATERAL (
    SELECT m.sender_id, m.content, m.message_type, m.created_at
    FROM public.messages m
    WHERE m.thread_id = t.id
    ORDER BY m.created_at DESC NULLS LAST
    LIMIT 1
  ) AS latest
  LEFT JOIN LATERAL (
    SELECT array_agg(s.sender_id ORDER BY s.last_at DESC NULLS LAST) AS ids
    FROM (
      SELECT r.sender_id, max(r.created_at) AS last_at
      FROM (
        SELECT m.sender_id, m.created_at
        FROM public.messages m
        WHERE m.thread_id = t.id
          AND m.message_type <> 'system'
          AND m.sender_id <> (SELECT auth.uid())
        ORDER BY m.created_at DESC NULLS LAST
        LIMIT 50
      ) AS r
      GROUP BY r.sender_id
      ORDER BY last_at DESC NULLS LAST
      LIMIT 2
    ) AS s
  ) AS recent ON true;
$fn$;

COMMENT ON FUNCTION public.get_thread_previews(uuid[]) IS
  'Latest message per thread for the chat list. SECURITY INVOKER: reads messages under the caller''s RLS.';

REVOKE ALL ON FUNCTION public.get_thread_previews(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_thread_previews(uuid[]) TO authenticated;

COMMIT;
