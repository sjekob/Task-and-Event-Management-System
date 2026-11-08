import { BaseController } from './BaseController';
import { Services } from '../services';
import { DepedEntry, EventItem, SchoolYearFilter, User } from '../models';
import { Format } from '../utils/format';
import { approvalMessage } from '../services/EventService';

export interface EventsState {
  events: EventItem[];
  loading: boolean;
  /** 0 = All Events, 1 = My Events */
  tab: 0 | 1;
  filter: SchoolYearFilter;
  month: Date;
  selectedDay: string | null;
  /** Official DepEd school-calendar entries by day key. */
  deped: Map<string, DepedEntry[]>;
}

/** Event Calendar: proposals by status, approval actions, drafts and a month calendar. */
export class EventsController extends BaseController<EventsState> {
  constructor(private readonly services: Services, private readonly user: User | null) {
    super({ events: [], loading: true, tab: 0, filter: SchoolYearFilter.current, month: new Date(), selectedDay: null, deped: new Map() });
  }

  async load() {
    void this.services.deped.list().then((d) => this.setState({ deped: DepedEntry.byDay(d) }), () => undefined);
    try {
      const sy = this.state.filter.schoolYear;
      this.setState({ events: await this.services.events.list(sy === 'current' ? null : sy), loading: false });
    } catch {
      this.setState({ loading: false });
    }
  }

  setTab(tab: 0 | 1) { this.setState({ tab }); }
  setFilter(filter: SchoolYearFilter) { this.setState({ filter }); void this.load(); }
  setMonth(month: Date) { this.setState({ month }); }
  selectDay(selectedDay: string | null) { this.setState({ selectedDay }); }

  // Permissions come from the backend, which enforces them on every action.
  get canManage() { return this.user?.can('manage_events') ?? false; }
  get canApprove() { return this.user?.can('approve_events') ?? false; }
  /** Oversight-only accounts approve but don't propose events. */
  get isPrincipal() { return this.canApprove && !this.canManage; }

  find(id: number) { return this.state.events.find((e) => e.id === id) ?? null; }

  /** On the calendar and in the lists: not disabled, drafts or returned to the proponent. */
  get active() { return this.state.events.filter((e) => !e.isInactive); }
  /** Rejected / revisions requested: the proponent's to revise (approvers see them all). */
  get returned() { return this.state.events.filter((e) => e.isReturned && (this.canApprove || e.createdBy === this.user?.id)); }
  get disabled() { return this.state.events.filter((e) => e.isDisabled); }
  get drafts() { return this.state.events.filter((e) => e.isDraft && e.createdBy === this.user?.id); }

  private get filteredActive() {
    return this.state.tab === 1 ? this.active.filter((e) => e.createdBy === this.user?.id) : this.active;
  }

  get approved() { return this.filteredActive.filter((e) => e.isApproved); }
  /** Set by the server once an approved event's last session has ended. */
  get completed() { return this.filteredActive.filter((e) => e.isCompleted); }
  get pending() { return this.filteredActive.filter((e) => e.isPending); }

  /** Active events by day key, for calendar dots. */
  get byDay(): Map<string, EventItem[]> {
    const map = new Map<string, EventItem[]>();
    for (const e of this.active) {
      const d = e.date;
      if (!d) continue;
      const k = Format.isoDate(d);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }

  private replace(id: number, status: string) {
    this.setState((s) => ({ events: s.events.map((e) => (e.id === id ? new EventItem({ ...e.raw, status }) : e)) }));
  }

  /** Returns the confirmation to show: committee tasks assigned, top scores credited, who was missed. */
  async approve(e: EventItem): Promise<string> {
    const r = await this.services.events.approve(e.id);
    this.replace(e.id, 'approved');
    return approvalMessage(r);
  }

  /** Reject or request revisions (the comment is required); returns the server's message. */
  async sendBack(e: EventItem, decision: 'rejected' | 'revisions_requested', comment: string): Promise<string> {
    const msg = await this.services.events.sendBack(e.id, decision, comment);
    this.replace(e.id, decision);
    return msg;
  }
  async disable(e: EventItem) { await this.services.events.disable(e.id); this.replace(e.id, 'disabled'); }
  async enable(e: EventItem) { await this.services.events.enable(e.id); this.replace(e.id, 'pending_approval'); }

  async deleteDraft(e: EventItem) {
    await this.services.events.remove(e.id);
    this.setState((s) => ({ events: s.events.filter((x) => x.id !== e.id) }));
  }

  static description(e: EventItem): string {
    return String(e.raw.rationale ?? e.raw.title ?? '');
  }

  depedOn(key: string): DepedEntry[] { return this.state.deped.get(key) ?? []; }

  /** Hover text for a day: its events, then its DepEd memo dates. */
  dayTooltip(key: string): string | null {
    const evs = this.byDay.get(key) ?? [];
    const parts = [evs.length ? EventsController.tooltip(evs) : '', DepedEntry.tooltip(this.depedOn(key))].filter(Boolean);
    return parts.length ? parts.join('\n\n') : null;
  }

  static tooltip(events: EventItem[]): string {
    return events.map((e) => {
      const lines = [e.title];
      if (e.targetDate?.trim()) lines.push(`When: ${e.targetDate.trim()}`);
      if (e.venue?.trim()) lines.push(`Where: ${e.venue.trim()}`);
      return lines.join('\n');
    }).join('\n\n');
  }
}
