-- The upsert in lib/nativePush.ts uses onConflict: 'user_id,platform',
-- but the original table only had a unique constraint on (user_id, token).
-- Without a matching constraint, the upsert fails with 42P10 and the
-- error is silently swallowed by console.error in the client.

alter table public.device_tokens
  add constraint device_tokens_user_id_platform_key unique (user_id, platform);
