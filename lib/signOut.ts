import { supabase } from './supabase';
import { unregisterNativePush, PUSH_SUBSCRIBED_KEY } from './nativePush';

// Cap how long the token cleanup can delay sign-out (e.g. when offline).
const UNREGISTER_TIMEOUT_MS = 3000;

export async function signOut() {
  await Promise.race([
    unregisterNativePush(),
    new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
  ]);
  await supabase.auth.signOut();
  // Let the next sign-in in this same session register its own device token.
  try {
    sessionStorage.removeItem(PUSH_SUBSCRIBED_KEY);
  } catch {}
}
