import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, CalendarDays, Clock, FileText, Library, Sparkles, Upload, Users, X } from 'lucide-react';
import { ATTACHMENT_KINDS, AttachmentKind, TaskFormController, TaskFormMode } from '@shared/controllers/TaskFormController';
import { TaskScanController } from '@shared/controllers/TaskScanController';
import { Task, TaskCategory } from '@shared/models';
import { Format } from '@shared/utils/format';
import { useServices, useSession } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { AssignPickerDialog, AssignRoleSelector } from '../../ui/AssignPickerDialog';
import { AttachmentDialog } from '../../ui/AttachmentDialog';
import { Avatar, Button, ErrorBox, Field, Loading, Spinner, TextArea, TextInput, pickFiles } from '../../ui/kit';
import './tasks.css';
import { ATT_ICON, PickerField, Section, TemplatePicker } from './TaskFormParts';
import { ScanFileButton } from './TaskScan';

/** /tasks/new, /tasks/template, /special-tasks/new and /…/:id/edit. */
export default function CreateTaskView({ backTo, isTemplate, lockedCategory, edit }: {
  backTo: string; isTemplate?: boolean; lockedCategory?: TaskCategory; edit?: boolean;
}) {
  const services = useServices();
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!edit || !id) return;
    services.tasks.get(Number(id)).then(setTask).catch((e) => setError(e.message));
  }, [edit, id, services]);

  if (edit) {
    if (error) return <ErrorBox message={error} />;
    if (!task) return <Loading />;
    return <TaskForm backTo={backTo} mode={{ kind: 'edit', task }} />;
  }
  return <TaskForm backTo={backTo} mode={isTemplate ? { kind: 'template' } : { kind: 'create', lockedCategory }} />;
}

