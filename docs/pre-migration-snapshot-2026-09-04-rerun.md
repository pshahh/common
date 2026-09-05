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

---

## Transactional dry run on production (4 Sep) — executed, rolled back

Run in place of the unavailable Supabase branch. The real migration statements were
executed against production inside a transaction aborted by `RAISE EXCEPTION`, which
guarantees rollback rather than relying on a trailing `ROLLBACK` reaching the server.

**No INSERT was issued against `posts` or `messages`.** Confirmed by inspection first:
the only notification triggers are `new-post-notification` (AFTER INSERT ON posts),
`send-message-notification` and `trg_update_thread_last_message_at` (both AFTER INSERT ON
messages). There are no UPDATE triggers on `posts`, `threads` or `messages`. The migration
is UPDATE-only on both tables, so no trigger fired and `pg_net` was never called — the
non-transactional side effect the dry run had to avoid.

### Transcript

```
A1 existing rows violating NEW check ....... 0
A2 constraint BEFORE ....................... CHECK ((status = ANY (ARRAY['pending','approved','rejected','hidden','closed','deleted'])))
A3 constraint AFTER ........................ CHECK ((status = ANY (ARRAY['pending','approved','rejected','hidden','closed','deleted','archived'])))
A4 validated against all existing rows ..... true

B1 dated recurring posts in scope ......... 73
B2 surviving chains ....................... 7
B3 chains with a live occurrence .......... 7
B4 survivors with non-approved root ....... 0   (guard requires 0)
B5 cron job 2 frozen ...................... yes

C1 posts backed up ........................ 73
C2 threads backed up ...................... 7

D1 survivors collapsed (UPDATE posts) ..... 7
D2 threads repointed (UPDATE threads) ..... 5
D3 children archived (UPDATE posts) ....... 50
D4 dead chains archived (UPDATE posts) .... 16

E-Q1  orphan threads (doc defn) ........... 10   [before 12]
E-Q1b orphan threads (true defn) .......... 12   [before 12]
E-Q3  rows not archived ................... 7    [target 7]
E-Q4  survivors missing next_occurrence ... 0    [target 0]
E-Q5  feed-visible dated recurring ........ 7    [before 7]
E-Q6  interest on survivors ............... 5    [before 5]
E-Q7  total archived rows ................. 66   [target 66]
E-Q9  standing offers disturbed ........... 5    [target 0]  <- mislabelled, see below

F  Spanish-English Language Exc   int=1  next=2026-09-04  exp=2026-09-05
F  Low stakes poker game!         int=2  next=2026-09-05  exp=2026-09-06
F  East London Badminton Group    int=0  next=2026-09-06  exp=2026-09-07
F  Casual Badminton               int=1  next=2026-09-06  exp=2026-09-07
F  Study buddies / Focus groups   int=0  next=2026-09-08  exp=2026-09-09
F  Jam session in Victoria Park   int=1  next=2026-09-13  exp=2026-09-14
F  Anyone want to play some mar   int=0  next=2026-10-03  exp=2026-10-04

ERROR: P0001: DRY RUN COMPLETE - ROLLING BACK
```

**A1–A4 answer the constraint question directly:** zero existing rows violate the widened
check, the swap applies cleanly, and Postgres reports the new constraint as `convalidated =
true`, meaning it was verified against all 165 existing rows rather than added NOT VALID.

**E-Q9 is a bad metric, not a failure.** It counts standing offers whose status is not
`approved`; there are 5 such rows (`closed`/`deleted`) both before and after. Re-checked
against the untouched database: 13 standing offers, 5 non-approved, unchanged. Zero standing
offers were modified.

### Rollback confirmation

Re-queried after the abort. Production is identical to its pre-dry-run state:

| Check | Result |
|---|---|
| `posts_status_check` reverted (no `archived`) | ✅ true |
| Rows with `status='archived'` | ✅ 0 |
| `recurring_backfill_backup_20260906` | ✅ gone |
| `recurring_backfill_threads_backup_20260906` | ✅ gone |
| Dated recurring rows | ✅ still 73 |
| Rows with `next_occurrence_at` set | ✅ still 0 |
| Threads on original chain posts | ✅ still 7 |
| Surviving roots with past expiry | ✅ still 7 |
| Total interest across chains | ✅ still 12 |

**Production is unchanged. Nothing has been applied.**

---

# RE-VERIFICATION — 5 September 2026, 10:37 UTC

Yesterday's evidence superseded. Production still unchanged (0 archived rows,
0 `next_occurrence_at` set, original `posts_status_check`). Cron job 2 still frozen,
job 3 still active.

## What moved overnight

| Measure | 4 Sep | 5 Sep |
|---|---|---|
| Total interest across chains | 12 | **13** |
| Threads on chain posts | 7 | **8** |
| Feed-visible dated recurring | 7 | **6** |

New activity: **Casual Badminton** gained 1 interest click and 1 thread (1→2 each).

### Interest per chain vs the snapshot — no chain is lower

| chain | snapshot | now | |
|---|---|---|---|
| Spanish-English Language Exchange | 1 | 1 | ✅ |
| Casual Badminton | 1 | **2** | ✅ up |
| East London Badminton Group | 0 | 0 | ✅ |
| Jam session in Victoria Park | 1 | 1 | ✅ |
| Study buddies / Focus groups | 0 | 0 | ✅ |
| Low stakes poker game! | 2 | 2 | ✅ |
| Anyone want to play some mario kart | 0 | 0 | ✅ |
| *(7 dead chains)* | 7 | 7 | ✅ unchanged |

## The Spanish-English chain lapsed — and the original migration would have aborted

