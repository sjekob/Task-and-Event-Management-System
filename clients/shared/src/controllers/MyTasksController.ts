import { PagedListController, PagedState } from './PagedListController';
import { Services } from '../services';
import { PageResult, SchoolYearFilter, Task, TaskCategory } from '../models';
import { Format } from '../utils/format';

export type StatusFilter = 'all' | 'pending' | 'submitted';

export interface MyTasksState extends PagedState<Task> {
  search: string;
  status: StatusFilter;
  filter: SchoolYearFilter;
}

/** Tasks assigned to the signed-in person (My Tasks / My Special Tasks). */
export class MyTasksController extends PagedListController<Task, MyTasksState> {
  constructor(private readonly services: Services, readonly category: TaskCategory) {
    super({ items: [], loading: true, loadingMore: false, hasMore: true, error: null, search: '', status: 'all', filter: SchoolYearFilter.current });
  }

  protected fetchPage(offset: number, limit: number): Promise<PageResult<Task>> {
    return this.services.tasks.assignedPage({ category: this.category, limit, offset, filter: this.state.filter });
  }

  setSearch(search: string) { this.setState({ search }); }
  setStatus(status: StatusFilter) { this.setState({ status }); }

  setFilter(filter: SchoolYearFilter) {
    this.setState({ filter });
    void this.load();
  }

  get filtered(): Task[] {
    const q = this.state.search.trim().toLowerCase();
    return this.state.items.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (this.state.status === 'pending' && t.isSubmitted) return false;
      if (this.state.status === 'submitted' && !t.isSubmitted) return false;
      return true;
    });
  }

  get title() { return this.category === 'special' ? 'My Special Tasks' : 'My Tasks'; }

  get subtitle() {
    return this.category === 'special'
      ? 'Track special tasks assigned to you and submit reports on time.'
      : 'Track your assigned tasks and submit reports on time.';
  }

  get emptyText() { return this.state.items.length ? 'No tasks match your filter.' : 'No tasks assigned yet.'; }

  static dueText(t: Task): string | null {
    return t.endDate ? `Due ${Format.date(t.endDate)}` : null;
  }

  static preview(t: Task): string {
    const s = (t.instructions ?? '').replace(/\n/g, ' ');
    return s.length > 80 ? `${s.slice(0, 80)}...` : s;
  }
}
