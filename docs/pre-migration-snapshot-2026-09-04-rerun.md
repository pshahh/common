# Pre-migration snapshot — RE-TAKEN 4 September 2026 (pre-backfill)

Captured from **production** immediately before the Session C backfill, superseding the
counts in `pre-migration-snapshot-2026-09.md` (which was taken 3 September). Keep both:
the older file records the decisions, this one records the numbers the backfill is
verified against.

Chains grouped by `coalesce(parent_post_id, id)`. Dated recurring only —
standing offers (2099 sentinel expiry) are untouched.

## Corrections to the 3 September doc

1. **Post count was wrong.** The old doc's "Posts across all chains: 63" contradicts its own
   per-chain table, which sums to **73**. Production confirms 73 = 14 roots + 59 children.
   The "63" came from the problem-statement table (10 originals + 53 children), which counted
   a different set. Chains, interest and thread totals in the old doc are all correct.
2. **Verification query 1 does not return 0 today.** It returns **12**. There are pre-existing
   orphaned threads unrelated to this migration. The test is "does not increase", not "is 0".
3. **Query 3's target is 7**, per the "Dead chains" revision, not the 14 written above the query.

## Totals

| Measure | Value (4 Sep, pre-backfill) |
|---|---|
| Chains | 14 |
| Dated recurring posts | **73** (14 roots + 59 children) |
| Standing offers (untouched) | 13 |
| Total `people_interested` across chains | 12 |
| Total threads attached to chains | 7 |
| Chains with >= 1 approved post | **7** |
| Chains with zero approved posts (dead) | **7** |
| Dated recurring posts currently visible in feed | **7** |

## Per-chain detail

`approved` = posts in the chain with `status='approved'`. `live` = has an approved,
not-yet-expired occurrence.

### Surviving chains (>= 1 approved post) — 7, these get collapsed

| root_id | title | posts | approved | interest | threads | root status | root expiry | live child expiry | live |
|---|---|---|---|---|---|---|---|---|---|
| 2d571be8 | Spanish-English Language Exchange | 20 | 17 | 1 | 1 | approved | 2026-05-16 | 2026-09-05 | 1 |
| e1663f0c | Casual Badminton | 10 | 10 | 1 | 1 | approved | 2026-07-06 | 2026-09-07 | 1 |
| 282bec31 | East London Badminton Group | 10 | 10 | 0 | 0 | approved | 2026-07-06 | 2026-09-07 | 1 |
| 4005dd12 | Jam session in Victoria Park | 5 | 5 | 1 | 1 | approved | 2026-07-20 | 2026-09-14 | 1 |
| 727db994 | Study buddies / Focus groups | 5 | 5 | 0 | 0 | approved | 2026-08-12 | 2026-09-09 | 1 |
| 13255fef | Low stakes poker game! | 4 | 4 | 2 | 2 | approved | 2026-08-16 | 2026-09-06 | 1 |
| 3bc77b7e | Anyone want to play some mario kart with us? | 3 | 3 | 0 | 0 | approved | 2026-08-05 | 2026-10-04 | 1 |

**Subtotal: 57 posts · 5 interest · 5 threads.**

Two facts that make the collapse safe, both verified rather than assumed:
- **Every one of the 7 roots is itself `approved`** — the survivor is a viable row in all cases.
- **Every one of the 7 chains has exactly one live occurrence** — `next_occurrence_at` has a
  single unambiguous source. No chain needs a tiebreak.

### Dead chains (zero approved posts) — 7, archived wholesale

| root_id | title | posts | approved | interest | threads | root status |
|---|---|---|---|---|---|---|
| 365a2982 | I'm going to a movie club tomorrow… | 4 | 0 | 0 | 0 | closed |
| dc61f646 | Lazy Sunday Badminton | 3 | 0 | **2** | **2** | deleted |
| cf4c403e | Would anyone like to come along to my movie club… | 3 | 0 | **5** | 0 | closed |
| f49297a4 | Lazy Sunday Badminton | 2 | 0 | 0 | 0 | closed |
| ee5a5016 | writing | 2 | 0 | 0 | 0 | deleted |
| e6cc71af | Come to a MoreYoga class with me | 1 | 0 | 0 | 0 | deleted |
| 81975604 | Moms groups | 1 | 0 | 0 | 0 | deleted |

**Subtotal: 16 posts · 7 interest · 2 threads — all discarded by the archive-wholesale rule.**

Two consequences of that rule, both intended but neither previously written down:

- **7 of the 12 interest clicks are dropped**, not carried forward: 5 on `cf4c403e`,
  2 on `dc61f646`. Post-backfill total across surviving chains is **5**, not 12. The old
  doc's "total interest per chain after >= before" holds for the 7 survivors and is
  meaningless for the 7 dead chains, which no longer exist as chains.
- **2 of the 7 threads sit on `dc61f646`**, whose root is already `status='deleted'`. They are
  already 2 of the 12 pre-existing orphans and stay orphaned. Only **5** threads get repointed.

## The `expires_at` problem — found during this snapshot, not previously specced

The feed query (`app/page.tsx:550`, mirrored in `sitemap.ts:28`) is:

    status = 'approved' AND (expires_at IS NULL OR expires_at > now())

**Every one of the 7 surviving roots has an `expires_at` in the past** (earliest 2026-05-16,
latest 2026-08-12). Collapsing onto the root and setting only `next_occurrence_at` would leave
all 7 survivors failing that filter: the feed would show **zero** dated recurring activities,
down from 7 today, and the sitemap would drop them too.

