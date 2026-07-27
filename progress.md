# Progress log - common

Living record of where the app and its Play Store launch stand. Update this
as things move rather than starting fresh each time.

Last updated: 27 July 2026

## App status

v1 is live on web (common-social.com) and installed as a Capacitor-wrapped
native app on Android for testing. `capacitor.config.ts` points at the live
production URL, so web deploys update the installed app automatically -
only native (Java/Gradle/manifest) changes need a fresh build.

## Recently shipped

**Push notifications (Android)** - end-to-end via Firebase Cloud Messaging,
confirmed working including backgrounded delivery. Root cause of the
original 401 was an incorrect OAuth scope in `supabase/functions/_shared/fcm.ts`
(`firebase.cloud-messaging` instead of `firebase.messaging`).

**UI/bug fixes**
- Notification tap no longer reopens the thread after navigating away
  (switched to `router.replace()` instead of raw `window.history` calls)
- Status bar icons fixed to dark, via explicit `SystemBars` config in
  `capacitor.config.ts` (Capacitor's default auto-theming was overriding
  earlier attempts)
- "+" post button now visible for logged-out users on mobile
- Friends-only posts show proper "this one's just for friends" copy instead
  of a bare not-found
- Own posts now appear in the feed (previously filtered out), with
  interest/report actions hidden appropriately
- Message thread send button restyled (circular icon button)
- Mobile message thread and chat list pages now show the "common" brand
  header
- Feed ranking: capped the "new post" boost window so old recurring posts
  (2099 expiry sentinel) stop permanently dominating the top of the feed
- Share button now uses `navigator.share()` with a proper copied-confirmation
  fallback, and a consistent `lucide-react` icon (`ExternalLink`) everywhere
  "share" appears
- Chat thread "..." menu: added Share, renamed "Leave this chat?" to "Leave
  chat", and hid (not removed) "Block this person" - code and modal logic
  are intact, just not reachable from the menu for now
- Legacy posts missing slugs backfilled via SQL migration

**Legal / compliance**
- Privacy Policy page live at `/privacy`, linked from Settings/Sidebar (web)
  and the mobile "More" menu
- 18+ confirmation checkbox added to signup (web + mobile, same codebase),
  gating on an `age_confirmed_at` column
- Existing users backfilled with `age_confirmed_at` (assumed adults)
- Play Console Data Safety form answers drafted (`play-store-data-safety.md`)
- Store listing copy drafted (`play-store-listing.md`) - title, short/full
  description, category, content rating guidance, contact details

**Android app icon** - discovered the shipped icon was still Capacitor's
default placeholder (not the real brand mark). Regenerated the full
adaptive-icon set (all density buckets) from `public/icons/icon-512.png`,
matched the background to the brand cream (`#F5F0E3`), and tuned the glyph
size down to a 50% safe-zone ratio per your side-by-side comparison.

## Deliberately parked

Search / category filtering for the feed - explicitly decided against
building this now; revisit once user growth picks back up and it's clearly
needed rather than assumed.

## Play Store submission - current status

- Package name `com.common.social` registered and its signing key
  (SHA-256 fingerprint from the `common-release` keystore alias) added
  via Android's developer verification flow
- Old Play Console developer account was closed for inactivity; a new one
  was registered under the same Google login, ID-verified, with email and
  phone confirmed
- **Blocked:** Play Console is still only showing the old, closed account
  (everything greyed out except Policy status) - the new account isn't
  appearing anywhere. Submitted a report via Google's general contact form
  (support.google.com/googleplay/android-developer/contact/general_contact)
  describing the issue; also worth double-checking the registration
  payment actually cleared. Waiting on Google's response before the store
  listing / app content / release steps can continue.

## Still to do once account access is sorted

1. Main store listing (copy ready in `play-store-listing.md`) - still need
   real device screenshots (feed, a post, a chat thread) and a 1024x500
   feature graphic
2. App content section: privacy policy URL (`common-social.com/privacy`),
   Data Safety form (`play-store-data-safety.md`), content rating
   questionnaire, 18+ target audience declaration
3. Generate the signed release AAB in Android Studio (keystore already
   created: `PriyaCommon.jks`, alias `common-release`) - AAB output goes to
   `android/app/release`
4. Recruit 12 testers to opt in for a continuous 14-day closed test - this
   is required for new personal developer accounts before production
   access, and is the longest lead time in the whole process, so worth
   starting recruitment as soon as account access is restored
5. Upload the signed AAB to a closed testing release, run the 14-day clock
6. After that clears: promote to production

## Bigger picture

Marketing has been paused while working through this backlog. Once the
Play Store submission is unblocked and moving on its own (closed testing
clock running), the plan is to shift attention back to marketing/growth
rather than continuing to find "one more" tech fix.