Its last occurrence expired at **2026-09-05 00:00 UTC**, ten hours before this run. It still
has 17 approved posts, 1 interest click and 1 thread, so it is emphatically *not* a dead
chain — but it had no *live* occurrence, so the original `JOIN LATERAL ... WHERE expires_at >
now()` produced no plan row for it and the `n_surviving <> n_plan` guard would have fired.

The guard did its job. The fix is not to loosen it:

**Migration updated with a lapsed-chain branch.** When a surviving chain has approved posts
but no live occurrence, the next occurrence is rolled forward from the last one in whole
recurrence intervals until it lands on or after today — reproducing exactly what cron job 2
would have written had it not been frozen. Spanish-English is `weekly`, last occurrence
2026-09-04, so it rolls to **2026-09-11** (expiry 2026-09-12).

The alternative — treating a chain that lapsed by ten hours as dead — would have archived a
live listing and orphaned its thread. A new guard (`B3c`) now asserts no survivor can end up
with a next occurrence in the past.

This also makes the migration robust to further delay: it stays correct however long
approval takes, rather than silently degrading each day job 2 stays off.

## The 1 row outside the chain filter — resolved: LEAVE IT ALONE

`364b7630-cae5-4583-bb10-4b8270c1e405` — *"Would anyone like to come along to my movie club
next month"*, status `closed`, expiry 2026-06-12, 1 interest, **6 threads**.

It has `parent_post_id = cf4c403e…` but **`recurrence_rule IS NULL`**, which is why the chain
filter misses it. It is a one-off post that happens to carry a parent pointer.

**It should not be collapsed**, for three reasons:

1. **There is nothing to collapse it onto.** Its parent chain `cf4c403e` is one of the seven
   dead chains — zero approved posts, archived wholesale, no surviving listing.
2. **It is not a recurring listing.** No `recurrence_rule`. The migration collapses recurring
   chains; this is out of scope by definition, not by accident.
3. **Archiving it would orphan 6 conversations** — the largest single thread cluster in this
   dataset (14 messages, all closed 2026-06-13, last activity 13 May). Today they resolve to a
   `closed` post, which renders correctly with `ClosedBadge`. Archiving would break that.

Verified untouched by the dry run (`E-Q10 = 1`). No change needed to the migration — the
existing filter already excludes it correctly.

## Fresh dry-run transcript (5 Sep, executed and rolled back)

```
A1 existing rows violating NEW check ....... 0
A2 constraint BEFORE ....................... CHECK ((status = ANY (ARRAY['pending','approved','rejected','hidden','closed','deleted'])))
A3 constraint AFTER ........................ CHECK ((status = ANY (ARRAY['pending','approved','rejected','hidden','closed','deleted','archived'])))
A4 validated against all existing rows ..... true

B1 dated recurring posts in scope ......... 73
B2 surviving chains ....................... 7
B3 plan rows .............................. 7
B3b chains LAPSED, rolled forward ......... 1
B3c survivors with next date in past ...... 0    [guard requires 0]
B4 survivors with non-approved root ....... 0    [guard requires 0]
B5 cron job 2 frozen ...................... yes

C1 posts backed up ........................ 73
C2 threads backed up ...................... 8

D1 survivors collapsed (UPDATE posts) ..... 7
D2 threads repointed (UPDATE threads) ..... 6
D3 children archived (UPDATE posts) ....... 50
D4 dead chains archived (UPDATE posts) .... 16

E-Q1  orphan threads (doc defn) ........... 10   [before 12]
E-Q1b orphan threads (true defn) .......... 12   [before 12]
E-Q3  rows not archived ................... 7    [target 7]
E-Q4  survivors missing next_occurrence ... 0    [target 0]
E-Q5  feed-visible dated recurring ........ 7    [before 6]
E-Q6  interest on survivors ............... 6    [before 6]
E-Q7  total archived rows ................. 66   [target 66]
E-Q10 orphan row 364b7630 untouched ....... 1    [1 = untouched]

F  Low stakes poker game!         int=2  next=2026-09-05  exp=2026-09-06
F  Casual Badminton               int=2  next=2026-09-06  exp=2026-09-07
F  East London Badminton Group    int=0  next=2026-09-06  exp=2026-09-07
F  Study buddies / Focus groups   int=0  next=2026-09-08  exp=2026-09-09
F  Spanish-English Language Exc   int=1  next=2026-09-11  exp=2026-09-12   <- ROLLED FORWARD
F  Jam session in Victoria Park   int=1  next=2026-09-13  exp=2026-09-14
F  Anyone want to play some mar   int=0  next=2026-10-03  exp=2026-10-04

ERROR: P0001: DRY RUN COMPLETE - ROLLING BACK
```

**E-Q5 goes 6 → 7**: the migration *restores* the lapsed Spanish-English listing to the feed.
**E-Q6 is 6**, up from 5 yesterday, carrying the new Casual Badminton click. Every survivor's
interest is >= its snapshot value.

### Rollback confirmation (re-queried after the abort)

| Check | Result |
|---|---|
| `posts_status_check` reverted | ✅ |
| Rows with `status='archived'` | ✅ 0 |
| Both backup tables | ✅ gone |
| Dated recurring rows | ✅ 73 |
| Rows with `next_occurrence_at` | ✅ 0 |
| Threads on chain posts | ✅ 8 |
| Total interest | ✅ 13 |
| Orphan row `364b7630` | ✅ still `closed` |

**Production is unchanged. Nothing applied.**

## Note for phase 4 — archived children of dead chains have no surviving parent

The redirect for state 4 must not blindly send an archived child to its `parent_post_id`:
the 16 posts in the seven dead chains are archived *and* their parents are archived too.
Redirecting would land on another dead page. The redirect must only fire when the parent is
actually a live listing; otherwise the child falls through to the "Removed" state.
