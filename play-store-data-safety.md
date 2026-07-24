# Play Console "Data Safety" form - answers for common

This is a working reference for filling out Play Console's Data Safety section
(App content > Data safety). It's based on what the codebase actually collects
and sends today. It is **not legal advice** - the answers below reflect the
app's behaviour as of this build; double-check anything you're unsure about
before submitting, since Google can suspend apps for inaccurate declarations.

## Does your app collect or share any of the required user data types?

**Yes.**

## Data types to declare

### Location
- **Approximate location** - Collected. Used for app functionality (sorting/filtering
  posts by distance). Not shared with third parties beyond the on-device
  calculation. Processed ephemerally - not persisted to your database, only
  cached client-side (localStorage) for convenience.
- **Precise location** - Not collected (the app uses the browser/device's
  standard geolocation call, which you can mark as "approximate" since you
  don't request high-accuracy/fine location deliberately - `enableHighAccuracy: false`
  is set in `page.tsx`).

### Personal info
- **Name** - Collected (first name). Shared with other users (visible on posts/profile).
  Required, used for account functionality.
- **Email address** - Collected (Supabase Auth). Not shared with other users. Used
  for account functionality (login) and transactional email (via Resend).
- **User IDs** - Collected (Supabase auth UID). Used for account functionality.
- **Date of birth** - Collected (optional, user-provided). Used to display age
  next to profile photos. Visible to other users if provided.

### Photos
- **Photos** - Collected (profile/avatar photo, optional). Shared with other users.

### Messages
- **In-app messages** - Collected (chat messages between users coordinating
  activities). Not shared outside the app; visible only to thread participants.

### App activity
- **Other user-generated content** - Collected (posts: title, notes, location text,
  timing, preferences). Shared with other users per the post's visibility
  (everyone / friends-only).
- **App interactions** - Arguably not collected (no analytics SDK in this build -
  confirmed no analytics/ad SDKs in package.json as of this write-up). If you add
  an analytics tool later, revisit this section.

### Device or other IDs
- **Device or other IDs** - Collected (push notification device token / FCM
  token, and web push subscription keys). Used for app functionality (delivering
  notifications) only. Not shared with third parties beyond Google/Firebase's
  own delivery pipeline (which Google does not require you to separately
  declare as "sharing," since FCM is the mechanism Android push runs on).

## Data NOT collected (per this codebase)
- Financial info, health/fitness data, contacts, calendar, files/docs, audio,
  video, web browsing history outside the app - none of these are collected
  based on what's in this repo.

## "Is data shared with third parties?"
Answer **yes**, and list:
- **Google (Firebase Cloud Messaging)** - device/other IDs, for push notification delivery.
- **Resend** - email address, for transactional email delivery.
- **OpenStreetMap Nominatim** - the free-text location search string you type
  (not stored server-side) - this is a borderline case; Nominatim receives
  whatever text the user types into the location search box directly from
  their device. Worth declaring under "App activity" or noting in the privacy
  policy even if Play's form doesn't have a clean category for it.
- **Supabase** is your data processor/hosting infrastructure, not a "third
  party" in the advertising/analytics sense - Play generally doesn't require
  declaring your own backend host as data sharing, since it's processing data
  strictly on your behalf under your instruction. Still worth naming in your
  privacy policy for transparency (already done on the `/privacy` page).

## "Is all of this data encrypted in transit?"
Yes, assuming Supabase (HTTPS/TLS) and your Vercel/hosting setup enforce HTTPS
everywhere, which is the default. Confirm your production domain doesn't allow
plain HTTP.

## "Do you provide a way for users to request data deletion?"
Yes - point this at the `/privacy` page's contact email
(hello@common-social.com), or better, add an in-app "Delete my account" flow
in Settings if you don't already have one. Play increasingly expects an
in-app self-service deletion path in addition to an email request, especially
for consumer social apps - worth prioritizing this if you don't have it yet.

## Target audience / age
This is the item most likely to need a real product decision, not just a form
answer. Right now:
- There's no age gate anywhere in signup (`AuthModal.tsx` only asks for email/password).
- `date_of_birth` is optional and collected post-signup, not verified.
- The app is designed around meeting people in person and messaging strangers.

Play's Families/target-audience policies are strict about apps that combine
"meeting new people" functionality with reachability by minors. You'll need to:
1. Declare an appropriate minimum age in the Play Console target audience
   section (commonly 18+ for apps facilitating in-person meetups with
   strangers).
2. Make sure your actual signup flow and Terms reflect that minimum age -
   right now nothing in the product enforces or even states one.
3. Decide whether you want a lightweight age assertion at signup (a simple
   "I am 18 or older" checkbox is the common minimum-effort approach many
   apps in this category use, though it's not a strong verification method).

This is worth a deliberate decision before submitting, since an inaccurate
answer here (declaring general audience when the app isn't appropriate for
one) is a common cause of Play Store rejections and suspensions for social
apps.
