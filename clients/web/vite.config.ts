import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';
import os from 'node:os';

/**
 * This computer's address on the local network (e.g. 10.0.0.38), so links meant
 * for phones (attendance QR codes) don't point at "localhost". Prefers the real
 * Wi-Fi/Ethernet adapter over virtual ones (WSL, Hyper-V, Docker, VMs).
 */
function lanHost(): string {
  const virtual = /vethernet|wsl|hyper-v|docker|virtualbox|vmware|vbox|loopback|tailscale|zerotier/i;
  const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs ?? []).filter((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
      .map((a) => ({ name, ip: a.address })));
  const rank = (c: { name: string; ip: string }) =>
    (virtual.test(c.name) ? 10 : 0) + (/^192\.168\.|^10\./.test(c.ip) ? 0 : 1);
  return candidates.sort((a, b) => rank(a) - rank(b))[0]?.ip ?? '';
}

// The MVC core (models, services, controllers) lives in ../shared and is
// compiled straight from source through the @shared alias.
// `npm run dev:https` (mode "https"): serve over https with a self-signed certificate, so phones on the
// Wi-Fi can share their location (browsers only allow it on https pages) for venue-pinned attendance.
export default defineConfig(({ command, mode }) => ({
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  // In the dev server, QR codes use this address when the app is opened as localhost.
  // A deployed build sets VITE_PUBLIC_ORIGIN (or is opened on its real address) instead.
  // (Only the dev server looks it up: a build made inside Docker would find the container's address.)
  define: { __LAN_HOST__: JSON.stringify(process.env.VITE_LAN_HOST ?? (command === 'serve' ? lanHost() : '')) },
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared/src') },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [path.resolve(__dirname, '..')] },
    // The API and uploaded files through this same address (http or https), so pages opened on a
    // phone reach the backend, and an https page never calls a plain-http API.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, xfwd: true },
      '/uploads': { target: 'http://localhost:8000', changeOrigin: true, xfwd: true },
    },
  },
}));
