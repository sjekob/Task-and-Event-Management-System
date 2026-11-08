import { useEffect } from 'react';
import { View } from 'react-native';
import { AUDIT_FILTERS, AuditLogController } from '@shared/controllers/AuditControllers';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { Banner, Button, C, Empty, Loading, Screen, SearchBox, T, Tabs } from '../../ui/kit';
import { AuditEntryTile } from '../common/Audit';

/** /audit-log: the read-only history of changes (principal/admin). */
export default function AuditLogScreen() {
  const services = useServices();
  const [c, s] = useScreenController(() => new AuditLogController(services), []);
  useEffect(() => { void c.load(); }, [c]);
  return (
    <Screen onRefresh={() => c.load()}>
      <Banner title="Audit Log" subtitle="Every change to accounts, tasks, submissions, events and more, with who made it and when. Entries cannot be edited or deleted." />
      <SearchBox value={s.query} onChange={(v) => c.setQuery(v)} placeholder="Search by person or description…" />
      <Tabs value={s.filter} onChange={(v) => c.setFilter(v)} tabs={AUDIT_FILTERS.map((f) => ({ value: f.value, label: f.label }))} />
      {s.error ? <T color={C.red}>{s.error}</T>
        : s.loading && !s.items.length ? <Loading />
        : !s.items.length ? <Empty icon="clock" title="No matching activity." />
        : (
          <View style={{ gap: 8 }}>
            <T size={12} color={C.muted}>{s.total} {s.total === 1 ? 'entry' : 'entries'}</T>
            {s.items.map((e) => <AuditEntryTile key={e.id} entry={e} />)}
            {c.hasMore && <Button variant="ghost" loading={s.loadingMore} onPress={() => void c.loadMore()}>Load more</Button>}
          </View>
        )}
    </Screen>
  );
}
