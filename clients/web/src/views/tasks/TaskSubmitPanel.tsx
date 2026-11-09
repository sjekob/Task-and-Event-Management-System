import { CheckCircle2, Clock, FileText, Link2, Send, Upload, X, Zap } from 'lucide-react';
import { ReportFormController, TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Report, Task } from '@shared/models';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { CommentItem, InlineCommentInput } from '../../ui/Comments';
import { Button, pickFiles } from '../../ui/kit';
import { CommentProps, ReportAttachments, Run, SubmissionType } from './TaskDetailParts';

// Assignee side panel: points, the report form or the submitted report.
export function SubmitPanel({ c, run, commentProps, showHeader }: { c: TaskDetailController; run: Run; commentProps: CommentProps; showHeader: boolean }) {
  const t = c.task;
  const fb = useFeedback();
  return (
    <div className="col gap-12">
      {showHeader && <div style={{ fontSize: 16, fontWeight: 700, padding: '0 4px 2px' }}>Your Submission</div>}
      {!t.myReport && !t.isLoggedOnly && (
        <div className="td-points">
          <div className="row gap-6" style={{ fontSize: 13, fontWeight: 700 }}><Zap size={16} color="#fbbf24" />Points You Can Earn</div>
          <div className="mt-8">
            {TaskDetailController.pointsTable(t).map((p) => (
              <div key={p.label} className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{p.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: { green: '#6ee7b7', blue: '#93c5fd', amber: '#fcd34d', red: '#f87171' }[p.tone] }}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {t.myReport
        ? <SubmittedState task={t} r={t.myReport} onUnsubmit={async () => {
            if (await fb.confirm({ title: 'Unsubmit report?', message: 'You can submit again before the deadline.', confirmLabel: 'Unsubmit' })) {
              await run(() => c.unsubmit(), 'Report unsubmitted');
            }
          }} />
        : t.isLoggedOnly
          ? (
            <div className="row gap-10" style={{ padding: 12, background: '#f0fdf4', borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle2 size={20} color="var(--green)" />
              <div><div className="strong" style={{ color: 'var(--green)' }}>Submitted</div><div style={{ fontSize: 11, color: 'var(--green)' }}>Recorded in the task log; there is no report file to show.</div></div>
            </div>
          )
          : <ReportForm taskId={t.id} onSubmitted={() => void c.load()} />}
      <div className="td-white-card">
        <div style={{ fontSize: 14, fontWeight: 700, padding: '16px 16px 2px' }}>Private Comments</div>
        <div style={{ padding: '0 16px' }}>
          {t.privateComments.length === 0
            ? <div className="caption" style={{ paddingBottom: 14 }}>No private comments yet.</div>
            : t.privateComments.map((cm) => <CommentItem key={cm.id} comment={cm} {...commentProps(cm)} />)}
        </div>
        <hr className="divider" style={{ margin: 0 }} />
        <InlineCommentInput initials={c.user.initials} avatarUrl={c.user.avatarUrl} onSend={(text) => run(() => c.addComment(text, 'private'))} />
      </div>
    </div>
  );
}

export function ReportForm({ taskId, onSubmitted }: { taskId: number; onSubmitted: () => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new ReportFormController(services, taskId), [taskId]);
  const pick = async () => {
    const [f] = await pickFiles('*/*');
    if (f) c.setFile({ name: f.name, type: f.type, blob: f });
  };
  const submit = async () => {
    try { await c.submit(); fb.toast('Report submitted'); onSubmitted(); } catch (e) { fb.error(e); }
  };
  const added = s.file ? { icon: <FileText size={16} color="var(--accent)" />, text: s.file.name }
    : s.type === 'link' && s.link.trim() ? { icon: <Link2 size={16} color="var(--accent)" />, text: s.link.trim() } : null;
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="td-white-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Files &amp; Links</div>
        <div className="caption" style={{ marginTop: 2 }}>Attach your report as a file or share a link to it.</div>
        {added && (
          <div className="row gap-8" style={{ marginTop: 12, padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
            {added.icon}
            <span className="ellipsis grow" style={{ fontSize: 13, minWidth: 0 }}>{added.text}</span>
            <button type="button" aria-label="Remove" title="Remove" onClick={() => c.clear()}
              style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex' }}><X size={16} /></button>
          </div>
        )}
        {s.type === 'link' && (
          <div className="input-icon" style={{ marginTop: 10 }}>
            <Link2 size={16} />
            <input className="input" placeholder="https://drive.google.com/…" value={s.link} onChange={(e) => c.setLink(e.target.value)} autoFocus />
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Button variant="outline-muted" icon={<Upload size={16} />} style={{ flex: 1 }}
            onClick={() => { c.choose('file'); void pick(); }}>{s.file ? 'Replace file' : 'Upload file'}</Button>
          <Button variant="outline-muted" icon={<Link2 size={16} />} style={{ flex: 1 }}
            onClick={() => c.choose('link')}>Add link</Button>
        </div>
      </div>
      <Button size="lg" block disabled={!c.hasContent} loading={s.submitting} icon={<Send size={16} />} onClick={() => void submit()}
        style={{ borderRadius: 12, ...(c.hasContent ? {} : { background: 'var(--border)', color: 'var(--muted)', opacity: 1 }) }}>
        Submit Report
      </Button>
      {!c.hasContent && <div className="caption" style={{ textAlign: 'center', marginTop: -4 }}>Add a file or a link to submit.</div>}
    </div>
  );
}

export function SubmittedState({ task, r, onUnsubmit }: { task: Task; r: Report; onUnsubmit: () => void }) {
  const { points, reason } = TaskDetailController.earned(task, r);
  return (
    <div className="col gap-10" style={{ gap: 10 }}>
      <div className="alert green" style={{ border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12 }}>
        <CheckCircle2 size={20} color="var(--green)" />
        <div><div className="strong" style={{ color: 'var(--green)' }}>Submitted</div><div style={{ fontSize: 11 }}>Your report has been received</div></div>
      </div>
      <div className="td-white-card" style={{ padding: 14 }}>
        <SubmissionType type={r.reportType} />
        <div className="mt-8" style={{ fontSize: 13, fontWeight: 600 }}>{r.reportTitle}</div>
        <ReportAttachments r={r} />
      </div>
      <div className="td-points">
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Points Earned</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>+{points}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{reason}</div>
        {r.reportDate && (
          <div className="row gap-4 mt-8" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            <Clock size={12} />Submitted: {TaskDetailController.submittedAt(r)}
          </div>
        )}
      </div>
      <Button size="lg" block style={{ background: 'var(--dark)', borderRadius: 12 }} onClick={onUnsubmit}>Unsubmit</Button>
    </div>
  );
}
