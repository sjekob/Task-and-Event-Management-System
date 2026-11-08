import { BaseController } from './BaseController';
import { Services } from '../services';
import { FilePart } from '../services/ApiClient';
import { CalendarTaskProposal, User } from '../models';
import { Format } from '../utils/format';
import { describeTask, moveDates } from '../utils/calendarDescription';

export interface CalendarScanState {
  scanning: boolean;
  /** Null until a calendar has been read; then the proposals to review. */
  rows: CalendarTaskProposal[] | null;
  fileName: string;
  posting: boolean;
  progress: string;
}

export const CALENDAR_KIND: Record<string, { label: string; tone: 'blue' | 'purple' | 'red' | 'gray' }> = {
  report: { label: 'Required', tone: 'blue' },
  optional: { label: 'Optional', tone: 'gray' },
  manual: { label: 'Added', tone: 'purple' },
  other: { label: 'Other', tone: 'gray' },
};

/** Who does a calendar task → who it is submitted to. The server does the routing. */
export const CALENDAR_ROUTES: { value: string; label: string }[] = [
  { value: 'subject>adviser', label: 'Subject teachers → adviser' },
  { value: 'adviser>dean', label: 'Advisers → their dean' },
  { value: 'dean>registrar', label: 'Deans → registrar' },
  { value: 'teacher>dean', label: 'Teachers → their dean' },
  { value: 'teacher>principal', label: 'Teachers → me' },
  { value: 'dean>principal', label: 'Deans → me' },
  { value: 'coordinator>principal', label: 'Coordinators → me' },
  { value: 'later', label: 'Nobody yet' },
];

/**
 * "Scan school calendar" (principal/admin): the server reads a calendar
 * (PDF, Word, text or photo) and proposes one task per dated row plus implied
 * follow-ups (grades after an exam or the end of a term); the principal edits /
 * ticks rows and posts them, each due 5:00 PM on its date and assigned along
 * its route, e.g. grades go to every teacher, submitted to the dean of their grade.
 */
export class CalendarScanController extends BaseController<CalendarScanState> {
  constructor(private readonly services: Services, private readonly user: User | null) {
    super({ scanning: false, rows: null, fileName: '', posting: false, progress: '' });
  }

  /** Principal, registrar or admin (permission `post_school_calendar`, decided by the backend, which enforces it too). */
  get canScan(): boolean { return this.user?.can('post_school_calendar') ?? false; }

  get routeOptions() { return CALENDAR_ROUTES; }

  get chosen(): CalendarTaskProposal[] { return (this.state.rows ?? []).filter((r) => r.selected && r.title.trim()); }

  get summary(): string {
    const s = this.state;
    return s.posting ? s.progress : `${this.chosen.length} of ${s.rows?.length ?? 0} selected · due 5:00 PM on each date`;
  }

  /** Returns an error message, or null once the proposals are ready to review. */
  async scan(file: FilePart): Promise<string | null> {
    this.setState({ scanning: true });
    try {
      const rows = await this.services.tasks.scanSchoolCalendar(file);
      this.setState({ rows, fileName: file.name });
      return null;
    } catch (e) {
      return BaseController.messageOf(e, 'The calendar could not be read');
    } finally {
      this.setState({ scanning: false });
    }
  }

  /** The rows grouped under the calendar entry each comes from, in calendar order; `index` is the row's place in `rows`. */
  get groups(): { source: string; date: string; items: { row: CalendarTaskProposal; index: number }[] }[] {
    const out: { source: string; date: string; items: { row: CalendarTaskProposal; index: number }[] }[] = [];
    (this.state.rows ?? []).forEach((row, index) => {
      const key = row.source || row.basis;
      const last = out[out.length - 1];
      if (last && last.source === key && last.date === row.sourceDate) last.items.push({ row, index });
      else out.push({ source: key, date: row.sourceDate, items: [{ row, index }] });
    });
    return out;
  }

  /** Changes a row's start or due date; the other moves with it so start never falls after due. */
  setDate(i: number, which: 'startDate' | 'endDate', value: string) {
    if (!value) return;
    const r = this.state.rows?.[i];
    if (!r) return;
    const startDate = which === 'startDate' ? value : value < r.startDate ? value : r.startDate;
    const endDate = which === 'endDate' ? value : value > r.endDate ? value : r.endDate;
    const past = endDate < CalendarScanController.today();
    this.update(i, { startDate, endDate, past, ...(r.past && !past ? { selected: true } : {}) });
  }

