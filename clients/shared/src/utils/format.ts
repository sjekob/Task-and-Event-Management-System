const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Text helpers shared by every view. */
export class Format {
  static readonly months = MONTHS;
  static readonly monthsLong = MONTHS_LONG;

  /** "2026-10-14" → Date (local), or null. Accepts full ISO timestamps too. */
  static parseDate(v: string | null | undefined): Date | null {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
    if (!m) {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (m[4] !== undefined && /Z|[+-]\d{2}:?\d{2}$/.test(v)) return new Date(v);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  }

  /** Server timestamps without a zone are UTC (SQLite CURRENT_TIMESTAMP). */
  static parseUtc(v: string | null | undefined): Date | null {
    if (!v) return null;
    const iso = /Z|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v.replace(' ', 'T')}Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Date → "2026-10-14" (local). */
  static isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** "Oct 14, 2026" */
  static date(v: string | Date | null | undefined, fallback = '—'): string {
    const d = v instanceof Date ? v : Format.parseDate(v);
    if (!d) return fallback;
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  /** "October 14, 2026" */
  static longDate(v: string | Date | null | undefined, fallback = '—'): string {
    const d = v instanceof Date ? v : Format.parseDate(v);
    if (!d) return fallback;
    return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  /** "Oct 14" */
  static shortDate(v: string | Date | null | undefined, fallback = '—'): string {
    const d = v instanceof Date ? v : Format.parseDate(v);
    if (!d) return fallback;
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }

  /** "3:05 PM" */
  static time(d: Date): string {
    const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
    return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }

  /** "Oct 14, 2026 · 3:05:09 PM" (audit trail). */
  static auditTime(d: Date | null): string {
    if (!d) return '—';
    const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${mm}:${ss} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }

  /** "Oct 14, 2026 3:05 PM" from a server UTC timestamp. */
  static dateTime(v: string | null | undefined, fallback = '—'): string {
    const d = Format.parseUtc(v);
    return d ? `${Format.date(d)} ${Format.time(d)}` : fallback;
  }

  /** "just now", "5m ago", "3h ago", "2d ago", else a date. */
  static ago(v: string | null | undefined): string {
    const d = Format.parseUtc(v);
    if (!d) return '';
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
    return Format.date(d);
  }

  /** "Oct 1 – Oct 14, 2026" style range for a task. */
  static range(start: string | null | undefined, end: string | null | undefined): string {
    if (!start && !end) return 'No dates';
    if (!start) return `Due ${Format.date(end)}`;
    if (!end) return `From ${Format.date(start)}`;
    return `${Format.shortDate(start)} – ${Format.date(end)}`;
  }

  /** "HH:MM" (24h) → "h:mm AM". */
  static to12h(hhmm: string): string {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
    if (!m) return hhmm;
    const h = Number(m[1]);
    return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
  }

  /** "h:mm AM" → "HH:MM" (24h), or '' if unparseable. */
  static to24h(t: string | null | undefined): string {
    const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec((t ?? '').trim());
    if (!m) return '';
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }

  /**
   * Uppercases the first letter of each whitespace- or hyphen-separated word,
   * leaving other letters as typed ("dela Cruz", "McArthur" survive).
   */
  static titleCase(input: string): string {
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

  static capitalize(s: string | null | undefined): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  static plural(n: number, word: string, pluralWord?: string): string {
    return `${n} ${n === 1 ? word : pluralWord ?? `${word}s`}`;
  }

  /** "2026-10-14" is a real calendar date. */
  static isIsoDate(v: string): boolean {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return false;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
  }

  static isFuture(v: string): boolean {
    return v > Format.isoDate(new Date());
  }
}
