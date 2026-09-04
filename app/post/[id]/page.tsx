import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import SinglePostClient from './SinglePostClient';
import { isUUID } from '@/lib/slug';
import { formatNextOccurrence } from '@/lib/dates';

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
  const { data: post } = await supabase
    .from('posts')
    .select('title, location, time, notes, next_occurrence_at')
    .eq(column, id)
    .in('status', ['approved', 'closed'])
    .single();

  if (!post) {
    return {
      title: 'Post not found | common',
      description: 'This post may have been removed or is no longer available.',
    };
  }

  // Create a compelling description.
  // A recurring listing carries a rolling next date, so a shared link should
  // preview the occurrence someone can actually turn up to rather than the
  // listing's generic time. Null until the recurring backfill runs, and on
  // standing offers, in which case the description is unchanged.
  const nextOccurrence = formatNextOccurrence(post.next_occurrence_at);
  const when = nextOccurrence ? `${post.time} · Next: ${nextOccurrence}` : post.time;
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

export default async function SinglePostPage({ params }: Props) {
  const { id } = await params;
  return <SinglePostClient postId={id} />;
}