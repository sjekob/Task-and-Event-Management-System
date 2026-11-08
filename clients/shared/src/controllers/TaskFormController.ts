import { BaseController } from './BaseController';
import { Services, FilePart } from '../services';
import { Task, TaskCategory, TaskTemplate, User } from '../models';
import { Format } from '../utils/format';
import { Attachment } from './attachments';

export interface TaskFormState {
  title: string;
  instructions: string;
  /** "YYYY-MM-DD" */
  startDate: string | null;
  endDate: string | null;
  /** "h:mm AM" */
  dueTime: string | null;
  category: TaskCategory;
  /** Identity assignees receive the task as. */
  targetRole: string | null;
  assignable: User[];
  loadingUsers: boolean;
  selectedIds: Set<number>;
  attachments: Attachment[];
  uploading: boolean;
  submitting: boolean;
  error: string | null;
}

export type TaskFormMode = { kind: 'create'; lockedCategory?: TaskCategory } | { kind: 'template' } | { kind: 'edit'; task: Task };

/**
 * Create task / create template / edit task. Assignment changes on edit go
 * through the assign endpoints, which enforce the role hierarchy.
 */
export class TaskFormController extends BaseController<TaskFormState> {
  private readonly originalIds: Set<number>;
  /** Edit: identity each newly added person receives the task as. */
  private readonly addedAs = new Map<number, string>();

  constructor(private readonly services: Services, private readonly user: User | null, readonly mode: TaskFormMode) {
    const task = mode.kind === 'edit' ? mode.task : null;
    const roles = user?.assignableRoles ?? [];
    super({
      title: task?.title ?? '',
      instructions: task?.instructions ?? '',
      startDate: task?.startDate?.slice(0, 10) ?? null,
      endDate: task?.endDate?.slice(0, 10) ?? null,
      dueTime: task?.dueTime ?? null,
      category: task?.taskCategory ?? (mode.kind === 'create' ? mode.lockedCategory ?? 'common' : 'common'),
      targetRole: roles[0] ?? null,
      assignable: [],
      loadingUsers: mode.kind !== 'template',
      selectedIds: new Set(task?.assignedUsers.map((u) => u.id) ?? []),
      attachments: [],
      uploading: false,
      submitting: false,
      error: null,
    });
    this.originalIds = new Set(this.state.selectedIds);
    if (mode.kind !== 'template') void this.loadUsers();
  }

  get isTemplate() { return this.mode.kind === 'template'; }
  get isEdit() { return this.mode.kind === 'edit'; }
  get isSpecial() { return this.mode.kind === 'create' && this.mode.lockedCategory === 'special'; }
  get roleOptions(): string[] { return this.isTemplate ? [] : this.user?.assignableRoles ?? []; }

  get pageTitle() {
    if (this.isEdit) return 'Edit Task';
    return this.isTemplate ? 'Create Template' : this.isSpecial ? 'Create Special Task' : 'Create Task';
  }

  get subtitle() {
    if (this.isEdit) return 'Change the details, schedule or who is assigned.';
    if (this.isTemplate) return 'Save a reusable task outline.';
    return this.isSpecial
      ? 'Special tasks are appraised separately from regular duties.'
      : 'Describe the task, set when it is due, then choose who does it.';
  }

  get submitLabel() {
    if (this.isEdit) return 'Save changes';
    return this.isTemplate ? 'Save template' : this.isSpecial ? 'Create special task' : 'Create task';
  }

  private async loadUsers() {
    try {
      const assignable = await this.services.tasks.assignableUsers(this.state.targetRole);
      this.setState({ assignable, loadingUsers: false });
    } catch {
      // Who may be assigned is decided by the server only.
      this.setState({ assignable: [], loadingUsers: false });
    }
  }

  setTitle(title: string) { this.setState({ title }); }
  setInstructions(instructions: string) { this.setState({ instructions }); }
  setStartDate(startDate: string | null) { this.setState({ startDate: startDate || null }); }
  setEndDate(endDate: string | null) { this.setState({ endDate: endDate || null }); }
  /** Accepts "HH:MM" (24h, from a time input) or "h:mm AM". */
  setDueTime(t: string | null) { this.setState({ dueTime: !t ? null : /[AP]M$/i.test(t) ? t : Format.to12h(t) }); }

  setTargetRole(role: string) {
    if (role === this.state.targetRole) return;
    // Creating: the selection depends on the role, so start over. Editing:
    // people already assigned stay assigned; the role only filters who can be added.
    this.setState({ targetRole: role, loadingUsers: true, ...(this.isEdit ? {} : { selectedIds: new Set<number>() }) });
    void this.loadUsers();
  }

