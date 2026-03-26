// supabase/functions/send-welcome-email/index.ts
// Sends a welcome email when a new user profile is created

// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const EMAIL_FROM = 'common <hello@common-social.com>';
const BASE_URL = 'https://www.common-social.com';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    first_name: string | null;
    created_at: string;
  };
  old_record: null;
}

// @ts-ignore - Deno.serve
Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const payload: WebhookPayload = await req.json();

    // Only process INSERT events on profiles table
    if (payload.type !== 'INSERT' || payload.table !== 'profiles') {
      return new Response('Ignored', { status: 200 });
    }

    const profile = payload.record;
    const userId = profile.id;
    const firstName = profile.first_name || 'there';

    // Get user's email from auth
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user?.email) {
      console.error('Failed to fetch user email:', userError);
      return new Response('Failed to fetch user email', { status: 500 });
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

function generateWelcomeEmail(params: { recipientName: string }): string {
  const { recipientName } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to common</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e0e0e0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 0;">
              <div style="font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">common</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 24px 32px 32px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #000000; letter-spacing: -0.3px;">
                You're in
              </h1>
              <p style="margin: 0 0 8px; font-size: 15px; color: #444444; line-height: 1.6;">
                Welcome to common - a place to find people to do things with nearby.
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #444444; line-height: 1.6;">
                Have a look at what's happening around you, or share what you're doing if you're open to company.
              </p>
              <a href="${BASE_URL}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 24px;">
                Browse what's nearby
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">
                You're receiving this because you signed up for common.
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