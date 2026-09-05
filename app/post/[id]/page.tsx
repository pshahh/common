import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import SinglePostClient, { type PostUnavailableReason } from './SinglePostClient';
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
    .select('title, location, time, notes, next_occurrence_at')
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
        .select('title, location, time, notes, next_occurrence_at')
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

  // Create a compelling description.
  // A recurring listing carries a rolling next date, so a shared link previews
  // the occurrence someone can actually turn up to rather than the stale date
  // the listing was posted with. Standing offers have no next date and read
  // exactly as the host wrote them.
  const when = formatListingTime(post.time, post.next_occurrence_at);
  const description = post.notes 
    ? `${post.location} · ${when} — ${post.notes}`
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

export default async function SinglePostPage({ params }: Props) {
  const { id } = await params;
  const unavailableReason = await resolveUnavailableReason(id);
  return <SinglePostClient postId={id} unavailableReason={unavailableReason} />;
}