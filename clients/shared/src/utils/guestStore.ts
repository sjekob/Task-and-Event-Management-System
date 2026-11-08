import { GuestInfo } from '../models';

/**
 * A guest's details (someone without a TaskNet account), remembered on this
 * device so they don't retype them at Time Out or on the evaluation form.
 * Best effort: a private window or blocked storage just means retyping.
 */
export interface StoredGuest {
  guest: GuestInfo;
  /** Events this guest gave Data Privacy consent for. */
  consentEvents: number[];
}

const KEY = 'tasknet_guest';

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? (globalThis as any).localStorage as Storage : null;
  } catch {
    return null;
  }
}

export const GuestStore = {
  load(): StoredGuest | null {
    try {
      const raw = storage()?.getItem(KEY);
      if (!raw) return null;
      const v = JSON.parse(raw) as Partial<StoredGuest>;
      if (!v.guest || typeof v.guest.email !== 'string') return null;
      return { guest: v.guest, consentEvents: Array.isArray(v.consentEvents) ? v.consentEvents.filter((n) => typeof n === 'number') : [] };
    } catch {
      return null;
    }
  },

  save(guest: GuestInfo, consentEvent?: number) {
    try {
      const prev = GuestStore.load();
      const consentEvents = [...new Set([...(prev?.consentEvents ?? []), ...(consentEvent != null ? [consentEvent] : [])])].slice(-50);
      storage()?.setItem(KEY, JSON.stringify({ guest, consentEvents }));
    } catch {
      /* storage unavailable */
    }
  },
};
