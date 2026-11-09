/**
 * The address links for phones start with (QR codes, shareable links). Phones
 * can't open "localhost" (it would mean the phone itself), so when this page is
 * open as localhost the links use this computer's network address instead
 * (found by the dev server, see vite.config.ts), or VITE_PUBLIC_ORIGIN when set.
 */
export function shareOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined;
  if (env) return env.replace(/\/+$/, '');
  const { protocol, hostname, port, origin } = window.location;
  const local = hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname.startsWith('127.');
  // Defined by vite.config.ts; absent if the dev server hasn't been restarted since that was added.
  const lan = typeof __LAN_HOST__ === 'string' ? __LAN_HOST__ : '';
  return local && lan ? `${protocol}//${lan}${port ? `:${port}` : ''}` : origin;
}
