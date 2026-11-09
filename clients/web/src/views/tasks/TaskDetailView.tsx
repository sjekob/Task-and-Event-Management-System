import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Comment } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useIsMobile, useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Avatar } from '../../ui/kit';
import './taskDetail.css';
import { MainContent } from './TaskDetailMain';
import { DetailSkeleton, ReportStatusChip } from './TaskDetailParts';
import { ReviewPanel } from './TaskReviewPanel';
import { SubmitPanel } from './TaskSubmitPanel';
import { WorkSheet } from './WorkSheet';

export default function TaskDetailView({ backTo, ownTaskView }: { backTo: string; ownTaskView?: boolean }) {
  const { id } = useParams();
  const services = useServices();
  const { user } = useSession();
  const navigate = useNavigate();
  const fb = useFeedback();
  const isMobile = useIsMobile();
  const [c, s] = useScreenController(() => new TaskDetailController(services, user!, Number(id), !!ownTaskView), [id, ownTaskView]);
  useEffect(() => { void c.load(); }, [c]);
  // Phones: the submission sheet (collapsed until someone is opened or the bar is tapped).
  const [sheet, setSheet] = useState(false);

  if (s.loading) return <DetailSkeleton />;
  if (!s.task) return <div className="empty">Task not found</div>;

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try { await fn(); if (done) fb.toast(done); } catch (e) { fb.error(e); }
  };
  const editComment = async (cm: Comment) => {
    const text = await fb.prompt({ title: 'Edit Comment', input: { label: 'Comment', required: true, initial: cm.content }, confirmLabel: 'Save' });
    if (text) await run(() => c.editComment(cm.id, text));
  };
  const deleteComment = async (cm: Comment) => {
    if (await fb.confirm({ title: 'Delete comment?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) {
      await run(() => c.deleteComment(cm.id));
    }
  };
  const commentProps = (cm: Comment) => c.isMine(cm) ? { onEdit: () => void editComment(cm), onDelete: () => void deleteComment(cm) } : {};

  const side = c.isReviewOnly
    ? <ReviewPanel c={c} run={run} commentProps={commentProps} inSheet={isMobile} />
    : <SubmitPanel c={c} run={run} commentProps={commentProps} showHeader={!isMobile} />;

  const main = (
    <div className="col gap-16">
      <button className="td-back" onClick={() => navigate(backTo)} aria-label="Back"><ArrowLeft size={16} /></button>
      <MainContent c={c} run={run} commentProps={commentProps} backTo={backTo} onPickAssignee={isMobile ? () => setSheet(true) : undefined} />
    </div>
  );

  if (isMobile) {
    const r = c.selectedReport;
    const own = c.ownStatus;
    const summary = c.isReviewOnly
      ? (r ? (
        <div className="row gap-10">
          <Avatar url={r.avatarUrl} initials={(r.fullName ?? '?').charAt(0).toUpperCase()} size={34} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 700 }}>{r.fullName}</div>
            <div className="caption ellipsis">{c.mobileDeadlineText}</div>
          </div>
          <ReportStatusChip status={r.reportStatus} />
        </div>
      ) : (
        <div className="row between gap-8">
          <span className="h3">Submission</span>
          <span className="caption">Tap someone above to see their work</span>
        </div>
      ))
      : (
        <div className="row gap-8">
          <span className="h3 grow">Your work</span>
          {own && <span className={`badge ${own.tone}`}>{own.label}</span>}
        </div>
      );
    return (
      <div className="ws-page">
        {main}
        <WorkSheet open={sheet} onOpenChange={setSheet} summary={summary}>{side}</WorkSheet>
      </div>
    );
  }
  return (
    <div className="td-layout">
      <div className="td-main">{main}</div>
      <aside className={`td-side ${c.isReviewOnly ? 'white' : ''}`}>{side}</aside>
    </div>
  );
}
