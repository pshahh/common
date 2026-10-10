import { supabase } from './supabase';
import { unregisterNativePush } from './nativePush';

// Cap how long the token cleanup can delay sign-out (e.g. when offline).
const UNREGISTER_TIMEOUT_MS = 3000;

export async function signOut() {
  await Promise.race([
    unregisterNativePush(),
    new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
  ]);
  await supabase.auth.signOut();
}
