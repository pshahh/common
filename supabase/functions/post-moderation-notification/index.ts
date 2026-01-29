// supabase/functions/post-moderation-notification/index.ts
// Sends email notifications when posts are approved or rejected

// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_FROM = 'Common <onboarding@resend.dev>'; // Update with your domain
const BASE_URL = 'https://common-smoky-seven.vercel.app'; // Update with your production URL

// @ts-ignore - Deno.serve
Deno.serve(async (req: Request) => {
  console.log('Function invoked, method:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('Supabase URL exists:', !!supabaseUrl);
    console.log('Service key exists:', !!supabaseServiceKey);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const { postId, userId, postTitle, action } = body;

    if (!postId || !userId || !postTitle || !action) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Processing action:', action, 'for post:', postTitle);

    // Get user's email and name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's email from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user?.email) {
      console.error('Error fetching user email:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recipientName = profile?.first_name || 'there';
    const recipientEmail = user.email;

    // Generate email content based on action
    let subject: string;
    let emailHtml: string;

    if (action === 'approved') {
      subject = `Your post "${postTitle}" is now live`;
      emailHtml = generateApprovedEmail({
        recipientName,
        postTitle,
        postUrl: `${BASE_URL}/post/${postId}`,
      });
    } else if (action === 'rejected') {
      subject = `About your post "${postTitle}"`;
      emailHtml = generateRejectedEmail({
        recipientName,
        postTitle,
        guidelinesUrl: `${BASE_URL}/guidelines`,
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('About to send email to:', recipientEmail);
    console.log('RESEND_API_KEY exists:', !!RESEND_API_KEY);
    console.log('EMAIL_FROM:', EMAIL_FROM);

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [recipientEmail],
        subject: subject,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Failed to send email:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${action} email sent to ${recipientEmail} for post ${postId}`);
    
    return new Response(
      JSON.stringify({ success: true, action, email: recipientEmail }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate approved email HTML
function generateApprovedEmail(params: {
  recipientName: string;
  postTitle: string;
  postUrl: string;
}): string {
  const { recipientName, postTitle, postUrl } = params;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your post is live</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #f0f0f0;">
              <div style="font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">common</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <div style="width: 48px; height: 48px; background-color: #EDF7F0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <span style="font-size: 24px;">✓</span>
              </div>
              <h1 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #000000;">
                Good news, ${recipientName}!
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; color: #444444; line-height: 1.6;">
                Your post <strong>"${postTitle}"</strong> has been approved and is now live. People can see it and express interest in joining you.
              </p>
              <a href="${postUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 24px;">
                View your post
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">
                You're receiving this because you posted on Common.
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

// Generate rejected email HTML
function generateRejectedEmail(params: {
  recipientName: string;
  postTitle: string;
  guidelinesUrl: string;
}): string {
  const { recipientName, postTitle, guidelinesUrl } = params;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About your post</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #f0f0f0;">
              <div style="font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">common</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #000000;">
                Hi ${recipientName},
              </h1>
              <p style="margin: 0 0 16px; font-size: 14px; color: #444444; line-height: 1.6;">
                Unfortunately, your post <strong>"${postTitle}"</strong> wasn't approved because it doesn't meet our community guidelines.
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; color: #444444; line-height: 1.6;">
                Common is for sharing real activities you'd like to do with others nearby. Please review our guidelines and feel free to post again.
              </p>
              <a href="${guidelinesUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 24px;">
                Read community guidelines
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">
                If you think this was a mistake, you can reply to this email.
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