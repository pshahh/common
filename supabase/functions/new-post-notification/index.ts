// supabase/functions/new-post-notification/index.ts
// Edge Function to email all users when a new post goes live

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EMAIL_FROM = "common <notifications@common-social.com>";
const BASE_URL = "https://www.common-social.com";

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    title: string;
    location: string;
    time: string;
    notes: string | null;
    name: string;
    user_id: string;
    status: string;
    parent_post_id: string | null;
    slug: string | null;
  };
  old_record: null;
}

function generateEmailHtml({
  recipientName,
  postTitle,
  postLocation,
  postTime,
  postNotes,
  posterName,
  postUrl,
}: {
  recipientName: string;
  postTitle: string;
  postLocation: string;
  postTime: string;
  postNotes: string | null;
  posterName: string;
  postUrl: string;
}): string {
  const notesHtml = postNotes
    ? '<p style="font-size: 14px; color: #000000; font-style: italic; margin: 12px 0 0 0; line-height: 1.5;">' + postNotes.substring(0, 200).replace(/\n/g, "<br>") + (postNotes.length > 200 ? "..." : "") + '</p>'
    : "";

  return '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'  <meta charset="utf-8">' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'  <meta name="color-scheme" content="light">' +
'  <meta name="supported-color-schemes" content="light">' +
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
'                Something new near you' +
'              </h1>' +
'              <p style="margin: 0 0 20px; font-size: 15px; color: #888888; line-height: 1.6;">' +
                 posterName + ' just shared something you might want to join.' +
'              </p>' +
'              <div style="background-color: #f7f5ee; border-radius: 12px; padding: 16px; margin-bottom: 24px;">' +
'                <p style="font-size: 16px; font-weight: 600; color: #000000; margin: 0 0 4px 0;">' + postTitle + '</p>' +
'                <p style="font-size: 13px; color: #888888; margin: 0 0 2px 0;">' + postLocation + '</p>' +
'                <p style="font-size: 13px; color: #888888; margin: 0;">' + postTime + '</p>' +
                 notesHtml +
'              </div>' +
'              <table cellpadding="0" cellspacing="0" border="0">' +
'                <tr>' +
'                  <td style="background-color: #0F4415; border-radius: 24px; padding: 12px 24px;">' +
'                    <a href="' + postUrl + '" style="color: #FEFCF8; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">' +
'                      Take a look' +
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

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload: WebhookPayload = await req.json();

    // Only process INSERT events on posts table with approved status
    if (
      payload.type !== "INSERT" ||
      payload.table !== "posts" ||
      payload.record.status !== "approved"
    ) {
      return new Response("Ignored — not an approved post insert", {
        status: 200,
      });
    }

    // Skip auto-generated recurring child posts to avoid notification spam
    if (payload.record.parent_post_id) {
      return new Response("Skipping recurring child post", { status: 200 });
    }

    const post = payload.record;
    const postUrl = `${BASE_URL}/post/${post.slug || post.id}`;

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get all users with notifications enabled, excluding the poster
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, email_notifications")
      .neq("id", post.user_id);

    if (profilesError) {
      console.error("Failed to fetch profiles:", profilesError);
      return new Response("Failed to fetch profiles", { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return new Response("No recipients", { status: 200 });
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

      // If we got fewer than perPage, we've reached the last page
      if (authUsers.users.length < perPage) break;
      page++;
    }

    // Filter to users who have notifications enabled
    const recipients = profiles.filter(
      (p: { id: string; email_notifications?: boolean }) => {
        const notificationsEnabled = p.email_notifications !== false;
        const hasEmail = emailMap.has(p.id);
        return notificationsEnabled && hasEmail;
      }
    );

    if (recipients.length === 0) {
      return new Response("No eligible recipients", { status: 200 });
    }

    // Send emails sequentially with delay to respect Resend rate limit (5/sec)
    const results: { success: boolean; email: string }[] = [];
    for (const recipient of recipients) {
      const recipientEmail = emailMap.get((recipient as { id: string }).id)!;
      const recipientName = (recipient as { id: string; first_name?: string }).first_name || "there";

      const emailHtml = generateEmailHtml({
        recipientName,
        postTitle: post.title,
        postLocation: post.location,
        postTime: post.time,
        postNotes: post.notes,
        posterName: post.name,
        postUrl,
      });

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [recipientEmail],
            subject: post.name + ' just posted "' + post.title + '" on common',
            html: emailHtml,
          }),
        });

        if (!res.ok) {
          const error = await res.text();
          console.error("Failed to send to " + recipientEmail + ":", error);
          results.push({ success: false, email: recipientEmail });
        } else {
          console.log("Sent new post notification to " + recipientEmail);
          results.push({ success: true, email: recipientEmail });
        }
      } catch (err) {
        console.error("Error sending to " + recipientEmail + ":", err);
        results.push({ success: false, email: recipientEmail });
      }

      // Wait 100ms between sends (well under 5/sec rate limit with API latency)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const successCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount}/${recipients.length} notifications`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});