import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ''); // load environment variables

  return {
    base: '/wavematch/', // ✅ important for GitHub Pages, matches the repo name
    server: {
      port: 3000,
      host: '0.0.0.0', // allows external access for testing on LAN
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'), // keep your alias
      },
    },
    build: {
      outDir: 'dist',       // ✅ default build folder, matches GitHub Pages workflow
      sourcemap: false,     // optional: can disable for smaller build
      rollupOptions: {
        output: {
          manualChunks: undefined, // optional: prevent code splitting if needed
        },
      },
    },
  };
});
// This configuration is tailored for deploying to GitHub Pages and includes environment variable handling.