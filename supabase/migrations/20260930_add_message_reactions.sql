-- Emoji reactions on messages.
--
-- Fixed set of five (👍 ❤️ 😂 😮 🙏), one per user per message. Reactions live
-- in their own table with NO triggers, so they cannot reach any of the
-- messages-INSERT side effects: the send-message-notification webhook
-- (email + push), update_thread_last_message_at (inbox ordering / unread).
--
-- Access rules are enforced here, not just in the UI:
--   * only participants of the thread can see or write reactions
--   * users act only as themselves
--   * you can't react to your own messages or to system messages
--   * blocked relationships (either direction, via is_blocked()) can't react
--     to each other's messages and don't see each other's reactions
--   * nothing is exposed to anon
--
-- thread_id is stored so the realtime subscription can filter on it. It is
-- checked against the message's own thread in the policies, so it can't lie.
-- Replica identity is left at DEFAULT on purpose: realtime DELETE events are
-- neither filterable nor RLS-filtered, and DEFAULT means they carry only the
-- reaction's id (no thread/user/emoji leaks to other threads' subscribers).
--
-- Purely additive; no backup table needed. Reversible by
-- supabase/migrations/20260930_add_message_reactions_rollback.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Guards.
-- ---------------------------------------------------------------------------
DO $guard$
BEGIN
  IF to_regclass('public.messages') IS NULL OR to_regclass('public.threads') IS NULL THEN
    RAISE EXCEPTION 'messages/threads not found -- wrong database?';
  END IF;
  IF to_regprocedure('public.is_blocked(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_blocked(uuid) not found.';
  END IF;
  IF to_regclass('public.message_reactions') IS NOT NULL THEN
    RAISE EXCEPTION 'public.message_reactions already exists.';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 1. Table.
-- ---------------------------------------------------------------------------
CREATE TABLE public.message_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  thread_id  uuid NOT NULL REFERENCES public.threads(id)  ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_one_per_user UNIQUE (message_id, user_id),
  CONSTRAINT message_reactions_emoji_allowed
    CHECK (emoji IN ('👍', '❤️', '😂', '😮', '🙏'))
);

CREATE INDEX message_reactions_thread_id_idx ON public.message_reactions (thread_id);

-- ---------------------------------------------------------------------------
-- 2. Privileges: authenticated only. Supabase default privileges would
--    otherwise hand anon the same grants.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.message_reactions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Read: thread participants, minus reactions from blocked relationships.
CREATE POLICY "Participants can read reactions in their threads"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = message_reactions.thread_id
        AND auth.uid() = ANY (t.participant_ids)
    )
    AND NOT public.is_blocked(message_reactions.user_id)
  );

-- Write rules shared by INSERT and UPDATE (UPDATE = switching emoji, and the
-- ON CONFLICT path of an upsert).
CREATE POLICY "Participants can react to others' messages"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = message_reactions.thread_id
        AND auth.uid() = ANY (t.participant_ids)
    )
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND m.thread_id = message_reactions.thread_id
        AND m.sender_id <> auth.uid()
        AND m.message_type <> 'system'
        AND NOT public.is_blocked(m.sender_id)
    )
  );

CREATE POLICY "Users can change their own reaction"
  ON public.message_reactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = message_reactions.thread_id
        AND auth.uid() = ANY (t.participant_ids)
    )
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND m.thread_id = message_reactions.thread_id
        AND m.sender_id <> auth.uid()
        AND m.message_type <> 'system'
        AND NOT public.is_blocked(m.sender_id)
    )
  );

CREATE POLICY "Users can remove their own reaction"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Realtime (INSERT/UPDATE are RLS-filtered per subscriber).
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

COMMIT;
