/// <reference types="@codetrix-studio/capacitor-google-auth" />
import type { CapacitorConfig } from '@capacitor/cli';

const GOOGLE_WEB_CLIENT_ID = '516623761240-o7mo7hvef1lej6474cjsutrqdpo688om.apps.googleusercontent.com';

const config: CapacitorConfig = {
  appId: 'com.alesport.app',
  appName: 'Alesport',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: GOOGLE_WEB_CLIENT_ID,
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
