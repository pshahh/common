import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

export async function registerNativePush(userId: string) {
  if (!Capacitor.isNativePlatform()) return;

  const permResult = await PushNotifications.requestPermissions();
  if (permResult.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    const platform = Capacitor.getPlatform() as 'ios' | 'android';
    await supabase.from('device_tokens').upsert(
      { user_id: userId, token: token.value, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Native push registration failed:', err);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    const url = notification.notification.data?.url;
    if (url && typeof url === 'string') {
      const path = url.replace('https://www.common-social.com', '');
      if (path) window.location.href = path;
    }
  });
}
