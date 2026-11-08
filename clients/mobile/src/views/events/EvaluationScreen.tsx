import { ReactNode, useEffect } from 'react';
import { Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { EVALUATOR_ROLES, PublicEvaluationController } from '@shared/controllers/PublicEvaluationController';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Card, Field, FeatherName, Icon, Input, Loading, Row, Screen, Select, T } from '../../ui/kit';

/**
 * /eval/[eventId] — the public observation tool (no login).
 * /attendance/[eventId]/[index]/evaluate — a signed-in attendee's evaluation after Time Out.
 */
export default function EvaluationScreen() {
  const { eventId = '', index } = useLocalSearchParams<{ eventId: string; index?: string }>();
  const services = useServices();
  const fb = useFeedback();
  const activityIndex = index === undefined ? null : Number(index);
  const [c, s] = useScreenController(() => new PublicEvaluationController(services, eventId, activityIndex), [eventId, activityIndex]);
  useEffect(() => { void c.load(); }, [c]);

  const panel = (icon: FeatherName, color: string, title: string, body: string, extra?: ReactNode) => (
    <Card style={{ alignItems: 'center', gap: 8, padding: 24 }}>
      <Icon name={icon} size={54} color={color} />
      <T size={19} weight={700} center>{title}</T>
      <T size={13.5} color={C.text2} center>{body}</T>
      {extra}
    </Card>
  );
  const header = <Stack.Screen options={{ title: c.isAttendee ? 'Activity Evaluation' : 'Event Evaluation' }} />;
  if (s.view === 'loading') return <Screen>{header}<Loading /></Screen>;
  if (s.view === 'error') return <Screen>{header}{panel('alert-circle', C.red, 'Unable to load event', s.message)}</Screen>;
  if (s.view === 'locked') return <Screen>{header}{panel('lock', C.amber, String(s.event?.title ?? 'Event Evaluation'), s.message)}</Screen>;
  if (s.view === 'submitted') {
    return (
      <Screen>
        {header}
        {panel('check-circle', C.green, 'Evaluation Submitted!', c.isAttendee
          ? 'Thank you! Your attendance for this activity is complete.'
          : 'Thank you for your response. Your feedback helps improve our future events.')}
      </Screen>
    );
  }

  const e = s.event!;
  const monitoring = String(e.monitoring_criteria ?? '').trim();
  const submit = async () => { const err = await c.submit(); if (err) fb.toast(err, 'error'); };
  return (
    <Screen>
      {header}
      <Card style={{ gap: 6 }}>
        <T size={11} weight={700} color={C.muted}>KAGAWARAN NG EDUKASYON · Performance Observation Tool</T>
        <T size={17} weight={700}>{String(e.title ?? 'Event Evaluation')}</T>
        <T size={12} color={C.muted}>{c.details}</T>
        {s.activity && <T size={12.5} weight={600}>Activity: {s.activity.activity.event?.trim() || `Activity ${s.activity.activity_index + 1}`}</T>}
        {monitoring ? <T size={12.5} color={C.text2}>{monitoring}</T> : null}
      </Card>
      <Card style={{ gap: 12 }}>
        {!c.isAttendee && (
          <>
            <Field label="Name (optional)"><Input value={s.name} onChangeText={(v) => c.setName(v)} /></Field>
            <Field label="I am a..."><Select value={s.role} options={EVALUATOR_ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))} onChange={(v) => c.set({ role: v })} /></Field>
            <Field label="Email (required)" help="Each email can submit this evaluation only once."><Input keyboardType="email-address" autoCapitalize="none" value={s.email} onChangeText={(v) => c.set({ email: v })} /></Field>
          </>
        )}
        <Field label="Sex (required)"><Select<string | null> value={s.sex} placeholder="Select…" options={c.options('sex').map((o) => ({ value: o, label: o }))} onChange={(v) => c.set({ sex: v })} /></Field>
        <Field label="Age group (required)"><Select<string | null> value={s.ageGroup} placeholder="Select…" options={c.options('age_group').map((o) => ({ value: o, label: o }))} onChange={(v) => c.set({ ageGroup: v })} /></Field>
        <Field label="School / office / organization (optional)"><Input value={s.affiliation} onChangeText={(v) => c.set({ affiliation: v })} /></Field>
      </Card>
      <T size={14} weight={800}>Observation Indicators</T>
      <T size={12} color={C.muted}>Mark each indicator as Evident or Not Evident based on what you observed.</T>
      {c.indicators.map((label, i) => (
        <Card key={i} flat style={{ gap: 8, padding: 12 }}>
          <T size={13} weight={600}>{i + 1}. {label}</T>
          <Row>
            {([[true, 'Evident', C.green, 'check-circle'], [false, 'Not Evident', C.red, 'x-circle']] as const).map(([v, l, color, icon]) => {
              const on = s.marks[i] === v;
              return (
                <Pressable key={l} onPress={() => c.mark(i, v)} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 9, borderRadius: 8, borderWidth: on ? 1.4 : 0.8, borderColor: on ? color : '#cbd5e1', backgroundColor: on ? `${color}1f` : '#fff' }}>
                  <Icon name={icon} size={15} color={on ? color : C.muted} /><T size={12.5} weight={600} color={on ? color : C.muted}>{l}</T>
                </Pressable>
              );
            })}
          </Row>
        </Card>
      ))}
      <Field label="Overall comments (optional)"><Input multiline rows={3} value={s.comments} onChangeText={(v) => c.set({ comments: v })} /></Field>
      <Button size="lg" block loading={s.submitting} onPress={() => void submit()}>Submit Evaluation</Button>
    </Screen>
  );
}
