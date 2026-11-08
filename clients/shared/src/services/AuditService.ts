import { ApiClient } from './ApiClient';
import { AuditEntry } from '../models';

export class AuditService {
  constructor(private readonly api: ApiClient) {}

  async list(opts: { entityType?: string; entityId?: number; action?: string; query?: string; limit?: number; offset?: number } = {}): Promise<{ items: AuditEntry[]; total: number }> {
    const d = await this.api.get('/api/audit', {
      query: {
        entity_type: opts.entityType,
        entity_id: opts.entityId,
        action: opts.action,
        q: opts.query,
        limit: opts.limit ?? 50,
        offset: opts.offset ?? 0,
      },
      fallback: 'Failed to load the audit log',
    });
    return { items: (d.items ?? []).map(AuditEntry.fromJson), total: Number(d.total ?? 0) };
  }
}