  setSelected(ids: Set<number>) {
    if (this.isEdit) {
      for (const id of ids) {
        if (!this.originalIds.has(id) && this.state.targetRole && !this.addedAs.has(id)) this.addedAs.set(id, this.state.targetRole);
      }
      for (const id of [...this.addedAs.keys()]) if (!ids.has(id)) this.addedAs.delete(id);
    }
    this.setState({ selectedIds: new Set(ids) });
  }

  unselect(id: number) {
    const ids = new Set(this.state.selectedIds);
    ids.delete(id);
    this.setSelected(ids);
  }

  /** Selected people, including assignees no longer in the assignable list. */
  get selectedUsers(): User[] {
    const { assignable, selectedIds } = this.state;
    const inList = assignable.filter((u) => selectedIds.has(u.id));
    const task = this.mode.kind === 'edit' ? this.mode.task : null;
    const extra = task?.assignedUsers.filter((u) => selectedIds.has(u.id) && !assignable.some((a) => a.id === u.id)) ?? [];
    return [...inList, ...extra];
  }

  get hasTaskText() {
    return !!(this.state.title.trim() || this.state.instructions.trim());
  }

  loadSuggestions = () => this.services.tasks.suggestions({
    targetRole: this.state.targetRole,
    title: this.state.title,
    instructions: this.state.instructions,
    taskCategory: this.state.category,
    startDate: this.state.startDate,
    endDate: this.state.endDate,
    dueTime: this.state.dueTime,
  });

  // ── Attachments ──
  addAttachment(a: Attachment) { this.setState((s) => ({ attachments: [...s.attachments, a] })); }
  removeAttachment(i: number) { this.setState((s) => ({ attachments: s.attachments.filter((_, j) => j !== i) })); }

  async uploadAttachment(file: FilePart) {
    this.setState({ uploading: true, error: null });
    try {
      const info = await this.services.tasks.uploadAttachment(file);
      this.addAttachment({ attachment_type: 'file', name: info.name, url: info.url });
    } catch (e) {
      this.setState({ error: `File upload failed: ${BaseController.messageOf(e)}` });
      throw e;
    } finally {
      this.setState({ uploading: false });
    }
  }

  applyTemplate(t: TaskTemplate) {
    this.setState({
      title: t.title,
      instructions: t.instructions ?? '',
      startDate: t.startDate?.slice(0, 10) ?? this.state.startDate,
      endDate: t.endDate?.slice(0, 10) ?? this.state.endDate,
      dueTime: t.dueTime ?? this.state.dueTime,
    });
  }

  /**
   * Saves. Returns a warning message (e.g. people skipped by the hierarchy) or
   * null; throws with a readable message on failure.
   */
  async submit(): Promise<string | null> {
    const s = this.state;
    const title = s.title.trim();
    if (!title) {
      const msg = `${this.isTemplate ? 'Template' : 'Task'} title is required`;
      this.setState({ error: msg });
      throw new Error(msg);
    }
    this.setState({ submitting: true, error: null });
    const common = {
      title,
      ...(s.instructions.trim() ? { instructions: s.instructions.trim() } : {}),
      ...(s.startDate ? { start_date: s.startDate } : {}),
      ...(s.endDate ? { end_date: s.endDate } : {}),
      ...(s.dueTime ? { due_time: s.dueTime } : {}),
    };
    try {
      if (this.mode.kind === 'template') {
        await this.services.tasks.createTemplate(common);
        return null;
      }
      if (this.mode.kind === 'create') {
        await this.services.tasks.create({
          ...common,
          task_category: s.category,
          ...(s.targetRole ? { target_role: s.targetRole } : {}),
          assigned_user_ids: [...s.selectedIds],
          attachments: s.attachments,
        });
        return null;
      }
      const taskId = this.mode.task.id;
      await this.services.tasks.update(taskId, { ...common, ...(s.attachments.length ? { attachments: s.attachments } : {}) });
      const byRole = new Map<string, number[]>();
      this.addedAs.forEach((role, id) => byRole.set(role, [...(byRole.get(role) ?? []), id]));
      let skipped = 0;
      for (const [role, ids] of byRole) skipped += await this.services.tasks.assign(taskId, ids, role);
      for (const id of this.originalIds) if (!s.selectedIds.has(id)) await this.services.tasks.unassign(taskId, id);
      return skipped > 0
        ? `${skipped} ${skipped === 1 ? 'person was' : 'people were'} not assigned — outside what your role may assign.`
        : null;
    } catch (e) {
      const msg = BaseController.messageOf(e, 'Failed to save');
      this.setState({ error: msg });
      throw new Error(msg);
    } finally {
      this.setState({ submitting: false });
    }
  }

  static longDate(iso: string | null): string | null {
    const d = Format.parseDate(iso);
    if (!d) return null;
    const w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return `${w}, ${Format.date(d)}`;
  }
}

export * from './attachments';
export * from './TemplatePickerController';
