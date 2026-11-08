import { useEffect } from 'react';
import { CalendarRange, ListChecks } from 'lucide-react';
import { DepedEntryFormController, DepedTaskController } from '@shared/controllers/DepedControllers';
import { DEPED_CATEGORIES, DEPED_TASK_ROLES, DepedEntry, roleLabel } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Field, Modal, Select, TextArea, TextInput } from '../../ui/kit';

/** "DepEd Memo" tag used wherever official DepEd dates appear. */
export function DepedTag() {
  return <span className="chip" style={{ background: '#ede9fe', color: 'var(--deped)', fontWeight: 700 }}>DepEd Memo</span>;
}

/** Add or edit one DepEd calendar entry (principal/admin). */
export function DepedEntryDialog({ existing, onClose, onSaved }: { existing: DepedEntry | null; onClose: () => void; onSaved: () => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new DepedEntryFormController(services, existing), [existing]);
  const save = async () => {
    try {
      await c.save();
      fb.toast(existing ? 'DepEd date updated' : 'DepEd date added');
      onSaved();
    } catch (e) { fb.error(e); }
  };
  return (
    <Modal title={existing ? 'Edit DepEd date' : 'Add DepEd date'} icon={<CalendarRange size={20} />} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={s.saving} disabled={!c.canSave} onClick={() => void save()}>Save</Button></>}>
      <div className="col gap-12">
        <Field label="Title"><TextInput placeholder="e.g. First Quarter Examinations" value={s.title} onChange={(e) => c.set({ title: e.target.value })} /></Field>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Start date"><TextInput type="date" value={s.startDate} onChange={(e) => c.set({ startDate: e.target.value })} /></Field>
          <Field label="End date" help="Leave empty for a one-day entry."><TextInput type="date" min={s.startDate || undefined} value={s.endDate} onChange={(e) => c.set({ endDate: e.target.value })} /></Field>
        </div>
        <Field label="Category">
          <Select value={s.category} onChange={(e) => c.set({ category: e.target.value })}>{DEPED_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</Select>
        </Field>
        <label className="check"><input type="checkbox" checked={s.isMandatory} onChange={(e) => c.set({ isMandatory: e.target.checked })} />
          Mandatory — warn proponents who schedule an event on these dates</label>
        <Field label="Description (optional)"><TextArea rows={2} value={s.description} onChange={(e) => c.set({ description: e.target.value })} /></Field>
      </div>
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
    <Modal title={<span className="row gap-8">Generate from DepEd Calendar <DepedTag /></span>} icon={<ListChecks size={20} />} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={s.busy} disabled={!c.canGenerate} onClick={() => void generate()}>Generate tasks</Button></>}>
      <div className="col gap-12">
        <Field label="DepEd calendar entry" help={s.entries.length ? undefined : 'No DepEd dates yet — add them on the School Year page.'}>
          <Select value={s.entryId ?? ''} onChange={(e) => c.pick(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Select an entry…</option>
            {s.entries.map((e) => <option key={e.id} value={e.id}>{e.title} · {e.range}</option>)}
          </Select>
        </Field>
        <Field label="Task title"><TextInput value={s.title} onChange={(e) => c.set({ title: e.target.value })} /></Field>
        <Field label="Instructions (optional)"><TextArea rows={3} value={s.instructions} onChange={(e) => c.set({ instructions: e.target.value })} /></Field>
        <Field label="Due date" help="Defaults to the entry's last day."><TextInput type="date" value={s.dueDate} onChange={(e) => c.set({ dueDate: e.target.value })} /></Field>
        <Field label="Assign to every active">
          <div className="row wrap gap-16">
            {DEPED_TASK_ROLES.map((r) => (
              <label key={r} className="check"><input type="checkbox" checked={s.roles.includes(r)} onChange={() => c.toggleRole(r)} />{roleLabel(r)}s</label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
