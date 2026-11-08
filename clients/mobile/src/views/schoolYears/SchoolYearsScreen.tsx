import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SchoolYearFormController, SchoolYearsController } from '@shared/controllers/SchoolYearControllers';
import { SchoolYear } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Badge, Banner, Button, C, Card, DateField, Field, IconButton, IconTile, Input, Loading, Modal, Row, Screen, T, Tone } from '../../ui/kit';
import { DepedCalendarSection } from '../deped/DepedCalendarSection';

/** /school-years: school years and terms (archiving), plus the DepEd school calendar. */
export default function SchoolYearsScreen() {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new SchoolYearsController(services), []);
  const [editing, setEditing] = useState<SchoolYear | null | 'new'>(null);
  useEffect(() => { void c.load(); }, [c]);

  const remove = async (y: SchoolYear) => {
    const ok = await fb.confirm({
      title: `Remove S.Y. ${y.name}?`, danger: true, confirmLabel: 'Remove', cancelLabel: 'Keep it',
      message: 'Only the calendar entry is removed. Tasks, events and appraisal records are kept; they just stop being grouped under this school year.',
    });
    if (!ok) return;
    try { await c.remove(y); } catch (e) { fb.error(e); }
  };

  return (
    <Screen onRefresh={() => c.load()}>
      <Banner title="School Year" subtitle="Set when each school year and term starts and ends. Records from ended school years are archived automatically." />
      <Row><T size={17} weight={700} style={{ flex: 1 }}>School years</T><Button icon="plus" size="sm" onPress={() => setEditing('new')}>Add school year</Button></Row>
      {s.loading ? <Loading /> : s.error ? <Card><T color={C.red}>{s.error}</T></Card> : !s.years.length ? (
        <Card><T size={13} color={C.text2}>No school year set up yet, so nothing is archived. Add the current school year and its terms to start grouping tasks, events and appraisals by year.</T></Card>
      ) : s.years.map((y) => {
        const st = SchoolYearsController.statusStyle(y.status);
        return (
          <Card key={y.id} flat style={{ gap: 10 }}>
            <Row gap={10}>
              <IconTile name={y.status === 'archived' ? 'archive' : 'book-open'} tone="gray" />
              <View style={{ flex: 1 }}>
                <Row gap={8}><T size={15.5} weight={700}>S.Y. {y.name}</T><Badge tone={st.tone as Tone}>{st.label}</Badge></Row>
                <T size={12.5} color={C.muted}>{SchoolYearsController.range(y.startDate, y.endDate)}</T>
              </View>
              <IconButton name="edit-2" size={18} label={`Edit S.Y. ${y.name}`} onPress={() => setEditing(y)} />
              <IconButton name="trash-2" size={18} label={`Remove S.Y. ${y.name}`} onPress={() => void remove(y)} />
            </Row>
            {!y.terms.length ? <T size={12} color={C.muted}>No terms set — add quarters/terms to filter appraisals by term.</T> : y.terms.map((t) => {
              const ts = SchoolYearsController.statusStyle(t.status);
              const cur = t.status === 'current';
              return (
                <View key={t.id} style={{ padding: 10, borderRadius: 10, backgroundColor: cur ? '#f0fdf4' : C.surface2, borderWidth: 1, borderColor: cur ? '#86efac' : '#e2e8f0' }}>
                  <Row><T size={13} weight={700} style={{ flex: 1 }}>{t.name}</T><Badge tone={ts.tone as Tone}>{ts.label}</Badge></Row>
                  <T size={12} color={C.muted}>{SchoolYearsController.range(t.startDate, t.endDate)}</T>
                </View>
              );
            })}
          </Card>
        );
      })}
      <DepedCalendarSection />
      {editing && (
        <SchoolYearDialog existing={editing === 'new' ? null : editing} onClose={(saved) => {
          const wasNew = editing === 'new';
          setEditing(null);
          if (saved) { void c.load(); fb.toast(wasNew ? 'School year added.' : 'School year updated.', 'success'); }
        }} />
      )}
    </Screen>
  );
}

function SchoolYearDialog({ existing, onClose }: { existing: SchoolYear | null; onClose: (saved: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new SchoolYearFormController(services, existing), [existing?.id]);
  return (
    <Modal title={c.title} onClose={() => onClose(false)}
      footer={<><Button variant="ghost" onPress={() => onClose(false)}>Cancel</Button><Button loading={s.saving} onPress={async () => { if (await c.save()) onClose(true); }}>{c.submitLabel}</Button></>}>
      <Field label="School year"><Input placeholder="e.g. 2026-2027" value={s.name} onChangeText={(v) => c.set({ name: v })} /></Field>
      <Field label="Starts"><DateField value={s.start || null} onChange={(v) => c.set({ start: v ?? '' })} /></Field>
      <Field label="Ends"><DateField value={s.end || null} min={s.start || null} onChange={(v) => c.set({ end: v ?? '' })} /></Field>
      <Row><T weight={700} style={{ flex: 1 }}>Terms</T><Button variant="ghost" size="sm" icon="plus" onPress={() => c.addTerm()}>Add term</Button></Row>
      <T size={12} color={C.muted}>Terms must fall inside the school year and must not overlap.</T>
      {s.terms.map((t, i) => (
        <View key={i} style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: C.surface2 }}>
          <Row><T size={12.5} weight={700} color={C.muted} style={{ flex: 1 }}>Term {i + 1}</T><IconButton name="x" size={17} label={`Remove ${t.name}`} onPress={() => c.removeTerm(i)} /></Row>
          <Input value={t.name} placeholder="Term name" onChangeText={(v) => c.setTerm(i, { name: v })} />
          <DateField value={t.start || null} min={s.start || null} onChange={(v) => c.setTerm(i, { start: v ?? '' })} />
          <DateField value={t.end || null} min={t.start || s.start || null} onChange={(v) => c.setTerm(i, { end: v ?? '' })} />
        </View>
      ))}
      {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
    </Modal>
  );
}
