import { createClient } from '@supabase/supabase-js';
import type { Post } from '@/app/HomeClient';

/**
 * Public, live posts for the server-rendered homepage. Same filter as the
 * client feed in app/HomeClient.tsx, limited to the "everyone" audience.
 * Uses the anon key, so RLS decides visibility exactly as it does for a
 * logged-out visitor.
 */
export async function getPublicFeedPosts(): Promise<Post[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'approved')
    .eq('audience', 'everyone')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[home] public feed query failed', error.message);
    return [];
  }
  return (data ?? []) as Post[];
}