So the backfill must also **roll `expires_at` forward on the survivor**, taking the live
child's value. This preserves today's visibility semantics exactly rather than inventing new
ones: the live child is the row the feed shows right now, so the survivor inherits both its
expiry and its occurrence date.

    survivor.next_occurrence_at := live_child.expires_at - interval '1 day'
    survivor.expires_at         := live_child.expires_at

The `- 1 day` is not a guess. `generate_recurring_posts` sets
`new_expiry := (next_date + INTERVAL '1 day')`, so a child's expiry is always its occurrence
date plus one day. Verified against the live function source.

## Verification queries (corrected targets)

```sql
-- 1. orphan threads. BEFORE = 12 (pre-existing). Must NOT increase.
select count(*) from threads t
left join posts p on p.id = t.post_id
where p.id is null or p.status = 'deleted';

-- 2. interest per surviving chain: after >= before, for the 7 survivors only
select coalesce(parent_post_id, id) root, sum(people_interested)
from posts where recurrence_rule is not null and expires_at < '2098-01-01'
group by 1 order by 2 desc;

-- 3. exactly one surviving row per live chain: must return 7 (not 14)
select count(*) from posts
where recurrence_rule is not null and expires_at < '2098-01-01'
  and status <> 'archived';

-- 4. every survivor has a next date: must return 0
select count(*) from posts
where recurrence_rule is not null and expires_at < '2098-01-01'
  and status <> 'archived' and next_occurrence_at is null;

-- 5. ADDED: survivors still visible to the feed. BEFORE = 7, must stay 7.
select count(*) from posts
where recurrence_rule is not null and expires_at < '2098-01-01'
  and status = 'approved' and expires_at > now();
```

## Baseline values (production, 4 Sep, pre-backfill)

| Query | Before |
|---|---|
| 1 · orphan threads | **12** |
| 3 · rows not archived | **73** |
| 4 · survivors missing next_occurrence_at | **73** |
| 5 · feed-visible dated recurring | **7** |

## Cron state at snapshot time

| jobid | name | schedule | active |
|---|---|---|---|
| 1 | close-expired-threads | `0 * * * *` | true |
| 2 | generate-recurring-posts | `0 3 * * *` | **false** (frozen, as required) |
| 3 | bump-recurring-posts | `0 9 1,15 * *` | true (left alone) |

---

## Dry-run results (read-only projection against production, 4 Sep)

Computed by projecting every row's post-migration state in SELECT-space. No write
touched production. Supabase branching is unavailable on this plan (Pro required), so
this projection stands in for the branch run — see "Branching blocked" below.

| Check | Before | After | Target | Pass |
|---|---|---|---|---|
| Q1 · orphan threads, doc's literal `status='deleted'` | 12 | **10** | not worse | ⚠ see note |
| Q1b · orphan threads, true definition (`deleted` OR `archived`) | 12 | **12** | not worse | ✅ |
| Q3 · dated recurring rows not archived | 73 | **7** | 7 | ✅ |
| Q4 · survivors missing `next_occurrence_at` | 73 | **0** | 0 | ✅ |
| Q5 · feed-visible dated recurring | 7 | **7** | 7 | ✅ |
| Q6 · interest on surviving chains | 5 | **5** | >= 5 | ✅ |
| Q7 · posts newly archived | — | **66** | 73 − 7 | ✅ |
| Q8 · rows deleted | — | **0** | 0 | ✅ |
| Q9 · standing offers modified | — | **0** | 0 | ✅ |

**Note on Q1.** The doc's query gets *better* (12 → 10) for the wrong reason. Dead chain
`dc61f646`'s root currently has `status='deleted'` and carries 2 threads; the migration
flips it to `'archived'`, so those 2 threads stop matching `status='deleted'` while
remaining just as orphaned. Q1b is the honest version and it is flat at 12. Neither
number represents a regression caused by this migration — the 12 are pre-existing.

### Per-survivor detail

| listing | interest before → after | chain | archived | threads repointed | expiry before → after | next_occurrence_at |
|---|---|---|---|---|---|---|
| Spanish-English Language Exchange | 0 → 1 | 20 | 19 | 1 | 2026-05-16 → 2026-09-05 | 2026-09-04 |
| Low stakes poker game! | 2 → 2 | 4 | 3 | 2 | 2026-08-16 → 2026-09-06 | 2026-09-05 |
| East London Badminton Group | 0 → 0 | 10 | 9 | 0 | 2026-07-06 → 2026-09-07 | 2026-09-06 |
| Casual Badminton | 0 → 1 | 10 | 9 | 1 | 2026-07-06 → 2026-09-07 | 2026-09-06 |
| Study buddies / Focus groups | 0 → 0 | 5 | 4 | 0 | 2026-08-12 → 2026-09-09 | 2026-09-08 |
| Jam session in Victoria Park | 0 → 1 | 5 | 4 | 1 | 2026-07-20 → 2026-09-14 | 2026-09-13 |
| Anyone want to play some mario kart with us? | 0 → 0 | 3 | 2 | 0 | 2026-08-05 → 2026-10-04 | 2026-10-03 |

50 children archived across surviving chains + 16 posts across the 7 dead chains = **66**.
5 threads repointed. 7 rows survive.

## Branching blocked

`create_branch` returns `PaymentRequiredException: Branching is supported only on the
Pro plan or above`. The project (`common`, ref `toosohygbqfpfktspbfr`) is not on Pro.

Worth knowing even if Pro is bought: a Supabase branch is created by replaying migrations
onto a **fresh, empty database** — production data does not carry over. A branch would
therefore have verified the migration against synthetic rows, not against the 73 real ones.
The read-only projection above verifies against the real data instead.

## Also found: `'archived'` is not a legal status

`posts_status_check` allows only `pending / approved / rejected / hidden / closed / deleted`.
The soft-delete fails outright without widening it first. The forward migration does this
as its step 0.
