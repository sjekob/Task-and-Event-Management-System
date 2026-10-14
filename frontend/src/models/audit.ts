import { Json, tryParseDate } from './models';

/// One audit-trail entry: who did what, when, with before → after values.
export interface AuditEntry {
  id: number;
  createdAt: Date | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityLabel: string | null;
  summary: string;
  changes: Record<string, unknown[]>;
  ipAddress: string | null;
}

export function auditEntryFromJson(j: Json): AuditEntry {
  const changes: Record<string, unknown[]> = {};
  for (const [key, value] of Object.entries((j.changes ?? {}) as Json)) {
    changes[key] = Array.isArray(value) ? value : [];
  }
  return {
    id: Math.trunc(j.id as number),
    // Stored in UTC ("...Z"), shown in local time.
    createdAt: tryParseDate((j.created_at ?? '').toString()),
    actorName: j.actor_name?.toString() ?? null,
    actorRole: j.actor_role?.toString() ?? null,
    action: (j.action ?? '').toString(),
    entityType: (j.entity_type ?? '').toString(),
    entityLabel: j.entity_label?.toString() ?? null,
    summary: (j.summary ?? '').toString(),
    changes,
    ipAddress: j.ip_address?.toString() ?? null,
  };
}
