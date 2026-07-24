-- Records when a user confirmed they are 18+ at signup (AuthModal.tsx).
-- Needed for Play Store target-audience compliance - a checkbox alone isn't
-- worth much as evidence if we don't actually record that it was checked.

alter table public.profiles
  add column if not exists age_confirmed_at timestamptz;
