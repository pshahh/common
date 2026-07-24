-- Backfill slugs for posts created before the slug feature existed
-- (lib/slug.ts's generateSlug is only ever called at creation time in
-- CreatePostModal.tsx, so any pre-existing post never got one).
-- Mirrors generateSlug()'s logic: lowercase, strip non [a-z0-9 space -],
-- collapse whitespace/hyphens, trim edges, cap to 60 chars, append a random
-- 4-char suffix for uniqueness.

update public.posts
set slug =
  substr(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(title)), '[^a-z0-9\s-]', '', 'g'),
        '[\s-]+', '-', 'g'
      ),
      '^-+|-+$', '', 'g'
    ),
    1, 60
  ) || '-' || substr(md5(random()::text || id::text), 1, 4)
where slug is null;
