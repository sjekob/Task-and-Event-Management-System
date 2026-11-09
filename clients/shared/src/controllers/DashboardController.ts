import { BaseController } from './BaseController';
import { Services } from '../services';
import { DashboardData, DepedEntry, EventItem, Task, User } from '../models';
import { CalendarMonth, daysUntil } from '../utils/calendar';
import { Format } from '../utils/format';

export type Tone = 'red' | 'amber' | 'blue' | 'gray' | 'green';

export interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  month: CalendarMonth;
  /** Upcoming (non-draft, non-disabled) events by day key "YYYY-MM-DD". */
  eventsByDay: Map<string, EventItem[]>;
  /** Official DepEd school-calendar entries by day key. */
  depedByDay: Map<string, DepedEntry[]>;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class DashboardController extends BaseController<DashboardState> {
  constructor(private readonly services: Services, private readonly user: User | null) {
    super({ data: null, loading: true, error: null, month: CalendarMonth.of(new Date()), eventsByDay: new Map(), depedByDay: new Map() });
  }

  /** Approvers (principal/admin) receive no tasks; the sections mirror the sidebar. */
  get isApprover() { return !(this.user?.can('receive_tasks') ?? false); }
  get canCreateTasks() { return this.user?.can('create_tasks') ?? false; }

  async load() {
    await Promise.all([this.loadData(), this.loadEvents(), this.loadDeped()]);
  }

  private async loadData() {
    try {
      this.setState({ data: await this.services.dashboard.load(), loading: false, error: null });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e, 'Failed to load dashboard') });
    }
  }

  private async loadEvents() {
    try {
      const events = await this.services.events.list();
      const map = new Map<string, EventItem[]>();
      for (const e of events) {
        if (e.isInactive) continue;   // disabled, drafts and proposals returned to the proponent
        const d = e.date;
        if (!d) continue;
        const k = Format.isoDate(d);
        map.set(k, [...(map.get(k) ?? []), e]);
      }
      this.setState({ eventsByDay: map });
    } catch {
      /* best effort */
    }
  }

  private async loadDeped() {
    try {
      this.setState({ depedByDay: DepedEntry.byDay(await this.services.deped.list()) });
    } catch {
      /* best effort */
    }
  }

  nextMonth() { this.setState((s) => ({ month: s.month.next() })); }
  prevMonth() { this.setState((s) => ({ month: s.month.prev() })); }

  // ── Derived text ──
  greeting(now = new Date()): string {
    const h = now.getHours();
    const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    // Some accounts store a role-prefixed full name and no first name.
    const name = ((this.user?.firstName?.trim() ? this.user.firstName : this.user?.fullName) ?? '')
      .trim()
      .replace(/^(principal|coordinator|dean|registrar|teacher|admin)\s+/i, '');
    const first = name.split(/\s+/)[0];
    return first ? `${part}, ${first}` : part;
  }

  subtitle(now = new Date()): string {
    return `${WEEKDAYS[now.getDay()]}, ${Format.monthsLong[now.getMonth()]} ${now.getDate()} — ${this.summary()}`;
  }

  /** One line on what needs attention, from the same data as the cards. */
  summary(): string {
    const d = this.state.data;
    if (!d) return 'Here is what is happening today.';
    const parts: string[] = [];
    if (this.isApprover) {
      if (d.eventsTotal > 0) parts.push(`${d.eventsTotal} event ${d.eventsTotal === 1 ? 'proposal' : 'proposals'} awaiting your approval`);
      if (d.missing > 0) parts.push(`${d.missing} ${d.missing === 1 ? 'assignment' : 'assignments'} past deadline on your tasks`);
      return parts.length ? `${parts.join(' · ')}.` : 'Nothing needs your attention right now.';
    }
    const dueSoon = d.myTasks.filter((t) => {
      const dl = t.deadline;
      return dl !== null && !t.isOverdue && daysUntil(dl) <= 7;
    }).length;
    if (d.missing > 0) parts.push(`${d.missing} overdue ${d.missing === 1 ? 'task' : 'tasks'}`);
    if (dueSoon > 0) parts.push(`${dueSoon} due this week`);
    if (!parts.length) {
      return d.pending > 0
        ? `No deadlines this week — ${d.pending} ${d.pending === 1 ? 'task' : 'tasks'} still open.`
        : 'You are all caught up.';
    }
    return `You have ${parts.join(' and ')}.`;
  }

  /** Where the KPI tiles lead. */
  get tasksRoute() { return this.isApprover ? '/tasks' : '/my-tasks'; }

  // ── Task row helpers ──
  static fmtDate(d: Date): string {
    const base = `${Format.months[d.getMonth()]} ${d.getDate()}`;
    return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
  }

  /** Task due label; the stored end-of-day default (11:59 PM) is not shown. */
  static fmtDue(t: Task): string {
    const dl = t.deadline;
    if (!dl) return 'No deadline';
    const time = (t.dueTime ?? '').trim();
    return time && time.toUpperCase() !== '11:59 PM' ? `${DashboardController.fmtDate(dl)}, ${time}` : DashboardController.fmtDate(dl);
  }

  static dueTone(t: Task): Tone {
    if (t.isOverdue) return 'red';
    const dl = t.deadline;
    if (dl && daysUntil(dl) <= 2) return 'amber';
    return 'gray';   // plenty of time: neutral, so red and amber stand out
  }

  static dueChip(t: Task): { label: string; tone: Tone } {
    const dl = t.deadline;
    if (t.isOverdue) return { label: 'Overdue', tone: 'red' };
    if (!dl) return { label: 'No deadline', tone: 'gray' };
    const days = daysUntil(dl);
    if (days <= 0) return { label: 'Due today', tone: 'amber' };
    if (days === 1) return { label: 'Due tomorrow', tone: 'amber' };
    if (days <= 7) return { label: `In ${days} days`, tone: 'blue' };
    return { label: DashboardController.fmtDate(dl), tone: 'gray' };
  }

  static taskMeta(t: Task, withAssigned = false): string {
    const base = `${t.isSpecial ? 'Special task' : 'Task'} · Due ${DashboardController.fmtDue(t)}`;
    return withAssigned && (t.teamTotal ?? 0) > 0 ? `${base} · ${t.teamTotal} assigned` : base;
  }

  static myTaskPath(t: Task) { return t.isSpecial ? `/my-special-tasks/${t.id}` : `/my-tasks/${t.id}`; }
  static managedTaskPath(t: Task) { return t.isSpecial ? `/special-tasks/${t.id}` : `/tasks/${t.id}`; }
  static eventPath(e: EventItem) { return e.id ? `/events?open=${e.id}` : '/events'; }

  static eventMeta(e: EventItem): string {
    return [String(e.raw.nature ?? '').trim(), (e.venue ?? '').trim()].filter(Boolean).join(' · ');
  }

  // ── Calendar ──
  eventsOn(key: string): EventItem[] {
    return this.state.eventsByDay.get(key) ?? [];
  }

  depedOn(key: string): DepedEntry[] {
    return this.state.depedByDay.get(key) ?? [];
  }

  /** Hover text for a day: its events, then its DepEd memo dates. */
  dayTooltip(key: string): string | null {
    const evs = this.eventsOn(key);
    const parts = [evs.length ? DashboardController.eventTooltip(evs) : '', DepedEntry.tooltip(this.depedOn(key))].filter(Boolean);
    return parts.length ? parts.join('\n\n') : null;
  }

  hasDeadline(key: string): boolean {
    return this.state.data?.deadlineDates.has(key) ?? false;
  }

  static eventTooltip(events: EventItem[]): string {
    return events.map((e) => {
      const lines = [e.title || 'Event'];
      if (e.targetDate?.trim()) lines.push(`When: ${e.targetDate.trim()}`);
      if (e.venue?.trim()) lines.push(`Where: ${e.venue.trim()}`);
      return lines.join('\n');
    }).join('\n\n');
  }

  /** The next three events from today. */
  upcoming(): { date: Date; event: EventItem }[] {
    const today = Format.isoDate(new Date());
    return [...this.state.eventsByDay.entries()]
      .filter(([k]) => k >= today)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([k, evs]) => evs.map((event) => ({ date: Format.parseDate(k)!, event })))
      .slice(0, 3);
  }
}
