import { BaseController } from './BaseController';
import { Services } from '../services';
import { Task, User } from '../models';

export interface AssignMoreState {
  role: string;
  available: User[];
  loading: boolean;
  error: string | null;
}

/** "Assign" on an existing task: people with the chosen role not yet assigned. */
export class AssignMoreController extends BaseController<AssignMoreState> {
  constructor(private readonly services: Services, readonly task: Task, readonly roles: string[]) {
    super({ role: roles[0] ?? 'teacher', available: [], loading: true, error: null });
    void this.load();
  }

  setRole(role: string) {
    if (role === this.state.role) return;
    this.setState({ role, loading: true, available: [] });
    void this.load();
  }

  private async load() {
    try {
      const users = await this.services.tasks.assignableUsers(this.state.role);
      const assigned = new Set(this.task.assignedUsers.map((u) => u.id));
      this.setState({ available: users.filter((u) => !assigned.has(u.id)), loading: false, error: null });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e) });
    }
  }

  get hasTaskText() { return !!(this.task.title.trim() || (this.task.instructions ?? '').trim()); }

  loadSuggestions = () => this.services.tasks.suggestions({
    targetRole: this.state.role,
    title: this.task.title,
    instructions: this.task.instructions ?? '',
    taskCategory: this.task.taskCategory,
    startDate: this.task.startDate,
    endDate: this.task.endDate,
    dueTime: this.task.dueTime,
  });

  /** Returns how many were skipped. */
  assign = (ids: Set<number>) => this.services.tasks.assign(this.task.id, [...ids], this.state.role);
}
