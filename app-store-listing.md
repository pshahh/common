# App Store listing draft - common

Working draft for App Store Connect, adapted from `play-store-listing.md`.
Copy is in common's voice: lowercase brand, calm, no exclamation marks, no
dashes. Character counts are checked against App Store Connect's limits as of
October 2026.

## App information

| Field | Value |
|---|---|
| Name (30) | `common: do things nearby` (24) |
| Subtitle (30) | `Find people to do things with` (29) |
| Bundle ID | `com.common.social` |
| SKU | `common-ios` (any unique string, never shown) |
| Primary language | English (U.K.) |
| Primary category | Social Networking |
| Secondary category | Lifestyle |
| Content rights | Doesn't contain, show or access third-party content |
| Privacy policy URL | `https://www.common-social.com/privacy` |
| Support URL | `https://www.common-social.com/guidelines#help` |
| Marketing URL (optional) | `https://www.common-social.com` |
| Copyright | `2026 common` |

Name alternatives: `common: find people nearby` (26). "common" on its own is
too generic a word to rank in search, so keep a descriptor.

Subtitle alternatives: `Share plans, find company` (25), `Real plans, real company` (24).

## Promotional text (170, editable any time without review)

```
Post what you're doing, from a run to a gig to a pub quiz, and find people nearby who want to come along. Personal invitations only, so the feed stays full of real plans.
```

(170)

## Keywords (100 bytes, comma separated, no spaces)

```
activities,meetup,friends,london,hobby,running,hiking,gig,company,plans,join,local,club,walks,social
```

Words already in the name and subtitle (common, things, nearby, find, people)
are indexed anyway, so they're left out here.

## Description (4,000)

```
What's happening nearby?

common is a place to share what you're actually doing, like a run, a gig, a writers' group at the pub or a hike this weekend, and find people who want to join in. No events to promote, no strangers to swipe on. Just real plans, shared by real people, looking for company.

HOW IT WORKS
• Post what you're up to: what, where, when, and who you'd like along
• Browse what's happening and say you're interested
• Chat with the poster to sort out the details
• Share plans with everyone, or keep them to friends only
• Get a notification when someone replies or wants to join

WHY common IS DIFFERENT
Every post has to be something the poster is doing themselves. Not a business promotion, not an event they're only organising. If it isn't a personal invitation to something you're part of, it doesn't belong on common. That keeps the feed full of real plans instead of adverts.

common isn't a dating app. It's for doing things.

STAY SAFE
Meet in public, especially the first time. You can report any post or conversation and block anyone, and we review every report within 24 hours. common is for adults, 18 and over.

common is live in London now.

Find your next run, gig, hike or hobby night. Or be the reason someone else finds theirs.
```

## App Review Information

- **Sign-in required:** yes. Username and password: the demo account (see
  "Demo account" in the step 1 notes). Don't put the password anywhere else.
- **Contact:** your name, phone number and hello@common-social.com.
- **Notes (4,000):**

```
common helps adults find people to do everyday things with: a run, a gig, a writing group. It is live in London, so the posts you'll see are London activities. The feed shows every post by default ("Distance: any"), so nothing needs changing to see them, and you don't need to share your location.

Native features
• Push notifications through APNs. People are notified when someone replies to them or is interested in their plan, which is the core loop of the app. Tapping a notification opens the relevant conversation or post. We've tested this on a physical iPhone.
• Location: only requested if you choose a distance filter or sort by nearest. It's used on the device to filter the feed and isn't sent to our servers.
• Saved passwords autofill through Associated Domains.
• Camera: used only if you choose to take a new profile photo.
• A bundled offline screen if the device has no connection.

Safety and user-generated content
• Everyone agrees to our Terms of Use at signup, which have a zero tolerance clause for objectionable content and abusive users: https://www.common-social.com/terms
• Any post can be reported from its menu (Report post). The report form includes "Also block [name]", ticked by default, so people can block the poster from any post.
• Any conversation can be reported or blocked from its menu.
• Reports are emailed to us immediately and reviewed within 24 hours. We remove content that breaks the terms and suspend or ban the account responsible.

Account deletion
Menu > Settings > Delete account, then type DELETE to confirm. The account and its data are deleted immediately. Please don't delete the demo account, or tell us if you do so we can recreate it.

Demo account
The demo account has a profile, a post of its own and an existing conversation with a second test account. Please use that conversation and the test account's posts to try reporting and blocking, rather than posts by real members.
```

## Age rating questionnaire

App Store Connect asks these on the Age Rating page. Answers for common:

- Violence, sexual content, nudity, profanity, horror, drugs, alcohol, tobacco,
  gambling, contests, medical information: **None**
- Unrestricted web access: **No** (the app only loads common-social.com;
  other links open outside the app)
- User-generated content: **Yes**
- Messaging and chat: **Yes**
- Age assurance or parental controls: **No**
- Advertising: **No**
- In-app purchases: **No**

The calculated rating will likely come out below 18+. Use the option to set a
higher rating and choose **18+**, so it matches the Terms of Use and the
signup checkbox.

## App Privacy

Answer **Yes, we collect data**. Nothing is used for tracking. Everything
below is **linked to the user**. This matches
`ios/App/App/PrivacyInfo.xcprivacy` and `play-store-data-safety.md`.

| Apple category | Data type | Purposes |
|---|---|---|
| Contact Info | Name | App Functionality |
| Contact Info | Email Address | App Functionality |
| Location | Coarse Location | Analytics |
| User Content | Photos or Videos | App Functionality |
| User Content | Emails or Text Messages | App Functionality |
| User Content | Other User Content | App Functionality |
| Identifiers | User ID | App Functionality, Analytics |
| Identifiers | Device ID | App Functionality |
| Usage Data | Product Interaction | Analytics |
| Other Data | Other Data Types | App Functionality |

Notes:

- **Coarse Location:** PostHog estimates city and country from the IP address,
  then discards the IP. The device's own location never leaves the phone, so
  it isn't declared.
- **Emails or Text Messages:** Apple's category for in-app messages.
- **Device ID:** the push notification token.
- **Other Data Types:** date of birth.
- **Not collected:** Precise Location, Phone Number, Physical Address,
  Health, Financial Info, Contacts, Browsing History, Search History, Audio,
  Gameplay, Customer Support, Crash Data, Performance Data, Advertising Data,
  Sensitive Info, Purchases.

## Pricing and availability

- Price: Free
- Availability: all countries is fine (the feed is London based for now), or
  just the United Kingdom if you'd rather start small

## Screenshots

- iPhone only, so no iPad screenshots are needed.
- Required size: **6.9" display**, 1320 x 2868 portrait (1290 x 2796 is also
  accepted). Apple scales these down for smaller iPhones.
- 1 to 10 screenshots. Suggested set of 4 to 5: the feed, a single post, a
  conversation, creating a post, and the Report post form with "Also block".
- The iPhone 17 Pro Max simulator gives exactly 1320 x 2868.

## Still needed before you can submit

1. **Review contact phone number.**
2. **The demo account**, set up as described in the step 1 notes.
3. **Screenshots** at 6.9".

Export compliance: `ITSAppUsesNonExemptEncryption` is set to NO in
`Info.plist` (the app only uses standard HTTPS), so App Store Connect won't
ask about encryption on each upload.
