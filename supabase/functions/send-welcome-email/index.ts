// supabase/functions/send-welcome-email/index.ts
// Sends a welcome email when a user confirms their email
// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const EMAIL_FROM = 'common <hello@common-social.com>';
const BASE_URL = 'https://www.common-social.com';

// @ts-ignore - Deno.serve
Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await req.json();

    // Support both the new trigger format and legacy webhook format
    let userId: string;
    let firstName: string;

    if (body.user_id) {
      // New format: called from the database trigger via pg_net
      userId = body.user_id;
      firstName = body.first_name || 'there';
    } else if (body.type === 'INSERT' && body.table === 'profiles') {
      // Legacy webhook format (can remove once migration is confirmed)
      userId = body.record.id;
      firstName = body.record.first_name || 'there';
    } else {
      return new Response('Ignored', { status: 200 });
    }

    // Get user's email from auth
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user?.email) {
      console.error('Failed to fetch user email:', userError);
      return new Response('Failed to fetch user email', { status: 500 });
    }

    // Double-check that the email is actually confirmed
    if (!user.email_confirmed_at) {
      console.log('Email not yet confirmed, skipping welcome email');
      return new Response('Email not confirmed yet', { status: 200 });
    }

    const recipientEmail = user.email;

    // Send welcome email via Resend
    const emailHtml = generateWelcomeEmail({ recipientName: firstName });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [recipientEmail],
        subject: "Welcome to common",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Failed to send welcome email:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Welcome email sent to ${recipientEmail}`);
    return new Response(
      JSON.stringify({ success: true, email: recipientEmail }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// generateWelcomeEmail function stays exactly as-is — no changes needed

function generateWelcomeEmail(params: { recipientName: string }): string {
  const { recipientName } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Welcome to common</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0E3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
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
                You're in, ${recipientName}
              </h1>
              <p style="margin: 0 0 8px; font-size: 15px; color: #888888; line-height: 1.6;">
                common is where people find others to do things with nearby.
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #888888; line-height: 1.6;">
                Have a look at what's happening around you, or share what you're up to if you're open to company.
              </p>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color: #0F4415; border-radius: 24px; padding: 12px 24px;">
                    <a href="${BASE_URL}" style="color: #FEFCF8; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
                      See what's nearby
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f7f5ee; border-top: 1px solid #E5DFD8;">
              <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">
                You're getting this because you just signed up for common.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}