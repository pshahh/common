import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from './supabase';

// sessionStorage flag: this session has already completed push registration.
export const PUSH_SUBSCRIBED_KEY = 'push-subscribed';

async function saveToken(userId: string, token: string) {
  const platform = Capacitor.getPlatform() as 'ios' | 'android';
  const { error } = await supabase.from('device_tokens').upsert(
    { user_id: userId, token, platform, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,platform' }
  );
  if (error) {
    // Throw so callers can tell registration failed and retry later.
    throw new Error('Failed to save device token: ' + JSON.stringify(error));
  }
  console.log('Device token saved successfully');
}

let listenersAttached = false;

async function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  // FCM rotates tokens (reinstall, restore, data clear). Read the user from
  // the live session rather than a captured id so a refresh after sign-out
  // or an account switch never writes under the wrong user.
  await FirebaseMessaging.addListener('tokenReceived', async ({ token }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await saveToken(session.user.id, token);
    } catch (err) {
      console.error(err);
    }
  });

  await FirebaseMessaging.addListener('notificationReceived', (event) => {
    console.log('Push notification received:', event);
  });

  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    const url = (event as any).notification?.data?.url;
    if (url && typeof url === 'string') {
      const path = url.replace('https://www.common-social.com', '');
      if (path) window.location.href = path;
    }
  });
}

export async function registerNativePush(userId: string) {
  if (!Capacitor.isNativePlatform()) return;

  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== 'granted') return;

  await attachListeners();

  const { token } = await FirebaseMessaging.getToken();
  console.log('FCM token:', token.substring(0, 20) + '...');

  await saveToken(userId, token);
}

// Remove this device's token row so a signed-out phone stops getting
// notifications. Matches on token (not platform) so signing out on one
// phone never removes the row of another phone on the same platform.
// Must run while the session is still valid: RLS scopes the delete to the
// signed-in user's own rows. Never throws; sign-out must not be blocked.
export async function unregisterNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { token } = await FirebaseMessaging.getToken();
    const { error } = await supabase.from('device_tokens').delete().eq('token', token);
    if (error) console.error('Failed to delete device token:', JSON.stringify(error));
  } catch (err) {
    console.error('Failed to unregister native push:', err);
  }
}
