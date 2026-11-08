import { Json, JsonReader as R } from './json';

/** Categories the server accepts (database.DEPED_CATEGORIES). */
export const DEPED_CATEGORIES = ['Mandatory Examination', 'Quarter Compliance', 'Holiday', 'Administrative Period'];

/** Roles a compliance task can be generated for (deped_calendar.FACULTY_ROLES). */
export const DEPED_TASK_ROLES = ['teacher', 'dean', 'coordinator', 'registrar'];

/** One official DepEd school-calendar entry (memorandum dates: exams, compliance, holidays). */
export class DepedEntry {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly description: string | null,
    /** ISO dates (YYYY-MM-DD); a one-day entry has start = end. */
    readonly startDate: string,
    readonly endDate: string,
    readonly category: string,
    readonly isMandatory: boolean,
  ) {}

  static fromJson(j: Json): DepedEntry {
    const start = R.str(j.start_date);
    return new DepedEntry(R.num(j.id), R.str(j.title), R.optStr(j.description), start, R.str(j.end_date, start),
      R.str(j.category), j.is_mandatory === true || j.is_mandatory === 1);
  }

  /** Whether calendar day [iso] (YYYY-MM-DD) falls inside the entry. */
  covers(iso: string): boolean {
    return this.startDate <= iso && iso <= this.endDate;
  }

  get range(): string {
    return this.startDate === this.endDate ? this.startDate : `${this.startDate} → ${this.endDate}`;
  }

  /** Entries by every calendar day they cover ("YYYY-MM-DD" → entries). */
  static byDay(entries: DepedEntry[]): Map<string, DepedEntry[]> {
    const map = new Map<string, DepedEntry[]>();
    for (const e of entries) {
      const day = new Date(`${e.startDate}T00:00:00Z`);
      const end = new Date(`${e.endDate}T00:00:00Z`);
      for (let n = 0; n < 400 && day <= end && !Number.isNaN(day.getTime()); n++) {
        const k = day.toISOString().slice(0, 10);
        map.set(k, [...(map.get(k) ?? []), e]);
        day.setUTCDate(day.getUTCDate() + 1);
      }
    }
    return map;
  }

  /** Hover text for a calendar day's DepEd entries. */
  static tooltip(entries: DepedEntry[]): string {
    return entries.map((e) => `DepEd Memo · ${e.category}${e.isMandatory ? ' (mandatory)' : ''}\n${e.title}\n${e.range}`).join('\n\n');
  }

  toJson(): Json {
    return {
      title: this.title, description: this.description, start_date: this.startDate, end_date: this.endDate,
      category: this.category, is_mandatory: this.isMandatory,
    };
  }
}
