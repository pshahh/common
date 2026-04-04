export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
  
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  }
  
  export async function subscribeToPush(userId: string) {
    console.log('subscribeToPush called for', userId);
    
    const registration = await registerServiceWorker();
    console.log('registration:', registration);
    if (!registration) return null;
  
    let subscription = await registration.pushManager.getSubscription();
    console.log('existing subscription:', subscription);
  
    if (!subscription) {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      console.log('VAPID key exists:', !!vapidPublicKey);
      if (!vapidPublicKey) return null;
  
      const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
      const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const applicationServerKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        applicationServerKey[i] = rawData.charCodeAt(i);
      }
  
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
  
      // Only save to backend when we create a NEW subscription
      const subscriptionJSON = subscription.toJSON();
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          endpoint: subscriptionJSON.endpoint,
          keys_p256dh: subscriptionJSON.keys?.p256dh,
          keys_auth: subscriptionJSON.keys?.auth,
        }),
      });
    }
  
    return subscription;
  }
  
  export async function unsubscribeFromPush() {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
  
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  }