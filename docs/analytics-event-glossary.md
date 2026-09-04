# Analytics event glossary

Reference for every PostHog event currently instrumented in the app. Companion to
[analytics-posthog.md](./analytics-posthog.md), which has the original rationale and the
funnels these events feed into — this doc is the concrete, kept-current list of what actually
fires, where, and with what properties.

Update this doc whenever an event is added, renamed, or its properties change.

## Events

| Event | Fires when | Properties | Surface(s) |
|---|---|---|---|
| `feed_viewed` | The feed finishes loading posts | `logged_in` (bool), `post_count` (number), `sort` (`recent` \| `soon` \| `nearest`), `has_location` (bool) | Home feed |
| `empty_state_shown` | The feed renders with zero posts after filters are applied | `radius` (number miles, or `null` for any distance), `has_location` (bool) | Home feed |
| `post_card_opened` | A **logged-in** user clicks "I'm interested" and the interested/join modal opens | `post_id` (string), `post_type` (`standing_offer` \| `one_off` \| `recurring`), `position` (number = index in the feed at click time, or `null` on the single-post page) | Home feed, single post page |
| `interested_clicked` | A **logged-out** user clicks "I'm interested" and is routed to sign up/log in instead of seeing the post detail | Same as `post_card_opened`: `post_id`, `post_type`, `position` | Home feed, single post page |
| `activity_joined` | A logged-in user completes the action — sends the first 1:1 message, or joins a group thread | `is_group` (bool) | Interested/join modal |
| `signup_started` | The auth modal is switched from login to signup mode | `trigger` (`interested` \| `post` \| `nav`) — what prompted the modal to open | Auth modal |
| `signup_completed` | `supabase.auth.signUp()` succeeds and the account row is created (before email confirmation) | — | Auth modal |
| `email_confirmed` | A user's session is identified with an `email_confirmed_at` timestamp from within the last 10 minutes — the closest available proxy for "just clicked the confirmation link," since Supabase has no distinct confirm event | `hours_since_signup` (number, rounded to 1 decimal) | Client instrumentation, on identify |
| `location_set` | The user's location is set — either browser geolocation succeeds, or they pick a result from the manual location search | `method` (`browser` \| `manual`) | Home feed |
| `message_sent` | A message is successfully sent in a thread | `thread_type` (`1:1` \| `group`) | Message thread |
| `post_created` | A new post is successfully inserted | `audience` (`everyone` \| `friends`), `recurrence` (`one-off` \| `repeats`), `thread_type` (`1:1` \| `group`), `timing_mode` (`specific` \| `flexible`) | Create post modal |

### `post_type` derivation

Computed by [`lib/postType.ts`](../lib/postType.ts) from `recurrence_rule`: `null` → `one_off`,
anything else → `recurring`. `standing_offer` isn't reachable yet — it needs the
`next_occurrence_at` column from the recurring-posts change described in
[recurring-posts-and-boosting.md](./recurring-posts-and-boosting.md), which hasn't shipped.
Once that lands, this helper needs updating to actually distinguish the two.

### Naming note

`interested_clicked` (logged-out, gated by signup) and `activity_joined` (logged-in, action
completed) are deliberately not named similarly to each other, to avoid the mix-up the earlier
`interest_clicked` name invited.

## Identify / reset

- `posthog.identify(user.id)` fires on login (Supabase `onAuthStateChange`, and on initial
  session load). **User ID only — no email, no other properties.**
- `posthog.reset()` fires on logout, and also runs automatically if a different user ID gets
  identified in the same browser session (covers shared/handed-off devices).
- This is why the same tab shows a different `distinct_id` before and after login: logged out,
  PostHog assigns a random anonymous ID; `identify()` switches the tab to the Supabase user
  UUID, and PostHog links the two behind the scenes so cross-session funnels still connect.

## First-touch attribution (person properties, not an event)

On init, `instrumentation-client.ts` reads `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, `utm_term` from the current URL and `document.referrer`, and writes them as
**set-once** person properties via `posthog.setPersonProperties(undefined, {...})`. Set-once
means they're written the first time a person profile picks them up and never overwritten by a
later, UTM-less visit — so a signup that started from a Reddit link keeps `utm_source: reddit`
even if the person returns directly weeks later. Not visible in the events table; check a
person's properties panel instead.

## No PII, anywhere

No event or person property above carries an email address, name, post title, message content,
or other PII — only IDs, categorical metadata, and counts.
