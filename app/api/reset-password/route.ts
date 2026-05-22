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
            <div style="margin: 0; padding: 0; background-color: #F5F0E3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0E3; padding: 40px 16px;">
                <tr>
                  <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #FEFCF8; border-radius: 16px; border: 1px solid #E5DFD8; overflow: hidden;">
                      <tr>
                        <td style="padding: 32px 32px 0;">
                          <div style="font-size: 20px; font-weight: 700; color: #0F4415; letter-spacing: -0.5px;">common</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 24px 32px 32px;">
                          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #000000; letter-spacing: -0.3px;">
                            Reset your password
                          </h1>
                          <p style="margin: 0 0 24px; font-size: 15px; color: #888888; line-height: 1.6;">
                            Tap below to choose a new password.
                          </p>
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #0F4415; border-radius: 24px; padding: 12px 24px;">
                                <a href="${resetLink}" style="color: #FEFCF8; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
                                  Reset password
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 24px 32px; background-color: #f7f5ee; border-top: 1px solid #E5DFD8;">
                          <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">
                            If you didn't ask for this, just ignore it. The link expires in 24 hours.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
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