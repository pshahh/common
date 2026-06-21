import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.common.social',
  appName: 'common',
  webDir: 'out',
  server: {
    url: 'http://localhost:3000',
    cleartext: true,
  },
  ios: {
    contentInset: 'never',
    scheme: 'common',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;