# Pre-migration snapshot — dated recurring chains

Captured 3 September 2026, from production, **before** any of the recurring-posts work.
This is the reference the Session C backfill must be verified against.

Chains are grouped by `coalesce(parent_post_id, id)`. Only dated recurring posts are
included — standing offers (2099 sentinel expiry) are untouched by the migration.

## Totals to preserve

| Measure | Before |
|---|---|
| Chains (become one listing each) | **14** |
| Posts across all chains | **63** |
| Total `people_interested` | **12** |
| Total threads attached | **7** |
| Chains with a live occurrence | **7** |

After the backfill: 14 surviving rows, interest per chain >= the values below, all 7 threads
still resolving to a live post.

## Per-chain detail

| root_id | title | posts | interest | threads | latest expiry | live |
|---|---|---|---|---|---|---|
| 2d571be8-a1b1-46cb-9067-1d19e5086a16 | Spanish-English Language Exchange | 20 | 1 | 1 | 2026-09-05 | yes |
| 282bec31-f71b-49cd-8767-f2dca3d2b9fc | East London Badminton Group | 10 | 0 | 0 | 2026-09-07 | yes |
| e1663f0c-d8f3-4252-9a42-6ab18ee36a4e | Casual Badminton | 10 | 1 | 1 | 2026-09-07 | yes |
| 727db994-67c1-4fce-ba25-7ff5e1cf4f1c | Study buddies / Focus groups | 5 | 0 | 0 | 2026-09-09 | yes |
| 4005dd12-0e41-436d-9fa3-df6836a7f192 | Jam session in Victoria Park | 5 | 1 | 1 | 2026-09-14 | yes |
| 365a2982-68c7-4349-8c06-a016f080ae92 | I'm going to a movie club tomorrow… | 4 | 0 | 0 | — | no |
| 13255fef-cfeb-4c5e-bc1b-81856f17ef3f | Low stakes poker game! | 4 | 2 | 2 | 2026-09-06 | yes |
| cf4c403e-ab39-4e6c-aca1-a5580fbf951b | Would anyone like to come along to my movie club…| 3 | 5 | 0 | — | no |
| dc61f646-fd20-46a0-947b-9a0e091fa386 | Lazy Sunday Badminton | 3 | 2 | 2 | — | no |
| 3bc77b7e-2c3a-4950-9fc6-e6685cfc5c08 | Anyone want to play some mario kart with us? | 3 | 0 | 0 | 2026-10-04 | yes |
| ee5a5016-aae2-4478-af4a-da380475d667 | writing | 2 | 0 | 0 | — | no |
| f49297a4-edd8-441a-b8c2-a06127f009e0 | Lazy Sunday Badminton | 2 | 0 | 0 | — | no |
| e6cc71af-64fc-465a-9399-0eec930c2f4e | Come to a MoreYoga class with me | 1 | 0 | 0 | — | no |
| 81975604-4251-4151-bcd6-536f15c3ed6f | Moms groups | 1 | 0 | 0 | — | no |

## What this shows

The Spanish-English Language Exchange has regenerated **20 times** and collected **one**
interest click and **one** thread in total. East London Badminton: 10 occurrences, zero of
either. That is the cold-start problem in one table — every occurrence starts from nothing and
dies a week later.

Seven chains have no live occurrence at all: they ran out and were never regenerated, or the
host stopped. Those become dormant listings after the migration — worth deciding whether to
close them rather than carry them across.

## Verification queries for Session C

Run on a Supabase branch, before and after:

```sql
-- 1. no orphan threads: must return 0
select count(*) from threads t
left join posts p on p.id = t.post_id
where p.id is null or p.status = 'deleted';

-- 2. interest preserved per chain: every row must have after >= before
--    (compare against the table above)
select coalesce(parent_post_id, id) root, sum(people_interested)
from posts where recurrence_rule is not null and expires_at < '2098-01-01'
group by 1 order by 2 desc;

-- 3. exactly one surviving row per chain: must return 14
select count(*) from posts
where recurrence_rule is not null and expires_at < '2098-01-01'
  and status <> 'archived';

-- 4. every surviving dated recurring listing has a next date
select count(*) from posts
where recurrence_rule is not null and expires_at < '2098-01-01'
  and status <> 'archived' and next_occurrence_at is null;
```

---

## Dead chains — resolved 4 September

Seven of the fourteen chains have **zero approved posts**: every row in them is already
`deleted` or `closed`. They aren't dormant, they're finished — the host ended them or they were
removed. Last occurrence ranges from 3 to 175 days ago.

`e6cc71af` MoreYoga (175d) · `ee5a5016` writing (169d) · `dc61f646` Lazy Sunday Badminton (123d) ·
`81975604` Moms groups (111d) · `f49297a4` Lazy Sunday Badminton (102d) ·
`cf4c403e` movie club next month (24d) · `365a2982` movie club tomorrow (3d)

**Backfill rule:** only collapse chains with >= 1 approved post. Archive the seven above
wholesale — no surviving listing, nothing carried forward. This reduces the migration to
**7 live chains**, and removes the "should dormant listings persist?" question entirely.

Revised verification target: **7** surviving rows, not 14.
