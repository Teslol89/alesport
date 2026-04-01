/// <reference types="vitest" />

import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy(),
    svgr()
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('@ionic/core')) return 'vendor-ionic-core';
          if (id.includes('@ionic/react') || id.includes('@ionic/react-router') || id.includes('ionicons')) {
            return 'vendor-ionic-react';
          }
          if (id.includes('firebase') || id.includes('@capacitor-firebase')) return 'vendor-firebase';
          if (id.includes('@capacitor')) return 'vendor-capacitor';

          return 'vendor';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
});