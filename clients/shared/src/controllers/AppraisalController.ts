import { BaseController } from './BaseController';
import { Services } from '../services';
import { EventForAppraisal, Json, SchoolYearFilter, SpecialTask, User } from '../models';

export type AppraisalTab = 'timing' | 'special' | 'events' | 'badges' | 'analytics';

export const APPRAISAL_TAB_LABELS: Record<AppraisalTab, string> = {
  timing: 'Timing Points', special: 'Special Tasks', events: 'Events', badges: 'Badges', analytics: 'Analytics',
};

export interface Slice<T> { items: T[]; loading: boolean; error: string | null }

export interface AppraisalState {
  tab: AppraisalTab;
  filter: SchoolYearFilter;
  submissions: Slice<Json>;
  tasks: Slice<SpecialTask>;
  events: Slice<EventForAppraisal>;
}

export const empty = <T>(): Slice<T> => ({ items: [], loading: true, error: null });

/** Performance Appraisal: timing points, special-task ratings, event evaluations, badges and analytics. */
export class AppraisalController extends BaseController<AppraisalState> {
  readonly tabs: AppraisalTab[];

  constructor(private readonly services: Services, private readonly user: User | null) {
    super({ tab: 'timing', filter: SchoolYearFilter.current, submissions: empty(), tasks: empty(), events: empty() });
    // Without school-wide access people see their own / grade-level records and no Analytics.
    this.tabs = user?.can('view_all_appraisals')
      ? ['timing', 'special', 'events', 'badges', 'analytics']
      : ['timing', 'special', 'events', 'badges'];
  }

  /** Principal/admin aren't appraised themselves. */
  get showOwnBadges() { return this.user?.can('receive_tasks') ?? false; }
  get showLeaderboard() { return this.user?.can('evaluate_appraisal') ?? false; }

  load() {
    void this.loadSubmissions();
    void this.loadTasks();
    void this.loadEvents();
  }

  private async slice<K extends 'submissions' | 'tasks' | 'events'>(key: K, fetch: () => Promise<AppraisalState[K]['items']>) {
    this.setState({ [key]: { ...this.state[key], loading: true, error: null } } as Partial<AppraisalState>);
    try {
      const items = await fetch();
      this.setState({ [key]: { items, loading: false, error: null } } as Partial<AppraisalState>);
    } catch (e) {
      this.setState({ [key]: { ...this.state[key], loading: false, error: BaseController.messageOf(e) } } as Partial<AppraisalState>);
    }
  }

  loadSubmissions() { return this.slice('submissions', () => this.services.appraisal.reportSubmissions(this.state.filter)); }
  loadTasks() { return this.slice('tasks', () => this.services.appraisal.specialTasks(this.state.filter)); }
  /** The Annual Faculty Performance Summary for the selected school year / term. */
  performanceSummary() { return this.services.appraisal.performanceSummary(this.state.filter); }

  loadEvents() { return this.slice('events', () => this.services.appraisal.events(this.state.filter)); }

  setTab(tab: AppraisalTab) { this.setState({ tab }); }

  setFilter(filter: SchoolYearFilter) {
    if (filter.equals(this.state.filter)) return;
    this.setState({ filter });
    this.load();
  }

  /** Red counters on the tab bar. */
  badgeCount(tab: AppraisalTab): number {
    if (tab === 'special') return this.state.tasks.items.filter((t) => t.status === 'pending').length;
    if (tab === 'events') return this.state.events.items.filter((e) => e.status === 'pending' || e.status === 'upcoming').length;
    return 0;
  }

  replaceTask(t: SpecialTask) {
    this.setState((s) => ({ tasks: { ...s.tasks, items: s.tasks.items.map((x) => (x.id === t.id ? t : x)) } }));
  }

  replaceEvent(e: EventForAppraisal) {
    this.setState((s) => ({ events: { ...s.events, items: s.events.items.map((x) => (x.id === e.id ? e : x)) } }));
  }
}
