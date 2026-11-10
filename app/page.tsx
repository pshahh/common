import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from './HomeClient';
import FeedFallback from './components/FeedFallback';
import { getPublicFeedPosts } from '@/lib/publicFeed';

/**
 * The homepage is the feed. This server component fetches the public posts so
 * that:
 *  - the HTML that crawlers and AI assistants read has real content (the
 *    Suspense fallback below), instead of "Loading...". HomeClient uses
 *    useSearchParams, so Next renders the nearest Suspense fallback on the server.
 *  - the client feed starts with posts already in place (initialPosts).
 * Refreshed at most every 5 minutes.
 */
export const revalidate = 300;

const CANONICAL_LINE = "common is a free app for finding people in London to do things with: post a plan, or join someone else's.";

export const metadata: Metadata = {
  title: 'common: find people in London to do things with',
  description: CANONICAL_LINE,
  alternates: { canonical: 'https://www.common-social.com/' },
  openGraph: {
    title: 'common: find people in London to do things with',
    description: CANONICAL_LINE,
    siteName: 'common',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: { card: 'summary', title: 'common: find people in London to do things with', description: CANONICAL_LINE },
};

export default async function Page() {
  const posts = await getPublicFeedPosts();
  return (
    <Suspense fallback={<FeedFallback posts={posts} />}>
      <HomeClient initialPosts={posts} />
    </Suspense>
  );
}
