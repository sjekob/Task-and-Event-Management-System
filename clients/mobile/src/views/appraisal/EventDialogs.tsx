import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { EVENT_RATING_CRITERIA, EventAppraisal, EventRatingController } from '@shared/controllers/AppraisalControllers';
import { EventForAppraisal } from '@shared/models';
import { useServices, webOrigin } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Field, Input, Modal, Progress, Row, T } from '../../ui/kit';
import { openUrl } from '../../ui/files';
import { Stars } from './common';

/** QR code and copyable link to the public evaluation page. */
export function EvalLinkDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const fb = useFeedback();
  const url = EventAppraisal.evalUrl(webOrigin(), event);
  return (
    <Modal title="Event Evaluation" subtitle={event.title} icon="grid" onClose={onClose} footer={<Button variant="ghost" onPress={onClose}>Close</Button>}>
      {EventAppraisal.organizerLine(event) ? <T size={12} color={C.muted} center>{EventAppraisal.organizerLine(event)}</T> : null}
      <View style={{ alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#eee', borderRadius: 12, alignSelf: 'center' }}>
        <QRCode value={url} size={200} />
      </View>
      <T size={12} color={C.muted} center>Event ID: {event.id}</T>
      <T size={12} color={C.accent} center selectable>{url}</T>
      <Row style={{ justifyContent: 'center' }}>
        <Button icon="copy" onPress={async () => { await Clipboard.setStringAsync(url); fb.toast('Evaluation link copied', 'success'); }}>Copy link</Button>
        <Button variant="outline-muted" icon="external-link" onPress={() => void openUrl(url)}>Open</Button>
      </Row>
    </Modal>
  );
}

export function DemographicsDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const d = EventAppraisal.demographics(event);
  return (
    <Modal title="Evaluator demographics" subtitle={`${event.title} · ${d.total} ${d.total === 1 ? 'evaluation' : 'evaluations'}`} icon="users" onClose={onClose}>
      {!d.total ? <T color={C.muted}>No evaluations yet.</T> : d.groups.map((g) => (
        <View key={g.title} style={{ gap: 8, marginBottom: 8 }}>
          <T weight={700}>{g.title}</T>
          {g.rows.map((r) => (
            <View key={r.label} style={{ gap: 3 }}>
              <Row><T size={12.5} color={r.unspecified ? C.light : C.text} style={{ flex: 1 }}>{r.label}</T><T size={12} color={C.muted}>{r.count} · {r.pct}%</T></Row>
              <Progress value={r.pct / 100} color={r.unspecified ? '#cbd5e1' : C.accent} />
            </View>
          ))}
        </View>
      ))}
    </Modal>
  );
}

export function EventRatingDialog({ event, onClose }: { event: EventForAppraisal; onClose: (updated: EventForAppraisal | null) => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new EventRatingController(services, event), [event.id]);
  return (
    <Modal title={`Evaluate: ${event.title}`} icon="message-square" onClose={() => onClose(null)}
      footer={<><Button variant="ghost" onPress={() => onClose(null)}>Cancel</Button>
        <Button loading={s.submitting} onPress={async () => { try { onClose(await c.submit()); } catch (e) { fb.error(e); } }}>Submit</Button></>}>
      <T weight={700}>Rating Criteria</T>
      {EVENT_RATING_CRITERIA.map((k) => (
        <View key={k.key} style={{ gap: 2 }}><T size={13} weight={600}>{k.label}</T><Stars value={s.scores[k.key]} onChange={(v) => c.rate(k.key, v)} /></View>
      ))}
      {c.started && <View style={{ padding: 10, borderRadius: 8, backgroundColor: '#FCE8EC' }}><T weight={600} color="#D92243">Average Score: {c.average.toFixed(2)} / 5</T></View>}
      <Field label="Comments (optional)"><Input multiline rows={4} value={s.comments} onChangeText={(v) => c.setComments(v)} /></Field>
    </Modal>
  );
}
