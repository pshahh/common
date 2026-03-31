import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Generate the reset link server-side using admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://www.common-social.com/reset-password',
      },
    });

    if (error) {
      console.error('Generate link error:', error);
      // Don't reveal whether the email exists — always return success
      return NextResponse.json({ success: true });
    }

    const resetLink = data?.properties?.action_link;

    if (!resetLink) {
      console.error('No action_link returned');
      return NextResponse.json({ success: true });
    }

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'common <hello@common-social.com>',
          to: email,
          subject: 'Reset your password',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
              <div style="margin-bottom: 32px;">
                <span style="font-size: 20px; font-weight: 600; color: #000;">common</span>
              </div>
              <h1 style="font-size: 18px; font-weight: 600; color: #000; margin-bottom: 12px;">
                Reset your password
              </h1>
              <p style="font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>
              <a href="${resetLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 24px; font-size: 14px; font-weight: 600; text-decoration: none;">
                Reset password
              </a>
              <p style="font-size: 13px; color: #999; line-height: 1.6; margin-top: 32px;">
                If you didn't request this, you can safely ignore this email. The link expires in 24 hours.
              </p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0 16px;" />
              <p style="font-size: 12px; color: #999;">
                common — do things with people nearby
              </p>
            </div>
          `,
        }),
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    // Always return success to avoid email enumeration
    return NextResponse.json({ success: true });
  }
}