import { Json, JsonReader as R } from './json';

/** current | upcoming | archived */
export type PeriodStatus = 'current' | 'upcoming' | 'archived';

/** A term (e.g. "1st Quarter") inside a school year. */
export class SchoolTerm {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly startDate: string,
    readonly endDate: string,
    readonly status: PeriodStatus = 'upcoming',
  ) {}

  static fromJson(j: Json): SchoolTerm {
    return new SchoolTerm(R.num(j.id), R.str(j.name), R.str(j.start_date), R.str(j.end_date), R.str(j.status, 'upcoming') as PeriodStatus);
  }
}

/** A school year set by the principal; records dated in ended years are archived. */
export class SchoolYear {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly startDate: string,
    readonly endDate: string,
    readonly status: PeriodStatus = 'upcoming',
    /** What "current" resolves to. */
    readonly isDefault = false,
    readonly terms: SchoolTerm[] = [],
  ) {}

  static fromJson(j: Json): SchoolYear {
    return new SchoolYear(
      R.num(j.id),
      R.str(j.name),
      R.str(j.start_date),
      R.str(j.end_date),
      R.str(j.status, 'upcoming') as PeriodStatus,
      j.is_selected_default === true,
      R.list(j.terms, SchoolTerm.fromJson),
    );
  }
}

/** Which school year (and optionally term) a list is showing. */
export class SchoolYearFilter {
  static readonly current = new SchoolYearFilter();

  /** 'current' | 'all' | '<id>' */
  constructor(readonly schoolYear: string = 'current', readonly termId: number | null = null) {}

  get query(): Record<string, string> {
    const q: Record<string, string> = {};
    if (this.schoolYear !== 'current') q.school_year = this.schoolYear;
    if (this.termId !== null) q.term_id = String(this.termId);
    return q;
  }

  equals(other: SchoolYearFilter): boolean {
    return other.schoolYear === this.schoolYear && other.termId === this.termId;
  }
}
