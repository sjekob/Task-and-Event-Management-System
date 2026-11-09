import { useEffect, useState } from 'react';
import { Archive, GraduationCap, Info, Pencil, Plus, Trash2, X } from 'lucide-react';
import { SchoolYearFormController, SchoolYearsController } from '@shared/controllers/SchoolYearControllers';
import { SchoolYear } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Badge, Banner, Button, Field, IconButton, Loading, Modal, TextInput } from '../../ui/kit';
import { DepedCalendarSection } from '../deped/DepedCalendarSection';

export default function SchoolYearsView() {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new SchoolYearsController(services), []);
  const [editing, setEditing] = useState<SchoolYear | null | 'new'>(null);
  useEffect(() => { void c.load(); }, [c]);

  const remove = async (y: SchoolYear) => {
    const ok = await fb.confirm({
      title: `Remove S.Y. ${y.name}?`, danger: true, confirmLabel: `Remove S.Y. ${y.name}`, cancelLabel: 'Keep it',
      message: 'Only the calendar entry is removed. Tasks, events and appraisal records are kept; they just stop being grouped under this school year.',
    });
    if (!ok) return;
    try { await c.remove(y); } catch (e) { fb.error(e); }
  };

  return (
    <div className="col gap-16">
      <Banner title="School Year" subtitle="Set when each school year and term starts and ends. Records from school years that have ended are archived automatically." />
      <div className="row">
        <span className="grow" style={{ fontSize: 18, fontWeight: 700 }}>School years</span>
        <Button icon={<Plus size={18} />} onClick={() => setEditing('new')}>Add school year</Button>
      </div>
      {s.loading ? <Loading /> : s.error ? <div className="card">{s.error}</div> : !s.years.length ? (
        <div className="card row gap-12"><Info size={20} color="var(--muted)" />
          <span className="body-md">No school year set up yet, so nothing is archived. Add the current school year and its terms to start grouping tasks, events and appraisals by year.</span>
        </div>
      ) : s.years.map((y) => {
        const st = SchoolYearsController.statusStyle(y.status);
        return (
          <div key={y.id} className="card flat" style={{ borderColor: 'var(--border)', padding: 18 }}>
            <div className="row gap-12">
              <span className="att-icon" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--tint)', color: 'var(--dark)' }}>
                {y.status === 'archived' ? <Archive size={20} /> : <GraduationCap size={20} />}
              </span>
              <div className="grow">
                <div className="row gap-8"><span style={{ fontSize: 16, fontWeight: 700 }}>S.Y. {y.name}</span><Badge color={st.tone}>{st.label}</Badge></div>
                <div className="body-md">{SchoolYearsController.range(y.startDate, y.endDate)}</div>
              </div>
              <IconButton title={`Edit S.Y. ${y.name}`} onClick={() => setEditing(y)}><Pencil size={20} /></IconButton>
              <IconButton title={`Remove S.Y. ${y.name}`} onClick={() => void remove(y)}><Trash2 size={20} /></IconButton>
            </div>
            <div className="mt-12">
              {!y.terms.length ? <div className="body-sm">No terms set — add quarters/terms to filter appraisals by term.</div> : (
                <div className="row wrap gap-10">
                  {y.terms.map((t) => {
                    const ts = SchoolYearsController.statusStyle(t.status);
                    const cur = t.status === 'current';
                    return (
                      <div key={t.id} style={{ width: 220, padding: 12, borderRadius: 10, background: cur ? '#f0fdf4' : 'var(--surface-2)', border: `1px solid ${cur ? '#86efac' : 'var(--border)'}` }}>
                        <div className="row gap-8"><span className="grow ellipsis" style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span><Badge color={ts.tone}>{ts.label}</Badge></div>
                        <div className="caption mt-4">{SchoolYearsController.range(t.startDate, t.endDate)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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
    </div>
  );
}

function SchoolYearDialog({ existing, onClose }: { existing: SchoolYear | null; onClose: (saved: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new SchoolYearFormController(services, existing), [existing?.id]);
  return (
    <Modal title={c.title} size="wide" onClose={() => onClose(false)}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button><Button loading={s.saving} onClick={async () => { if (await c.save()) onClose(true); }}>{c.submitLabel}</Button></>}>
      <div className="col gap-12">
        <Field label="School year"><TextInput placeholder="e.g. 2026-2027" value={s.name} onChange={(e) => c.set({ name: e.target.value })} autoFocus /></Field>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Starts"><TextInput type="date" value={s.start} onChange={(e) => c.set({ start: e.target.value })} /></Field>
          <Field label="Ends"><TextInput type="date" value={s.end} min={s.start || undefined} onChange={(e) => c.set({ end: e.target.value })} /></Field>
        </div>
        <div className="row mt-8">
          <span className="grow" style={{ fontSize: 14, fontWeight: 700 }}>Terms</span>
          <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => c.addTerm()}>Add term</Button>
        </div>
        <div className="body-sm" style={{ color: 'var(--muted)' }}>Terms must fall inside the school year and must not overlap.</div>
        {s.terms.map((t, i) => (
          <div key={i} className="row wrap gap-10" style={{ alignItems: 'flex-end' }}>
            <Field label="Term name" className="grow" ><TextInput value={t.name} onChange={(e) => c.setTerm(i, { name: e.target.value })} /></Field>
            <Field label="Starts"><TextInput type="date" value={t.start} min={s.start || undefined} max={s.end || undefined} onChange={(e) => c.setTerm(i, { start: e.target.value })} /></Field>
            <Field label="Ends"><TextInput type="date" value={t.end} min={t.start || s.start || undefined} max={s.end || undefined} onChange={(e) => c.setTerm(i, { end: e.target.value })} /></Field>
            <IconButton title={`Remove ${t.name}`} onClick={() => c.removeTerm(i)} style={{ marginBottom: 4 }}><X size={18} /></IconButton>
          </div>
        ))}
        {s.error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{s.error}</div>}
      </div>
    </Modal>
  );
}
