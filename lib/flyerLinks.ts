/**
 * Short links printed on paper flyers: common-social.com/comedy and so on.
 *
 * Each slug resolves to a live post (or the feed) via app/api/flyer/[slug],
 * wired up by the rewrites() entry in next.config.ts. Because the flyer
 * outlives the post, the handler checks the post is still live and falls
 * back to the feed when it isn't, so a flyer on a noticeboard never lands on
 * a dead page.
 *
 * To point a slug somewhere else, change its postId here (leave it out for
 * the feed) and deploy. The printed QR code and URL never change.
 *
 * Post ids are the UUIDs from the posts table. Recurring posts keep one
 * durable listing, so their id stays valid week to week.
 */
export const FLYERS: Record<string, { postId?: string }> = {
  comedy: { postId: '3807cfc8-1bb3-4ab5-8c2e-42efda126aca' }, // improv show, ends 15 Nov
  bookclub: { postId: '90ba6598-b2e5-486a-b66f-7bbea292928c' },
  draw: { postId: '606246df-b646-4eb5-ac84-b3b284bdef97' },
  badminton: { postId: 'e1663f0c-d8f3-4252-9a42-6ab18ee36a4e' },
  plan: {}, // host flyer: goes to the feed
};
