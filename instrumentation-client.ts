import posthog from "posthog-js";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!projectToken) {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
    );
  }
} else if (!host) {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured"
    );
  }
} else {
  posthog.init(projectToken, {
    api_host: host,
    autocapture: false,
    person_profiles: "identified_only",
    persistence: "localStorage",
    debug: process.env.NODE_ENV === "development",
  });

  let identifiedUserId: string | null = null;

  // Supabase gives no distinct "email confirmed" auth event - confirming a
  // signup produces the same session as any other login. Treat a
  // confirmation timestamp within the last 10 minutes as "just confirmed".
  const CONFIRMATION_WINDOW_MS = 10 * 60 * 1000;

  const identifyUser = (user: Pick<User, "id" | "email_confirmed_at" | "created_at">) => {
    if (identifiedUserId === user.id) {
      return;
    }

    if (identifiedUserId) {
      posthog.reset();
    }

    if (user.email_confirmed_at) {
      const confirmedAt = new Date(user.email_confirmed_at).getTime();
      const msSinceConfirm = Date.now() - confirmedAt;
      if (msSinceConfirm >= 0 && msSinceConfirm < CONFIRMATION_WINDOW_MS) {
        const hoursSinceSignup = (confirmedAt - new Date(user.created_at).getTime()) / (60 * 60 * 1000);
        posthog.capture("email_confirmed", { hours_since_signup: Math.round(hoursSinceSignup * 10) / 10 });
      }
    }

    posthog.identify(user.id);
    identifiedUserId = user.id;
  };

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      identifyUser(session.user);
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      identifyUser(session.user);
    } else if (event === "SIGNED_OUT") {
      identifiedUserId = null;
      posthog.reset();
    }
  });
}
