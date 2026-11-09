import { View } from 'react-native';
import { ReportFormController, TaskDetailController } from '@shared/controllers/TaskDetailController';
import { Report, Task } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Avatar, Button, C, Empty, Icon, Input, Row, T } from '../../ui/kit';
import { pickFile } from '../../ui/files';
import { CommentInput, CommentItem, InlineCommentInput } from '../common/Comments';
import { Block, CommentProps, ReportAttachments, ReportStatusChip, Run, SubmissionType } from './TaskDetailParts';

/** Reviewer: one assignee's report, marking it, and private comments. */
export function ReviewPanel({ c, run, commentProps, inSheet }: {
  c: TaskDetailController; run: Run; commentProps: CommentProps;
  /** Inside the bottom sheet, whose bar already shows the person and status. */
  inSheet?: boolean;
}) {
  const r = c.selectedReport;
  if (!r) {
    return (
      <Block title="Submission">
        <Empty icon="file-text" title={c.task.reports.length ? 'No submission selected' : 'No submissions yet'}>
          {c.task.reports.length ? 'Tap someone marked "Pending review" or "Completed" above to read their report.' : 'Reports appear here once assignees submit.'}
        </Empty>
      </Block>
    );
  }
  const comments = c.privateCommentsFor(r);
  return (
    <Block title={inSheet ? undefined : 'Submission'}>
      {!inSheet && (
        <Row gap={10}>
          <Avatar url={r.avatarUrl} initials={(r.fullName ?? '?').charAt(0).toUpperCase()} size={36} />
          <View style={{ flex: 1 }}>
            <T weight={700} lines={1}>{r.fullName}</T>
            {r.gradeLevel ? <T size={12} color={C.muted}>{r.gradeLevel}</T> : null}
          </View>
          <ReportStatusChip status={r.reportStatus} />
        </Row>
      )}
      <View style={{ backgroundColor: C.surface2, borderRadius: 10, padding: 12, gap: 6 }}>
        <SubmissionType type={r.reportType} />
        <T weight={600}>{r.reportTitle}</T>
        {r.reportDescription ? <T size={13} color={C.text2}>{r.reportDescription}</T> : null}
        <ReportAttachments r={r} />
      </View>
      <T size={12} color={C.muted}>Mark this submission as</T>
      <Row>
        <Button size="sm" variant="outline-muted" style={{ borderColor: C.green }} onPress={() => void run(() => c.setReportStatus(r.id, 'Completed'), 'Marked completed')}>
          <T size={12.5} weight={600} color={C.greenDark}>Completed</T>
        </Button>
        <Button size="sm" variant="outline-muted" style={{ borderColor: C.red }} onPress={() => void run(() => c.setReportStatus(r.id, 'Missing'), 'Marked missing')}>
          <T size={12.5} weight={600} color={C.red}>Missing</T>
        </Button>
      </Row>
      <Row gap={6} style={{ marginTop: 6 }}><Icon name="lock" size={14} color={C.muted} /><T weight={700}>Private comments</T></Row>
      <T size={12} color={C.muted}>Only visible to the submitter and reviewers.</T>
      {comments.length === 0 ? <T size={13} color={C.muted}>No private comments yet.</T> : comments.map((cm) => <CommentItem key={cm.id} comment={cm} {...commentProps(cm)} />)}
      <CommentInput placeholder="Add private comment..." onSend={(text) => run(() => c.addComment(text, 'private', r.id))} />
    </Block>
  );
}

