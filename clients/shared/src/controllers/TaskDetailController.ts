import { BaseController } from './BaseController';
import { Services } from '../services';
import { Comment, Report, Task, User } from '../models';
import { Format } from '../utils/format';

export type StatusTone = 'green' | 'red' | 'blue' | 'amber' | 'gray';

export interface TaskDetailState {
  task: Task | null;
  loading: boolean;
  error: string | null;
  selectedReportId: number | null;
}

/**
 * One task. Separation of duties is route-based: opened from Task Manager the
 * viewer reviews assignees' work; opened from My Tasks (ownTaskView) they only
 * see and submit their own.
 */
export class TaskDetailController extends BaseController<TaskDetailState> {
  constructor(
    private readonly services: Services,
    readonly user: User,
    readonly taskId: number,
    readonly ownTaskView: boolean,
  ) {
    super({ task: null, loading: true, error: null, selectedReportId: null });
  }

  get canAssign() { return this.user.canAssign && !this.ownTaskView; }
  /** Reviewers by role, and anyone reviewing the people they were assigned, e.g. a class adviser. */
  get canReview() { return (this.user.canReviewSubmissions || this.state.task?.teamScope === 'mine') && !this.ownTaskView; }
  /** The side panel reviews assignees' submissions instead of the viewer's own. */
  get isReviewOnly() { return this.canReview || this.canAssign; }
  get isLeaf() { return this.user.can('receive_tasks'); }

  async load() {
    try {
      const task = await this.services.tasks.get(this.taskId);
      const keep = task.reports.some((r) => r.id === this.state.selectedReportId);
      this.setState({
        task, loading: false, error: null,
        selectedReportId: keep ? this.state.selectedReportId : task.reports[0]?.id ?? null,
      });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e, 'Task not found') });
    }
  }

  get task(): Task { return this.state.task!; }

  get selectedReport(): Report | null {
    return this.state.task?.reports.find((r) => r.id === this.state.selectedReportId) ?? null;
  }

  selectAssignee(u: User) {
    const r = this.reportOf(u.id);
    if (r) this.setState({ selectedReportId: r.id });
  }

  reportOf(userId: number): Report | null {
    return this.state.task?.reports.find((r) => r.personnelId === userId) ?? null;
  }

  get pastDue(): boolean {
    const dl = this.state.task?.deadline;
    return !!dl && dl.getTime() < Date.now();
  }

  /** A coordinator/dean who delegated part of the task tracks the people they assigned. */
  get mineOnly() { return this.state.task?.teamScope === 'mine'; }

  get team(): User[] {
    const t = this.state.task;
    if (!t) return [];
    return this.mineOnly ? t.assignedUsers.filter((u) => t.assignedByOf.get(u.id) === this.user.id) : t.assignedUsers;
  }

  get progress() {
    const t = this.state.task;
    const team = this.team;
    const submitted = team.filter((u) => t?.submittedAssigneeIds.has(u.id)).length;
    const total = team.length;
    const missing = this.pastDue ? total - submitted : 0;
    return { submitted, total, missing, pending: Math.max(0, total - submitted - missing) };
  }

  /** Per-assignee status for reviewers. */
  statusFor(u: User): { label: string; tone: StatusTone } {
    const r = this.reportOf(u.id);
    if (r) {
      if (r.reportStatus === 'Completed') return { label: 'Completed', tone: 'green' };
      if (r.reportStatus === 'Missing') return { label: 'Marked missing', tone: 'red' };
      return { label: 'Pending review', tone: 'blue' };
    }
    if (this.state.task?.submittedAssigneeIds.has(u.id)) return { label: 'Submitted', tone: 'green' };
    return this.pastDue ? { label: 'Missing', tone: 'red' } : { label: 'Not submitted', tone: 'amber' };
  }

  /** The viewer's own status pill (assignees). */
  get ownStatus(): { label: string; tone: StatusTone } | null {
    const t = this.state.task;
    if (!t || !this.isLeaf || this.isReviewOnly) return null;
    if (t.isSubmitted) return { label: 'Submitted', tone: 'green' };
    return this.pastDue ? { label: 'Missing', tone: 'red' } : { label: 'Not submitted', tone: 'amber' };
  }

  get deadlineText(): string {
    const t = this.state.task;
    if (!t?.deadline || !t.endDate) return 'No deadline';
    const time = (t.dueTime ?? '').trim();
    return `${Format.longDate(t.endDate)}${time && time.toUpperCase() !== '11:59 PM' ? `, ${time}` : ''}`;
  }

  get mobileDeadlineText(): string {
    const t = this.state.task;
    return !t?.endDate ? 'No due date' : `Due ${Format.longDate(t.endDate)}, ${t.dueTime ?? '11:59 PM'}`;
  }

  /** Private comments about the selected report: from its submitter or tagged to it. */
  privateCommentsFor(r: Report): Comment[] {
    return (this.state.task?.privateComments ?? []).filter((c) => c.userId === r.personnelId || (c.reportId !== null && c.reportId === r.id));
  }

  isMine(c: Comment) { return c.userId === this.user.id; }

  // ── Actions (each reloads the task) ──
  async addComment(content: string, type: 'public' | 'private', reportId?: number | null) {
    await this.services.tasks.addComment(this.taskId, content, type, reportId);
    await this.load();
  }

  async editComment(id: number, content: string) {
    await this.services.tasks.editComment(id, content);
    await this.load();
  }

  async deleteComment(id: number) {
    await this.services.tasks.deleteComment(id);
    await this.load();
  }

  async setReportStatus(reportId: number, status: 'Completed' | 'Missing') {
    await this.services.tasks.setReportStatus(reportId, status);
    await this.load();
  }

  async unassign(userId: number) {
    await this.services.tasks.unassign(this.taskId, userId);
    await this.load();
  }

  async unsubmit() {
    const r = this.state.task?.myReport;
    if (!r) return;
    await this.services.tasks.deleteReport(r.id);
    await this.load();
  }

  // ── Points ──
  static pointsTable(t: Task) {
    return [
      { label: 'Early Submission', value: `+${t.pointsEarly}`, tone: 'green' as const },
      { label: 'On Time', value: `+${t.pointsOntime}`, tone: 'blue' as const },
      { label: 'Late (within 24h)', value: `+${t.pointsLate24}`, tone: 'amber' as const },
      { label: 'Late (after 24h)', value: `${t.pointsAfter24}`, tone: 'red' as const },
    ];
  }

  /** Points for the viewer's submission and why. */
  static earned(t: Task, r: Report): { points: number; reason: string } {
    let points = 0;
    const due = Format.parseDate(t.endDate);
    const submitted = Format.parseDate(r.reportDate);
    if (due && submitted) {
      const hours = (submitted.getTime() - due.getTime()) / 3600000;
      points = hours <= -24 ? t.pointsEarly : hours <= 0 ? t.pointsOntime : hours <= 24 ? t.pointsLate24 : t.pointsAfter24;
    }
    const reason = points >= 100 ? 'On time' : points >= 50 ? 'Late (within 24h)' : 'Late (after 24h)';
    return { points, reason };
  }

  static submittedAt(r: Report): string {
    const d = Format.parseDate(r.reportDate);
    return d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}, ${Format.time(d)}` : r.reportDate;
  }
}

export * from './ReportFormController';
export * from './AssignMoreController';
