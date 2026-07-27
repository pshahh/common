# Play Store listing draft - common

Working draft for the Play Console store listing. Character limits are current
as of 2026 (title 30, short description 80, full description 4,000) and
haven't changed since 2021. Everything below is a starting point in common's
voice, pulled from the app's own tagline and guidelines page - edit freely.

## App name / title (max 30 characters)

Pick one:

- `common - things to do nearby` (28 chars)
- `common: do things nearby` (24 chars)
- `common` (6 chars - simplest, but "common" alone is a very generic word for
  Play Store search, so it's worth pairing with a descriptor unless you're
  leaning entirely on brand recall from marketing rather than search discovery)

## Short description (max 80 characters)

> Share what you're doing. Find people nearby to join in.

(58 characters)

Alternative:

> Post an activity, find people to share it with. No dating, just doing.

(72 characters)

## Full description (max 4,000 characters)

```
What's happening nearby?

common is a place to share what you're actually doing - a run, a gig, a
writers' group at the pub, a hike this weekend - and find people who want to
join in. No events to promote, no strangers to swipe on. Just real plans,
shared by real people, looking for company.

HOW IT WORKS
- Post what you're up to: what, where, when, and who you'd like along
- Browse what's happening near you and say you're interested
- Chat with the poster to sort out the details
- Share plans with everyone, or keep them to friends only

WHY common IS DIFFERENT
Every post has to be something the poster is genuinely doing themselves -
not a business promotion, not an event they're just organising. If it's not
a personal invitation to an activity you're also part of, it doesn't belong
on common. That keeps the feed full of real plans instead of adverts.

STAY SAFE
Meet in public places, especially the first time. Report anything that
doesn't feel right, and block anyone you don't want to hear from. common is
built for people looking to do something fun or meaningful with others - be
one of them.

Find your next run, gig, hike, or hobby night. Or be the reason someone
else finds theirs.
```

(roughly 1,150 characters - well under the 4,000 limit, deliberately kept
tight rather than padded; can expand with specific use cases/testimonials
once you have them)

## Category

Suggest **Social** as the primary category (Lifestyle is the other plausible
option, but Social fits better given the messaging/friends/posting model).

## Content rating questionnaire (IARC)

You'll answer this interactively in Play Console, but here's how the
questions likely map to common as it exists today:

- Violence: None
- Sexual content: None depicted in-app (note: since the app facilitates
  real-world meetups between users, there isn't a clean IARC checkbox for
  this - answer the violence/sexual-content questions based on in-app
  content, which is none, not based on real-world outcomes)
- Profanity: None built into the app itself (user-generated messages/posts
  could theoretically contain it - if asked about user-generated content,
  answer yes, since posts and chat messages aren't pre-moderated before
  going live)
- Controlled substances: None
- User interaction / user-generated content: Yes - users post activities,
  message each other, and share content with other users
- Shares location: Yes - approximate location, for sorting/filtering by
  distance
- Digital purchases: No
- Ads: No

This questionnaire's answers directly affect the age rating and Families
policy eligibility - given the "meeting strangers in person" nature of the
app, expect a rating in the young-adult range (typically 16+ or 18+
depending on how the "user interaction with strangers" question resolves),
consistent with the 18+ target audience decision already made and enforced
at signup.

## Contact details

- Email: hello@common-social.com
- Privacy policy: https://www.common-social.com/privacy (already live)
- Website: https://www.common-social.com

## Target audience

18+ (matches the signup age gate already implemented).

## Ads / in-app purchases

Both **No**, based on the current codebase - no ad SDK, no payment/purchase
flow anywhere in the app.

## Screenshots and feature graphic

Not something I can generate here - these need actual device screenshots
(Play Console requires a minimum of 2, recommends showing the core flows:
the home feed, a post detail, the chat thread) and a 1024x500 feature
graphic. Worth grabbing screenshots of the feed, a single post, and a chat
thread on a real device once you're happy with how things look.
