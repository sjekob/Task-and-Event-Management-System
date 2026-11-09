import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { EVENT_RATING_CRITERIA, EventAppraisal, EventRatingController, PaperEvaluationController } from '@shared/controllers/AppraisalControllers';
import { EVALUATOR_AGE_GROUPS, EVALUATOR_ROLES, EVALUATOR_SEXES, EVENT_CRITERIA, EventForAppraisal, RATING_LABELS } from '@shared/models';
import { useMediaUrl, useServices, webOrigin } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Badge, Button, C, Field, Input, Modal, Progress, Row, Select, T } from '../../ui/kit';
import { openUrl, pickFile, pickImage } from '../../ui/files';
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

/**
 * An event's evaluation results (from Lok's appraisal update): the aggregate
 * summary per criterion, and each response; a paper one opens its scanned form.
 */
export function ResultsDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const media = useMediaUrl();
  const [tab, setTab] = useState<'summary' | 'responses'>('summary');
  const [open, setOpen] = useState<number | null>(null);
  const n = event.evaluations.length;
  return (
    <Modal title="Evaluation Results" icon="bar-chart-2" onClose={onClose}
      subtitle={`${event.title} · ${n} ${n === 1 ? 'response' : 'responses'}${event.paperCount ? ` (${event.paperCount} on paper)` : ''}`}
      footer={<Button block variant="ghost" onPress={onClose}>Close</Button>}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'summary', label: 'Aggregate Summary' }, { value: 'responses', label: 'Individual Responses' }]} />
      {tab === 'summary' ? (
        <View style={{ gap: 10 }}>
          <Row gap={8} style={{ alignItems: 'flex-end' }}>
            <T size={28} weight={800}>{event.avgRating.toFixed(2)}</T>
            <T size={13} color={C.muted}>/ 5 average · {event.evidencyRate.toFixed(0)}% evidency</T>
          </Row>
          {event.criterionAverages.map((x) => (
            <View key={x.label} style={{ gap: 4 }}>
              <Row><T size={13} style={{ flex: 1 }}>{x.label}</T><T size={13} weight={700}>{x.avg.toFixed(2)}</T></Row>
              <Progress value={x.avg / 5} color={C.accent} />
            </View>
          ))}
        </View>
      ) : !n ? <T color={C.muted}>No responses yet.</T> : event.evaluations.map((ev) => (
        <View key={ev.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' }}>
          <Pressable onPress={() => setOpen(open === ev.id ? null : ev.id)} accessibilityRole="button" accessibilityState={{ expanded: open === ev.id }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: C.card }}>
            <View style={{ flex: 1 }}>
              <T weight={700} lines={1}>{ev.evaluatorName}</T>
              <T size={12} color={C.muted} lines={1}>{[ev.evaluatorRole, ev.evaluatorSex, ev.evaluatorAgeGroup].filter(Boolean).join(' · ') || '—'}</T>
            </View>
            {ev.isPaper ? <Badge tone="amber">Paper</Badge> : null}
            <T weight={700}>{ev.average.toFixed(1)} / 5</T>
          </Pressable>
          {open === ev.id && (
            <View style={{ gap: 6, padding: 12, backgroundColor: C.surface2, borderTopWidth: 1, borderColor: C.border }}>
              {EVENT_CRITERIA.map((cr) => (
                <Row key={cr.key}><T size={12.5} color={C.muted} style={{ flex: 1 }}>{cr.label}</T><T size={12.5}>{String(ev[cr.key])} / 5 · {RATING_LABELS[Number(ev[cr.key])] ?? ''}</T></Row>
              ))}
              {ev.feedbackComments ? <T size={13}>“{ev.feedbackComments}”</T> : null}
              {ev.isPaper && ev.imageUrl ? (
                <Button size="sm" variant="outline" icon="image" onPress={() => void openUrl(media(ev.imageUrl) ?? ev.imageUrl!)}>View Scanned Paper Form</Button>
              ) : null}
            </View>
          )}
        </View>
      ))}
    </Modal>
  );
}

