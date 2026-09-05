# Session C — resume here

Stopped 4 September, after phase 2. **Production is unchanged.** Phases 1–2 done,
phase 3 (apply to production) awaiting approval.

## State when we stopped

- Cron job 2 (`generate_recurring_posts`) — **disabled**. Left off deliberately.
- Cron job 3 (bump, now writing `resurfaced_at`) — active, untouched.
- Steps 0–3 merged and deployed. `next_occurrence_at` / `resurfaced_at` exist, all null.
- Dry run done as `BEGIN…ROLLBACK` against production (Supabase branching needs Pro).
  All checks passed, rollback confirmed. Transcript in the rerun snapshot doc.
- Git branch: `feat/recurring-backfill`.

## Do this first on resuming

**Re-run the dry run.** Data has moved since 4 Sept — occurrences expire daily while job 2
is off, so the before/after numbers in the phase 2 output are already stale. Don't approve
phase 3 against yesterday's evidence.

## Three things to check before approving phase 3

1. **One child post falls outside the migration's filter.** There is exactly 1 row with a
   `parent_post_id` that is not matched by `recurrence_rule IS NOT NULL AND expires_at <
   '2098-01-01'`. Confirm whether it should be collapsed or left alone — it may be an
   orphan the chain logic misses entirely.

2. **Interest per chain must be >= the snapshot, never less.** If any chain comes back
   lower, stop and investigate rather than approving.

3. **7 of the 12 interest clicks are dropped** by the archive-wholesale rule (5 on
   `cf4c403e`, 2 on `dc61f646`). Intended — both are finished chains with no approved
   posts — but confirm you're happy before it's irreversible.

## Carried forward, not blocking

**12 pre-existing orphan threads.** Threads whose post is deleted or missing. Nothing to do
with this migration; they predate it and the migration leaves the count flat. Worth a
separate look — 12 of 150 threads is 8%, and each one is a conversation someone can
presumably still see with no post behind it.

**Corrections to the 4 Sept snapshot doc:** the summary said "63 posts across all chains";
the true figure is **73** (14 roots + 59 children). The per-chain table in that doc was
right; the summary line was wrong.

## If resuming is delayed beyond 5 September

Job 2 being off means live occurrences expire and nothing regenerates them. Expiries were:
5 Sep, 6 Sep, 7 Sep, 7 Sep, 9 Sep, 14 Sep, 4 Oct. Losing the 5 Sep one costs almost nothing
(that chain regenerated 20 times for a single interest click). Beyond that it starts eating
real supply — re-enable job 2 until you're ready, then disable it again immediately before
phase 3.

## Then

Phase 3 (apply to production, re-verify), then phase 4 (rewrite `generate_recurring_posts`
as an UPDATE, re-enable job 2, remove the `!a.parent_post_id` boost condition, remove the
`parent_post_id` guard in `new-post-notification`, add the archived-child redirect in
`app/post/[id]`).

---

## Bug to fix inside phase 4: every dead link claims to be "friends only"

Found 5 September. A user deleted a "swimming group" post; anyone clicking the link in the
notification email now sees **"This one's just for friends"**.

**Cause:** `SinglePostClient.tsx:236` is `if (notFound || !post)` and renders the friends-only
screen for every failure. The intent was reasonable — RLS makes a friends-only post come back
as not-found, and that copy is friendlier than a bare 404 — but it over-applies to deleted
posts, expired links and mistyped slugs.

**Why it belongs in phase 4:** the migration archives 66 posts, so every old email link to a
child post will hit this same screen. It takes the bug from ~30 deleted posts to ~96 URLs.
Phase 4 already edits this file for the archived-child redirect.

**Fix:** the client can't distinguish the cases (RLS returns nothing either way), but
`page.tsx` already uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS. Resolve the reason
server-side and pass it down as a prop. Four states:

### Not part of this bug

**Closed and expired posts already behave correctly.** `'closed'` is in the fetch filter, so
those posts still render with `ClosedBadge` and the interest button hidden. Leave that alone.
This bug is only about posts that can't be fetched at all.

### The shell to extract

There is no not-found or error page anywhere in the app — no `not-found.tsx`, no `error.tsx`,
one screen for every failure. But the existing block is a good reusable shell: `Header` + a
centred column at `padding: 48px 24px`, a 40px emoji, a 20px/600 heading in `#000`, 14px
`#888` body at `line-height: 1.5`, and a `btn btn-primary` CTA. Extract it as one component
taking icon / title / body / CTA, then use it for all three states below. No new CSS.

### The four states — copy approved 5 September

**1. Removed** — status `deleted`, `rejected` or `hidden`. Icon: 🚫

> **This post has been removed**
> It's no longer available. There's plenty else happening nearby.
> → `Browse all posts`

Do NOT distinguish "the poster took it down" from "an admin removed it". The viewer doesn't
need to know which, and naming the poster's action invites questions we don't want to field.

**2. Not found** — no row at all (bad slug, mistyped or truncated link). Icon: 🔍

> **We couldn't find that post**
> The link may be incomplete, or the post may no longer exist.
> → `Browse all posts`

**3. Friends only** — row exists, `audience = 'friends'`, viewer isn't a friend. Icon: 🔒
Unchanged, including the CTA split: logged-out sees "Log in or sign up", logged-in sees
"Browse all posts".

**4. Archived child** — status `archived` with a `parent_post_id`. **Not a page** — redirect
to the surviving parent listing, so someone clicking a July badminton link lands on the live
badminton listing rather than a dead end.

Don't leak post content in any of the three pages; the reason is enough.
