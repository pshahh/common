# Recurring posts, feed ordering and admin boosting

Status: **specified, not started**. Ships *after* analytics — we want a baseline first.
Written 3 September 2026. Design decisions in this doc are settled; don't relitigate them
without a reason.

---

## The problem

Recurring posts regenerate as brand-new child posts each occurrence. Every child starts with
zero interest, no thread history and no social proof, gets no email (deliberately suppressed
via `parent_post_id`), and loses the feed's new-post boost (also keyed on `parent_post_id`).

The result, measured:

| Type | Posts | Total interest | Threads |
|---|---|---|---|
| Recurring **originals** | 10 | 7 | 0 |
| Recurring **generated children** | **53** | **3** | **5** |
| Standing offers (no date) | 8 | 66 | ~30 |

53 posts manufactured, 3 interest clicks between them. Meanwhile one persistent standing
offer ("Beginner tennis") has accumulated 17 interested and 15 threads over six months.

**The fix: stop generating posts. One durable listing carries a rolling date.**

---

## Schema

Two nullable columns on `posts`:

- **`next_occurrence_at timestamptz`** — the real date of the next occurrence.
  `NULL` on standing offers, which is exactly why they stay out of "Happening soon".
- **`resurfaced_at timestamptz`** — what the twice-monthly evergreen job writes to,
  instead of overwriting `created_at`.

---

## Feed ordering

All sorting is client-side in the `sortedPosts` `useMemo` in `app/page.tsx`.

**Happening soon** — currently sorts on `expires_at`, which works only because the
recurrence job sets each child's expiry to the occurrence date plus a day. Under one
permanent listing that proxy breaks. Change to:

    next_occurrence_at ?? expires_at

This is the single most important line in the change. Written down because it is the
easiest thing to lose by accident, and it is the behaviour dated recurrence exists to
provide.

**Recently added** — sort on `greatest(created_at, resurfaced_at)`. Delete the
`!a.parent_post_id` condition from the new-post boost; there are no children any more.

**Nearest** — unchanged.

### Standing offers in "Happening soon"

They have no date, so they sort to the end. Rather than leaving them lumped at the bottom
of our highest-intent view — they are the best-performing format — insert a **single
labelled band** of 2–3 of them partway down: *"No fixed date — arrange it directly"*.

A label keeps the sort's promise honest. Do NOT interleave them at arbitrary positions;
that is the same move as the bump job and reads as a bug. Seed the rotation on the day, not
the render, so cards don't shuffle mid-scroll.

Later, if it earns it: make availability structured in the composer (weekday evenings /
weekends / any time) so standing offers get a computed next date and sort natively with no
band. Do not parse the existing free-text `time` field — one live post contains
"Based on pill".

---

## Threads

**Threads attach to the listing, not the occurrence.** The composer's 1:1 / group choice is
unchanged — this only changes how long a thread lives.

- **1:1 recurring** (59 of 63 posts): each interested person gets their own thread with the
  host, persisting across every occurrence. They cannot see each other.
- **Group recurring** (4 posts): one shared thread, everyone joins it, persists across
  occurrences.
- `close_expired_threads` gets *simpler*: no occurrence boundaries, no reopening. A thread
  closes when the host closes or deletes the listing.
- Delete `UPDATE threads SET post_id = new_post_id` from `generate_recurring_posts` — it
  exists only to drag conversations onto each new clone.

**Watch for:** a months-long thread has no natural break, so someone joining late opens a
long scrollback. If it bites, add a system divider per occurrence ("— Sunday 6 September —").
Not worth building now. Also worth checking how unread badges feel on the busiest listing,
given "no red dots demanding attention".

---

## Admin boosting

Admin-selected posts pinned to the top of the feed. No money involved. A manual liquidity
lever while supply is thin — useful for a new host's first post, a one-off like Open House
Festival, or seeding a new neighbourhood.

Three rules, all deliberate:

