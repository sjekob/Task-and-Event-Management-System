import { ReactNode, useState } from 'react';
import { CheckCircle2, CircleX, MessageSquare, Undo2 } from 'lucide-react';
import { EventDetailController, REVIEW_DECISION, SEND_BACK, SendBack } from '@shared/controllers/EventControllers';
import { AttendanceList, EventItem, EventReview } from '@shared/models';
import { formatDistance } from '@shared/utils/geo';
import { Button, Modal, TextArea } from '../../ui/kit';

const TONE = { green: '#16a34a', orange: '#c2410c', red: '#dc2626' };
const ICON = { approved: <CheckCircle2 size={15} />, revisions_requested: <Undo2 size={15} />, rejected: <CircleX size={15} /> };

/** Reject / Request revisions: the comment is required. [send] resolves true when it went through. */
export function SendBackDialog({ event, decision, onClose, send }: {
  event: EventItem; decision: SendBack; onClose: () => void; send: (comment: string) => Promise<boolean>;
}) {
  const t = SEND_BACK[decision];
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const reject = decision === 'rejected';
  return (
    <Modal title={`${t.title} · ${event.title}`} size="wide" locked={busy} onClose={onClose}
      footer={<>
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant={reject ? 'danger' : undefined} style={reject ? undefined : { background: '#c2410c' }} disabled={!comment.trim()} loading={busy}
          onClick={async () => { setBusy(true); if (!(await send(comment.trim()))) setBusy(false); }}>{t.confirm}</Button>
      </>}>
      <div className="col gap-12">
        <div className="body-md" style={{ color: 'var(--muted)' }}>{t.hint}</div>
        <label className="col gap-4">
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label} <span style={{ color: 'var(--red)' }}>*</span></span>
          <TextArea rows={5} autoFocus maxLength={4000} placeholder={t.placeholder} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

/** The approver's comment on a returned proposal, shown to the proponent. */
export function ReturnedBanner({ event, action }: { event: EventItem; action?: ReactNode }) {
  if (!event.isReturned) return null;
  const latest = event.latestReturn;
  const rejected = event.status === 'rejected';
  const tone = rejected ? TONE.red : TONE.orange;
  return (
    <div className="col gap-8" style={{ border: `1px solid ${tone}40`, background: `${tone}0d`, borderRadius: 12, padding: '14px 16px', color: tone }}>
      <div className="row gap-8" style={{ fontWeight: 700 }}>{rejected ? <CircleX size={18} /> : <Undo2 size={18} />}{rejected ? 'This proposal was rejected' : 'Revisions requested'}</div>
      {latest?.comment && (
        <div className="ev-quote" style={{ color: 'var(--text)' }}>
          <div style={{ fontSize: 13.5 }}>{latest.comment}</div>
          <div className="caption mt-4">{latest.reviewerName ?? 'Approver'} · {EventDetailController.when(latest.createdAt)}</div>
        </div>
      )}
      <div className="row wrap gap-8" style={{ color: 'var(--text)' }}>
        <span className="grow" style={{ fontSize: 13.5 }}>
          {rejected ? 'You can revise the proposal and submit it again for approval.' : 'Make the changes, then resubmit the proposal for approval.'}
        </span>
        {action}
      </div>
    </div>
  );
}

/** Every decision on the proposal, newest first. */
export function ReviewHistory({ reviews }: { reviews: EventReview[] }) {
  return (
    <div className="ev-timeline">
      {reviews.map((r) => {
        const d = REVIEW_DECISION[r.decision] ?? REVIEW_DECISION.approved;
        return (
          <div key={r.id}>
            <span style={{ color: TONE[d.tone], marginTop: 2 }}>{ICON[r.decision]}</span>
            <div className="grow">
              <div style={{ fontSize: 13.5, fontWeight: 700, color: TONE[d.tone] }}>{d.label}</div>
              <div className="caption">{r.reviewerName ?? 'Approver'} · {EventDetailController.when(r.createdAt)}</div>
              {r.comment && <div className="row-top gap-6 mt-4"><MessageSquare size={14} color="var(--light)" style={{ flexShrink: 0, marginTop: 3 }} /><span style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{r.comment}</span></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Who scanned the attendance QR codes, per session: personnel and guests (no TaskNet account). */
export function AttendanceTable({ list, error, total, guests }: { list: AttendanceList | null; error: string | null; total: number; guests: number }) {
  if (error) return <div className="caption" style={{ color: 'var(--red)' }}>{error}</div>;
  if (!list) return <div className="caption">Loading…</div>;
  if (!list.attendees.length) return <div className="caption">No one has scanned in yet. Time In / Time Out scans will appear here.</div>;
  const clock = EventDetailController.clock;
  return (
    <div className="col gap-16">
      <div className="caption">{total} scan record{total === 1 ? '' : 's'}{guests ? ` · ${guests} guest${guests === 1 ? '' : 's'} without a TaskNet account` : ''}</div>
      {list.sessions.map((s) => {
        const rows = list.attendees.filter((a) => a.activity_index === s.index);
        if (!rows.length) return null;
        return (
          <div key={s.index}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>{s.event}{s.time && <span className="caption"> · {s.time}</span>}</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ev-att-table" style={{ minWidth: 600 }}>
                <thead><tr><th>Name</th><th>Role</th><th>Time In</th><th>Time Out</th><th>Evaluation</th></tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{a.name || '—'}</span>{a.is_guest && <span className="badge purple" style={{ marginLeft: 6 }}>Guest</span>}
                        {a.is_guest && (a.email || a.affiliation) && <div className="caption">{[a.email, a.affiliation].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{a.role ? a.role.replace(/_/g, ' ') : '—'}</td>
                      <td>{clock(a.time_in_at)}{a.time_in_distance_m != null && <div className="caption">{formatDistance(a.time_in_distance_m)} from venue</div>}</td>
                      <td>{clock(a.time_out_at)}{a.time_out_distance_m != null && <div className="caption">{formatDistance(a.time_out_distance_m)} from venue</div>}</td>
                      <td>{a.evaluated_at ? <span style={{ color: 'var(--green)' }}>Submitted</span> : <span className="caption">{a.time_out_at ? 'Not yet' : '—'}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
