import { Json, JsonReader as R } from './json';
import { User } from './User';

export type TaskCategory = 'common' | 'special';

export class TaskFile {
  constructor(readonly id: number | null, readonly fileType: string, readonly name: string, readonly url: string) {}

  static fromJson(j: Json): TaskFile {
    return new TaskFile(R.optNum(j.id), R.str(j.attachment_type ?? j.file_type, 'file'), R.str(j.name), R.str(j.url));
  }
}

export class Report {
  constructor(
    readonly id: number,
    readonly taskId: number,
    readonly personnelId: number,
    readonly reportTitle: string,
    readonly reportDescription: string | null,
    readonly reportType: string | null,
    readonly reportLinkUrl: string | null,
    readonly reportFilePath: string | null,
    readonly reportFilename: string | null,
    readonly reportDate: string,
    readonly reportStatus: string,
    readonly fullName: string | null,
    readonly avatarUrl: string | null,
    readonly gradeLevel: string | null,
  ) {}

  static fromJson(j: Json): Report {
    return new Report(
      R.num(j.id),
      R.num(j.task_id),
      R.num(j.personnel_id),
      R.str(j.report_title),
      R.optStr(j.report_description),
      R.optStr(j.report_type),
      R.optStr(j.report_link_url),
      R.optStr(j.report_file_path),
      R.optStr(j.report_filename),
      R.str(j.report_date),
      R.str(j.report_status, 'Pending'),
      R.optStr(j.full_name),
      R.optStr(j.avatar_url),
      R.optStr(j.grade_level),
    );
  }
}

export class Comment {
  constructor(
    readonly id: number,
    readonly userId: number,
    readonly fullName: string,
    readonly content: string,
    /** public | private */
    readonly commentType: string,
    readonly createdAt: string,
    readonly reportId: number | null,
  ) {}

  static fromJson(j: Json): Comment {
    return new Comment(
      R.num(j.id),
      R.num(j.user_id),
      R.str(j.full_name),
      R.str(j.content),
      R.str(j.comment_type, 'public'),
      R.str(j.created_at),
      R.optNum(j.report_id),
    );
  }
}

export class Task {
  id = 0;
  title = '';
  subject: string | null = null;
  startDate: string | null = null;
  endDate: string | null = null;
  dueTime: string | null = null;
  instructions: string | null = null;
  status = 'active';
  taskCategory: TaskCategory = 'common';
  submissionCount = 0;
  assignedUsers: User[] = [];
  publicComments: Comment[] = [];
  privateComments: Comment[] = [];
  myReport: Report | null = null;
  pointsEarly = 100;
  pointsOntime = 100;
  pointsLate24 = 50;
  pointsAfter24 = 0;
  submissionStatus: string | null = null;
  teamTotal: number | null = null;
  teamSubmitted: number | null = null;
  reports: Report[] = [];
  /** Assignees who have submitted (task log or report), for reviewers. */
  submittedAssigneeIds = new Set<number>();
  /** Server-decided: may the current user edit/disable/delete this task. */
  canEdit = false;
  /** Who assigned each assignee (user id → assigner id). */
  assignedByOf = new Map<number, number | null>();
  /** Whose progress teamTotal/teamSubmitted cover: 'all' or 'mine'. */
  teamScope: string | null = null;
  /** Role each assignee received the task as (user id → role). */
  assignedRoleOf = new Map<number, string | null>();