1. **Boost overrides sort, not filters.** If someone filtered to "within 1 mile" or toggled
   Friends, a boosted post outside that must not appear. Override the ordering; respect what
   the user explicitly excluded. Friends-only posts are never boostable into strangers' feeds.
2. **`boosted_until timestamptz`, not a boolean.** It must expire on its own. The evergreen
   bump job is the cautionary tale: a permanent flag nobody remembers setting is how the same
   posts end up on top for six months. Cap at 1–2 boosted posts at a time.
3. **Label it "Featured".** The philosophy doc explicitly rejects algorithmic feed ranking; an
   unmarked pinned post is editorial curation presented as neutral ordering. A small marker
   makes it honest and costs nothing.

Build it as the **same mechanism** as the standing-offer band above — both are "place this
here for editorial reasons". One component, not two.

Admin UI belongs in `/admin/posts`, which already exists and already gates on `is_admin`.

---

## Order of work

Every step is independently shippable and reversible. Do not reorder.

**0. Freeze.** `UPDATE cron.job SET active = false WHERE jobid IN (2, 3);`
Both jobs write to the rows being migrated. Then snapshot posts-per-chain, interest-per-chain
and threads-per-post so the backfill can be verified. Create a Supabase branch.

**1. Add both columns.** Nullable, nothing reads them. Zero-risk deploy.

**2. Repoint the bump job and ship it.** One line in cron job 3 (`resurfaced_at` instead of
`created_at`) plus the "Recently added" comparison. Re-enable job 3 and verify on the 15th
that standing offers still surface. Independently valuable — banks the timestamp fix early.

**3. Teach the card and sorts to read `next_occurrence_at`, with a fallback** to current
behaviour when null. Deploy before the backfill: invisible until data exists, so the risky
step lands into proven code.

**4. Backfill, on the branch first.** Collapse each chain onto its parent: sum
`people_interested`, repoint threads, set `next_occurrence_at` from the live child.
**Soft-delete the children — do not drop them**, so rollback is an UPDATE.

Verify on the branch before touching production:
- every thread's `post_id` resolves to a live, non-deleted post (zero orphans)
- total interest per chain after >= before
- exactly one surviving row per chain, each with `next_occurrence_at` set
- the count of posts the feed would show matches expectation

**5. Replace `generate_recurring_posts`** with an UPDATE that rolls the date forward.
Re-enable cron job 2.

**6. Delete the dead branches:** the `parent_post_id` guard in `new-post-notification`, and
the `!a.parent_post_id` boost condition. Last, once nothing depends on them.

**7. Admin boosting** — separate, smaller, can ship any time after step 3.

---

## Old shared links will break

Every generated child has its own slug. Anyone who shared `/post/casual-badminton-a3f2` in
July has a link to a post the backfill soft-deletes, and `sitemap.ts` lists live post slugs
so some may be indexed.

**Decide before the backfill, because it changes what the backfill writes.** Simplest option:
keep children as stubs and have `app/post/[id]` resolve a soft-deleted child to its parent
and redirect.

---

## Surfaces to check

- `app/page.tsx` — the sort, the band, boosting
- `app/components/PostCard.tsx` — render "Next: {date}"; no new CSS needed
- `app/post/[id]/` — single post view and `generateMetadata`, plus the redirect above
- `app/my-activity/page.tsx` — will now show one listing per activity, not a chain
- `app/components/EditPostModal.tsx` — editing a recurring listing now edits one row

---

## Consequence of parking reconfirmation

We decided not to ask hosts periodically whether a listing is still open. Under the new
model a recurring listing sits near the top of "Happening soon" indefinitely, because its
date keeps rolling — nothing prunes one whose host has quietly stopped running it. Fine at
current scale and visible in `my-activity`, but it is a real failure mode created by that
decision. Revisit if stale listings start showing up.

---

## How we'll know it worked

Interest clicks per recurring listing, before and after. Currently 0.06 per recurring post.
Needs the PostHog `activity_joined` event plus the database counts —
which is why analytics ships first.
