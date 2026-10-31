-- Let thread participants read the post their thread is about.
--
-- "Users can view posts" only shows approved posts (to everyone, or to friends)
-- plus your own and admins'. Once a post is closed, every participant except
-- the poster loses it, so the inbox shows "Unknown post" and the thread opens
-- as "Conversation unavailable". Closed posts are meant to stay openable and
-- greyed out.
--
-- This adds a second, read-only SELECT policy (permissive, so OR'd with the
-- existing one):
--   * you can read a post if you are a participant of a thread for that post
--   * not if you and the poster are in a blocked relationship (either
--     direction, via is_blocked())
--   * nothing is exposed to anon; no INSERT/UPDATE/DELETE rights change
--
-- Purely additive. Reversible by
-- supabase/migrations/20261031_thread_participants_can_read_post_rollback.sql.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.posts') IS NULL OR to_regclass('public.threads') IS NULL THEN
    RAISE EXCEPTION 'posts/threads not found -- wrong database?';
  END IF;
  IF to_regprocedure('public.is_blocked(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_blocked(uuid) not found.';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Thread participants can view the thread's post" ON public.posts;

CREATE POLICY "Thread participants can view the thread's post"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.post_id = posts.id
        AND auth.uid() = ANY (t.participant_ids)
    )
    AND NOT public.is_blocked(posts.user_id)
  );

COMMIT;
