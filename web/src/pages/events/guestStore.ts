// A guest's details (no TaskNet account), remembered in this browser so they
// don't retype them at Time Out or on the evaluation form. Best effort:
// private windows or blocked storage just mean retyping.
import type { GuestInfo } from '@tasknet/shared';

const KEY = 'tasknet_guest';

export interface StoredGuest {
  guest: GuestInfo;
  /** events this guest gave Data Privacy consent for */
  consentEvents: number[];
}

export function loadGuest(): StoredGuest | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredGuest>;
    if (!v.guest || typeof v.guest.email !== 'string') return null;
    return { guest: v.guest, consentEvents: Array.isArray(v.consentEvents) ? v.consentEvents.filter((n) => typeof n === 'number') : [] };
  } catch {
    return null;
  }
}

export function saveGuest(guest: GuestInfo, consentEvent?: number) {
  try {
    const prev = loadGuest();
    const consentEvents = [...new Set([...(prev?.consentEvents ?? []), ...(consentEvent != null ? [consentEvent] : [])])].slice(-50);
    localStorage.setItem(KEY, JSON.stringify({ guest, consentEvents }));
  } catch {
    /* storage unavailable */
  }
}
