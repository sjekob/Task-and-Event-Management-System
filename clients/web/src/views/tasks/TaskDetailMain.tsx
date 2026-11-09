import { useNavigate } from 'react-router-dom';
import { ClipboardList, Flag, MessageSquare, Pencil, PlayCircle, Star, Users } from 'lucide-react';
import { TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Format } from '@shared/utils/format';
import { CommentInput, CommentItem } from '../../ui/Comments';
import { Button } from '../../ui/kit';
import { AssigneesCard } from './TaskAssignees';
import { CommentProps, Legend, Meta, Pill, Run } from './TaskDetailParts';

// Task detail: header, progress, instructions and public comments.
export function MainContent({ c, run, commentProps, backTo, onPickAssignee }: {
  c: TaskDetailController; run: Run; commentProps: CommentProps; backTo: string;
  /** Someone's submission was opened from the list (phones open the sheet). */
  onPickAssignee?: () => void;
}) {
  const navigate = useNavigate();
  const t = c.task;
  const reviewing = c.isReviewOnly;
  const p = c.progress;
  const own = c.ownStatus;
  return (
    <>
      <div className="td-card">
        <div className="row-top gap-16">
          <span className="td-icon">{t.isSpecial ? <Star size={24} /> : <ClipboardList size={24} />}</span>
          <div className="grow">
            <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, margin: 0, overflowWrap: 'anywhere' }}>{t.title}</h1>
            <div className="row wrap gap-6 mt-8">
              <Pill tone="gray">{t.isSpecial ? 'Special task' : 'Task'}</Pill>
              {t.status !== 'active' && <Pill tone="gray">Disabled</Pill>}
              {own && <Pill tone={own.tone}>{own.label}</Pill>}
            </div>
          </div>
          {t.canEdit && (
            <Button variant="outline-muted" size="sm" icon={<Pencil size={16} />} onClick={() => navigate(`${backTo}/${t.id}/edit`)}>Edit task</Button>
          )}
        </div>
        <hr className="divider" style={{ margin: '16px 0 14px' }} />
        <div className="row wrap" style={{ gap: '12px 32px' }}>
          <Meta icon={<PlayCircle size={18} />} label="Start" value={t.startDate ? Format.longDate(t.startDate) : 'Not set'} />
          <Meta icon={<Flag size={18} />} label="Deadline" value={c.deadlineText} danger={c.pastDue} note={c.pastDue ? 'Past deadline' : undefined} />
          {reviewing && (
            <Meta icon={<Users size={18} />} label={c.mineOnly ? 'Assigned by you' : 'Assigned'}
              value={c.mineOnly ? `${p.total} of ${t.assignedUsers.length} people` : Format.plural(p.total, 'person', 'people')} />
          )}
        </div>
      </div>

      {reviewing && (p.total > 0 || c.mineOnly) && (
        <div className="td-card">
          <div className="row between">
            <span className="td-title">Submission progress</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: p.submitted >= p.total ? '#15803d' : 'var(--text)' }}>{p.submitted} of {p.total} submitted</span>
          </div>
          {c.mineOnly && <div className="caption mt-4">Counting the {Format.plural(p.total, 'person', 'people')} you assigned ({t.assignedUsers.length} on this task in total).</div>}
          <div className="progress mt-12" style={{ height: 10, background: 'var(--tint)' }}>
            <div style={{ width: `${p.total ? (p.submitted / p.total) * 100 : 0}%`, background: p.submitted >= p.total ? 'var(--green)' : 'var(--accent)' }} />
          </div>
          <div className="row wrap gap-20 mt-12">
            <Legend color="var(--green)" label="Submitted" count={p.submitted} />
            <Legend color="var(--amber)" label="Not yet submitted" count={p.pending} />
            <Legend color="var(--red)" label="Missing (past deadline)" count={p.missing} />
          </div>
        </div>
      )}

      <div className="td-card">
        <div className="td-title">Instructions</div>
        <div className="pre-wrap mt-8" style={{ fontSize: 15, lineHeight: 1.6, color: t.instructions?.trim() ? 'var(--text)' : 'var(--light)' }}>
          {t.instructions?.trim() || 'No instructions provided.'}
        </div>
      </div>

      {reviewing && <AssigneesCard c={c} run={run} onPick={onPickAssignee} />}

      <div className="td-card">
        <div className="row gap-8">
          <MessageSquare size={18} color="var(--muted)" />
          <span className="td-title">Public comments</span>
          {t.publicComments.length > 0 && <Pill tone="gray">{t.publicComments.length}</Pill>}
        </div>
        <div className="caption mt-4 mb-12">Visible to everyone assigned to this task.</div>
        {t.publicComments.map((cm) => <CommentItem key={cm.id} comment={cm} {...commentProps(cm)} />)}
        <CommentInput placeholder="Add a comment..." onSend={(text) => run(() => c.addComment(text, 'public'))} />
      </div>
    </>
  );
}
