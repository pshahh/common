# Analytics setup — PostHog

Status: **in progress** — PostHog account created (EU region), wizard next. This is the highest-priority piece of work on the roadmap.
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
2. Run the setup wizard for the boilerplate: `npx -y @posthog/wizard@latest`

   **Do NOT run it with `self-driving`.** That mode connects your GitHub repo, enables
   Session Replay and Error Tracking, and sets up AI agents that draft pull requests — far
   more than we want. Note that the wizard sends source files to an AI for analysis; env
   vars and secrets stay local.

   Do this on a clean branch so the wizard's changes are a reviewable diff.
3. **Immediately check what the wizard configured:**
   - `NEXT_PUBLIC_POSTHOG_HOST` points at the EU host (`eu.i.posthog.com`), not the US default
   - **`autocapture: false`** — this is the important one. Autocapture records clicks and
     element text across the DOM, which on our feed means post titles, first names and
     possibly message content. It breaks the no-PII rule and is badly at odds with the
     product. Set it explicitly; don't assume the default.
   - If session replay is on, input masking must be on with it
4. Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to Vercel's environment
   variables as well as `.env.local`.
5. Confirm the provider initialises PostHog once with `persistence: 'localStorage'` and
   `person_profiles: 'identified_only'`, and is mounted in `app/layout.tsx`.
6. Remove any generic "starter events" the wizard instrumented — we want exactly the ten
   events below, no more.
7. Call `posthog.identify(user.id)` on login and `posthog.reset()` on logout. Use the Supabase
   user ID so PostHog joins cleanly to the database.
8. Capture UTM parameters and referrer on first touch as person properties, so channel
   attribution survives to signup.
9. Verify in PostHog's live events view before considering it done.

## What the wizard actually produced (3 Sep)

It created `instrumentation-client.ts`, installed `posthog-js`, wrote the env vars (EU host —
correct), and instrumented ten events of its own choosing across six components.

**Correct and worth keeping:** the identify wiring is genuinely good — it hooks
`supabase.auth.onAuthStateChange`, avoids re-identifying the same user, and calls `reset()` on
sign-out. Event payloads are clean categorical metadata, no titles or message content.

**Must fix before production:**
- `posthog.identify(user.id, { email: user.email })` **sends user email addresses**. Remove the
  properties argument entirely — user id only.
- Init is missing `autocapture: false`, `person_profiles: 'identified_only'` and
  `persistence: 'localStorage'`.
- It enabled `capture_exceptions: true` (error tracking) unprompted. Decide deliberately.
- It uses `defaults: "2026-01-30"`, a versioned defaults bundle. Set the three options above
  explicitly rather than trusting whatever that bundle turns on.

**Its events vs ours:** `post_created` and `message_sent` match. `account_signup_requested` ≈
`signup_started`; `direct_thread_started` / `group_thread_joined` ≈ `interest_clicked`.
Missing entirely: **`feed_viewed`**, **`empty_state_shown`**, `signup_completed`,
`email_confirmed`, `post_card_opened`, `location_set` — including the two most important ones.
Extra and droppable: `conversation_left`, `user_blocked`, `post_updated`,
`password_reset_requested`, `report_submitted`.

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
