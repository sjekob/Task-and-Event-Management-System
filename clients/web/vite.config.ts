import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The MVC core (models, services, controllers) lives in ../shared and is
// compiled straight from source through the @shared alias.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared/src') },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
});
