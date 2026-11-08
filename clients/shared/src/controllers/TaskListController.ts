import { BaseController } from './BaseController';
import { Services } from '../services';
import { SchoolYearFilter, Task, TaskCategory, User } from '../models';
import { Format } from '../utils/format';

export interface TaskListState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  search: string;
  /** Principal/admin: 'mine' = tasks they created, 'all' = every task; 'advisory' = an adviser's class tasks. */
  scope: 'mine' | 'all' | 'advisory';
  filter: SchoolYearFilter;
}

/** Task Manager / Special Tasks: tasks the signed-in person manages. */
export class TaskListController extends BaseController<TaskListState> {
  /**
   * [advisory]: a class adviser's tab — the school-calendar tasks their class's
   * subject teachers submit to them. Read-only: they are posted automatically,
   * never created or assigned here.
   */
  constructor(private readonly services: Services, readonly category: TaskCategory, private readonly user: User | null, readonly advisory = false) {
    super({ tasks: [], loading: true, error: null, search: '', scope: advisory ? 'advisory' : 'mine', filter: SchoolYearFilter.current });
  }

  get canViewAll() { return !this.advisory && (this.user?.can('view_all_tasks') ?? false); }
  /** Where a task opens. */
  get base() { return this.advisory ? '/advisory' : this.category === 'special' ? '/special-tasks' : '/tasks'; }

  async load() {
    this.setState({ loading: this.state.tasks.length === 0, error: null });
    try {
      const all = await this.services.tasks.list({ scope: this.state.scope, filter: this.state.filter });
      this.setState({ tasks: all.filter((t) => t.taskCategory === this.category), loading: false });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e, 'Failed to load tasks') });
    }
  }

  setSearch(search: string) { this.setState({ search }); }

  setScope(scope: TaskListState['scope']) {
    if (scope === this.state.scope) return;
    this.setState({ scope, tasks: [] });
    void this.load();
  }

  setFilter(filter: SchoolYearFilter) {
    this.setState({ filter, tasks: [] });
    void this.load();
  }

  private matches(t: Task) {
    const q = this.state.search.trim().toLowerCase();
    return !q || t.title.toLowerCase().includes(q);
  }

  get active(): Task[] { return this.state.tasks.filter((t) => t.status === 'active' && this.matches(t)); }
  get disabled(): Task[] { return this.state.tasks.filter((t) => t.status !== 'active' && this.matches(t)); }

  async setEnabled(id: number, enabled: boolean) {
    await this.services.tasks.update(id, { status: enabled ? 'active' : 'disabled' });
    await this.load();
  }

  get title(): string {
    if (this.advisory) return 'Advisory';
    if (this.category === 'special') return 'Special Tasks';
    return ['admin', 'principal', 'coordinator', 'dean'].includes(this.user?.role ?? '') ? 'Task Manager' : 'Tasks';
  }

  get subtitle(): string {
    if (this.advisory) return 'Tasks for your class from the school calendar. Your subject teachers submit them to you — review their work here.';
    if (this.category === 'special') return 'Create and manage special tasks. Assign to your team.';
    switch (this.user?.role) {
      case 'admin':
      case 'principal': return 'Create and manage tasks. Assign to your team.';
      case 'coordinator': return 'Manage tasks assigned to you. Reassign to deans or teachers.';
      case 'dean': return 'Manage tasks assigned to you. Assign to your grade-level teachers.';
      default: return 'Tasks assigned to you. Submit reports on time.';
    }
  }

  /** Row presentation shared by the web and mobile cards. */
  static rowInfo(t: Task) {
    const disabled = t.status !== 'active';
    const total = t.teamTotal ?? 0;
    const done = t.teamSubmitted ?? 0;
    const complete = total > 0 && done >= total;
    const dl = t.deadline;
    const overdue = !disabled && !complete && dl !== null && dl.getTime() < Date.now();
    const dot: 'gray' | 'green' | 'red' | 'blue' = disabled ? 'gray' : complete ? 'green' : overdue ? 'red' : 'blue';
    const instructions = (t.instructions ?? '').replace(/\n/g, ' ').trim();
    return {
      disabled, total, done, complete, overdue, dot,
      due: TaskListController.dueText(t),
      instructions: instructions && instructions.toLowerCase() !== t.title.toLowerCase() ? instructions : '',
    };
  }

  static dueText(t: Task): string {
    const dl = t.deadline;
    if (!dl) return 'No deadline';
    const date = Format.date(dl);
    const time = (t.dueTime ?? '').trim();
    return !time || time.toUpperCase() === '11:59 PM' ? `Due ${date}` : `Due ${date}, ${time}`;
  }
}
