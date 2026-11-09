import { useState } from 'react';
import { View } from 'react-native';
import { EvaluateSpecialTaskController, SpecialTaskStats } from '@shared/controllers/AppraisalControllers';
import { IPCRF_LABELS, ipcrfRating, Mov, SpecialTask } from '@shared/models';
import { useMediaUrl, useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Field, Icon, Input, Modal, Row, Select, T } from '../../ui/kit';
import { openUrl } from '../../ui/files';
import { FileViewer } from '../common/FileViewer';
import { Line } from './common';

const QET = [['quality', 'Quality (Q)'], ['efficiency', 'Efficiency (E)'], ['timeliness', 'Timeliness (T)']] as const;
const RATINGS = [5, 4, 3, 2, 1].map((v) => ({ value: v, label: `${v} - ${IPCRF_LABELS[v]}` }));

export function TaskFacts({ t }: { t: SpecialTask }) {
  return (
    <View style={{ gap: 4 }}>
      <Line label="Personnel" value={t.assigneeName ?? '—'} />
      <Line label="Department" value={t.assigneeDepartment ?? '—'} />
      <Line label="Assigned by" value={t.assignerName ?? '—'} />
      <Line label="Task" value={t.title} />
      <Line label="Due date" value={SpecialTaskStats.fmtDate(t.dueDate)} />
      <Line label="Submitted" value={SpecialTaskStats.fmtDate(t.submittedDate)} />
    </View>
  );
}

/** The assignee's submitted file / link (means of verification). */
export function MovList({ task }: { task: SpecialTask }) {
  const media = useMediaUrl();
  const [viewing, setViewing] = useState<Mov | null>(null);
  return (
    <View style={{ gap: 6 }}>
      <T size={13} weight={700}>Attached MOVs:</T>
      {task.movs.length === 0 ? <T size={12} color={C.muted} style={{ fontStyle: 'italic' }}>No MOVs uploaded</T> : task.movs.map((m) => (
        <Row key={m.id} gap={8}>
          <Icon name={m.type === 'file' ? 'file-text' : 'link-2'} size={15} color="#D92243" />
          <T size={13} color="#D92243" lines={1} style={{ flex: 1, textDecorationLine: 'underline' }}>{m.name}</T>
          <Button variant="ghost" size="sm" onPress={() => (m.type === 'file' ? setViewing(m) : void openUrl(m.url))}>View MOV</Button>
        </Row>
      ))}
      {viewing && <FileViewer filename={viewing.name} url={media(viewing.url) ?? viewing.url} onClose={() => setViewing(null)} />}
    </View>
  );
}

/** IPCRF rating: Quality, Efficiency and Timeliness (1-5); the final score is their average. */
export function EvaluateSpecialTaskDialog({ task, onClose }: { task: SpecialTask; onClose: (updated: SpecialTask | null) => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new EvaluateSpecialTaskController(services, task), [task.id]);
  const submit = async () => { try { onClose(await c.submit()); } catch (e) { fb.error(e); } };
  return (
    <Modal title="Evaluate Special Task" subtitle={task.title} onClose={() => onClose(null)}
      footer={s.step === 1
        ? <><Button variant="ghost" onPress={() => onClose(null)}>Close</Button><Button icon="arrow-right" onPress={() => c.set({ step: 2 })}>Start Evaluation</Button></>
        : <><Button variant="ghost" onPress={() => c.set({ step: 1 })}>Back</Button><Button loading={s.submitting} onPress={() => void submit()}>Submit Evaluation</Button></>}>
      {s.step === 1 && <TaskFacts t={task} />}
      <MovList task={task} />
      {s.step === 2 && (
        <>
          <T size={13} weight={600}>Rating (Scale 1 - 5):</T>
          {QET.map(([k, l]) => (
            <Field key={k} label={l}>
              <Select<number | null> value={s[k] || null} placeholder="Select rating" title={l} options={RATINGS} onChange={(v) => c.set({ [k]: v ?? 0 })} />
            </Field>
          ))}
          <T size={13} weight={700} color="#A11A33">Final IPCRF Score: {c.finalScoreText}</T>
          <Field label="Remarks"><Input multiline rows={3} placeholder="Add performance comments..." value={s.remarks} onChangeText={(v) => c.set({ remarks: v })} /></Field>
        </>
      )}
    </Modal>
  );
}

export function ViewSpecialTaskDialog({ task, onClose }: { task: SpecialTask; onClose: () => void }) {
  const ev = task.evaluation;
  return (
    <Modal title="View Evaluation" subtitle={task.title} onClose={onClose} footer={<Button variant="ghost" onPress={onClose}>Close</Button>}>
      <TaskFacts t={task} />
      <MovList task={task} />
      {ev && (
        <View style={{ gap: 6, borderTopWidth: 1, borderColor: C.border, paddingTop: 12 }}>
          <T weight={700}>Evaluation</T>
          {([['Quality (Q)', ev.completionScore], ['Efficiency (E)', ev.initiativeScore], ['Timeliness (T)', ev.timelinessScore]] as const).map(([l, v]) => (
            <Line key={l} label={l} value={`${v} - ${IPCRF_LABELS[v] ?? '—'}`} />
          ))}
          <View style={{ backgroundColor: '#FCE8EC', borderRadius: 8, padding: 10 }}>
            <T weight={700} color="#A11A33">Final IPCRF Score: {(ev.weightedAverage ?? 0).toFixed(2)} / 5.00 ({ipcrfRating(ev.weightedAverage ?? 0)})</T>
          </View>
          {ev.remarks ? <><T size={13} weight={700}>Remarks</T><T size={13} color={C.text2}>{ev.remarks}</T></> : null}
        </View>
      )}
    </Modal>
  );
}
