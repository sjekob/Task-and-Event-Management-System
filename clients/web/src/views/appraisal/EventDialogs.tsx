import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Copy, FileImage, FileText, MessageSquare, Upload } from 'lucide-react';
import { EVENT_RATING_CRITERIA, EventAppraisal, EventRatingController, PaperEvaluationController } from '@shared/controllers/AppraisalControllers';
import { EVALUATOR_AGE_GROUPS, EVALUATOR_ROLES, EVALUATOR_SEXES, EVENT_CRITERIA, EventEvaluation, EventForAppraisal, RATING_LABELS } from '@shared/models';
import { useMediaUrl, useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { FileViewerDialog } from '../../ui/FileViewerDialog';
import { Button, Field, Modal, Select, TextArea, TextInput, pickFiles } from '../../ui/kit';
import { Stars } from './common';
import { shareOrigin } from '../../app/shareOrigin';

export function LinkDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const fb = useFeedback();
  const url = EventAppraisal.evalUrl(shareOrigin(), event);
  return (
    <Modal title="Evaluation Link" subtitle={`Direct evaluation form link for "${event.title}":`} onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="row gap-8">
        <input className="input grow" readOnly value={url} onFocus={(e) => e.target.select()} />
        <Button variant="primary" icon={<Copy size={15} />} onClick={async () => { await navigator.clipboard.writeText(url); fb.toast('Evaluation link copied to clipboard', 'success'); }}>Copy</Button>
      </div>
    </Modal>
  );
}

