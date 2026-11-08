import { useEffect } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Comment } from '@shared/models';
import { Format } from '@shared/utils/format';
import { useServices, useSession } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Badge, Bone, Button, C, Empty, Icon, IconTile, Progress, Row, Screen, T } from '../../ui/kit';
import { CommentInput, CommentItem } from '../common/Comments';
import { AssigneesCard } from './TaskAssignees';
import { Block, Legend, Meta } from './TaskDetailParts';
import { ReviewPanel, SubmitPanel } from './TaskPanels';

/** /task/[id]?own=1&base=/my-tasks — a task as its assignee (own) or its creator / reviewer. */
export default function TaskDetailScreen() {
  const { id, own, base = '/tasks' } = useLocalSearchParams<{ id: string; own?: string; base?: string }>();
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new TaskDetailController(services, user!, Number(id), own === '1'), [id, own]);
  useEffect(() => { void c.load(); }, [c]);

  const header = <Stack.Screen options={{ title: s.task?.isSpecial ? 'Special Task' : 'Task' }} />;
  if (s.loading) return <Screen>{header}<Bone h={150} r={14} /><Bone h={120} r={14} /><Bone h={200} r={14} /></Screen>;
  if (!s.task) return <Screen>{header}<Empty icon="clipboard" title="Task not found" /></Screen>;

  const t = c.task;
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try { await fn(); if (done) fb.toast(done); } catch (e) { fb.error(e); }
  };
  const editComment = async (cm: Comment) => {
    const text = await fb.prompt({ title: 'Edit Comment', input: { label: 'Comment', required: true, initial: cm.content }, confirmLabel: 'Save' });
    if (text) await run(() => c.editComment(cm.id, text));
  };
  const deleteComment = async (cm: Comment) => {
    if (await fb.confirm({ title: 'Delete comment?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) await run(() => c.deleteComment(cm.id));
  };
  const commentProps = (cm: Comment) => (c.isMine(cm) ? { onEdit: () => void editComment(cm), onDelete: () => void deleteComment(cm) } : {});
  const reviewing = c.isReviewOnly;
  const p = c.progress;
  const ownStatus = c.ownStatus;

  return (
    <Screen onRefresh={() => c.load()}>
      {header}
      <Block>
        <Row gap={12} style={{ alignItems: 'flex-start' }}>
          <IconTile name={t.isSpecial ? 'star' : 'clipboard'} tone="blue" size={44} />
          <View style={{ flex: 1, gap: 6 }}>
            <T size={19} weight={700}>{t.title}</T>
            <Row wrap gap={6}>
              <Badge>{t.isSpecial ? 'Special task' : 'Task'}</Badge>
              {t.status !== 'active' && <Badge>Disabled</Badge>}
              {ownStatus && <Badge tone={ownStatus.tone}>{ownStatus.label}</Badge>}
            </Row>
          </View>
        </Row>
        {t.canEdit && (
          <Button variant="outline-muted" size="sm" icon="edit-2" style={{ alignSelf: 'flex-start' }}
            onPress={() => router.push({ pathname: '/task-form', params: { mode: 'edit', id: String(t.id), base } })}>Edit task</Button>
        )}
        <View style={{ height: 1, backgroundColor: C.border }} />
        <Meta icon="play-circle" label="Start" value={t.startDate ? Format.longDate(t.startDate) : 'Not set'} />
        <Meta icon="flag" label="Deadline" value={c.deadlineText} danger={c.pastDue} note={c.pastDue ? 'Past deadline' : undefined} />
        {reviewing && (
          <Meta icon="users" label={c.mineOnly ? 'Assigned by you' : 'Assigned'}
            value={c.mineOnly ? `${p.total} of ${t.assignedUsers.length} people` : Format.plural(p.total, 'person', 'people')} />
        )}
      </Block>

      {reviewing && (p.total > 0 || c.mineOnly) && (
        <Block title="Submission progress">
          <T size={14} weight={700} color={p.submitted >= p.total ? C.greenDark : C.text}>{p.submitted} of {p.total} submitted</T>
          {c.mineOnly && <T size={12} color={C.muted}>Counting the {Format.plural(p.total, 'person', 'people')} you assigned ({t.assignedUsers.length} on this task in total).</T>}
          <Progress value={p.total ? p.submitted / p.total : 0} color={p.submitted >= p.total ? C.green : C.accent} />
          <Row wrap gap={14}>
            <Legend color={C.green} label="Submitted" count={p.submitted} />
            <Legend color={C.amber} label="Not yet submitted" count={p.pending} />
            <Legend color={C.red} label="Missing" count={p.missing} />
          </Row>
        </Block>
      )}

      <Block title="Instructions">
        <T size={14.5} style={{ lineHeight: 23 }} color={t.instructions?.trim() ? C.text : C.light} selectable>{t.instructions?.trim() || 'No instructions provided.'}</T>
      </Block>

      {reviewing && <AssigneesCard c={c} run={run} />}
      {reviewing ? <ReviewPanel c={c} run={run} commentProps={commentProps} /> : <SubmitPanel c={c} run={run} commentProps={commentProps} />}

      <Block>
        <Row gap={8}><Icon name="message-square" size={17} color={C.muted} /><T size={15} weight={700}>Public comments</T>{t.publicComments.length > 0 && <Badge>{t.publicComments.length}</Badge>}</Row>
        <T size={12} color={C.muted}>Visible to everyone assigned to this task.</T>
        {t.publicComments.map((cm) => <CommentItem key={cm.id} comment={cm} {...commentProps(cm)} />)}
        <CommentInput placeholder="Add a comment..." onSend={(text) => run(() => c.addComment(text, 'public'))} />
      </Block>
    </Screen>
  );
}
