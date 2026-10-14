import { tryParseDate } from '../models/models';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/// Parses an event's free-text target/event date into a Date, or `null`
/// when it can't be confidently parsed — so callers must NOT fall back to
/// "today" (that's what put event dots on the current date).
///
/// Handles:
///   • ISO            "2026-10-20"
///   • Human-readable "October 20, 2026", "Oct. 20, 2026"
///   • Multi-date     "Oct. 23, 24 & 28, 2024"  → first date (Oct 23, 2024)
export function parseEventDate(raw: string | null | undefined): Date | null {
  if (raw == null || raw.trim().length === 0) return null;
  const t = raw.trim();

  const iso = tryParseDate(t);
  if (iso != null) return iso;

  // Month name + first day, and the 4-digit year (taken anywhere in the string).
  const md = /([A-Za-z]{3,9})\.?\s+(\d{1,2})/.exec(t);
  const ym = /(19|20)\d{2}/.exec(t);
  if (md != null && ym != null) {
    const mon = MONTHS[md[1].toLowerCase().substring(0, 3)];
    const day = parseInt(md[2], 10);
    const year = parseInt(ym[0], 10);
    if (mon != null && !isNaN(day) && !isNaN(year)) {
      return new Date(year, mon - 1, day);
    }
  }
  return null;
}

/// Midnight of the same calendar day.
export const dateOnly = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/// A stable key for a calendar day (for maps and sets keyed by date).
export const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
