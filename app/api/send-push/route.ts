import { NextResponse } from 'next/server';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:hello@common-social.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  try {
    // Verify the request is from our Edge Function
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.PUSH_API_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription, title, body, url } = await req.json();

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url, tag: `common-${Date.now()}` })
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    // If subscription is expired/invalid, return 410
    if (err.statusCode === 410 || err.statusCode === 404) {
      return NextResponse.json({ error: 'Subscription expired' }, { status: 410 });
    }
    console.error('Push send error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}