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
};

export default config;