-- Rollback for 20261107_get_thread_previews.sql.
-- The chat list still renders without previews if the function is missing.

BEGIN;

DROP FUNCTION IF EXISTS public.get_thread_previews(uuid[]);
DROP INDEX IF EXISTS public.idx_messages_thread_id_created_at;

COMMIT;
