import { FileText, Lock } from 'lucide-react';
import { TaskDetailController } from '@shared/controllers/TaskDetailController';
import { CommentInput, CommentItem } from '../../ui/Comments';
import { Avatar } from '../../ui/kit';
import { CommentProps, ReportAttachments, ReportStatusChip, Run, SubmissionType } from './TaskDetailParts';

// Reviewer side panel: one assignee's report, its status and private comments.
export function ReviewPanel({ c, run, commentProps }: { c: TaskDetailController; run: Run; commentProps: CommentProps }) {
  const r = c.selectedReport;
  const t = c.task;
  if (!r) {
    return (
      <div>
        <div className="td-title">Submission</div>
        <div className="empty">
          <span className="avatar" style={{ width: 56, height: 56, background: '#eef2fa', color: 'var(--muted)' }}><FileText size={22} /></span>
          <div className="label">{t.reports.length ? 'No submission selected' : 'No submissions yet'}</div>
          <div className="body-sm">{t.reports.length ? 'Choose someone marked "Pending review" or "Completed" to read their report.' : 'Reports appear here once assignees submit.'}</div>
        </div>
      </div>
    );
  }
  const comments = c.privateCommentsFor(r);
  return (
    <div>
      <div className="caption">Submission</div>
      <div className="row gap-12 mt-8">
        <Avatar url={r.avatarUrl} initials={(r.fullName ?? '?').charAt(0).toUpperCase()} size={36} />
        <div className="grow">
          <div className="td-title ellipsis">{r.fullName}</div>
          {r.gradeLevel && <div className="body-sm">{r.gradeLevel}</div>}
        </div>
        <ReportStatusChip status={r.reportStatus} />
      </div>
      <div className="panel mt-16">
        <SubmissionType type={r.reportType} />
        <div className="label mt-8">{r.reportTitle}</div>
        {r.reportDescription && <div className="body-md mt-4">{r.reportDescription}</div>}
        <ReportAttachments r={r} />
      </div>
      <div className="caption mt-12 mb-8">Mark this submission as</div>
      <div className="row gap-8">
        <button className="btn sm" style={{ background: '#fff', color: 'var(--green-dark)', border: '1px solid var(--green)' }}
          onClick={() => void run(() => c.setReportStatus(r.id, 'Completed'), 'Marked completed')}>Completed</button>
        <button className="btn sm" style={{ background: '#fff', color: 'var(--red)', border: '1px solid var(--red)' }}
          onClick={() => void run(() => c.setReportStatus(r.id, 'Missing'), 'Marked missing')}>Missing</button>
      </div>
      <hr className="divider" style={{ margin: '20px 0 16px' }} />
      <div className="row gap-6"><Lock size={15} color="var(--muted)" /><span className="td-title">Private comments</span></div>
      <div className="body-sm mt-4 mb-12">Only visible to the submitter and reviewers.</div>
      {comments.length === 0 ? <div className="body-md mb-8">No private comments yet.</div> : comments.map((cm) => <CommentItem key={cm.id} comment={cm} {...commentProps(cm)} />)}
      <CommentInput placeholder="Add private comment..." onSend={(text) => run(() => c.addComment(text, 'private', r.id))} />
    </div>
  );
}
