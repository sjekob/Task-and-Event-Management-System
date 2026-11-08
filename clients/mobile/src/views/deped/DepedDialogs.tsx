import { useEffect } from 'react';
import { View } from 'react-native';
import { DepedEntryFormController, DepedTaskController } from '@shared/controllers/DepedControllers';
import { DEPED_CATEGORIES, DEPED_TASK_ROLES, DepedEntry, roleLabel } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Check, DateField, Field, Input, Modal, Row, Select, T } from '../../ui/kit';

/** "DepEd Memo" tag used wherever official DepEd dates appear. */
export function DepedTag() {
  return <View style={{ backgroundColor: C.purpleBg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}><T size={11.5} weight={700} color={C.purple}>DepEd Memo</T></View>;
}

/** Add or edit one DepEd calendar entry (principal/admin). */
export function DepedEntryDialog({ existing, onClose, onSaved }: { existing: DepedEntry | null; onClose: () => void; onSaved: () => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new DepedEntryFormController(services, existing), [existing]);
  const save = async () => {
    try { await c.save(); fb.toast(existing ? 'DepEd date updated' : 'DepEd date added'); onSaved(); } catch (e) { fb.error(e); }
  };
  return (
    <Modal title={existing ? 'Edit DepEd date' : 'Add DepEd date'} icon="calendar" onClose={onClose}
      footer={<><Button variant="ghost" onPress={onClose}>Cancel</Button><Button loading={s.saving} disabled={!c.canSave} onPress={() => void save()}>Save</Button></>}>
      <Field label="Title"><Input placeholder="e.g. First Quarter Examinations" value={s.title} onChangeText={(v) => c.set({ title: v })} /></Field>
      <Field label="Start date"><DateField value={s.startDate || null} onChange={(v) => c.set({ startDate: v ?? '' })} /></Field>
      <Field label="End date" help="Leave empty for a one-day entry."><DateField value={s.endDate || null} min={s.startDate || null} clearable onChange={(v) => c.set({ endDate: v ?? '' })} /></Field>
      <Field label="Category">
        <Select value={s.category} options={DEPED_CATEGORIES.map((x) => ({ value: x, label: x }))} onChange={(v) => c.set({ category: v })} title="Category" />
      </Field>
      <Check checked={s.isMandatory} onChange={() => c.set({ isMandatory: !s.isMandatory })} label="Mandatory — warn proponents who schedule an event on these dates" />
      <Field label="Description (optional)"><Input multiline rows={2} value={s.description} onChangeText={(v) => c.set({ description: v })} /></Field>
    </Modal>
  );
}

/** Turn a DepEd entry into one mandatory task for every active faculty member in the chosen roles. */
export function DepedTaskDialog({ onClose }: { onClose: () => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new DepedTaskController(services), []);
  useEffect(() => { void c.load(); }, [c]);
  const generate = async () => {
    try {
      const n = await c.generate();
      fb.toast(`Task assigned to ${n} faculty member${n === 1 ? '' : 's'}`);
      onClose();
    } catch (e) { fb.error(e); }
  };
  return (
    <Modal title={<Row><T size={17} weight={700}>From DepEd Calendar</T><DepedTag /></Row>} icon="check-square" onClose={onClose}
      footer={<><Button variant="ghost" onPress={onClose}>Cancel</Button><Button loading={s.busy} disabled={!c.canGenerate} onPress={() => void generate()}>Generate tasks</Button></>}>
      <Field label="DepEd calendar entry" help={s.entries.length ? undefined : 'No DepEd dates yet — add them on the School Year page.'}>
        <Select<number | null> value={s.entryId} placeholder="Select an entry…" title="DepEd calendar entry"
          options={s.entries.map((e) => ({ value: e.id, label: e.title, hint: e.range }))} onChange={(v) => c.pick(v)} />
      </Field>
      <Field label="Task title"><Input value={s.title} onChangeText={(v) => c.set({ title: v })} /></Field>
      <Field label="Instructions (optional)"><Input multiline rows={3} value={s.instructions} onChangeText={(v) => c.set({ instructions: v })} /></Field>
      <Field label="Due date" help="Defaults to the entry's last day."><DateField value={s.dueDate || null} onChange={(v) => c.set({ dueDate: v ?? '' })} /></Field>
      <Field label="Assign to every active">
        <Row wrap gap={14}>
          {DEPED_TASK_ROLES.map((r) => <Check key={r} checked={s.roles.includes(r)} onChange={() => c.toggleRole(r)} label={`${roleLabel(r)}s`} />)}
        </Row>
      </Field>
    </Modal>
  );
}
