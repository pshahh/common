-- Rollback for 20261031_thread_participants_can_read_post.sql.
BEGIN;

DROP POLICY IF EXISTS "Thread participants can view the thread's post" ON public.posts;

COMMIT;