  static fromJson(j: Json): Task {
    const t = new Task();
    t.id = R.num(j.id);
    t.title = R.str(j.title);
    t.subject = R.optStr(j.subject);
    t.startDate = R.optStr(j.start_date);
    t.endDate = R.optStr(j.end_date);
    t.dueTime = R.optStr(j.due_time);
    t.instructions = R.optStr(j.instructions);
    t.status = R.str(j.status, 'active');
    t.taskCategory = (R.str(j.task_category, 'common') as TaskCategory);
    t.submissionCount = R.num(j.submission_count);
    const raw: Json[] = Array.isArray(j.assigned_users) ? j.assigned_users : [];
    t.assignedUsers = R.list(raw, User.fromJson);
    for (const u of raw) {
      const id = R.num(u.id);
      if (R.bool(u.submitted)) t.submittedAssigneeIds.add(id);
      t.assignedByOf.set(id, R.optNum(u.assigned_by));
      t.assignedRoleOf.set(id, R.optStr(u.assigned_role ?? u.target_role));
    }
    t.publicComments = R.list(j.public_comments, Comment.fromJson);
    t.privateComments = R.list(j.private_comments, Comment.fromJson);
    const mine = R.obj(j.my_report);
    t.myReport = mine ? Report.fromJson(mine) : null;
    t.pointsEarly = R.num(j.points_early, 100);
    t.pointsOntime = R.num(j.points_ontime, 100);
    t.pointsLate24 = R.num(j.points_late24, 50);
    t.pointsAfter24 = R.num(j.points_after24, 0);
    t.submissionStatus = R.optStr(j.submission_status);
    t.teamTotal = R.optNum(j.team_total ?? j.teacher_total);
    t.teamSubmitted = R.optNum(j.team_submitted ?? j.teacher_submitted);
    t.reports = R.list(j.reports, Report.fromJson);
    t.canEdit = j.can_edit === true;
    t.teamScope = R.optStr(j.team_scope);
    return t;
  }

  get isSpecial() { return this.taskCategory === 'special'; }

  /** Recorded in the task log without a report (e.g. marked done before reports existed). */
  get isLoggedOnly(): boolean {
    return this.myReport === null && this.submissionStatus === 'submitted';
  }

  get isSubmitted(): boolean {
    return this.submissionStatus === 'submitted' || this.myReport !== null;
  }

  /**
   * When the task is due: endDate at dueTime ('5:00 PM'), or the end of endDate
   * when no time is set. Mirrors task_deadline in the backend (date_utils.py).
   */
  get deadline(): Date | null {
    const end = this.endDate;
    if (!end) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(end);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
    const t = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec((this.dueTime ?? '').trim());
    if (!t) return new Date(y, mo, d, 23, 59, 59);
    let h = Number(t[1]) % 12;
    if (t[3].toUpperCase() === 'PM') h += 12;
    return new Date(y, mo, d, h, Number(t[2]));
  }

  /** Unsubmitted and past its deadline. */
  get isOverdue(): boolean {
    const dl = this.deadline;
    return !this.isSubmitted && dl !== null && dl.getTime() < Date.now();
  }

  get isDisabled() { return this.status === 'disabled'; }

  /** "3/5" progress for reviewers, or null when not tracked. */
  get progressLabel(): string | null {
    if (this.teamTotal === null) return null;
    return `${this.teamSubmitted ?? 0}/${this.teamTotal}`;
  }
}

export class TaskTemplate {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly instructions: string | null,
    readonly startDate: string | null,
    readonly endDate: string | null,
    readonly dueTime: string | null,
    readonly pointsEarly: number,
    readonly pointsOntime: number,
    readonly pointsLate24: number,
    readonly pointsAfter24: number,
    readonly createdByName: string | null,
  ) {}

  static fromJson(j: Json): TaskTemplate {
    return new TaskTemplate(
      R.num(j.id),
      R.str(j.title),
      R.optStr(j.instructions),
      R.optStr(j.start_date),
      R.optStr(j.end_date),
      R.optStr(j.due_time),
      R.num(j.points_early, 100),
      R.num(j.points_ontime, 100),
      R.num(j.points_late24, 50),
      R.num(j.points_after24, 0),
      R.optStr(j.created_by_name),
    );
  }
}

/** Fields for creating / editing a task (POST/PUT /api/tasks). */
export interface TaskDraft {
  title: string;
  instructions?: string;
  start_date?: string | null;
  end_date?: string | null;
  due_time?: string | null;
  task_category?: TaskCategory;
  points_early?: number;
  points_ontime?: number;
  points_late24?: number;
  points_after24?: number;
  status?: string;
  attachments?: { attachment_type: string; name: string; url: string }[];
  [key: string]: unknown;
}
