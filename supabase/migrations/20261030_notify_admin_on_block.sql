-- Email the admin whenever someone blocks another user (App Store guideline 1.2:
-- blocking must also notify the developer). Reuses the report-notification edge
-- function, which handles both public.reports and public.blocked_users inserts.
--
-- The webhook is cloned from the existing "report-notification" trigger on
-- public.reports so the function URL and auth header stay in one place and no
-- key is written into this file.
DO $$
DECLARE
  report_trigger_def text;
BEGIN
  SELECT pg_get_triggerdef(t.oid)
    INTO report_trigger_def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'reports' AND t.tgname = 'report-notification';

  IF report_trigger_def IS NULL THEN
    RAISE EXCEPTION 'report-notification trigger on public.reports not found';
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS "block-notification" ON public.blocked_users';
  EXECUTE replace(
    replace(report_trigger_def, 'TRIGGER "report-notification"', 'TRIGGER "block-notification"'),
    'ON public.reports', 'ON public.blocked_users'
  );
END $$;
