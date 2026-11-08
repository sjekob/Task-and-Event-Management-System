import { Json, JsonReader as R } from './json';

/** One audit-trail entry: who did what, when, with before → after values. */
export class AuditEntry {
  constructor(
    readonly id: number,
    /** Stored in UTC, shown in local time. */
    readonly createdAt: Date | null,
    readonly actorName: string | null,
    readonly actorRole: string | null,
    readonly action: string,
    readonly entityType: string,
    readonly entityLabel: string | null,
    readonly summary: string,
    /** field → [before, after] */
    readonly changes: Record<string, unknown[]>,
    readonly ipAddress: string | null,
  ) {}

  static fromJson(j: Json): AuditEntry {
    const raw = R.str(j.created_at);
    const d = raw ? new Date(raw) : null;
    const changes: Record<string, unknown[]> = {};
    for (const [k, v] of Object.entries(R.obj(j.changes) ?? {})) changes[k] = Array.isArray(v) ? v : [];
    return new AuditEntry(
      R.num(j.id),
      d && !Number.isNaN(d.getTime()) ? d : null,
      R.optStr(j.actor_name),
      R.optStr(j.actor_role),
      R.str(j.action),
      R.str(j.entity_type),
      R.optStr(j.entity_label),
      R.str(j.summary),
      changes,
      R.optStr(j.ip_address),
    );
  }

  /** Visual kind of the action, used by views to pick an icon and color. */
  get kind(): 'deactivate' | 'account' | 'personnel' | 'verified' | 'rejected' | 'certificate' | 'school_year' | 'event' | 'task' | 'other' {
    const a = this.action;
    if (a.startsWith('account.deactivate')) return 'deactivate';
    if (a.startsWith('account')) return 'account';
    if (a.startsWith('personnel')) return 'personnel';
    if (a === 'certificate.verified') return 'verified';
    if (a === 'certificate.rejected') return 'rejected';
    if (a.startsWith('certificate')) return 'certificate';
    if (a.startsWith('school_year')) return 'school_year';
    if (a.startsWith('event')) return 'event';
    if (a.startsWith('task')) return 'task';
    return 'other';
  }

  static formatValue(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    return String(v);
  }
}
