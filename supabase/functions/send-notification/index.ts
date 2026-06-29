// supabase/functions/send-notification/index.ts
// Edge Function to send email notifications for new messages

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmToUsers } from "../_shared/fcm.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// For testing, use Resend's test domain (can only send to your own email)
// Change this to your domain once verified: "Common <notifications@yourdomain.com>"
const EMAIL_FROM = "common <notifications@common-social.com>";

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    thread_id: string;
    sender_id: string;
    content: string;
    created_at: string;
  };
  old_record: null;
}

interface ThreadData {
  id: string;
  post_id: string;
  participant_ids: string[];
  created_by: string;
  posts: {
    id: string;
    title: string;
    user_id: string;
  } | null;
}

serve(async (req: Request) => {
  try {
    // Verify request method
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Parse the webhook payload
    const payload: WebhookPayload = await req.json();
    
    // Only process INSERT events on messages table
    if (payload.type !== "INSERT" || payload.table !== "messages") {
      return new Response("Ignored", { status: 200 });
    }

    const message = payload.record;
    const senderId = message.sender_id;
    const threadId = message.thread_id;

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get thread details with post info
    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .select("id, post_id, participant_ids, created_by, posts (id, title, user_id)")
      .eq("id", threadId)
      .single();

    if (threadError || !thread) {
      console.error("Failed to fetch thread:", threadError);
      return new Response("Thread not found", { status: 404 });
    }

    const threadData = thread as unknown as ThreadData;
    const post = threadData.posts;

    if (!post) {
      console.error("Post not found for thread");
      return new Response("Post not found", { status: 404 });
    }

    // Determine who should receive the notification
    // All participants except the sender
    const recipientIds = threadData.participant_ids.filter(
      (id: string) => id !== senderId
    );

    if (recipientIds.length === 0) {
      return new Response("No recipients", { status: 200 });
    }

    // Get sender's name for the email
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", senderId)
      .single();

    const senderName = senderProfile?.first_name || "Someone";

    // Get recipient emails and notification preferences
    const { data: recipients, error: recipientsError } = await supabase
      .from("profiles")
      .select("id, first_name, email_notifications")
      .in("id", recipientIds);

    if (recipientsError) {
      console.error("Failed to fetch recipients:", recipientsError);
      return new Response("Failed to fetch recipients", { status: 500 });
    }

    // Get emails from auth.users (paginate — listUsers returns max 50 per page)
    const emailMap = new Map<string, string>();
    let page = 1;
    const perPage = 50;
    while (true) {
      const { data: authUsers, error: authError } =
        await supabase.auth.admin.listUsers({ page, perPage });

      if (authError || !authUsers) {
        console.error("Failed to fetch auth users page " + page + ":", authError);
        break;
      }

      authUsers.users.forEach((user: { id: string; email?: string }) => {
        if (user.email) emailMap.set(user.id, user.email);
      });

      if (authUsers.users.length < perPage) break;
      page++;
    }

    // Check if this is the first message in the thread (new interest notification)
    const { count: messageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId);

    const isFirstMessage = messageCount === 1;

    // Send emails to each recipient
    const emailPromises = recipients
      ?.filter((recipient: { id: string; email_notifications?: boolean }) => {
        // Check if user has notifications enabled (default to true if not set)
        const notificationsEnabled = recipient.email_notifications !== false;
        const hasEmail = emailMap.has(recipient.id);
        return notificationsEnabled && hasEmail;
      })
      .map(async (recipient: { id: string; first_name?: string }) => {
        const recipientEmail = emailMap.get(recipient.id)!;
        const recipientName = recipient.first_name || "there";

        // Different email content for first message vs subsequent messages
        const subject = isFirstMessage
  ? senderName + ' wants to join "' + post.title + '"'
  : 'New message from ' + senderName + ' about "' + post.title + '"';

        const emailHtml = generateEmailHtml({
          recipientName,
          senderName,
          postTitle: post.title,
          messagePreview: message.content.substring(0, 150).replace(/\n/g, '<br>') + (message.content.length > 150 ? "..." : ""),
          isFirstMessage,
          threadUrl: "https://www.common-social.com/?thread=" + threadId,
        });

        // Send via Resend
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + RESEND_API_KEY,
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
          console.error("Failed to send email to " + recipientEmail + ":", error);
          return { success: false, email: recipientEmail, error };
        }

        console.log("Email sent to " + recipientEmail);
        return { success: true, email: recipientEmail };
      }) || [];

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r: { success: boolean }) => r.success).length;

    // Send push notifications to all recipients (regardless of email preference)
    const pushRecipientIds = recipientIds;
    const pushTitle = isFirstMessage
      ? senderName + ' is interested in "' + post.title + '"'
      : 'New message from ' + senderName;
    const pushBody = message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '');
    const pushUrl = 'https://www.common-social.com/?thread=' + threadId;

    await Promise.all([
      sendPushNotifications(supabase, pushRecipientIds, pushTitle, pushBody, pushUrl).catch(err => {
        console.error('Web push notifications failed:', err);
      }),
      sendFcmToUsers(supabase, pushRecipientIds, pushTitle, pushBody, pushUrl).catch(err => {
        console.error('FCM notifications failed:', err);
      }),
    ]);

    return new Response(
      JSON.stringify({
        message: "Sent " + successCount + " notification(s)",
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Generate email HTML
function generateEmailHtml(params: {
  recipientName: string;
  senderName: string;
  postTitle: string;
  messagePreview: string;
  isFirstMessage: boolean;
  threadUrl: string;
}): string {
  const { recipientName, senderName, postTitle, messagePreview, isFirstMessage, threadUrl } = params;

  const headline = isFirstMessage
    ? senderName + " wants to join you"
    : "New message from " + senderName;

  const subline = isFirstMessage
    ? 'They\'re interested in your post <strong>"' + postTitle + '"</strong>'
    : 'About <strong>"' + postTitle + '"</strong>';

  return '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'  <meta charset="utf-8">' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'  <meta name="color-scheme" content="light">' +
'  <meta name="supported-color-schemes" content="light">' +
'  <title>' + headline + '</title>' +
'</head>' +
'<body style="margin: 0; padding: 0; background-color: #F5F0E3; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">' +
'  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0E3; padding: 40px 16px;">' +
'    <tr>' +
'      <td align="center">' +
'        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #FEFCF8; border-radius: 16px; border: 1px solid #E5DFD8; overflow: hidden;">' +
'          <tr>' +
'            <td style="padding: 32px 32px 0;">' +
'              <div style="font-size: 20px; font-weight: 700; color: #0F4415; letter-spacing: -0.5px;">common</div>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td style="padding: 24px 32px 32px;">' +
'              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #000000; letter-spacing: -0.3px;">' +
                 headline +
'              </h1>' +
'              <p style="margin: 0 0 24px; font-size: 15px; color: #888888; line-height: 1.6;">' +
                 subline +
'              </p>' +
'              <div style="background-color: #f7f5ee; border-radius: 12px; padding: 16px; margin-bottom: 24px;">' +
'                <p style="margin: 0 0 8px; font-size: 13px; color: #888888;">' +
                   senderName + ' wrote:' +
'                </p>' +
'                <p style="margin: 0; font-size: 14px; color: #000000; line-height: 1.5;">' +
'                  "' + messagePreview + '"' +
'                </p>' +
'              </div>' +
'              <table cellpadding="0" cellspacing="0" border="0">' +
'                <tr>' +
'                  <td style="background-color: #0F4415; border-radius: 24px; padding: 12px 24px;">' +
'                    <a href="' + threadUrl + '" style="color: #FEFCF8; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">' +
'                      Reply to ' + senderName +
'                    </a>' +
'                  </td>' +
'                </tr>' +
'              </table>' +
'            </td>' +
'          </tr>' +
'          <tr>' +
'            <td style="padding: 24px 32px; background-color: #f7f5ee; border-top: 1px solid #E5DFD8;">' +
'              <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">' +
'                You\'re getting this because you have notifications enabled on common.' +
'                <br>' +
'                <a href="https://www.common-social.com/settings" style="color: #888888;">Manage preferences</a>' +
'              </p>' +
'            </td>' +
'          </tr>' +
'        </table>' +
'      </td>' +
'    </tr>' +
'  </table>' +
'</body>' +
'</html>';
}

async function sendPushNotifications(
  supabase: any,
  recipientIds: string[],
  title: string,
  body: string,
  url: string
) {
  console.log('sendPushNotifications called for recipients:', recipientIds);
  
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', recipientIds);

  console.log('Push subscriptions found:', subscriptions?.length, 'error:', subError);

  if (!subscriptions || subscriptions.length === 0) return;

  for (const sub of subscriptions) {
    try {
      console.log('Sending push to endpoint:', sub.endpoint.substring(0, 50) + '...');
      
      const pushRes = await fetch('https://www.common-social.com/api/send-push', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + Deno.env.get('PUSH_API_SECRET'),
        },
        body: JSON.stringify({
          subscription: {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          title,
          body,
          url,
        }),
      });

      const pushResText = await pushRes.text();
      console.log('Push API response:', pushRes.status, pushResText);
    } catch (err) {
      console.error('Push send error:', err);
    }
  }
}