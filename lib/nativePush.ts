import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from './supabase';

export async function registerNativePush(userId: string) {
  if (!Capacitor.isNativePlatform()) return;

  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== 'granted') return;

  const { token } = await FirebaseMessaging.getToken();
  console.log('FCM token:', token.substring(0, 20) + '...');

  const platform = Capacitor.getPlatform() as 'ios' | 'android';
  const { error } = await supabase.from('device_tokens').upsert(
    { user_id: userId, token, platform, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,platform' }
  );
  if (error) {
    console.error('Failed to save device token:', JSON.stringify(error));
  } else {
    console.log('Device token saved successfully');
  }

  await FirebaseMessaging.addListener('notificationReceived', (event) => {
    console.log('Push notification received:', event);
  });

  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    const url = event.notification?.data?.url;
    if (url && typeof url === 'string') {
      const path = url.replace('https://www.common-social.com', '');
      if (path) window.location.href = path;
    }
  });
}
