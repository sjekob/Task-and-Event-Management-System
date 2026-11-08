import { Json, JsonReader as R } from './json';

/** A subject teacher's load in a section. */
export interface SectionTeacher { userId: number; name: string; subject: string; active: boolean }

/** A class of the school ("Grade 1 - Rizal"), its adviser and its subject teachers. */
export class Section {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly gradeLevelId: number,
    readonly gradeLevel: string,
    readonly adviserId: number | null,
    readonly adviserName: string | null,
    readonly teachers: SectionTeacher[],
  ) {}

  /** "Grade 1 - Rizal". */
  get label() { return `${this.gradeLevel} - ${this.name}`; }

  static fromJson(j: Json): Section {
    return new Section(
      R.num(j.id), R.str(j.name), R.num(j.grade_level_id), R.str(j.grade_level),
      R.optNum(j.adviser_id), R.optStr(j.adviser_name),
      R.list(j.teachers, (t: Json) => ({ userId: R.num(t.user_id), name: R.str(t.name), subject: R.str(t.subject), active: t.active !== false })),
    );
  }
}

/** The section a teacher advises, as a personnel record reports it. */
export interface AdvisorySection { id: number; name: string; gradeLevelId: number; gradeLevel: string }

export function advisoryFromJson(j: unknown): AdvisorySection | null {
  if (!j || typeof j !== 'object') return null;
  const o = j as Json;
  return { id: R.num(o.id), name: R.str(o.name), gradeLevelId: R.num(o.grade_level_id), gradeLevel: R.str(o.grade_level) };
}
