/// <reference types="@capacitor/keyboard" />
import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.alesport.app',
  appName: 'Alesport',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Ionic,
    },
  },
};

export default config;
