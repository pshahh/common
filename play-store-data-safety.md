# Play Console "Data Safety" form - answers for common

This is a working reference for filling out Play Console's Data Safety section
(App content > Data safety). It matches the iOS privacy manifest
(`ios/App/App/PrivacyInfo.xcprivacy`) and the `/privacy` page, and reflects
what the codebase collects as of October 2026. It is **not legal advice** -
Google can suspend apps for inaccurate declarations, so revisit this whenever
an SDK or data flow changes.

## Does your app collect or share any of the required user data types?

**Yes.**

## Is all of the user data collected by your app encrypted in transit?

**Yes.** Supabase, Vercel, PostHog, FCM and Resend are all HTTPS only.

## Do you provide a way for users to request that their data is deleted?

**Yes.** Settings > Delete account deletes the account and its data
immediately, in the app and on the website. Play also asks for a web URL where
people can request deletion: use `https://www.common-social.com/privacy`, which
describes the Settings path and the contact email.

## Data types to declare

Play counts data as "collected" only when it leaves the device, and doesn't
count transfers to service providers acting on your behalf as "sharing".

| Play category | Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|---|
| Location | Approximate location | Yes | No | Required | Analytics |
| Personal info | Name | Yes | No | Required | App functionality |
| Personal info | Email address | Yes | No | Required | App functionality, Account management |
| Personal info | User IDs | Yes | No | Required | App functionality, Analytics, Account management |
| Personal info | Other info (date of birth) | Yes | No | Optional | App functionality |
| Photos and videos | Photos | Yes | No | Optional | App functionality |
| Messages | Other in-app messages | Yes | No | Required | App functionality |
| App activity | App interactions | Yes | No | Required | Analytics |
| App activity | Other user-generated content (posts) | Yes | No | Required | App functionality |
| Device or other IDs | Device or other IDs | Yes | No | Optional | App functionality |

Notes on each:

- **Approximate location** - PostHog estimates city/country from the IP
  address on every event, linked to the user ID once signed in. The device's
  own geolocation (used for distance filtering and nearest sorting) stays on
  the device and is never sent to our servers, so on its own it would not
  count as collected.
- **Name, date of birth, photos** - visible to other users on posts and
  profiles. Showing data to other users of the app is not "sharing" in Play's
  sense.
- **User IDs** - the Supabase auth UID, also used as the PostHog distinct ID.
- **App interactions** - PostHog product events (signup, post created, message
  sent, etc.), plus first-touch UTM parameters and referrer. Autocapture is off.
  PostHog runs on EU servers, without cookies, and isn't used for tracking
  across apps.
- **Device or other IDs** - FCM token for push notifications (only if the
  person allows notifications), and the PostHog anonymous ID before signup.

## Data NOT collected

Precise location, financial info, health and fitness, contacts, calendar,
files and docs, audio, video, web browsing history, installed apps, crash logs
and diagnostics, advertising ID.

## Is data shared with third parties?

**No.** Everything goes to service providers processing on our behalf, which
Play excludes from "sharing":

- **Supabase** - database, auth, profile photo storage
- **Vercel** - hosting
- **PostHog** - usage analytics (EU)
- **Google Firebase Cloud Messaging** - push notification delivery
- **Resend** - transactional email

One borderline case: **OpenStreetMap Nominatim** receives the free-text place
search typed into the location box, directly from the device. It isn't stored
by us and isn't one of Play's data types, so it isn't declared, but it is
named in the privacy policy. Similarly, tapping a place opens Google Maps with
that place, which is a user-initiated link, not a transfer.

## Target audience and age

common is 18+. Signup requires ticking "I confirm I'm 18 or older, and I agree
to common's Terms of Use and Privacy Policy", and the Terms of Use (`/terms`)
state the minimum age. Declare 18+ as the target age group in Play Console's
Target audience section.
