import { Json, JsonReader as R } from './json';

/** One personnel row of the Annual Faculty Performance Summary (server: appraisal.performance_summary). */
export interface PerformanceRow {
  id: number;
  name: string;
  position: string;
  department: string | null;
  /** Average special-task rating, 1-5. */
  specialTaskScore: number | null;
  /** Attendee evaluation rate of events they organized, 0-100. */
  eventScore: number | null;
  timingPoints: number;
  totalPoints: number | null;
  overallGrade: string | null;
  escalationCount: number;
  remarks: string;
}

export class PerformanceSummary {
  constructor(
    readonly schoolName: string,
    readonly stationId: string,
    readonly division: string,
    readonly schoolYear: string | null,
    readonly rows: PerformanceRow[],
  ) {}

  static fromJson(j: Json): PerformanceSummary {
    return new PerformanceSummary(R.str(j.school_name), R.str(j.station_id), R.str(j.division), R.optStr(j.school_year),
      R.list(j.rows, (r: Json) => ({
        id: R.num(r.id),
        name: R.str(r.name),
        position: R.str(r.position),
        department: R.optStr(r.department),
        specialTaskScore: R.optNum(r.special_task_score),
        eventScore: R.optNum(r.event_score),
        timingPoints: R.num(r.timing_points),
        totalPoints: R.optNum(r.total_points),
        overallGrade: R.optStr(r.overall_grade),
        escalationCount: R.num(r.escalation_count),
        remarks: R.str(r.remarks),
      })));
  }
}
