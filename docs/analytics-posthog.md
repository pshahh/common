# Analytics setup — PostHog

Status: **not started**. This is the highest-priority piece of work on the roadmap.
Written 3 September 2026.

## Why this first

Every metric we currently have starts *after* signup, because the only data source is the
Supabase database. The larger half of the funnel — how many people land on the feed, what
they do there, and how many convert — is completely unobserved.

Analytics also has a lead time you cannot recover: you can't retroactively instrument. Any
change shipped before this lands will have no measurable "before".

**The one question to answer in week one:** of everyone who lands on the feed, what
fraction signs up?

## Choice and cost

**PostHog, EU (Frankfurt) region.** We need product analytics — funnels, cohort retention,
per-user paths — not page analytics, which rules out Plausible and Fathom.

Free tier is 1M events/month, 5K session recordings, 1M feature flag requests. At ~40 monthly
actives we'll generate low thousands of events a month. Realistically free for well over a
year. Budget nothing.

## Privacy configuration — decide before shipping

PECR covers storing or accessing information on a user's device, which is broader than
cookies and arguably includes `localStorage`. Two options:

- **`persistence: 'localStorage'`** (recommended) — anonymous IDs survive page loads, so
  funnels work properly. Add a short line to `/privacy` describing first-party analytics.
  Most privacy-forward products take this route.
- **`persistence: 'memory'`** — nothing stored, no consent question at all, but the anonymous
  ID resets on every page load, which breaks multi-page funnels. Only worth it if we want to
  be maximally conservative.

Either way: set `person_profiles: 'identified_only'` so anonymous browsing doesn't create
person records, and **never send PII** — no email addresses, no post titles, no message
content. User IDs only.

This is worth 20 minutes of proper checking rather than taking this doc's word for it.
Whatever we choose, we do NOT want a cookie banner — it would be badly at odds with the
product.

## Setup steps

1. Create a PostHog account, choose **EU (Frankfurt)** at signup. Region cannot be changed later.
2. `npm install posthog-js`
3. Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` (the EU host) to `.env.local`
   and to Vercel's environment variables.
4. Create a client provider component that initialises PostHog once, with the persistence
   and `person_profiles` settings above. Mount it in `app/layout.tsx`.
5. Call `posthog.identify(user.id)` on login and `posthog.reset()` on logout. Use the Supabase
   user ID so PostHog joins cleanly to the database.
6. Capture UTM parameters and referrer on first touch as person properties, so channel
   attribution survives to signup.
7. Verify in PostHog's live events view before considering it done.

## Event taxonomy

Ten events. Resist adding more until a specific question demands one — a small, well-named
set beats a large vague one.

| Event | Fires when | Properties | Answers |
|---|---|---|---|
| `feed_viewed` | Feed renders | `logged_in`, `post_count`, `sort`, `has_location` | How many people arrive, and do they see an empty feed |
| `post_card_opened` | A post is opened | `post_id`, `post_type`, `position` | Does the feed hold attention; which formats get clicked |
| `signup_started` | Auth modal opens | `trigger` (interested / post / nav) | What motivates signup |
| `signup_completed` | Account created | — | **The core conversion, with `feed_viewed`** |
| `email_confirmed` | Confirmation link followed | `hours_since_signup` | Whether the 16% non-confirmation is deliverability or drop-off |
| `interest_clicked` | "I'm interested" pressed | `post_id`, `post_type`, `is_recurring` | Whether the recurring change worked |
| `message_sent` | Message sent | `thread_id`, `is_first_in_thread` | Activation |
| `post_created` | Post published | `post_type`, `audience`, `recurrence`, `thread_type` | Supply, and which formats hosts choose |
| `location_set` | Location granted or entered | `method` (browser / manual) | How many can use distance filters at all |
| `empty_state_shown` | Feed renders with 0 posts | `radius`, `has_location` | **How often we show newcomers nothing** |

`post_type` should be one of `standing_offer` / `one_off` / `recurring`, matching the three
de facto types in the philosophy doc.

## What to build in PostHog once events land

- **Funnel:** `feed_viewed` → `signup_started` → `signup_completed` → `email_confirmed`
- **Funnel:** `feed_viewed` → `post_card_opened` → `interest_clicked` → `message_sent`
- **Retention:** weekly, on `feed_viewed`, to track month-1 return against the 25% target
- **Session replay:** watch five sessions that ended without signup. This will teach more in
  twenty minutes than any dashboard — particularly the out-of-area case.
- **Trend:** `empty_state_shown` per week. If this is high, liquidity is the whole problem
  and nothing else matters.

## Definition of done

- Events visible in PostHog live view from production
- Both funnels built and showing data
- One week of baseline collected **before** the recurring-posts change ships
- No PII in any event payload
