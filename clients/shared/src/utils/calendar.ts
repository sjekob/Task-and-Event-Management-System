import { Format } from './format';

export interface CalendarCell {
  date: Date;
  /** "2026-10-14" */
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

/** A month grid (Sunday first) for calendar views. */
export class CalendarMonth {
  constructor(readonly year: number, readonly month: number) {}

  static of(d: Date): CalendarMonth {
    return new CalendarMonth(d.getFullYear(), d.getMonth());
  }

  get title(): string {
    return `${Format.monthsLong[this.month]} ${this.year}`;
  }

  next(): CalendarMonth {
    return this.month === 11 ? new CalendarMonth(this.year + 1, 0) : new CalendarMonth(this.year, this.month + 1);
  }

  prev(): CalendarMonth {
    return this.month === 0 ? new CalendarMonth(this.year - 1, 11) : new CalendarMonth(this.year, this.month - 1);
  }

  contains(d: Date): boolean {
    return d.getFullYear() === this.year && d.getMonth() === this.month;
  }

  /** Cells for the month only, with leading blanks (null) to align the first weekday. */
  cells(): (CalendarCell | null)[] {
    const first = new Date(this.year, this.month, 1).getDay();
    const days = new Date(this.year, this.month + 1, 0).getDate();
    const today = Format.isoDate(new Date());
    const out: (CalendarCell | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) {
      const date = new Date(this.year, this.month, d);
      const key = Format.isoDate(date);
      out.push({ date, key, day: d, inMonth: true, isToday: key === today });
    }
    return out;
  }

  /** Full 6-week grid including the neighbouring months' days. */
  fullGrid(): CalendarCell[] {
    const first = new Date(this.year, this.month, 1);
    const start = new Date(this.year, this.month, 1 - first.getDay());
    const today = Format.isoDate(new Date());
    const out: CalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = Format.isoDate(date);
      out.push({ date, key, day: date.getDate(), inMonth: date.getMonth() === this.month, isToday: key === today });
    }
    return out;
  }
}

/** Whole days from today to [d] (negative when past). */
export function daysUntil(d: Date): number {
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}