  update(i: number, patch: Partial<CalendarTaskProposal>) {
    this.setState((s) => ({ rows: (s.rows ?? []).map((r, j) => (j === i ? CalendarScanController.apply(r, patch) : r)) }));
  }

  /** Edits the description; clearing it hands it back to the automatic one. */
  setDescription(i: number, instructions: string) { this.update(i, { instructions, autoDescribe: !instructions.trim() }); }

  /** [r] with [patch], keeping the description in step with the title, route and dates. */
  private static apply(r: CalendarTaskProposal, patch: Partial<CalendarTaskProposal>): CalendarTaskProposal {
    const next = { ...r, ...patch };
    if (next.autoDescribe) {
      if (!('instructions' in patch) || !next.instructions.trim()) next.instructions = describeTask(next.title, next.route, next.endDate, { source: next.source, date: next.sourceDate });
    } else if (next.startDate !== r.startDate || next.endDate !== r.endDate) {
      next.instructions = moveDates(next.instructions, { start: r.startDate, end: r.endDate }, { start: next.startDate, end: next.endDate });
    }
    return next;
  }

  /** Gives every chosen row the same route (e.g. all to "Nobody yet"). */
  setAllRoutes(route: string) {
    this.setState((s) => ({ rows: (s.rows ?? []).map((r) => (r.selected ? CalendarScanController.apply(r, { route }) : r)) }));
  }

  /** Another task under the calendar entry of row [after] (typed in by the principal), placed after it. */
  addTask(after: number) {
    const rows = this.state.rows ?? [];
    const like = rows[after];
    if (!like) return;
    const startDate = like.sourceStart || like.startDate;
    const endDate = like.endDate < startDate ? startDate : like.endDate;
    const row: CalendarTaskProposal = {
      title: '', startDate, endDate, kind: 'manual', selected: true, instructions: '', past: endDate < CalendarScanController.today(),
      route: 'teacher>dean', basis: like.basis, source: like.source, sourceDate: like.sourceDate, sourceStart: like.sourceStart, autoDescribe: true,
    };
    this.setState({ rows: [...rows.slice(0, after + 1), row, ...rows.slice(after + 1)] });
  }

  /** Removes a task the principal added (scanned ones are just unticked). */
  remove(i: number) {
    this.setState((s) => ({ rows: (s.rows ?? []).filter((r, j) => j !== i || r.kind !== 'manual') }));
  }

  static today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  close() { this.setState({ rows: null, progress: '' }); }

  /** Posts the chosen rows in one request; returns the message to show. */
  async post(): Promise<{ posted: number; message: string; error: boolean }> {
    // A task can't go out without a description: any left empty gets the automatic one.
    const chosen = this.chosen.map((r) => (r.instructions.trim() ? r : { ...r, instructions: describeTask(r.title, r.route, r.endDate, { source: r.source, date: r.sourceDate }) }));
    this.setState({ posting: true, progress: `Posting ${chosen.length} task${chosen.length === 1 ? '' : 's'}…` });
    try {
      const r = await this.services.tasks.postCalendarTasks(this.state.fileName, chosen);
      this.close();
      const reviewers = Object.entries(r.byReviewer).map(([name, n]) => `${name} (${n})`);
      const routed = reviewers.length ? ` Submissions go to ${reviewers.join(', ')}${r.toPoster ? ` and you (${r.toPoster})` : ''}.` : '';
      return { posted: r.posted, message: `${r.posted} task${r.posted === 1 ? '' : 's'} posted from the school calendar, ${r.assigned} assignment${r.assigned === 1 ? '' : 's'}.${routed}`, error: false };
    } catch (e) {
      return { posted: 0, message: BaseController.messageOf(e, 'The calendar tasks could not be posted'), error: true };
    } finally {
      this.setState({ posting: false, progress: '' });
    }
  }

  static dates(r: CalendarTaskProposal): string {
    return r.startDate === r.endDate ? `Due ${Format.date(r.endDate)}` : `${Format.date(r.startDate)} – due ${Format.date(r.endDate)}`;
  }
}
