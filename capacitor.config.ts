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
  },
};

export default config;