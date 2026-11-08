import { PagedListController, PagedState } from './PagedListController';
import { Services } from '../services';
import { PageResult, User } from '../models';

export interface PersonnelState extends PagedState<User> {
  search: string;
  /** 0 = Academic Delegation, 1 = Personal Information */
  tab: 0 | 1;
}

/**
 * Personnel list (registrar / principal / admin). The last unfiltered first
 * page is cached across visits so the tab opens instantly, then refreshes.
 */
export class PersonnelController extends PagedListController<User, PersonnelState> {
  private static cache: { items: User[]; hasMore: boolean } | null = null;

  constructor(private readonly services: Services, private readonly me: User | null) {
    const cached = PersonnelController.cache;
    super({
      items: cached?.items ?? [], loading: !cached, loadingMore: false, hasMore: cached?.hasMore ?? true, error: null, search: '', tab: 0,
    });
  }

  protected fetchPage(offset: number, limit: number): Promise<PageResult<User>> {
    return this.services.personnel.page({ search: this.state.search, limit, offset });
  }

  protected override onLoaded(items: User[]) {
    if (!this.state.search) PersonnelController.cache = { items, hasMore: this.state.hasMore };
  }

  /** Initial load: quiet when the cache is showing. */
  start() { void this.load(this.state.items.length > 0); }

  search(search: string) {
    this.setState({ search });
    const cached = !search ? PersonnelController.cache : null;
    if (cached) this.setState({ items: cached.items, hasMore: cached.hasMore });
    void this.load(!!cached);
  }

  setTab(tab: 0 | 1) { this.setState({ tab }); }

  get active() { return this.state.items.filter((u) => u.isActive); }
  get inactive() { return this.state.items.filter((u) => !u.isActive); }

  /** Principal/admin add users and change roles/delegations. */
  get canWrite() { return this.me?.can('manage_personnel') ?? false; }
  /** The registrar may only deactivate / reactivate (enforced server-side). */
  get canToggle() { return this.me?.can('deactivate_personnel') ?? false; }
  get canReviewCertificates() { return this.me?.can('review_certificates') ?? false; }
  get canViewAudit() { return this.me?.can('view_audit') ?? false; }

  /** Decided per account by the backend (self, principal/admin rules live in Python). */
  canToggleUser(u: User): boolean {
    return u.canToggleStatus;
  }

  isMe(u: User) { return this.me?.id === u.id; }

  async toggleStatus(u: User) {
    await this.services.personnel.toggleStatus(u.id);
    await this.load(true);
  }

  // ── Table cells ──
  static subjects(u: User): string {
    const s = [...new Set(u.subjects.map((x) => x.subject))];
    return s.length ? s.join(', ') : '—';
  }

  /** Dean's grade, else the grades of their subject rows, else the advisory grade. */
  static grades(u: User): string {
    const sg = [...new Set(u.subjects.map((x) => x.gradeLevel).filter((g): g is string => !!g))].sort();
    if (u.role === 'dean' && u.deanGradeLevel) return u.deanGradeLevel;
    return sg.length ? sg.join(', ') : u.gradeLevel ?? '—';
  }

  static subjectAssignments(u: User): string {
    return u.subjects.length ? u.subjects.map((s) => (s.gradeLevel ? `${s.subject} (${s.gradeLevel})` : s.subject)).join(', ') : '—';
  }

  static assignmentLabel(u: User): string | null {
    if (u.role === 'coordinator') return u.coordinatorType ?? 'Coordinator';
    if (u.role === 'dean') return u.deanGradeLevel ? `Dean — ${u.deanGradeLevel}` : 'Dean';
    return null;
  }

  /** Skills grouped by category ("Other" last). */
  static groupedSkills(u: User): { category: string; items: string }[] {
    const groups = new Map<string, string[]>();
    for (const s of u.skillDetails) groups.set(s.category ?? 'Other', [...(groups.get(s.category ?? 'Other') ?? []), s.name]);
    return [...groups.keys()]
      .sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
      .map((k) => ({ category: k, items: groups.get(k)!.join(', ') }));
  }
}

export * from './AddUserController';
export * from './EditRoleController';
