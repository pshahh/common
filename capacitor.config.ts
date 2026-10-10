/// <reference types="@capacitor-firebase/messaging" />

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.common.social',
  appName: 'common',
  webDir: 'out',
  server: {
    url: 'https://www.common-social.com',
  cleartext: false,
  },
  ios: {
    contentInset: 'never',
    scheme: 'common',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // common has no dark mode - the background is always pale, so force
      // dark status bar icons regardless of the device's system theme
      // (Capacitor's built-in SystemBars plugin otherwise auto-picks based
      // on system dark/light mode, which is why this kept reverting).
      style: 'light',
    },
    FirebaseMessaging: {
      // Show notifications while the app is open. No 'badge': common has no
      // badge counts. iOS only - the plugin ignores this on Android, where
      // foreground messages are delivered to JS (notificationReceived) and
      // not shown by the system.
      presentationOptions: ['alert', 'sound'],
    },
  },
};

export default config;