/** Record a paper evaluation form: a photo or scan of it, who filled it in, the six ratings and remarks. */
export function PaperEvaluationDialog({ event, onClose }: { event: EventForAppraisal; onClose: (updated: EventForAppraisal | null) => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new PaperEvaluationController(services, event), [event.id]);
  const save = async () => {
    const updated = await c.submit();
    if (updated) { fb.toast('Paper evaluation recorded with its scanned form.', 'success'); onClose(updated); }
  };
  const isImage = !!s.image && /^image\//.test(s.image.type ?? '') && !!s.image.uri;
  return (
    <Modal title="Upload Paper Evaluation" icon="image" onClose={() => onClose(null)}
      subtitle={`Record a filled-in paper form for "${event.title}", with a photo or scan of it as proof.`}
      footer={<Row gap={8}>
        <Button variant="ghost" style={{ flex: 1 }} onPress={() => onClose(null)}>Cancel</Button>
        <Button style={{ flex: 1 }} loading={s.submitting} disabled={c.missing.length > 0} onPress={() => void save()}>Save</Button>
      </Row>}>
      <View style={{ alignItems: 'center', gap: 10, padding: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, borderRadius: 12, backgroundColor: C.surface2 }}>
        {isImage ? <Image source={{ uri: s.image!.uri }} style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="contain" />
          : s.image ? <T weight={700}>{s.image.name}</T>
          : <T size={12.5} color={C.muted} center>A clear photo or scanned PDF of the whole form</T>}
        <Row gap={8}>
          <Button size="sm" icon="image" onPress={async () => { const f = await pickImage(); if (f) c.setImage(f); }}>{s.image ? 'Change photo' : 'Choose photo'}</Button>
          <Button size="sm" variant="outline" icon="file" onPress={async () => { const f = await pickFile('application/pdf'); if (f) c.setImage(f); }}>PDF scan</Button>
        </Row>
      </View>
      <Field label="Evaluator's name"><Input placeholder="e.g., Juan Dela Cruz or Paper Evaluator" value={s.name} onChangeText={(v) => c.set({ name: v })} /></Field>
      <Field label="Evaluator is a">
        <Select<string> value={s.role} title="Evaluator is a" options={EVALUATOR_ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))} onChange={(v) => c.set({ role: v })} />
      </Field>
      <Field label="Sex">
        <Select<string> value={s.sex} title="Sex" options={[{ value: '', label: 'Not stated' }, ...EVALUATOR_SEXES.map((x) => ({ value: x, label: x }))]} onChange={(v) => c.set({ sex: v })} />
      </Field>
      <Field label="Age group">
        <Select<string> value={s.ageGroup} title="Age group" options={[{ value: '', label: 'Not stated' }, ...EVALUATOR_AGE_GROUPS.map((x) => ({ value: x, label: x }))]} onChange={(v) => c.set({ ageGroup: v })} />
      </Field>
      <T weight={700}>Ratings on the form (1-5)</T>
      {EVENT_RATING_CRITERIA.map((k) => (
        <Field key={k.key} label={k.label}>
          <Select<number> value={s.scores[k.key] || 0} title={k.label} placeholder="Select rating"
            options={[5, 4, 3, 2, 1].map((v) => ({ value: v, label: `${v} - ${RATING_LABELS[v]}` }))} onChange={(v) => c.rate(k.key, v)} />
        </Field>
      ))}
      <Field label="Remarks on the form"><Input multiline rows={3} placeholder="Enter any remarks written on the paper form..." value={s.comments} onChangeText={(v) => c.set({ comments: v })} /></Field>
      {c.missing.length ? <T size={12} color={C.muted}>Still needed: {c.missing.join(', ')}.</T> : null}
      {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
    </Modal>
  );
}

/** Two-option switch (e.g. the results' Aggregate Summary / Individual Responses). */
export function Segmented<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[] }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, borderRadius: 10, backgroundColor: C.surface3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: on ? C.dark : 'transparent' }}>
            <T size={12.5} weight={600} color={on ? '#fff' : C.text2}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
