import { useEffect } from 'react';
import { View } from 'react-native';
import { SectionsController } from '@shared/controllers/SectionsController';
import { Section } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Field, IconButton, Input, Loading, Modal, Row, Select, T } from '../../ui/kit';

/** Personnel → Sections: the school's classes, their advisers and subject teachers. */
export function SectionsDialog({ onClose }: { onClose: () => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new SectionsController(services), []);
  useEffect(() => { void c.load(); }, [c]);
  const remove = async (x: Section) => {
    const ok = await fb.confirm({
      title: `Remove ${x.label}?`, danger: true, confirmLabel: 'Remove section',
      message: `${x.adviserName ? `${x.adviserName} will no longer advise a class, and ` : ''}its subject teachers' loads in this section are removed. Tasks already posted stay.`,
    });
    if (!ok) return;
    try { await c.remove(x); fb.toast(`${x.label} removed`, 'success'); } catch (e) { fb.error(e); }
  };
  return (
    <Modal title="Sections" subtitle="Set each teacher's advisory class and sections in Edit Role." icon="grid" onClose={onClose}
      footer={<Button variant="ghost" onPress={onClose}>Close</Button>}>
      {s.editing ? (
        <View style={{ gap: 10, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 }}>
          <Field label="Grade level">
            <Select<number | null> value={s.editing.gradeLevelId} options={s.gradeLevels.map((g) => ({ value: g.id, label: g.name }))}
              onChange={(v) => c.setEditing({ gradeLevelId: v })} />
          </Field>
          <Field label="Section name"><Input placeholder="e.g. Rizal" value={s.editing.name} maxLength={60} onChangeText={(v) => c.setEditing({ name: v })} /></Field>
          {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
          <Row gap={8} style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onPress={() => c.cancel()}>Cancel</Button>
            <Button size="sm" disabled={!c.canSave} loading={s.saving} onPress={() => void c.save()}>{s.editing.id === null ? 'Add section' : 'Save section'}</Button>
          </Row>
        </View>
      ) : (
        <Button size="sm" icon="plus" style={{ alignSelf: 'flex-start' }} onPress={() => c.startAdd()}>Add section</Button>
      )}
      {s.loading ? <Loading /> : !s.sections.length ? (
        <T size={12.5} color={C.muted}>No sections yet. Add the school's classes, then set each teacher's advisory class in Edit Role.</T>
      ) : c.byGrade.map((g) => (
        <View key={g.grade} style={{ gap: 6 }}>
          <T size={13} weight={700}>{g.grade}</T>
          {g.sections.map((x) => (
            <Row key={x.id} gap={8} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={13.5} weight={600}>{x.name}</T>
                <T size={12} color={C.muted}>{SectionsController.summary(x)}</T>
                {x.teachers.length ? <T size={12} color={C.muted} lines={2}>{x.teachers.map((t) => `${t.subject}: ${t.name}`).join(' · ')}</T> : null}
              </View>
              <IconButton name="edit-2" size={17} label={`Rename ${x.label}`} onPress={() => c.startEdit(x)} />
              <IconButton name="trash-2" size={17} color={C.red} label={`Remove ${x.label}`} onPress={() => void remove(x)} />
            </Row>
          ))}
        </View>
      ))}
    </Modal>
  );
}
