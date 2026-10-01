-- ROLLBACK for 20260930_add_message_reactions.sql.
--
-- Removes the table from the realtime publication and drops it (policies,
-- index and constraints go with it). This DELETES ALL REACTIONS; the forward
-- migration touched nothing else, so nothing else needs restoring. Safe to
-- run more than once.

BEGIN;

DO $rt$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.message_reactions;
  END IF;
END
$rt$;

DROP TABLE IF EXISTS public.message_reactions;

COMMIT;
