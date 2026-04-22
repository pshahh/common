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
    ? `<p style="font-size: 14px; color: #666; font-style: italic; margin: 12px 0 0 0;">${postNotes.substring(0, 200).replace(/\n/g, "<br>")}${postNotes.length > 200 ? "..." : ""}</p>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 480px; margin: 0 auto; padding: 24px 16px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 18px; font-weight: 700; color: #000;">common</span>
        </div>
        <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 16px; padding: 24px;">
          <p style="font-size: 14px; color: #444; margin: 0 0 16px 0;">Hi ${recipientName},</p>
          <p style="font-size: 14px; color: #444; margin: 0 0 20px 0;">There's a new activity on common:</p>
          
          <div style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="font-size: 16px; font-weight: 600; color: #000; margin: 0 0 4px 0;">${postTitle}</p>
            <p style="font-size: 13px; color: #666; margin: 0 0 2px 0;">${postLocation}</p>
            <p style="font-size: 13px; color: #666; margin: 0;">${postTime}</p>
            ${notesHtml}
            <p style="font-size: 12px; color: #888; margin: 12px 0 0 0;">${posterName}</p>
          </div>

          <a href="${postUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 24px; font-size: 14px; font-weight: 600;">Take a look</a>
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <p style="font-size: 12px; color: #888; margin: 0;">You're receiving this because you have notifications enabled on common.</p>
          <p style="font-size: 12px; color: #888; margin: 4px 0 0 0;">To stop these emails, update your <a href="${BASE_URL}/settings" style="color: #888;">notification preferences</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;
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

    // Get emails from auth.users
    const { data: authUsers, error: authError } =
      await supabase.auth.admin.listUsers();

    if (authError || !authUsers) {
      console.error("Failed to fetch auth users:", authError);
      return new Response("Failed to fetch auth users", { status: 500 });
    }

    const emailMap = new Map<string, string>();
    authUsers.users.forEach((user: { id: string; email?: string }) => {
      if (user.email) emailMap.set(user.id, user.email);
    });

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

    // Send emails
    const emailPromises = recipients.map(
      async (recipient: { id: string; first_name?: string }) => {
        const recipientEmail = emailMap.get(recipient.id)!;
        const recipientName = recipient.first_name || "there";

        const emailHtml = generateEmailHtml({
          recipientName,
          postTitle: post.title,
          postLocation: post.location,
          postTime: post.time,
          postNotes: post.notes,
          posterName: post.name,
          postUrl,
        });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [recipientEmail],
            subject: `New on common: "${post.title}"`,
            html: emailHtml,
          }),
        });

        if (!res.ok) {
          const error = await res.text();
          console.error("Failed to send to " + recipientEmail + ":", error);
          return { success: false, email: recipientEmail };
        }

        console.log("Sent new post notification to " + recipientEmail);
        return { success: true, email: recipientEmail };
      }
    );

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(
      (r: { success: boolean }) => r.success
    ).length;

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