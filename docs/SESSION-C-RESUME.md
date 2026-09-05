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

---

# COMPLETED 5 September 2026 — phases 3 and 4 shipped

## Phase 3 — applied to production

Migration applied inside an explicit `BEGIN…COMMIT` via `execute_sql` (not
`apply_migration`) so atomicity was guaranteed rather than assumed; recorded in
`supabase_migrations.schema_migrations` afterwards.

| Check | Result |
|---|---|
| Dated recurring rows not archived | **7** (target 7) |
| Survivors missing `next_occurrence_at` | **0** |
| Feed-visible dated recurring | **7** (was 6 — the lapsed chain came back) |
| Interest on survivors | **6** |
| Total archived | **66** |
| Orphan threads, true definition | **12**, flat |
| Rows deleted | **0** — all 73 backed-up posts and 8 threads still present |
| Orphan row `364b7630` | untouched, still `closed` |

Backup tables `recurring_backfill_backup_20260906` and
`recurring_backfill_threads_backup_20260906` are on production. Rollback is
`20260906_collapse_recurring_chains_rollback.sql`, a pure UPDATE.

## Phase 4 — shipped

- **`generate_recurring_posts` is now an UPDATE.** Rolls `next_occurrence_at`
  and `expires_at` forward on the listing. No INSERT, so the AFTER INSERT email
  trigger can never fire for a recurrence.
- **Shared roll-forward.** `next_occurrence_after()` is called by both the
  backfill and the cron function. Verified: re-running the function against the
  collapsed data changes **0 rows**, and simulating every listing expiring
  advances each exactly one interval from what the migration wrote.
- **Cron job 2 re-enabled** — via `cron.alter_job()`; a direct `UPDATE
  cron.job` is permission-denied on this project.
- **Dead code removed**: the `!parent_post_id` boost condition and the
  `parent_post_id` guard in `new-post-notification`.
- **Four post states** with the approved copy, resolved server-side.

## Still open

- ~~The `time` text on all 7 survivors is a stale date.~~ **Fixed 5 September.**
  `formatListingTime()` in `lib/dates.ts` substitutes the real next date for the
  stale one at render time, keeping the host's time of day: *"Friday 15 May,
  14:00 -16:00"* renders as *"Friday 11 September, 14:00 -16:00"*. One date, no
  "Next:" prefix, in the normal time-field position. Used by PostCard,
  `app/post/[id]` (page and OG description) and both my-activity tabs.

  Splits on the FIRST comma. The old `generate_recurring_posts` required two or
  more commas and took the third chunk, which matched no real post — every live
  post has exactly one comma — so it silently dropped the time of day.

  The stored `time` column is never written. The old job rewrote it and
  permanently destroyed the host's original wording; this is render-only.
- **The edge function is committed but NOT deployed.** Deploying it alone would
  put it out of sync with the frontend; it ships with the branch.
- **12 pre-existing orphan threads** — unchanged, still worth a separate look.

---

## Mario kart date corrected — and a monthly-recurrence bug it exposed

The backfill faithfully carried this listing's date across from its live child,
but that child's date was **already wrong**. Corrected to **Tuesday 6 October**
(was Saturday 3 October) per the host.

**Root cause: `monthly` is a flat 30-day step, which drifts off the weekday.**
The host runs it on the first Tuesday: 4 Aug -> 1 Sep -> 6 Oct. The 30-day rule
produced 4 Aug (Tue) -> 3 Sep (Thu) -> 3 Oct (Sat). The drift is recorded in the
chain's own history: one archived child stores `time = 'Tuesday 1 September'`
against an occurrence of Thursday 3 September, and the next reads
`'Saturday, 3rd October'`. So this predates the migration by two cycles.

**Weekly and biweekly are unaffected** - 7 and 14 days both preserve the weekday
exactly. That is why the other six listings are all correct, and their rendered
weekday matches the weekday in their original text.

**Not fixed, needs a decision.** At the next roll, 6 Oct + 30 = 5 Nov (Thursday),
not the first Tuesday (3 Nov) - it will drift again. Representing "first Tuesday
of the month" is beyond what `recurrence_rule` ('weekly'/'biweekly'/'monthly')
can express; it needs a schema and composer change, not a new constant.
Switching `monthly` to `+ 1 month` would hold the day-of-month steady but still
not the weekday, so it is not a fix either.
