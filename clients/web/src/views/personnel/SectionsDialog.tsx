import { useEffect } from 'react';
import { Pencil, Plus, School, Trash2 } from 'lucide-react';
import { SectionsController } from '@shared/controllers/SectionsController';
import { Section } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Field, IconButton, Modal, Select, Spinner, TextInput } from '../../ui/kit';

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
    try { await c.remove(x); fb.toast(`${x.label} removed`); } catch (e) { fb.error(e); }
  };
  return (
    <Modal title="Sections" subtitle="Classes of the school. Set each teacher's advisory class and sections in Edit Role."
      icon={<School size={20} />} onClose={onClose}
      footer={<><span className="grow" /><Button variant="ghost" onClick={onClose}>Close</Button></>}>
      {s.editing ? (
        <div className="col gap-12" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div className="row gap-12" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Field label="Grade level">
              <Select value={s.editing.gradeLevelId ?? ''} onChange={(e) => c.setEditing({ gradeLevelId: e.target.value ? Number(e.target.value) : null })}>
                {s.gradeLevels.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field></div>
            <div style={{ flex: 2 }}><Field label="Section name">
              <TextInput autoFocus placeholder="e.g. Rizal" value={s.editing.name} maxLength={60}
                onChange={(e) => c.setEditing({ name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && c.canSave) void c.save(); }} />
            </Field></div>
          </div>
          {s.error && <div className="alert red">{s.error}</div>}
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => c.cancel()}>Cancel</Button>
            <Button size="sm" disabled={!c.canSave} loading={s.saving} onClick={() => void c.save()}>
              {s.editing.id === null ? 'Add section' : 'Save section'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="row mb-12"><Button size="sm" icon={<Plus size={16} />} onClick={() => c.startAdd()}>Add section</Button></div>
      )}
      {s.loading ? <div className="center-fill" style={{ padding: 24 }}><Spinner /></div>
        : !s.sections.length ? <div className="caption" style={{ padding: 12 }}>No sections yet. Add the school's classes, then set each teacher's advisory class in Edit Role.</div>
        : (
          <div className="col gap-12" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {c.byGrade.map((g) => (
              <div key={g.grade} className="col gap-4">
                <div style={{ fontSize: 13, fontWeight: 700 }}>{g.grade}</div>
                {g.sections.map((x) => (
                  <div key={x.id} className="row gap-12" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{x.name}</div>
                      <div className="caption">{SectionsController.summary(x)}</div>
                      {x.teachers.length > 0 && (
                        <div className="caption ellipsis" title={x.teachers.map((t) => `${t.subject}: ${t.name}`).join(', ')}>
                          {x.teachers.map((t) => `${t.subject}: ${t.name}`).join(' · ')}
                        </div>
                      )}
                    </div>
                    <IconButton small title={`Rename ${x.label}`} onClick={() => c.startEdit(x)}><Pencil size={15} /></IconButton>
                    <IconButton small title={`Remove ${x.label}`} onClick={() => void remove(x)}><Trash2 size={15} color="var(--red)" /></IconButton>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
    </Modal>
  );
}
