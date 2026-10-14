import type { Permission, Role, SessionUser, User } from '../types';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  principal: 'Principal',
  coordinator: 'Coordinator',
  dean: 'Dean',
  teacher: 'Teacher',
  registrar: 'Registrar',
};

export const roleLabel = (role: string | null | undefined) =>
  (role && ROLE_LABELS[role as Role]) || (role ? role[0].toUpperCase() + role.slice(1) : '');

/** Whether the backend granted this session `permission` (UI only; the server enforces it). */
export const can = (user: SessionUser | null | undefined, permission: Permission) =>
  !!user?.permissions?.includes(permission);

export const initials = (u: Pick<User, 'full_name'> | null | undefined) => {
  const parts = (u?.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

export const isActive = (u: Pick<User, 'is_active'>) => u.is_active === undefined || u.is_active === 1 || u.is_active === true;

/** True for the API's 0/1 and boolean flags. */
export const flag = (v: unknown) => v === true || v === 1;

/** Epoch ms of a JWT's `exp` claim, or null. */
export function jwtExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const json = JSON.parse(decodeBase64(payload)) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function decodeBase64(s: string): string {
  if (typeof atob === 'function') return atob(s);
  // Minimal fallback (ASCII JWT payloads) for runtimes without atob.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const c of s.replace(/=+$/, '')) {
    buffer = (buffer << 6) | chars.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * Capitalizes the first letter of each word as the user types ("mark p.
 * fuentes" → "Mark P. Fuentes"), leaving other letters as typed so names like
 * "McArthur" or "dela Cruz" aren't mangled.
 */
export function titleCase(input: string): string {
  let out = '';
  let start = true;
  for (const ch of input) {
    if (ch === ' ' || ch === '\t' || ch === '-' || ch === '\n') {
      start = true;
      out += ch;
    } else {
      out += start ? ch.toUpperCase() : ch;
      start = false;
    }
  }
  return out;
}
