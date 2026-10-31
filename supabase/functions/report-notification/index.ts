// supabase/functions/report-notification/index.ts
// Edge Function to email admin when a report is submitted or a user blocks someone.
// Triggered by database webhooks on INSERT into public.reports and public.blocked_users.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EMAIL_FROM = "common <notifications@common-social.com>";
const ADMIN_EMAIL = "hello@common-social.com";
const BASE_URL = "https://www.common-social.com";

interface BlockRecord {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sendAdminEmail(subject: string, html: string): Promise<Response> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + RESEND_API_KEY,
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [ADMIN_EMAIL], subject, html }),
  });
  if (!res.ok) {
    console.error("Failed to send admin notification:", await res.text());
    return new Response("Failed to send email", { status: 500 });
  }
  return new Response("Admin notification sent", { status: 200 });
}

// deno-lint-ignore no-explicit-any
async function handleBlock(supabase: any, block: BlockRecord): Promise<Response> {
  const { data: people } = await supabase
    .from("profiles")
    .select("id, first_name")
    .in("id", [block.user_id, block.blocked_user_id]);
  // deno-lint-ignore no-explicit-any
  const nameOf = (id: string) => people?.find((p: any) => p.id === id)?.first_name || "Unknown user";
  const blockerName = escapeHtml(nameOf(block.user_id));
  const blockedName = escapeHtml(nameOf(block.blocked_user_id));

  // How many people have blocked this user in total - a quick signal for repeat offenders
  const { count: timesBlocked } = await supabase
    .from("blocked_users")
    .select("id", { count: "exact", head: true })
    .eq("blocked_user_id", block.blocked_user_id);

  // The blocked user's live posts, so the content can be reviewed straight from the email
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, slug")
    .eq("user_id", block.blocked_user_id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(5);
  const postList = (posts && posts.length > 0)
    // deno-lint-ignore no-explicit-any
    ? posts.map((p: any) =>
        `<li style="margin: 0 0 4px 0;"><a href="${BASE_URL}/post/${encodeURIComponent(p.slug || p.id)}" style="color: #000;">${escapeHtml(p.title || "Untitled")}</a></li>`
      ).join("")
    : `<li>No live posts</li>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 480px; margin: 0 auto; padding: 24px 16px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 18px; font-weight: 700; color: #000;">common</span>
        </div>
        <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 16px; padding: 24px;">
          <p style="font-size: 16px; font-weight: 600; color: #000; margin: 0 0 16px 0;">A user was blocked</p>
          <div style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="font-size: 13px; color: #666; margin: 0 0 4px 0;"><strong>Blocked user:</strong> ${blockedName} (${block.blocked_user_id})</p>
            <p style="font-size: 13px; color: #666; margin: 0 0 4px 0;"><strong>Blocked by:</strong> ${blockerName}</p>
            <p style="font-size: 13px; color: #666; margin: 0 0 12px 0;"><strong>Times blocked in total:</strong> ${timesBlocked ?? 1}</p>
            <p style="font-size: 13px; color: #666; margin: 0 0 4px 0;"><strong>Their live posts:</strong></p>
            <ul style="font-size: 13px; color: #666; margin: 0; padding-left: 18px;">${postList}</ul>
          </div>
          <a href="${BASE_URL}/admin/reports" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 24px; font-size: 14px; font-weight: 600;">Review reports</a>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendAdminEmail(`Blocked: ${nameOf(block.blocked_user_id)} (blocked ${timesBlocked ?? 1}x)`, html);
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    post_id: string | null;
    thread_id: string | null;
    reported_by: string;
    reason: string;
    status: string;
    created_at: string;
  };
  old_record: null;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT" || (payload.table !== "reports" && payload.table !== "blocked_users")) {
      return new Response("Ignored", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    if (payload.table === "blocked_users") {
      return await handleBlock(supabase, payload.record as unknown as BlockRecord);
    }

    const report = payload.record;

    // Get post details if this is a post report
    let postTitle = "Unknown";
    let posterName = "Unknown";
    if (report.post_id) {
      const { data: post } = await supabase
        .from("posts")
        .select("title, name")
        .eq("id", report.post_id)
        .single();
      if (post) {
        postTitle = post.title;
        posterName = post.name;
      }
    }

    // Get reporter name
    const { data: reporter } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", report.reported_by)
      .single();
    const reporterName = reporter?.first_name || "Unknown user";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 480px; margin: 0 auto; padding: 24px 16px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 18px; font-weight: 700; color: #000;">common</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 16px; padding: 24px;">
            <p style="font-size: 16px; font-weight: 600; color: #000; margin: 0 0 16px 0;">New report submitted</p>
            <div style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
              <p style="font-size: 13px; color: #666; margin: 0 0 4px 0;"><strong>Post:</strong> ${postTitle}</p>
              <p style="font-size: 13px; color: #666; margin: 0 0 4px 0;"><strong>Posted by:</strong> ${posterName}</p>
              <p style="font-size: 13px; color: #666; margin: 0 0 4px 0;"><strong>Reported by:</strong> ${reporterName}</p>
              <p style="font-size: 13px; color: #666; margin: 0;"><strong>Reason:</strong> ${report.reason}</p>
            </div>
            <a href="${BASE_URL}/admin/reports" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 24px; font-size: 14px; font-weight: 600;">Review reports</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [ADMIN_EMAIL],
        subject: `Report: "${postTitle}" — ${report.reason}`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Failed to send report notification:", error);
      return new Response("Failed to send email", { status: 500 });
    }

    console.log("Report notification sent to admin");
    return new Response("Report notification sent", { status: 200 });
  } catch (err) {
    console.error("Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});