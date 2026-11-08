import { BaseController } from './BaseController';
import { Services } from '../services';
import { DEPED_CATEGORIES, DepedEntry, User } from '../models';
import { Format } from '../utils/format';

// The DepEd school calendar: the list (principal/admin manage it), the entry
// form, and turning an entry into a mandatory compliance task for faculty.

export interface DepedListState { entries: DepedEntry[]; loading: boolean; error: string | null }

export class DepedCalendarController extends BaseController<DepedListState> {
  constructor(private readonly services: Services, private readonly user: User | null) {
    super({ entries: [], loading: true, error: null });
  }

  /** Decided by the backend (permission `manage_deped_calendar`); the server enforces it too. */
  get canManage(): boolean { return this.user?.can('manage_deped_calendar') ?? false; }

  async load() {
    try {
      this.setState({ entries: await this.services.deped.list(), loading: false, error: null });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e) });
    }
  }

  async remove(e: DepedEntry) {
    await this.services.deped.remove(e.id);
    this.setState((s) => ({ entries: s.entries.filter((x) => x.id !== e.id) }));
  }

  /** Upcoming entries first (soonest first), then past ones (most recent first). */
  get ordered(): DepedEntry[] {
    const today = Format.isoDate(new Date());
    const all = this.state.entries;
    return [...all.filter((e) => e.endDate >= today), ...all.filter((e) => e.endDate < today).reverse()];
  }
}

export interface DepedEntryForm {
  title: string; description: string; startDate: string; endDate: string; category: string; isMandatory: boolean; saving: boolean;
}

export class DepedEntryFormController extends BaseController<DepedEntryForm> {
  constructor(private readonly services: Services, readonly existing: DepedEntry | null) {
    super({
      title: existing?.title ?? '', description: existing?.description ?? '', startDate: existing?.startDate ?? '',
      endDate: existing?.endDate ?? '', category: existing?.category ?? DEPED_CATEGORIES[0], isMandatory: existing?.isMandatory ?? true, saving: false,
    });
  }

  set(patch: Partial<Omit<DepedEntryForm, 'saving'>>) {
    this.setState((s) => {
      const next = { ...s, ...patch };
      // An end before the start follows the start.
      if (next.endDate && next.startDate && next.endDate < next.startDate) next.endDate = next.startDate;
      return next;
    });
  }

  get canSave(): boolean { return !!this.state.title.trim() && !!this.state.startDate && !this.state.saving; }

  /** Throws with the server's reason. */
  async save(): Promise<DepedEntry> {
    const s = this.state;
    this.setState({ saving: true });
    try {
      return await this.services.deped.save(this.existing?.id ?? null, {
        title: s.title.trim(), description: s.description.trim() || null, start_date: s.startDate,
        end_date: s.endDate || s.startDate, category: s.category, is_mandatory: s.isMandatory,
      });
    } finally {
      this.setState({ saving: false });
    }
  }
}

export interface DepedTaskForm {
  entries: DepedEntry[]; entryId: number | null; title: string; instructions: string; dueDate: string; roles: string[]; busy: boolean;
}

export class DepedTaskController extends BaseController<DepedTaskForm> {
  constructor(private readonly services: Services) {
    super({ entries: [], entryId: null, title: '', instructions: '', dueDate: '', roles: ['teacher'], busy: false });
  }

  async load() {
    try {
      const all = await this.services.deped.list();
      const today = Format.isoDate(new Date());
      this.setState({ entries: [...all.filter((e) => e.endDate >= today), ...all.filter((e) => e.endDate < today).reverse()] });
    } catch { /* the picker stays empty */ }
  }

  /** Picking an entry suggests its title and due date (its last day). */
  pick(entryId: number | null) {
    const e = this.state.entries.find((x) => x.id === entryId);
    this.setState((s) => ({ entryId, title: s.title.trim() || !e ? s.title : e.title, dueDate: e ? e.endDate : s.dueDate }));
  }

  set(patch: Partial<Pick<DepedTaskForm, 'title' | 'instructions' | 'dueDate'>>) { this.setState(patch); }

  toggleRole(role: string) {
    this.setState((s) => ({ roles: s.roles.includes(role) ? s.roles.filter((r) => r !== role) : [...s.roles, role] }));
  }

  get canGenerate(): boolean {
    const s = this.state;
    return s.entryId !== null && !!s.title.trim() && s.roles.length > 0 && !s.busy;
  }

  /** Returns how many faculty received the task; throws with the server's reason. */
  async generate(): Promise<number> {
    const s = this.state;
    this.setState({ busy: true });
    try {
      return await this.services.deped.generateTasks(s.entryId!, {
        title: s.title.trim(), instructions: s.instructions.trim() || null, due_date: s.dueDate || null, roles: s.roles,
      });
    } finally {
      this.setState({ busy: false });
    }
  }
}
