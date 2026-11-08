import { View } from 'react-native';
import { AuditHistoryController } from '@shared/controllers/AuditControllers';
import { AuditEntry } from '@shared/models';
import { Format } from '@shared/utils/format';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { C, FeatherName, Icon, Row, Spinner, T } from '../../ui/kit';

const KIND: Record<AuditEntry['kind'], [FeatherName, string]> = {
  deactivate: ['user-x', C.red],
  account: ['user-plus', C.green],
  personnel: ['user-check', C.accent],
  verified: ['check-circle', C.green],
  rejected: ['slash', C.red],
  certificate: ['award', C.accent],
  school_year: ['book-open', C.amber],
  event: ['calendar', C.purple],
  task: ['check-square', C.accent],
  other: ['clock', C.muted],
};

/** One audit entry: summary, when and by whom, and before → after values. */
export function AuditEntryTile({ entry: e, showEntity = true }: { entry: AuditEntry; showEntity?: boolean }) {
  const [icon, color] = KIND[e.kind];
  const role = e.actorRole ? ` (${Format.capitalize(e.actorRole)})` : '';
  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: `${color}1a`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T size={13.5} weight={600}>{e.summary}{showEntity && e.entityLabel ? <T size={12.5} color={C.muted}>{`  · ${e.entityLabel}`}</T> : null}</T>
        <T size={11.5} color={C.muted}>{Format.auditTime(e.createdAt)}  ·  by {e.actorName ?? 'system'}{role}</T>
        {Object.entries(e.changes).map(([k, v]) => (
          <T key={k} size={12}>
            <T size={12} weight={600}>{k.replace(/_/g, ' ')}: </T>
            <T size={12} color={C.muted} style={{ textDecorationLine: 'line-through' }}>{AuditEntry.formatValue(v[0])}</T>
            {'  →  '}{AuditEntry.formatValue(v[1])}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Change history of one record. */
export function AuditHistory({ entityType, entityId }: { entityType: string; entityId: number }) {
  const services = useServices();
  const [, s] = useScreenController(() => new AuditHistoryController(services, entityType, entityId), [entityType, entityId]);
  if (s.error) return <T size={12.5} color={C.muted}>{s.error}</T>;
  if (!s.items) return <Row><Spinner /></Row>;
  if (!s.items.length) return <T size={12.5} color={C.muted}>No recorded changes yet.</T>;
  return <View style={{ gap: 8 }}>{s.items.map((e) => <AuditEntryTile key={e.id} entry={e} showEntity={false} />)}</View>;
}
