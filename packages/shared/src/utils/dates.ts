import type { Task } from '../types';

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date → "YYYY-MM-DD". */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD…" → local midnight Date (no UTC shift), or null. */
export function parseIsoDate(raw: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((raw ?? '').trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

/** "YYYY-MM-DD HH:MM:SS" (server, UTC) or ISO → Date. */
export function parseTimestamp(raw: string | null | undefined, utc = true): Date | null {
  if (!raw) return null;
  let s = raw.trim().replace(' ', 'T');
  if (utc && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) && s.length > 10) s += 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * An event's free-text target date → Date, or null when it can't be
 * confidently parsed (callers must not fall back to "today").
 * Handles ISO "2026-10-20", "October 20, 2026", "Oct. 20, 2026" and multi-date
 * "Oct. 23, 24 & 28, 2024" (→ the first date).
 */
export function parseEventDate(raw: string | null | undefined): Date | null {
  if (!raw || !raw.trim()) return null;
  const t = raw.trim();
  const iso = parseIsoDate(t);
  if (iso) return iso;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const md = /([A-Za-z]{3,9})\.?\s+(\d{1,2})/.exec(t);
  const ym = /(19|20)\d{2}/.exec(t);
  if (md && ym) {
    const mon = months[md[1].toLowerCase().slice(0, 3)];
    const day = +md[2];
    if (mon !== undefined && day >= 1 && day <= 31) {
      const d = new Date(+ym[0], mon, day);
      if (d.getMonth() === mon) return d;
    }
  }
  return null;
}

/** "5:00 PM" → [17, 0], or null. */
export function parseClockTime(raw: string | null | undefined): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec((raw ?? '').trim());
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return [h, +m[2]];
}

/** [17, 5] → "5:05 PM" */
export function formatClockTime(h: number, m: number): string {
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * When a task is due: end_date at due_time, or the end of end_date when no
 * time is set. Mirrors task_deadline in the backend (date_utils.py).
 */
export function taskDeadline(t: Pick<Task, 'end_date' | 'due_time'>): Date | null {
  const d = parseIsoDate(t.end_date);
  if (!d) return null;
  const hm = parseClockTime(t.due_time);
  return hm ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), hm[0], hm[1])
    : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

export function isTaskSubmitted(t: Pick<Task, 'submission_status' | 'my_report'>): boolean {
  return t.submission_status === 'submitted' || t.my_report != null;
}

/** Unsubmitted and past its deadline. */
export function isTaskOverdue(t: Task, now = new Date()): boolean {
  const dl = taskDeadline(t);
  return !isTaskSubmitted(t) && dl != null && dl < now;
}

/** "Mar 5, 2026" */
export function formatDate(d: Date | null | undefined, fallback = '—'): string {
  if (!d) return fallback;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "YYYY-MM-DD" → "Mar 5, 2026"; other text is returned as-is. */
export function formatIsoDate(raw: string | null | undefined, fallback = '—'): string {
  if (!raw) return fallback;
  const d = parseIsoDate(raw);
  return d ? formatDate(d) : raw;
}

/** "Mar 5, 2026 · 2:30 PM" (local time) */
export function formatDateTime(d: Date | null | undefined, fallback = '—'): string {
  if (!d) return fallback;
  return `${formatDate(d)} · ${formatClockTime(d.getHours(), d.getMinutes())}`;
}

/** Relative time for feeds: "just now", "5m ago", "3h ago", "2d ago", else the date. */
export function timeAgo(d: Date | null | undefined, now = new Date()): string {
  if (!d) return '';
  const s = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(d);
}

/** "Dec 16 – 17, 2026" / "Dec 19, 2026 – Jan 3, 2027" / "Nov 30, 2026" */
export function formatRange(start: Date, end: Date): string {
  const s = `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}`;
  if (sameDay(start, end)) return `${s}, ${start.getFullYear()}`;
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${s} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${s} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${s}, ${start.getFullYear()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

/** The 6×7 grid of days shown for a month (weeks start on Sunday). */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Whole calendar days from today to `d` (negative when past). */
export function daysUntil(d: Date, now = new Date()): number {
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** "May 22" this year, "May 22, 2025" otherwise. */
export function formatShortDate(d: Date, now = new Date()): string {
  const base = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** Task due label; the stored end-of-day default (11:59 PM) is not shown. */
export function formatDue(t: Pick<Task, 'end_date' | 'due_time'>): string {
  const dl = taskDeadline(t);
  if (!dl) return 'No deadline';
  const time = (t.due_time ?? '').trim();
  return time && time.toUpperCase() !== '11:59 PM' ? `${formatShortDate(dl)}, ${time}` : formatShortDate(dl);
}

export type DueState = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

/** How urgent a task is, plus its chip label ("Overdue", "In 3 days", …). */
export function dueState(t: Task, now = new Date()): { state: DueState; label: string } {
  const dl = taskDeadline(t);
  if (isTaskOverdue(t, now)) return { state: 'overdue', label: 'Overdue' };
  if (!dl) return { state: 'none', label: 'No deadline' };
  const days = daysUntil(dl, now);
  if (days <= 0) return { state: 'today', label: 'Due today' };
  if (days === 1) return { state: 'tomorrow', label: 'Due tomorrow' };
  if (days <= 7) return { state: 'week', label: `In ${days} days` };
  return { state: 'later', label: formatShortDate(dl, now) };
}

/** "14:30" / "14:30:00" (time inputs) → "2:30 PM" (as stored by the API); "" → null. */
export function to12h(hhmm: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hhmm ?? '').trim());
  return m ? formatClockTime(+m[1], +m[2]) : null;
}

/** "2:30 PM" → "14:30" for time inputs; null when unparseable. */
export function to24h(clock: string | null | undefined): string | null {
  const hm = parseClockTime(clock);
  return hm ? `${pad(hm[0])}:${pad(hm[1])}` : null;
}

/** "1984-03-15" → "March 15, 1984"; other text is returned as-is. */
export function formatLongIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = parseIsoDate(raw);
  return d ? `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : raw;
}