function TaskForm({ backTo, mode }: { backTo: string; mode: TaskFormMode }) {
  const services = useServices();
  const { user } = useSession();
  const navigate = useNavigate();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new TaskFormController(services, user, mode), []);
  const [scan] = useScreenController(() => new TaskScanController(services, c), [c]);
  const [picker, setPicker] = useState(false);
  const [linkKind, setLinkKind] = useState<AttachmentKind | null>(null);
  const [templates, setTemplates] = useState(false);

  const addAttachment = async (kind: AttachmentKind) => {
    if (kind !== 'file') { setLinkKind(kind); return; }
    const [file] = await pickFiles('*/*');
    if (!file) return;
    try { await c.uploadAttachment({ name: file.name, type: file.type, blob: file }); } catch (e) { fb.error(e); }
  };

  const submit = async () => {
    try {
      const warning = await c.submit();
      if (warning) fb.toast(warning, 'error');
      else if (c.isEdit) fb.toast('Task updated');
      navigate(backTo);
    } catch (e) {
      fb.error(e);
    }
  };

  const details = (
    <Section icon={<FileText size={16} />} title="Task details">
      <div className="col gap-16">
        <Field label={c.isTemplate ? 'Template name' : 'Title'} required>
          <TextInput value={s.title} onChange={(e) => c.setTitle(e.target.value)} autoFocus
            placeholder={c.isTemplate ? 'e.g. Quarterly report' : 'e.g. First aid station for the sports fest'} />
        </Field>
        <Field label="Instructions">
          <TextArea rows={8} value={s.instructions} onChange={(e) => c.setInstructions(e.target.value)}
            placeholder="What needs to be done, what to submit, and anything the assignee should know." />
        </Field>
        <div>
          <div className="field-label mb-8">Attachments</div>
          <div className="row wrap gap-8">
            {ATTACHMENT_KINDS.map((k) => (
              <Button key={k.kind} variant="outline-muted" size="sm" onClick={() => void addAttachment(k.kind)}
                icon={k.kind === 'file' ? (s.uploading ? <Spinner small /> : <Upload size={16} />) : ATT_ICON[k.kind]}>
                {k.label}
              </Button>
            ))}
          </div>
          {s.attachments.length > 0 && (
            <div className="mt-12">
              {s.attachments.map((a, i) => {
                const color = ATTACHMENT_KINDS.find((k) => k.kind === a.attachment_type)?.color ?? '#4a90e2';
                return (
                  <div key={i} className="att-row">
                    <span className="att-icon" style={{ background: `${color}1f`, color }}>{ATT_ICON[a.attachment_type] ?? ATT_ICON.link}</span>
                    <div className="grow">
                      <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 600 }}>{a.name}</div>
                      {a.url && <div className="ellipsis body-sm" style={{ color: 'var(--accent)' }}>{a.url}</div>}
                    </div>
                    <button className="icon-btn sm" title="Remove" onClick={() => c.removeAttachment(i)}><X size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Section>
  );

  const schedule = (
    <Section icon={<CalendarDays size={16} />} title="Schedule">
      <div className="col gap-10" style={{ gap: 10 }}>
        <PickerField icon={<CalendarDays size={18} />} label="Start date" set={!!s.startDate} display={TaskFormController.longDate(s.startDate)}>
          <input type="date" value={s.startDate ?? ''} onChange={(e) => c.setStartDate(e.target.value)} />
        </PickerField>
        <PickerField icon={<CalendarCheck size={18} />} label="Due date" set={!!s.endDate} display={TaskFormController.longDate(s.endDate)}>
          <input type="date" value={s.endDate ?? ''} min={s.startDate ?? undefined} onChange={(e) => c.setEndDate(e.target.value)} />
        </PickerField>
        <PickerField icon={<Clock size={18} />} label="Due time" set={!!s.dueTime} display={s.dueTime}>
          <input type="time" value={Format.to24h(s.dueTime)} onChange={(e) => c.setDueTime(e.target.value)} />
        </PickerField>
      </div>
    </Section>
  );

  const selected = c.selectedUsers;
  const assignment = !c.isTemplate && (
    <Section icon={<Users size={16} />} title="Assignment">
      {c.roleOptions.length >= 2 && (
        <div className="mb-16">
          <div className="field-label mb-8">Assign as</div>
          <AssignRoleSelector options={c.roleOptions} value={s.targetRole} onChange={(r) => c.setTargetRole(r)} />
          {c.isEdit && <div className="body-sm mt-4" style={{ color: 'var(--muted)' }}>Filters who you can add. People already assigned stay assigned.</div>}
        </div>
      )}
      <div className="field-label mb-8">People</div>
      {selected.length === 0 ? <div className="body-sm" style={{ color: 'var(--muted)' }}>No one selected yet.</div> : (
        <div className="row wrap gap-6">
          {selected.map((u) => (
            <span key={u.id} className="chip removable" style={{ background: '#fff', borderColor: 'var(--border)', color: 'var(--text)', paddingLeft: 4 }}>
              <Avatar url={u.avatarUrl} initials={u.initials} size={22} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{u.fullName}</span>
              <button title={`Remove ${u.fullName}`} onClick={() => c.unselect(u.id)}><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
      <Button variant="outline" block className="mt-12" disabled={s.loadingUsers || (!s.assignable.length)}
        icon={s.loadingUsers ? <Spinner small /> : <Sparkles size={16} />} onClick={() => setPicker(true)}>
        {selected.length ? 'Change people' : 'Choose people'}
      </Button>
      {!s.loadingUsers && !s.assignable.length && <div className="body-sm mt-4" style={{ color: 'var(--muted)' }}>There is no one you can assign as this role.</div>}
      <div className="body-sm mt-8" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        Suggestions match the title and instructions against each person's skills and certifications, and weigh their current workload.
      </div>
    </Section>
  );

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div className="row-top wrap gap-12 mb-16" style={{ marginTop: 4 }}>
        <div className="grow">
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{c.pageTitle}</h1>
          <div className="body-md mt-4">{c.subtitle}</div>
        </div>
        {mode.kind !== 'edit' && <ScanFileButton scan={scan} onTemplatesMade={() => navigate(backTo)} />}
        {mode.kind === 'create' && (
          <Button variant="outline" icon={<Library size={16} />} onClick={() => setTemplates(true)}>Use template</Button>
        )}
      </div>
      <div className="form-grid">
        {details}
        <div className="col gap-16">{schedule}{assignment}</div>
      </div>
      <div className="row end gap-8 mt-24">
        <Button variant="outline-muted" size="lg" onClick={() => navigate(backTo)}>Cancel</Button>
        <Button size="lg" loading={s.submitting} onClick={() => void submit()}>{c.submitLabel}</Button>
      </div>

      {picker && (
        <AssignPickerDialog
          onClose={() => setPicker(false)}
          onDone={(ids) => c.setSelected(ids)}
          options={{ users: s.assignable, selected: s.selectedIds, hasTaskText: c.hasTaskText, loadSuggestions: c.loadSuggestions }}
        />
      )}
      {linkKind && <AttachmentDialog kind={linkKind} onClose={() => setLinkKind(null)} onAdd={(a) => c.addAttachment(a)} />}
      {templates && <TemplatePicker onClose={() => setTemplates(false)} onPick={(t) => { c.applyTemplate(t); setTemplates(false); }} />}
    </div>
  );
}
