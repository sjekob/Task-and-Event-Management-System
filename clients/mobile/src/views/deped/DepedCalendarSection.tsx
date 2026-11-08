import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DepedCalendarController } from '@shared/controllers/DepedControllers';
import { DepedEntry } from '@shared/models';
import { useServices, useSession } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Card, IconButton, Loading, Row, T } from '../../ui/kit';
import { DepedEntryDialog, DepedTag } from './DepedDialogs';

/** The official DepEd school-calendar dates shown on every calendar (School Year screen). */
export function DepedCalendarSection() {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new DepedCalendarController(services, user), [user]);
  const [editing, setEditing] = useState<DepedEntry | 'new' | null>(null);
  useEffect(() => { void c.load(); }, [c]);

  const remove = async (e: DepedEntry) => {
    if (!await fb.confirm({ title: 'Remove DepEd date', message: `Remove "${e.title}"?`, confirmLabel: 'Remove', danger: true })) return;
    try { await c.remove(e); fb.toast('DepEd date removed'); } catch (err) { fb.error(err); }
  };

  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Row><T size={17} weight={700}>DepEd school calendar</T><DepedTag /></Row>
      <T size={12} color={C.muted}>Official memorandum dates shown on every calendar. Mandatory entries warn proponents who pick an overlapping event date.</T>
      {c.canManage && <Button icon="plus" style={{ alignSelf: 'flex-start' }} onPress={() => setEditing('new')}>Add DepEd date</Button>}
      <Card style={{ padding: 0 }}>
        {s.loading ? <Loading /> : s.error ? <T color={C.red} style={{ padding: 16 }}>{s.error}</T>
          : !s.entries.length ? <T size={13} color={C.muted} style={{ padding: 16 }}>No DepEd dates yet.</T>
          : c.ordered.map((e) => (
            <Row key={e.id} gap={10} style={{ padding: 12, borderBottomWidth: 1, borderColor: C.border }}>
              <View style={{ width: 5, height: 36, borderRadius: 3, backgroundColor: C.purple }} />
              <View style={{ flex: 1 }}>
                <T size={14} weight={600}>{e.title}</T>
                <T size={12} color={C.muted}>{e.range} · {e.category}{e.isMandatory ? ' · Mandatory' : ''}</T>
              </View>
              {c.canManage && <>
                <IconButton name="edit-2" size={17} label="Edit" color={C.muted} onPress={() => setEditing(e)} />
                <IconButton name="trash-2" size={17} label="Remove" color={C.red} onPress={() => void remove(e)} />
              </>}
            </Row>
          ))}
      </Card>
      {editing && <DepedEntryDialog existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void c.load(); }} />}
    </View>
  );
}