export function DemographicsDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const d = EventAppraisal.demographics(event);
  return (
    <Modal title="Evaluator demographics" subtitle={`${event.title} · ${d.total} ${d.total === 1 ? 'evaluation' : 'evaluations'}`} size="wide" onClose={onClose}>
      {!d.total ? <div className="body-md">No evaluations yet.</div> : d.groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{g.title}</div>
          {g.rows.map((r) => (
            <div key={r.label} className="row gap-12" style={{ marginBottom: 8 }}>
              <span className="ellipsis" style={{ width: 150, fontSize: 13, color: r.unspecified ? 'var(--light)' : 'var(--text)' }}>{r.label}</span>
              <div className="progress grow" style={{ height: 10, background: 'var(--tint)' }}><div style={{ width: `${r.pct}%`, background: r.unspecified ? 'var(--light)' : 'var(--accent)' }} /></div>
              <span style={{ width: 90, textAlign: 'right', fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{r.count} · {r.pct}%</span>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}

export function EventRatingDialog({ event, onClose }: { event: EventForAppraisal; onClose: (updated: EventForAppraisal | null) => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new EventRatingController(services, event), [event.id]);
  return (
    <Modal title={`Evaluate: ${event.title}`} icon={<MessageSquare size={18} style={{ marginTop: 3 }} />} onClose={() => onClose(null)}
      footer={<><Button variant="ghost" onClick={() => onClose(null)}>Cancel</Button><Button loading={s.submitting} onClick={async () => { try { onClose(await c.submit()); } catch (e) { fb.error(e); } }}>Submit</Button></>}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Rating Criteria</div>
      <div className="col gap-12">
        {EVENT_RATING_CRITERIA.map((k) => (
          <div key={k.key}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{k.label}</div><Stars value={s.scores[k.key]} onChange={(v) => c.rate(k.key, v)} /></div>
        ))}
        {c.started && <div style={{ padding: 10, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>Average Score: {c.average.toFixed(2)} / 5</div>}
        <TextArea rows={5} placeholder="Comments (optional)" value={s.comments} onChange={(e) => c.setComments(e.target.value)} />
      </div>
    </Modal>
  );
}

/**
 * An event's evaluation results (from Lok's appraisal update): the aggregate
 * summary per criterion, and each response, where a paper one opens the photo
 * or scan of the form.
 */
export function ResultsDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const media = useMediaUrl();
  const [tab, setTab] = useState<'summary' | 'responses'>('summary');
  const [open, setOpen] = useState<number | null>(null);
  const [scan, setScan] = useState<EventEvaluation | null>(null);
  const n = event.evaluations.length;
  return (
    <Modal title="Evaluation Results" subtitle={`${event.title} · ${n} ${n === 1 ? 'response' : 'responses'}${event.paperCount ? ` (${event.paperCount} on paper)` : ''}`}
      icon={<BarChart3 size={20} />} size="wide" onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="ap-seg" role="tablist">
        <button role="tab" aria-selected={tab === 'summary'} className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}>Aggregate Summary</button>
        <button role="tab" aria-selected={tab === 'responses'} className={tab === 'responses' ? 'on' : ''} onClick={() => setTab('responses')}>Individual Responses</button>
      </div>
      {tab === 'summary' ? (
        <div className="col gap-12 mt-16">
          <div className="row gap-12" style={{ alignItems: 'baseline' }}>
            <span style={{ fontSize: 30, fontWeight: 800 }}>{event.avgRating.toFixed(2)}</span>
            <span className="muted">/ 5 average · {event.evidencyRate.toFixed(0)}% evidency rate</span>
          </div>
          {event.criterionAverages.map((x) => (
            <div key={x.label}>
              <div className="row between" style={{ fontSize: 13 }}><span>{x.label}</span><b>{x.avg.toFixed(2)}</b></div>
              <div className="progress mt-4"><div style={{ width: `${(x.avg / 5) * 100}%`, background: 'var(--accent)' }} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="col gap-8 mt-16">
          {event.evaluations.map((ev) => (
            <div key={ev.id} className="ap-resp">
              <button type="button" className="ap-resp-head" aria-expanded={open === ev.id} onClick={() => setOpen(open === ev.id ? null : ev.id)}>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: 'block' }}>{ev.evaluatorName}</b>
                  <span className="caption">{[ev.evaluatorRole, ev.evaluatorSex, ev.evaluatorAgeGroup].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                {ev.isPaper && <span className="badge amber">Paper</span>}
                <b>{ev.average.toFixed(1)} / 5</b>
              </button>
              {open === ev.id && (
                <div className="ap-resp-body">
                  {EVENT_CRITERIA.map((cr) => (
                    <div key={cr.key} className="row between" style={{ fontSize: 13 }}>
                      <span className="muted">{cr.label}</span>
                      <span>{String(ev[cr.key])} / 5 · {RATING_LABELS[Number(ev[cr.key])] ?? ''}</span>
                    </div>
                  ))}
                  {ev.feedbackComments && <div className="mt-8" style={{ fontSize: 13 }}>&ldquo;{ev.feedbackComments}&rdquo;</div>}
                  {ev.isPaper && ev.imageUrl && (
                    <div className="mt-8"><Button size="sm" variant="outline-muted" icon={<FileImage size={15} />} onClick={() => setScan(ev)}>View Scanned Paper Form</Button></div>
                  )}
                </div>
              )}
            </div>
          ))}
          {!n && <div className="caption" style={{ textAlign: 'center', padding: 16 }}>No responses yet.</div>}
        </div>
      )}
      {scan?.imageUrl && <FileViewerDialog filename={scan.imageUrl.split('/').pop() ?? 'paper-form'} url={media(scan.imageUrl) ?? scan.imageUrl} onClose={() => setScan(null)} />}
    </Modal>
  );
}

/** Record a paper evaluation form: a photo or scan of it, who filled it in, the six ratings and remarks. */
export function PaperEvaluationDialog({ event, onClose }: { event: EventForAppraisal; onClose: (updated: EventForAppraisal | null) => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new PaperEvaluationController(services, event), [event.id]);
  const preview = useMemo(() => (s.image?.blob && /^image\//.test(s.image.type ?? '') ? URL.createObjectURL(s.image.blob) : null), [s.image]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const pick = async () => {
    const [f] = await pickFiles('image/*,application/pdf');
    if (f) c.setImage({ name: f.name, type: f.type, blob: f });
  };
  const save = async () => {
    const updated = await c.submit();
    if (updated) { fb.toast('Paper evaluation recorded with its scanned form.', 'success'); onClose(updated); }
  };
  return (
    <Modal title="Upload Paper Evaluation" icon={<FileImage size={20} />} size="wide" onClose={() => onClose(null)}
      subtitle={`Record a filled-in paper evaluation form for "${event.title}", with a photo or scan of it as proof.`}
      footer={<>
        <span className="caption grow">{c.missing.length ? `Still needed: ${c.missing.join(', ')}.` : 'Ready to save.'}</span>
        <Button variant="ghost" onClick={() => onClose(null)}>Cancel</Button>
        <Button loading={s.submitting} disabled={c.missing.length > 0} onClick={() => void save()}>Save Paper Evaluation</Button>
      </>}>
      <div className="col gap-16">
        <div className="ap-paper-drop">
          {s.image ? (
            <>
              {preview ? <img src={preview} alt="The paper form" /> : <div className="row gap-8"><FileText size={20} /><b>{s.image.name}</b></div>}
              <Button size="sm" variant="outline-muted" onClick={() => void pick()}>Change Image</Button>
            </>
          ) : (
            <>
              <FileImage size={28} color="var(--muted)" />
              <div className="caption">A clear photo (JPG, PNG) or scanned PDF of the whole form</div>
              <Button size="sm" icon={<Upload size={15} />} onClick={() => void pick()}>Choose photo or scan</Button>
            </>
          )}
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Evaluator's name"><TextInput placeholder="e.g., Juan Dela Cruz or Paper Evaluator" value={s.name} onChange={(e) => c.set({ name: e.target.value })} /></Field>
          <Field label="Evaluator is a">
            <Select value={s.role} onChange={(e) => c.set({ role: e.target.value })}>
              {EVALUATOR_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Sex">
            <Select value={s.sex} onChange={(e) => c.set({ sex: e.target.value })}>
              <option value="">Not stated</option>{EVALUATOR_SEXES.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="Age group">
            <Select value={s.ageGroup} onChange={(e) => c.set({ ageGroup: e.target.value })}>
              <option value="">Not stated</option>{EVALUATOR_AGE_GROUPS.map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ratings on the form (1-5)</div>
          <div className="grid-2" style={{ gap: 12 }}>
            {EVENT_RATING_CRITERIA.map((k) => (
              <Field key={k.key} label={k.label}>
                <Select value={s.scores[k.key] || ''} onChange={(e) => c.rate(k.key, Number(e.target.value) || 0)}>
                  <option value="">Select rating</option>
                  {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v} - {RATING_LABELS[v]}</option>)}
                </Select>
              </Field>
            ))}
          </div>
        </div>
        <Field label="Remarks on the form"><TextArea rows={3} placeholder="Enter any remarks written on the paper form..." value={s.comments} onChange={(e) => c.set({ comments: e.target.value })} /></Field>
        {s.error && <div className="alert red">{s.error}</div>}
      </div>
    </Modal>
  );
}
