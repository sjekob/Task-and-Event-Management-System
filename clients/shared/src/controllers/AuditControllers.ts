import { BaseController } from './BaseController';
import { Services } from '../services';
import { AuditEntry } from '../models';

/** The change history of one record (e.g. a person's account and delegation). */
export class AuditHistoryController extends BaseController<{ items: AuditEntry[] | null; error: string | null }> {
  constructor(services: Services, entityType: string, entityId: number) {
    super({ items: null, error: null });
    services.audit.list({ entityType, entityId, limit: 50 })
      .then((r) => this.setState({ items: r.items }))
      .catch((e) => this.setState({ error: BaseController.messageOf(e) }));
  }
}

/** Category chips on the audit log page: label and action prefix. */
export const AUDIT_FILTERS: { value: string; label: string; action?: string }[] = [
  { value: 'all', label: 'All activity' },
  { value: 'account', label: 'Accounts', action: 'account' },
  { value: 'personnel', label: 'Roles & delegation', action: 'personnel' },
  { value: 'certificate', label: 'Certificates', action: 'certificate' },
  { value: 'school_year', label: 'School years', action: 'school_year' },
  { value: 'event', label: 'Events', action: 'event' },
  { value: 'task', label: 'Tasks', action: 'task' },
  { value: 'report', label: 'Submissions', action: 'report' },
  { value: 'comment', label: 'Comments', action: 'comment' },
  { value: 'template', label: 'Templates', action: 'template' },
  { value: 'deped_calendar', label: 'DepEd calendar', action: 'deped_calendar' },
  { value: 'auth', label: 'Sign-ins', action: 'auth' },
];

export interface AuditLogState {
  items: AuditEntry[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  filter: string;
  query: string;
}

/**
 * The audit trail (principal/admin): account and delegation changes,
 * certificate reviews, school years, event approvals and task assignments.
 * Entries can't be edited or deleted (enforced by the database).
 */
export class AuditLogController extends BaseController<AuditLogState> {
  private static readonly PAGE = 50;
  private gen = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly services: Services) {
    super({ items: [], total: 0, loading: true, loadingMore: false, error: null, filter: 'all', query: '' });
  }

  private params() {
    const f = AUDIT_FILTERS.find((x) => x.value === this.state.filter);
    return { action: f?.action, query: this.state.query.trim() || undefined };
  }

  async load() {
    const g = ++this.gen;
    this.setState({ loading: true, error: null });
    try {
      const r = await this.services.audit.list({ ...this.params(), limit: AuditLogController.PAGE, offset: 0 });
      if (g === this.gen) this.setState({ items: r.items, total: r.total, loading: false });
    } catch (e) {
      if (g === this.gen) this.setState({ loading: false, error: BaseController.messageOf(e) });
    }
  }

  get hasMore() { return this.state.items.length < this.state.total; }

  async loadMore() {
    if (this.state.loading || this.state.loadingMore || !this.hasMore) return;
    const g = this.gen;
    this.setState({ loadingMore: true });
    try {
      const r = await this.services.audit.list({ ...this.params(), limit: AuditLogController.PAGE, offset: this.state.items.length });
      if (g === this.gen) this.setState((s) => ({ items: [...s.items, ...r.items], total: r.total, loadingMore: false }));
    } catch {
      this.setState({ loadingMore: false });
    }
  }

  setFilter(filter: string) {
    this.setState({ filter });
    void this.load();
  }

  /** Debounced search. */
  setQuery(query: string) {
    this.setState({ query });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(), 350);
  }

  override dispose() {
    if (this.timer) clearTimeout(this.timer);
    super.dispose();
  }
}
