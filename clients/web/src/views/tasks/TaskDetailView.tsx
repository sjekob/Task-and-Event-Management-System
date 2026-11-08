import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Comment } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useIsMobile, useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import './taskDetail.css';
import { MainContent } from './TaskDetailMain';
import { DetailSkeleton } from './TaskDetailParts';
import { ReviewPanel } from './TaskReviewPanel';
import { SubmitPanel } from './TaskSubmitPanel';

export default function TaskDetailView({ backTo, ownTaskView }: { backTo: string; ownTaskView?: boolean }) {
  const { id } = useParams();
  const services = useServices();
  const { user } = useSession();
  const navigate = useNavigate();
  const fb = useFeedback();
  const isMobile = useIsMobile();
  const [c, s] = useScreenController(() => new TaskDetailController(services, user!, Number(id), !!ownTaskView), [id, ownTaskView]);
  useEffect(() => { void c.load(); }, [c]);

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
    ? <ReviewPanel c={c} run={run} commentProps={commentProps} />
    : <SubmitPanel c={c} run={run} commentProps={commentProps} showHeader={!isMobile} />;

  const main = (
    <div className="col gap-16">
      <button className="td-back" onClick={() => navigate(backTo)} aria-label="Back"><ArrowLeft size={16} /></button>
      <MainContent c={c} run={run} commentProps={commentProps} backTo={backTo} />
    </div>
  );

  if (isMobile) {
    return (
      <div>
        {main}
        <div className="td-sheet">
          <div className="row between" style={{ padding: '0 4px 10px' }}>
            <span className="h3">{c.isReviewOnly ? 'Submission' : 'Your work'}</span>
            <span className="body-md ellipsis">{c.mobileDeadlineText}</span>
          </div>
          {side}
        </div>
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
