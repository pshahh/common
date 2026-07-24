-- Backfill age_confirmed_at for users who signed up before the 18+ checkbox
-- existed. Assumes existing users are adults (per product decision).
-- Backdates to each user's actual signup time (from auth.users) rather than
-- "now" for all, so the record reflects when they joined, not today.

update public.profiles p
set age_confirmed_at = u.created_at
from auth.users u
where p.id = u.id
  and p.age_confirmed_at is null;