/** Assignee: points, the report form or the submitted report, and private comments. */
export function SubmitPanel({ c, run, commentProps }: { c: TaskDetailController; run: Run; commentProps: CommentProps }) {
  const t = c.task;
  const fb = useFeedback();
  return (
    <View style={{ gap: 12 }}>
      <Row><T size={16} weight={700} style={{ flex: 1 }}>Your work</T><T size={12} color={C.muted}>{c.mobileDeadlineText}</T></Row>
      {!t.myReport && !t.isLoggedOnly && (
        <View style={{ backgroundColor: C.dark, borderRadius: 14, padding: 16, gap: 6 }}>
          <Row gap={6}><Icon name="zap" size={15} color="#fbbf24" /><T size={13} weight={700} color="#fff">Points You Can Earn</T></Row>
          {TaskDetailController.pointsTable(t).map((p) => (
            <Row key={p.label} style={{ justifyContent: 'space-between' }}>
              <T size={12} color="rgba(255,255,255,0.7)">{p.label}</T>
              <T size={13} weight={700} color={{ green: '#6ee7b7', blue: '#93c5fd', amber: '#fcd34d', red: '#f87171' }[p.tone]}>{p.value}</T>
            </Row>
          ))}
        </View>
      )}
      {t.myReport
        ? <SubmittedState task={t} r={t.myReport} onUnsubmit={async () => {
          if (await fb.confirm({ title: 'Unsubmit report?', message: 'You can submit again before the deadline.', confirmLabel: 'Unsubmit' })) await run(() => c.unsubmit(), 'Report unsubmitted');
        }} />
        : t.isLoggedOnly ? (
          <Row gap={10} style={{ padding: 12, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
            <Icon name="check-circle" size={20} color={C.green} />
            <View style={{ flex: 1 }}><T weight={700} color={C.greenDark}>Submitted</T><T size={11.5} color={C.greenDark}>Recorded in the task log; there is no report file to show.</T></View>
          </Row>
        ) : <ReportForm taskId={t.id} onSubmitted={() => void c.load()} />}
      <View style={{ backgroundColor: '#fff', borderRadius: 14 }}>
        <T size={14} weight={700} style={{ padding: 16, paddingBottom: 8 }}>Private Comments</T>
        <View style={{ paddingHorizontal: 16 }}>
          {t.privateComments.length === 0 ? <T size={13} color={C.muted} style={{ paddingBottom: 10 }}>No private comments yet.</T>
            : t.privateComments.map((cm) => <CommentItem key={cm.id} comment={cm} {...commentProps(cm)} />)}
        </View>
        <InlineCommentInput initials={c.user.initials} avatarUrl={c.user.avatarUrl} onSend={(text) => run(() => c.addComment(text, 'private'))} />
      </View>
    </View>
  );
}

function ReportForm({ taskId, onSubmitted }: { taskId: number; onSubmitted: () => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new ReportFormController(services, taskId), [taskId]);
  const pick = async () => {
    const f = await pickFile('*/*');
    if (f) c.setFile(f);
  };
  const submit = async () => {
    try { await c.submit(); fb.toast('Report submitted'); onSubmitted(); } catch (e) { fb.error(e); }
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 10 }}>
        <T size={14} weight={700}>Files & Links</T>
        {s.type === 'link' && s.link.trim() ? <Row><Icon name="link-2" size={14} color={C.accent} /><T size={13} color={C.accent} lines={1}>{s.link.trim()}</T></Row>
          : s.file ? <Row><Icon name="file-text" size={14} color={C.accent} /><T size={13} lines={1}>{s.file.name}</T></Row>
          : <T size={12.5} color={C.muted}>No files added yet</T>}
        <Row>
          <Button variant={s.type === 'file' ? 'dark' : 'outline-muted'} icon="file-text" style={{ flex: 1 }} onPress={() => { c.choose('file'); void pick(); }}>File</Button>
          <Button variant={s.type === 'link' ? 'dark' : 'outline-muted'} icon="link-2" style={{ flex: 1 }} onPress={() => c.choose('link')}>Link</Button>
        </Row>
        {s.type === 'link' && <Input placeholder="www.example.com" autoCapitalize="none" keyboardType="url" value={s.link} onChangeText={(v) => c.setLink(v)} autoFocus />}
      </View>
      <Button size="lg" block icon="send" disabled={!c.hasContent} loading={s.submitting} onPress={() => void submit()}>Submit Report</Button>
    </View>
  );
}

function SubmittedState({ task, r, onUnsubmit }: { task: Task; r: Report; onUnsubmit: () => void }) {
  const { points, reason } = TaskDetailController.earned(task, r);
  return (
    <View style={{ gap: 10 }}>
      <Row gap={10} style={{ padding: 12, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
        <Icon name="check-circle" size={20} color={C.green} />
        <View><T weight={700} color={C.greenDark}>Submitted</T><T size={11.5} color={C.greenDark}>Your report has been received</T></View>
      </Row>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 6 }}>
        <SubmissionType type={r.reportType} />
        <T size={13} weight={600}>{r.reportTitle}</T>
        <ReportAttachments r={r} />
      </View>
      <View style={{ backgroundColor: C.dark, borderRadius: 14, padding: 16, gap: 2 }}>
        <T size={12} color="rgba(255,255,255,0.65)">Points Earned</T>
        <T size={28} weight={800} color="#fff">+{points}</T>
        <T size={12} color="rgba(255,255,255,0.65)">{reason}</T>
        {r.reportDate ? <T size={11} color="rgba(255,255,255,0.55)">Submitted: {TaskDetailController.submittedAt(r)}</T> : null}
      </View>
      <Button size="lg" block style={{ backgroundColor: '#3d4350' }} onPress={onUnsubmit}>Unsubmit</Button>
    </View>
  );
}
