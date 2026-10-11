/// <reference types="@capacitor-firebase/messaging" />

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.common.social',
  appName: 'common',
  // Only holds offline.html - the app itself loads the live site from server.url
  webDir: 'native-web',
  server: {
    url: 'https://www.common-social.com',
    // Shown when the live site can't load (e.g. no connection)
    errorPath: 'offline.html',
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
      // Show nothing while the app is open, matching Android, where foreground
      // messages are delivered to JS (notificationReceived) and not shown by
      // the system. iOS only - the plugin ignores this option on Android.
      presentationOptions: [],
    },
  },
};

export default config;