import { getPublicFeedPosts } from '@/lib/publicFeed';
import { shortArea } from '@/lib/landing/livePosts';
import { formatListingTime } from '@/lib/dates';

/**
 * /llms.txt: a plain-text summary of common for AI assistants and crawlers
 * (format: https://llmstxt.org). Lists the live public plans, refreshed at
 * most every hour, so it never goes stale.
 */
export const revalidate = 3600;

const SITE = 'https://www.common-social.com';
const REPEATS: Record<string, string> = { weekly: 'every week', biweekly: 'every other week', monthly: 'every month' };

export async function GET() {
  const posts = (await getPublicFeedPosts()).slice(0, 40);

  const plans = posts.map((p) => {
    const when = formatListingTime(p.time ?? '', p.next_occurrence_at).replace(/\s+/g, ' ').trim();
    const repeats = p.recurrence_rule ? REPEATS[p.recurrence_rule] : null;
    const details = [shortArea(p.location), when, repeats].filter(Boolean).join(' · ');
    const title = p.title.replace(/[\[\]]/g, '').trim();
    return `- [${title}](${SITE}/post/${p.slug ?? p.id}): ${details}`;
  });

  const body = `# common

> common is a free app for finding people in London to do things with: post a plan, or join someone else's.

common is a web app that works in any browser, with no download. Each post is someone saying "I'm doing this, who's in?", from beginner tennis and badminton to book clubs, gigs and photo walks. Anyone can browse without an account. Tapping "I'm interested" opens a chat with the host, 1:1 or as a group, where people sort out the details. Plans can happen once, repeat weekly, every other week or monthly, or have no fixed date at all.

Key facts:
- Free to use. Some plans have their own costs, like a court booking or a ticket.
- London only for now. Plans are spread across the city.
- For over-18s. Not a dating app, and dating posts aren't allowed.
- No long profiles, likes, followers or algorithmic feed. You sort plans by newest, soonest or nearest.
- Anyone can be blocked or reported from the chat.

## Key pages

- [How common works](${SITE}/welcome): what common is, how joining and posting work, staying safe, and answers to common questions such as how to meet people and make friends in London
- [Everything on common now](${SITE}/): the live feed of plans
- [Community guidelines](${SITE}/guidelines): what can be posted and how people are expected to behave

## Plans on common right now

${plans.length ? plans.join('\n') : '- Nothing is live at the moment. See the feed for new plans.'}

## Optional

- [Privacy](${SITE}/privacy)
- [Terms](${SITE}/terms)
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
