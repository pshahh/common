-- Admin "Featured" capability: pins a post to the top of the feed.
-- Timestamp, not a boolean, so "featured N days ago" needs no migration later.
-- See docs/recurring-posts-and-boosting.md ("Admin boosting — Featured").

alter table public.posts
  add column if not exists featured_at timestamptz;
