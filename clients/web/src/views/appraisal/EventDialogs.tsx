import { Copy, MessageSquare } from 'lucide-react';
import { EVENT_RATING_CRITERIA, EventAppraisal, EventRatingController } from '@shared/controllers/AppraisalControllers';
import { EventForAppraisal } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Modal, TextArea } from '../../ui/kit';
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
