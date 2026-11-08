import { Json, JsonReader as R } from './json';

/** One dated row of a scanned schedule (e.g. a term calendar). */
export interface ScannedItem { title: string; startDate: string | null; endDate: string | null }

/** Task fields read from an uploaded document (server: task_scanner.py). Missing fields are null. */
export class ScannedTask {
  constructor(
    readonly title: string | null,
    readonly instructions: string | null,
    readonly startDate: string | null,
    readonly endDate: string | null,
    /** e.g. "5:00 PM". */
    readonly dueTime: string | null,
    /** Non-empty when the file is a schedule of several dated rows rather than one task. */
    readonly items: ScannedItem[],
  ) {}

  static fromJson(j: Json): ScannedTask {
    const items = Array.isArray(j.items)
      ? j.items.map((x: Json) => ({ title: R.str(x.title), startDate: R.optStr(x.start_date), endDate: R.optStr(x.end_date) }))
      : [];
    return new ScannedTask(R.optStr(j.title), R.optStr(j.instructions), R.optStr(j.start_date), R.optStr(j.end_date), R.optStr(j.due_time), items);
  }
}

/**
 * A task proposed from a scanned school calendar (server: task_scanner.plan_calendar_tasks).
 * kind: 'task' | 'suggested' (implied, e.g. submitting grades after an exam) |
 * 'holiday' | 'marker' (term starts/ends, breaks) | 'other'.
 */
export interface CalendarTaskProposal {
  title: string;
  startDate: string;
  endDate: string;
  kind: string;
  selected: boolean;
  instructions: string;
  /** Already over: listed, but not pre-selected. */
  past: boolean;
  /** Who does it and who it is submitted to, e.g. 'teacher>dean' (see CALENDAR_ROUTES). */
  route: string;
  /** The calendar entry this task comes from, e.g. "End of Term 1 · October 16, 2026". */
  basis: string;
  /** That entry's title and dates as the calendar gives them, e.g. "End of Term 1" / "October 16, 2026". */
  source: string;
  sourceDate: string;
  /** The entry's first day (ISO), the default start of a task the principal adds under it. */
  sourceStart: string;
  /** The description is written for the principal (from the title, route and due date) until they edit it. */
  autoDescribe?: boolean;
}

export function calendarProposalFromJson(j: Json): CalendarTaskProposal {
  return {
    title: R.str(j.title), startDate: R.str(j.start_date), endDate: R.str(j.end_date), kind: R.str(j.kind, 'other'),
    selected: j.selected === true, instructions: R.str(j.instructions), past: j.past === true,
    route: R.str(j.route, 'later'), basis: R.str(j.basis),
    source: R.str(j.source), sourceDate: R.str(j.source_date), sourceStart: R.str(j.source_start),
  };
}
