create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, token)
);

alter table public.device_tokens enable row level security;

create policy "Users can insert their own tokens"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tokens"
  on public.device_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tokens"
  on public.device_tokens for delete
  using (auth.uid() = user_id);

create policy "Users can view their own tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id);
