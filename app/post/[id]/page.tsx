import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import SinglePostClient from './SinglePostClient';

// Create a server-side Supabase client for metadata generation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Props {
  params: Promise<{ id: string }>;
}

// Generate dynamic metadata for link previews
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  const { data: post } = await supabase
    .from('posts')
    .select('title, location, time, notes')
    .eq('id', id)
    .eq('status', 'approved')
    .single();

  if (!post) {
    return {
      title: 'Post not found | common',
      description: 'This post may have been removed or is no longer available.',
    };
  }

  // Create a compelling description
  const description = post.notes 
    ? `${post.location} · ${post.time} — ${post.notes}`
    : `${post.location} · ${post.time}`;

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