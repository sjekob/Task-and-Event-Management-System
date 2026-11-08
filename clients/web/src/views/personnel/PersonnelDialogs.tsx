import { Eye, EyeOff, Lock, Pencil, Plus, X } from 'lucide-react';
import { ASSIGNABLE_ROLES, AddUserController, COORDINATOR_TYPE_GROUPS, EditRoleController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { Button, Field, Modal, Select, Spinner, Switch, TextInput } from '../../ui/kit';

// Add a user / edit role and assignment (principal, admin).
export function AddUserDialog({ onClose }: { onClose: (ok: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new AddUserController(services), []);
  return (
    <Modal title="Add New User" onClose={() => onClose(false)}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button><Button disabled={!c.canSubmit} loading={s.saving} onClick={async () => { if (await c.submit()) onClose(true); }}>Create User</Button></>}>
      <div className="col gap-16">
        <Field label="Email" required><TextInput type="email" placeholder="Email" value={s.email} onChange={(e) => c.set({ email: e.target.value })} autoFocus /></Field>
        <Field label="Username" required><TextInput placeholder="Username" value={s.username} onChange={(e) => c.set({ username: e.target.value })} /></Field>
        <Field label="Password" required help="Min. 6 characters" error={c.passwordError}>
          <div style={{ position: 'relative' }}>
            <TextInput type={s.show ? 'text' : 'password'} placeholder="Password" value={s.password} onChange={(e) => c.set({ password: e.target.value })} style={{ paddingRight: 40 }} />
            <button type="button" className="icon-btn sm" style={{ position: 'absolute', right: 6, top: 7 }} onClick={() => c.toggleShow()} aria-label="Show password">
              {s.show ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </Field>
        {s.error && <div className="alert red">Error: {s.error}</div>}
      </div>
    </Modal>
  );
}

export function EditRoleDialog({ user, onClose }: { user: User; onClose: (ok: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new EditRoleController(services, user), [user.id]);
  const grade = (value: number | null, onChange: (v: number | null) => void, label: string) => (
    <Field label={label}>
      <Select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">— None —</option>
        {s.gradeLevels.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </Select>
    </Field>
  );
  return (
    <Modal title="Edit Role & Assignment" subtitle={user.fullName} size="wide" icon={<Pencil size={20} style={{ marginTop: 2 }} />} onClose={() => onClose(false)}
      footer={<><Button variant="outline-muted" onClick={() => onClose(false)}>Cancel</Button><Button style={{ background: '#2d3748' }} loading={s.saving} onClick={async () => { if (await c.submit()) onClose(true); }}>Save Changes</Button></>}>
      <div className="col" style={{ gap: 24 }}>
        <section className="col gap-12">
          <div className="pm-label">Role Assignment</div>
          <div className="grid-2" style={{ gap: 16 }}>
            <Field label="Administrative Role">
              <Select value={s.role} onChange={(e) => c.set({ role: e.target.value })}>
                {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Date of Appointment">
              <TextInput type="date" max={new Date().toISOString().slice(0, 10)} min="1960-01-01" value={s.appointment} onChange={(e) => c.set({ appointment: e.target.value })} />
            </Field>
            {s.role === 'dean' && s.gradeLevels.length > 0 && grade(s.deanGradeLevelId, (v) => c.set({ deanGradeLevelId: v }), 'Grade Level Handled')}
          </div>
          {s.role === 'coordinator' && (
            <Field label="Coordinator Type">
              <Select value={s.coordinatorType ?? ''} onChange={(e) => c.set({ coordinatorType: e.target.value || null })}>
                <option value="">Select type</option>
                {Object.entries(COORDINATOR_TYPE_GROUPS).map(([group, types]) => (
                  <optgroup key={group} label={group.toUpperCase()}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
                ))}
              </Select>
            </Field>
          )}
        </section>

        {c.canAdvise && (
          <section className="col gap-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div className="row gap-16">
              <div className="grow col gap-4">
                <div className="pm-label">Class Adviser</div>
                <div className="body-sm" style={{ color: 'var(--muted)' }}>
                  Is this teacher the adviser of a class? Advisers get an Advisory tab with their class's tasks from the school calendar.
                </div>
              </div>
              <Switch checked={s.isAdviser} onChange={(v) => c.set({ isAdviser: v })} />
            </div>
            {s.isAdviser && (
              <div style={{ maxWidth: 360 }}>
                <Field label="Advisory class" help={s.sections.length ? undefined : 'No sections yet: add them with "Sections" on the Personnel page.'}>
                  <Select value={s.advisorySectionId ?? ''} onChange={(e) => c.set({ advisorySectionId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Select section</option>
                    {c.advisoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
              </div>
            )}
          </section>
        )}

        <section className="col gap-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div className="col gap-4">
            <div className="pm-label">Subjects and Sections Taught</div>
            <div className="body-sm" style={{ color: 'var(--muted)' }}>For each subject, tick the sections this person teaches it in.</div>
          </div>
          {!s.metaLoaded ? <div className="center-fill" style={{ padding: 8 }}><Spinner small /></div> : s.rows.map((r, i) => (
            <div key={i} className="col gap-12" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--surface-2)' }}>
              <div className="row gap-8">
                <span className="grow" style={{ fontSize: 13, fontWeight: 700 }}>{r.subject ? `${r.subject}` : `Subject ${i + 1}`}</span>
                <button className="icon-btn sm" disabled={s.rows.length <= 1} title="Remove subject" aria-label="Remove subject" onClick={() => c.removeRow(i)}
                  style={{ color: s.rows.length > 1 ? 'var(--red)' : '#d1d5db' }}><X size={18} /></button>
              </div>
              <div className="grid-2" style={{ gap: 16 }}>
                {grade(r.gradeLevelId, (v) => c.setRow(i, { gradeLevelId: v }), 'Grade Level')}
                <Field label="Subject">
                  <Select value={r.subject ?? ''} onChange={(e) => c.setRow(i, { subject: e.target.value || null })}>
                    <option value="">Select subject</option>
                    {s.subjects.map((x) => <option key={x} value={x}>{x}</option>)}
                  </Select>
                </Field>
              </div>
              {r.subject && c.sectionsFor(r).length > 0 && (
                <div className="col gap-8">
                  <div className="row gap-8">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Sections taught</span>
                    <span className="caption">{r.sectionIds.length} of {c.sectionsFor(r).length} selected</span>
                  </div>
                  <div className="row wrap" style={{ gap: 8 }} role="group" aria-label={`Sections taught in ${r.subject}`}>
                    {c.sectionsFor(r).map((x) => (
                      <button key={x.id} type="button" className={`chip selectable ${r.sectionIds.includes(x.id) ? 'on' : ''}`}
                        style={{ padding: '6px 12px' }} aria-pressed={r.sectionIds.includes(x.id)} onClick={() => c.toggleSection(i, x.id)}>
                        {r.gradeLevelId === null ? x.label : x.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div><Button variant="outline-muted" size="sm" icon={<Plus size={16} />} onClick={() => c.addRow()}>Add Subject</Button></div>
        </section>

        <div className="row-top gap-8" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
          <Lock size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#374151' }}>Personal information — education, skills, certifications and family details — can only be edited by {user.fullName} in their own profile.</span>
        </div>
        {s.error && <div className="alert red">Error: {s.error}</div>}
      </div>
    </Modal>
  );
}
