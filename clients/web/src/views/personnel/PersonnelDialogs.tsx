import { CheckCircle2, Copy, KeyRound, Lock, Pencil, Plus, X } from 'lucide-react';
import { ASSIGNABLE_ROLES, AddUserController, COORDINATOR_TYPE_GROUPS, CreatedAccount, EditRoleController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Field, Modal, Select, Spinner, Switch, TextInput } from '../../ui/kit';

// Add a user / edit role and assignment (principal, admin).
export function AddUserDialog({ onClose }: { onClose: (ok: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new AddUserController(services), []);
  if (s.created) return <AccountCreated a={s.created} onDone={() => onClose(true)} />;
  return (
    <Modal title="Add New User" onClose={() => onClose(false)}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button><Button disabled={!c.canSubmit} loading={s.saving} onClick={() => void c.submit()}>Create User</Button></>}>
      <div className="col gap-16">
        <Field label="Email" required><TextInput type="email" placeholder="Email" value={s.email} onChange={(e) => c.set({ email: e.target.value })} autoFocus /></Field>
        <Field label="Username" required><TextInput placeholder="Username" value={s.username} onChange={(e) => c.set({ username: e.target.value })} /></Field>
        <div className="row-top gap-8 caption" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          <KeyRound size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>A password is generated automatically and emailed to this address with the username.</span>
        </div>
        {s.error && <div className="alert red">Error: {s.error}</div>}
      </div>
    </Modal>
  );
}

/** The new account's sign-in details, shown once (the password is stored only as a hash). */
function AccountCreated({ a, onDone }: { a: CreatedAccount; onDone: () => void }) {
  const fb = useFeedback();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Username: ${a.username}
Password: ${a.password}`);
      fb.toast('Sign-in details copied');
    } catch { fb.toast('Copy failed: select the text instead'); }
  };
  return (
    <Modal title="Account created" icon={<CheckCircle2 size={20} color="var(--green)" />} onClose={onDone}
      footer={<><Button variant="outline-muted" icon={<Copy size={16} />} onClick={() => void copy()}>Copy details</Button><Button onClick={onDone}>Done</Button></>}>
      <div className="col gap-12">
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55 }}>
          {a.emailed
            ? <>The sign-in details were emailed to <b style={{ color: 'var(--text)' }}>{a.email}</b>.</>
            : <>Email isn't set up, so nothing was sent. Give these sign-in details to the user.</>}
        </div>
        <div className="pm-cred">
          <span>Username</span><b>{a.username}</b>
          <span>Password</span><b className="mono">{a.password}</b>
        </div>
        <div className="caption">This password won't be shown again, so copy it now if you need to hand it over.</div>
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
      footer={<><Button variant="outline-muted" onClick={() => onClose(false)}>Cancel</Button><Button style={{ background: 'var(--dark)' }} loading={s.saving} onClick={async () => { if (await c.submit()) onClose(true); }}>Save Changes</Button></>}>
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
          {!s.metaLoaded ? <div className="center-fill" style={{ padding: 8 }}><Spinner small /></div>
            : s.metaError ? (
              <div className="alert red row gap-12">
                <span className="grow">{s.metaError}</span>
                <Button size="sm" variant="outline-muted" onClick={() => void c.loadMeta()}>Retry</Button>
              </div>
            ) : s.rows.map((r, i) => (
            <div key={i} className="col gap-12" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--surface-2)' }}>
              <div className="row gap-8">
                <span className="grow" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>Subject {i + 1}</span>
                <button className="icon-btn sm" disabled={s.rows.length <= 1} title="Remove subject" aria-label="Remove subject" onClick={() => c.removeRow(i)}
                  style={{ color: s.rows.length > 1 ? 'var(--red)' : '#d1d5db' }}><X size={18} /></button>
              </div>
              <div className="grid-2" style={{ gap: 16 }}>
                {grade(r.gradeLevelId, (v) => c.setRow(i, { gradeLevelId: v }), 'Grade Level')}
                <Field label="Subject">
                  <Select value={r.subject ?? ''} onChange={(e) => c.setRow(i, { subject: e.target.value || null })}>
                    <option value="">Select subject</option>
                    {s.subjects.map((x) => <option key={x} value={x}>{x}</option>)}
                    {/* A subject no longer in the list still shows as chosen. */}
                    {r.subject && !s.subjects.includes(r.subject) && <option value={r.subject}>{r.subject}</option>}
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

        <div className="row-top gap-8" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <Lock size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Personal information — education, skills, certifications and family details — can only be edited by {user.fullName} in their own profile.</span>
        </div>
        {s.error && <div className="alert red">Error: {s.error}</div>}
      </div>
    </Modal>
  );
}
