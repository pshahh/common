import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FLYERS } from '@/lib/flyerLinks';

// Never cache: the destination depends on whether the post is live right now.
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Resolves a printed flyer link (/comedy, /bookclub, ...) to its destination.
 *
 * The QR code encodes `?s=qr`, the printed URL has no query, so the two are
 * told apart as utm_content=qr vs utm_content=typed. PostHog already records
 * UTM params on a person's first visit (instrumentation-client.ts), so no
 * extra tracking code is needed: the UTMs just have to survive the redirect.
 *
 * Uses 307 rather than 308 so browsers never cache the destination.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const flyer = FLYERS[slug];

  let path = '/';
  if (flyer?.postId) {
    const { data, error } = await supabase
      .from('posts')
      .select('id')
      .eq('id', flyer.postId)
      .eq('status', 'approved')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    // If the lookup itself fails, send them to the post anyway: the post page
    // already handles every unavailable state better than the feed would.
    if (error || data) path = `/post/${flyer.postId}`;
  }

  const source = request.nextUrl.searchParams.get('s') === 'qr' ? 'qr' : 'typed';
  const query = new URLSearchParams({
    utm_source: 'flyer',
    utm_medium: 'print',
    utm_campaign: flyer ? slug : 'unknown',
    utm_content: source,
  });

  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: `${path}?${query.toString()}`,
      'Cache-Control': 'no-store',
    },
  });
}
