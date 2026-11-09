import { useState } from 'react';
import { ArrowRight, FileText, Link2 } from 'lucide-react';
import { EvaluateSpecialTaskController, SpecialTaskStats } from '@shared/controllers/AppraisalControllers';
import { IPCRF_LABELS, Mov, SpecialTask, ipcrfRating } from '@shared/models';
import { useMediaUrl, useServices } from '../../app/AppContext';
import { FileViewerDialog } from '../../ui/FileViewerDialog';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Modal, Select, TextArea } from '../../ui/kit';

export function TaskFacts({ t }: { t: SpecialTask }) {
  const f = (label: string, value: string) => <div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div></div>;
  return (
    <div className="grid-2" style={{ gap: '16px 24px' }}>
      {f('Personnel', t.assigneeName ?? '—')}{f('Department', t.assigneeDepartment ?? '—')}
      {f('Assigned By', t.assignerName ?? '—')}{f('Supervisor', '—')}
      {f('Task', t.title)}{f('Submitted', SpecialTaskStats.fmtDate(t.submittedDate))}
      {f('Due Date', SpecialTaskStats.fmtDate(t.dueDate))}
    </div>
  );
}

/** The assignee's submitted file / link (means of verification). */
export function MovList({ task }: { task: SpecialTask }) {
  const media = useMediaUrl();
  const [viewing, setViewing] = useState<Mov | null>(null);
  const open = (m: Mov) => {
    if (m.type === 'file') setViewing(m);
    else window.open(/^https?:/.test(m.url) ? m.url : `https://${m.url}`, '_blank', 'noreferrer');
  };
  return (
    <div className="mt-16">
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Attached MOVs:</div>
      {task.movs.length === 0 ? <div className="caption" style={{ fontStyle: 'italic' }}>No MOVs uploaded</div> : task.movs.map((m) => (
        <div key={m.id} className="row gap-8" style={{ marginBottom: 6 }}>
          {m.type === 'file' ? <FileText size={16} color="var(--accent)" /> : <Link2 size={16} color="var(--accent)" />}
          <span className="grow ellipsis" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>{m.name}</span>
          <Button variant="ghost" size="sm" onClick={() => open(m)}>View MOV</Button>
        </div>
      ))}
      {viewing && <FileViewerDialog filename={viewing.name} url={media(viewing.url) ?? viewing.url} onClose={() => setViewing(null)} />}
    </div>
  );
}

const QET = [['quality', 'Quality (Q)'], ['efficiency', 'Efficiency (E)'], ['timeliness', 'Timeliness (T)']] as const;

export function EvaluateSpecialTaskDialog({ task, onClose }: { task: SpecialTask; onClose: (updated: SpecialTask | null) => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new EvaluateSpecialTaskController(services, task), [task.id]);
  const submit = async () => { try { onClose(await c.submit()); } catch (e) { fb.error(e); } };
  return (
    <Modal title="Evaluate Special Task" subtitle={task.title} size="wide" onClose={() => onClose(null)}
      footer={s.step === 1 ? (
        <><Button variant="ghost" onClick={() => onClose(null)}>Close</Button><Button onClick={() => c.set({ step: 2 })}>Start Evaluation <ArrowRight size={16} /></Button></>
      ) : (
        <><Button variant="ghost" onClick={() => c.set({ step: 1 })}>Back</Button><Button variant="ghost" onClick={() => onClose(null)}>Close</Button><Button loading={s.submitting} onClick={() => void submit()}>Submit Evaluation</Button></>
      )}>
      {s.step === 1 ? <><TaskFacts t={task} /><MovList task={task} /></> : (
        <div className="col gap-16">
          <MovList task={task} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Rating (Scale 1 - 5):</div>
          {QET.map(([k, l]) => (
            <div key={k} className="row gap-12">
              <span className="grow" style={{ fontSize: 13, fontWeight: 600 }}>{l}:</span>
              <Select style={{ width: 250 }} value={s[k] || ''} onChange={(e) => c.set({ [k]: Number(e.target.value) })}>
                <option value="">Select rating</option>
                {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v} - {IPCRF_LABELS[v]}</option>)}
              </Select>
            </div>
          ))}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-dark)' }}>Final IPCRF Score: {c.finalScoreText}</div>
          <div><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Remarks:</div><TextArea rows={3} placeholder="Add performance comments..." value={s.remarks} onChange={(e) => c.set({ remarks: e.target.value })} /></div>
        </div>
      )}
    </Modal>
  );
}

export function ViewSpecialTaskDialog({ task, onClose }: { task: SpecialTask; onClose: () => void }) {
  const ev = task.evaluation;
  return (
    <Modal title="View Evaluation" subtitle={task.title} size="wide" onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <TaskFacts t={task} />
      <MovList task={task} />
      {ev && (
        <div className="mt-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Previous Evaluation:</div>
          {([['Quality (Q)', ev.completionScore], ['Efficiency (E)', ev.initiativeScore], ['Timeliness (T)', ev.timelinessScore]] as const).map(([l, v]) => (
            <div key={l} className="row" style={{ marginBottom: 8 }}><span className="grow" style={{ fontSize: 13 }}>{l}</span><span style={{ fontSize: 13, fontWeight: 600 }}>{v} - {IPCRF_LABELS[v] ?? '—'}</span></div>
          ))}
          <div className="row mt-12">
            <span className="grow" style={{ fontSize: 13, fontWeight: 700 }}>Final IPCRF Score</span>
            <span style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--accent-bg)', color: 'var(--accent-dark)', fontWeight: 700 }}>
              {(ev.weightedAverage ?? 0).toFixed(2)} / 5.00 ({ipcrfRating(ev.weightedAverage ?? 0)})
            </span>
          </div>
          {ev.remarks && <><div style={{ fontSize: 13, fontWeight: 700, marginTop: 12 }}>Coordinator Remarks:</div><div className="body-md mt-4">{ev.remarks}</div></>}
        </div>
      )}
    </Modal>
  );
}
