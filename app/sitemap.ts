import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

// Generates /sitemap.xml at build/request time. Like robots.ts, this is a
// metadata file — it lists existing pages for crawlers, it doesn't create any.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const baseUrl = 'https://www.common-social.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'hourly', priority: 1 },
    { url: `${baseUrl}/guidelines`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.1 },
  ];

  // Only public ("everyone" audience), currently-live posts — mirrors the
  // same filter the home feed uses (status = approved, not expired).
  // Friends-only posts are never included: they aren't public content.
  const { data: posts } = await supabase
    .from('posts')
    .select('id, slug, created_at')
    .eq('status', 'approved')
    .eq('audience', 'everyone')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(5000);

  const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((post) => ({
    url: `${baseUrl}/post/${post.slug ?? post.id}`,
    lastModified: post.created_at,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  return [...staticRoutes, ...postRoutes];
}
