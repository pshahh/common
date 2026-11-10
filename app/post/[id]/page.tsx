import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import SinglePostClient, { type Post, type PostUnavailableReason } from './SinglePostClient';
import { isUUID } from '@/lib/slug';
import { formatListingTime } from '@/lib/dates';

// Create a server-side Supabase client for metadata generation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Props {
  params: Promise<{ id: string }>;
}

// Generate dynamic metadata for link previews
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  // Try by UUID first, then by slug
  const column = isUUID(id) ? 'id' : 'slug';
  let { data: post } = await supabase
    .from('posts')
    .select('title, location, time, notes, next_occurrence_at, audience')
    .eq(column, id)
    .in('status', ['approved', 'closed'])
    .single();

  // An archived child of a still-running listing redirects at render time, but
  // link-preview scrapers often don't follow redirects. Describe the surviving
  // listing instead, so a badminton link shared in July still previews as
  // badminton rather than "Post not found".
  if (!post) {
    const { data: archived } = await supabase
      .from('posts')
      .select('parent_post_id, status')
      .eq(column, id)
      .maybeSingle();

    if (archived?.status === 'archived' && archived.parent_post_id) {
      const { data: parent } = await supabase
        .from('posts')
        .select('title, location, time, notes, next_occurrence_at, audience')
        .eq('id', archived.parent_post_id)
        .eq('status', 'approved')
        .maybeSingle();
      if (parent) post = parent;
    }
  }

  if (!post) {
    return {
      title: 'Post not found | common',
      description: 'This post may have been removed or is no longer available.',
    };
  }

  // Friends-only posts: say nothing about the plan. The service key above
  // bypasses RLS, so without this the title, place and notes would sit in the
  // page <title> and link previews for anyone holding the URL, which is the
  // exact leak the friends-only screen in SinglePostClient is built to avoid.
  if (post.audience === 'friends') {
    return {
      title: 'A plan shared with friends | common',
      description: 'This plan is only visible to the host’s friends on common.',
      robots: { index: false },
    };
  }

  // Create a compelling description.
  // A recurring listing carries a rolling next date, so a shared link previews
  // the occurrence someone can actually turn up to rather than the stale date
  // the listing was posted with. Standing offers have no next date and read
  // exactly as the host wrote them.
  const when = formatListingTime(post.time, post.next_occurrence_at);
  const description = post.notes 
    ? `${post.location} · ${when} · ${post.notes}`
    : `${post.location} · ${when}`;

  return {
    title: `${post.title} | common`,
    description: description,
    openGraph: {
      title: post.title,
      description: description,
      siteName: 'common',
      type: 'website',
      locale: 'en_GB',
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: description,
    },
  };
}

// Statuses that mean "there is a row, but nobody should be shown it".
const REMOVED_STATUSES = ['deleted', 'rejected', 'hidden', 'archived'];

// Resolve WHY a post can't be shown, using the service role key.
//
// This has to happen server-side. The browser's client is RLS-scoped, and RLS
// returns an empty result for a deleted post, a mistyped slug and a
// friends-only post the viewer isn't a friend of - three very different things
// that the page used to collapse into one "just for friends" screen.
//
// Returns null when the post exists and is viewable in principle. The client
// then does its own fetch, and an empty result there really does mean
// friends-only.
async function resolveUnavailableReason(id: string): Promise<PostUnavailableReason> {
  const column = isUUID(id) ? 'id' : 'slug';
  const { data: post } = await supabase
    .from('posts')
    .select('id, status, parent_post_id')
    .eq(column, id)
    .maybeSingle();

  if (!post) return 'not_found';

  // An archived child is an old occurrence of a recurring listing that the
  // backfill collapsed. Anyone holding a link shared back in July should land
  // on the listing that is still running, not on a dead end.
  //
  // Only redirect when the parent is genuinely live. The 16 posts in the seven
  // dead chains are archived AND so are their parents - redirecting those would
  // just bounce the viewer onto another unavailable page.
  if (post.status === 'archived' && post.parent_post_id) {
    const { data: parent } = await supabase
      .from('posts')
      .select('id, slug, status')
      .eq('id', post.parent_post_id)
      .maybeSingle();

    if (parent && parent.status === 'approved') {
      redirect(`/post/${parent.slug ?? parent.id}`);
    }
    return 'removed';
  }

  if (REMOVED_STATUSES.includes(post.status)) return 'removed';

  return null;
}

// A public post, for the server-rendered page. Friends-only posts are left to
// the client, where RLS decides whether this viewer may see them.
async function getPublicPost(id: string): Promise<Post | null> {
  const column = isUUID(id) ? 'id' : 'slug';
  const { data } = await supabase
    .from('posts')
    // Only what the page uses: this object is embedded in the HTML.
    .select('id, title, location, latitude, longitude, time, notes, name, preference, people_interested, user_id, created_at, status, recurrence_rule, expires_at, slug, thread_type, audience, next_occurrence_at')
    .eq(column, id)
    .eq('audience', 'everyone')
    .in('status', ['approved', 'closed'])
    .maybeSingle();
  return (data as Post | null) ?? null;
}

const SITE = 'https://www.common-social.com';
const STANDING_OFFER_EXPIRY = '2099-01-01';

// schema.org Event for dated plans that are still on, so search engines and AI
// assistants can treat them as events. Dates only: the time of day is free text
// ("around 7pm"), so it can't be parsed reliably. Standing offers have no date
// and get no Event.
function eventJsonLd(post: Post) {
  if (post.status !== 'approved' || !post.expires_at || post.expires_at >= STANDING_OFFER_EXPIRY) return null;
  if (new Date(post.expires_at) < new Date()) return null;

  // A recurring listing carries its next date. A one-off expires at midnight
  // after the day it happens, so its date is the day before expires_at.
  let startDate: string;
  if (post.next_occurrence_at) {
    startDate = post.next_occurrence_at.slice(0, 10);
  } else {
    const d = new Date(post.expires_at);
    d.setUTCDate(d.getUTCDate() - 1);
    startDate = d.toISOString().slice(0, 10);
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: post.title,
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: post.location, address: { '@type': 'PostalAddress', addressLocality: 'London', addressCountry: 'GB' } },
    ...(post.notes ? { description: post.notes.slice(0, 300) } : {}),
    url: `${SITE}/post/${post.slug ?? post.id}`,
  };
}

export default async function SinglePostPage({ params }: Props) {
  const { id } = await params;
  const unavailableReason = await resolveUnavailableReason(id);
  const initialPost = unavailableReason ? null : await getPublicPost(id);
  const event = initialPost ? eventJsonLd(initialPost) : null;

  return (
    <>
      {event && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(event).replace(/</g, '\\u003c') }} />
      )}
      <SinglePostClient postId={id} unavailableReason={unavailableReason} initialPost={initialPost} />
    </>
  );
}