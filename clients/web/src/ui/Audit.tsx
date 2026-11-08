import {
  Ban, BadgeCheck, CalendarDays, CalendarRange, ClipboardCheck, History, UserCog, UserPlus, UserX, Award,
} from 'lucide-react';
import { AuditHistoryController } from '@shared/controllers/AuditControllers';
import { AuditEntry } from '@shared/models';
import { Format } from '@shared/utils/format';
import { useServices } from '../app/AppContext';
import { useScreenController } from '../app/hooks';
import { Spinner } from './kit';

const KIND: Record<AuditEntry['kind'], [React.ComponentType<{ size?: number }>, string]> = {
  deactivate: [UserX, 'var(--red)'],
  account: [UserPlus, 'var(--green)'],
  personnel: [UserCog, 'var(--accent)'],
  verified: [BadgeCheck, 'var(--green)'],
  rejected: [Ban, 'var(--red)'],
  certificate: [Award, 'var(--accent)'],
  school_year: [CalendarRange, 'var(--amber)'],
  event: [CalendarDays, 'var(--purple)'],
  task: [ClipboardCheck, 'var(--accent)'],
  other: [History, 'var(--muted)'],
};

/** One audit entry: summary, when and by whom, and before → after values. */
export function AuditEntryTile({ entry: e, showEntity = true }: { entry: AuditEntry; showEntity?: boolean }) {
  const [Icon, color] = KIND[e.kind];
  const role = e.actorRole ? ` (${Format.capitalize(e.actorRole)})` : '';
  return (
    <div className="row-top gap-12" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
      <span className="att-icon" style={{ width: 34, height: 34, background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}><Icon size={18} /></span>
      <div className="grow">
        <div className="row wrap gap-8">
          <span className="label">{e.summary}</span>
          {showEntity && e.entityLabel && <span className="body-sm">· {e.entityLabel}</span>}
        </div>
        <div className="caption" style={{ marginTop: 3 }}>{Format.auditTime(e.createdAt)}  ·  by {e.actorName ?? 'system'}{role}</div>
        {Object.keys(e.changes).length > 0 && (
          <div className="mt-8">
            {Object.entries(e.changes).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12, marginBottom: 3 }}>
                <b style={{ fontWeight: 600 }}>{k.replace(/_/g, ' ')}: </b>
                <span style={{ color: 'var(--muted)', textDecoration: 'line-through' }}>{AuditEntry.formatValue(v[0])}</span>
                {'  →  '}
                <span>{AuditEntry.formatValue(v[1])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Change history of one record. */
export function AuditHistory({ entityType, entityId }: { entityType: string; entityId: number }) {
  const services = useServices();
  const [, s] = useScreenController(() => new AuditHistoryController(services, entityType, entityId), [entityType, entityId]);
  if (s.error) return <div className="body-sm">{s.error}</div>;
  if (!s.items) return <div className="center-fill" style={{ padding: 8 }}><Spinner small /></div>;
  if (!s.items.length) return <div className="body-sm">No recorded changes yet.</div>;
  return <div>{s.items.map((e) => <AuditEntryTile key={e.id} entry={e} showEntity={false} />)}</div>;
}
