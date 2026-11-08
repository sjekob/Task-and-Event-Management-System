import { ReactNode, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { EventDetailController, ProposalView, SendBack } from '@shared/controllers/EventControllers';
import { useServices, useSession } from '../../core/AppModel';
import { useLiveRefresh, useScreenController } from '../../core/hooks';
import { printProposal, shareProposal } from '../../core/printProposal';
import { useFeedback } from '../../ui/feedback';
import { Bone, Button, C, Empty, FeatherName, Info, Row, Screen, T } from '../../ui/kit';
import { AttendanceQrDialog } from './AttendanceQrDialog';
import { Bullets, FieldText, Meta, Panel, RowCards, StatusBadge } from './EventDetailParts';
import { AttendancePanel, ReturnedCard, ReviewHistory, SendBackSheet, VenueCard } from './EventReview';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** /event/[id]: the full proposal with approve / revisions / reject / disable / print / attendance (kept current every 30 s). */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new EventDetailController(services, user, Number(id)), [id, user?.id]);
  const [qr, setQr] = useState(false);
  const [review, setReview] = useState<SendBack | null>(null);
  useEffect(() => { void c.load(); }, [c]);
  useLiveRefresh(() => void c.load());

  const header = <Stack.Screen options={{ title: 'Event Proposal' }} />;
  if (s.loading) return <Screen>{header}<Bone h={160} r={14} /><Bone h={120} r={14} /></Screen>;
  const event = s.event;
  if (!event) return <Screen>{header}<Empty icon="calendar" title={s.error ?? 'That event is no longer available.'} /></Screen>;

  const a = c.actions;
  const edit = () => router.push({ pathname: '/event-form', params: { id: String(event.id) } });
  const p = new ProposalView(event.raw);
  const r = event.raw;
  const sec = p.sections;
  const approve = async () => { try { fb.toast(await c.approve(), 'success'); } catch (e) { fb.error(e); } };
  const disable = async () => {
    if (!await fb.confirm({ title: 'Confirm Disable', message: `Disable "${event.title}"?`, confirmLabel: 'Disable', danger: true })) return;
    try { await c.disable(); fb.toast('Event disabled', 'success'); } catch (e) { fb.error(e); }
  };
  const print = async () => { try { await printProposal(event.raw); } catch (e) { fb.error(e); } };
  const share = async () => { try { await shareProposal(event.raw); } catch (e) { fb.error(e); } };

  const sections: { title: string; icon: FeatherName; body: ReactNode }[] = [];
  if (sec.rationale) sections.push({ title: 'Rationale', icon: 'zap', body: <T size={14} style={{ lineHeight: 22 }}>{String(r.rationale)}</T> });
  if (sec.objectives) sections.push({ title: 'Objectives', icon: 'flag', body: <Bullets items={p.objectives} /> });
  if (sec.methodology) {
    const m = p.methodology;
    sections.push({ title: 'Methodology / Work plan', icon: 'map', body: (
      <View style={{ gap: 10 }}>
        {m.steps.map((st, i) => (
          <Row key={i} gap={10} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' }}><T size={12} weight={700} color="#fff">{i + 1}</T></View>
            <View style={{ flex: 1, gap: 2 }}>
              {st.stage ? <T weight={700}>{st.stage}</T> : null}
              {st.activities.map((x, j) => <T key={j} size={13} color="#4a5568">• {x}</T>)}
            </View>
          </Row>
        ))}
        {m.legacy.map((l) => <FieldText key={l.label} label={l.label} value={l.text} />)}
      </View>
    ) });
  }
  if (sec.matrix) {
    const cols: [string, string][] = [['day', 'Day'], ['time', 'Time'], ['event', 'Activity'], ['speaker', 'Speaker']];
    sections.push({ title: 'Activity matrix', icon: 'calendar', body: <RowCards rows={p.activityMatrix} cols={cols} raw={r.activity_matrix} /> });
  }
  if (sec.budget) {
    sections.push({ title: 'Budget', icon: 'credit-card', body: (
      <View style={{ gap: 8 }}>
        {p.materials && <><T size={12.5} weight={700} color={C.muted}>Training materials</T><RowCards rows={p.materials} cols={[['item', 'Item'], ['qty', 'Qty'], ['cost', 'Cost'], ['total', 'Total']]} /></>}
        {p.snacks && <><T size={12.5} weight={700} color={C.muted}>Meals / snacks</T><RowCards rows={p.snacks} cols={[['item', 'Item'], ['pax', 'Participants'], ['cost', 'Cost/Day'], ['total', 'Total']]} /></>}
      </View>
    ) });
  }
  if (sec.committees) {
    sections.push({ title: 'Committees', icon: 'git-branch', body: (
      <View style={{ gap: 4 }}>
        {p.execCommittee && <><T size={12.5} weight={700} color={C.muted}>Executive committee</T>
          {p.execCommittee.map((m, i) => { const pos = String(m.position ?? m.designation ?? ''); return <T key={i} size={13.5}>• {String(m.name ?? '')}{pos ? ` — ${pos}` : ''}</T>; })}</>}
        {p.twg && <><T size={12.5} weight={700} color={C.muted} style={{ marginTop: 6 }}>Technical working groups</T>
          {p.twg.map((g, i) => (
            <View key={i} style={{ gap: 2 }}>
              {g.title ? <T size={11.5} weight={600} color="#718096">{g.title}</T> : null}
              {g.members.map((m, j) => <T key={j} size={13.5}>• {String(m.name ?? '')}{m.designation ? ` — ${m.designation}` : ''}</T>)}
            </View>
          ))}</>}
      </View>
    ) });
  }
  if (sec.monitoring) {
    sections.push({ title: 'Monitoring & evaluation', icon: 'clipboard', body: (
      <View style={{ gap: 4 }}>
        {ProposalView.has(r.monitoring_criteria) && <T size={14}>{String(r.monitoring_criteria)}</T>}
        {p.indicators.map((l, i) => <T key={i} size={13.5}>{i + 1}. {l}</T>)}
      </View>
    ) });
  }
  const participants = p.participants;
  const focal = p.focal;

  return (
    <Screen onRefresh={() => c.load()}>
      {header}
      {event.isReturned && <ReturnedCard event={event} action={a.edit ? <Button icon="edit-2" onPress={edit}>Revise &amp; resubmit</Button> : undefined} />}
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 }}>
        <T size={11} weight={700} color="#718096" style={{ letterSpacing: 0.8 }}>EVENT PROPOSAL</T>
        <T size={21} weight={800}>{event.title}</T>
        <StatusBadge e={event} />
        {event.creatorName ? <Meta icon="user" text={`Proposed by ${event.creatorName}`} /> : null}
        {ProposalView.has(r.target_date) && <Meta icon="calendar" text={String(r.target_date)} />}
        {ProposalView.has(r.venue) && <Meta icon="map-pin" text={String(r.venue)} />}
        <Row wrap style={{ marginTop: 6 }}>
          {a.approve && <Button variant="success" icon="check-circle" onPress={() => void approve()}>Approve</Button>}
          {a.sendBack && <Button variant="outline" icon="corner-up-left" onPress={() => setReview('revisions_requested')}>Request revisions</Button>}
          {a.sendBack && <Button variant="ghost-danger" icon="x-circle" onPress={() => setReview('rejected')}>Reject</Button>}
          {a.disable && <Button variant="outline-muted" icon="slash" onPress={() => void disable()}>Disable</Button>}
          {a.edit && !event.isReturned && <Button variant="outline-muted" icon="edit-2" onPress={edit}>Edit</Button>}
          <Button variant="outline-muted" icon="printer" onPress={() => void print()}>Print</Button>
          {Platform.OS !== 'web' && <Button variant="outline-muted" icon="share" onPress={() => void share()}>PDF</Button>}
          {a.qr && <Button variant="outline-muted" icon="grid" onPress={() => setQr(true)}>Attendance QR</Button>}
        </Row>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 }}>
        {p.facts.map((f) => <Info key={f.label} label={f.label} value={f.value.trim() || '—'} />)}
      </View>
      {focal && <Panel icon="credit-card" title="Focal person">{focal.map((f) => <FieldText key={f.label} label={f.label} value={f.value} />)}</Panel>}
      {participants && (
        <Panel icon="users" title="Target participants">
          {typeof participants === 'string' ? <FieldText label="Participants" value={participants} /> : (
            <RowCards rows={participants.rows} cols={[['category', 'Category'], ['male', 'Male'], ['female', 'Female'], ['total', 'Total']]}
              footer={participants.totals ? ['Total', participants.totals.male, participants.totals.female, participants.totals.total] : undefined} />
          )}
        </Panel>
      )}
      {p.outputs.length > 0 && <Panel icon="list" title="Expected outputs"><Bullets items={p.outputs} /></Panel>}
      {sections.map((x, i) => <Panel key={x.title} icon={x.icon} title={x.title} roman={ROMAN[i + 1]}>{x.body}</Panel>)}
      {event.venuePin && <VenueCard pin={event.venuePin} venue={event.venue} />}
      {a.attendanceList && <AttendancePanel list={s.attendance} error={s.attendanceError} {...c.attendanceSummary} />}
      {event.reviews.length > 0 && <ReviewHistory reviews={event.reviews} />}
      {qr && <AttendanceQrDialog eventId={event.id} onClose={() => setQr(false)} />}
      {review && (
        <SendBackSheet event={event} decision={review} onClose={() => setReview(null)}
          send={async (comment) => {
            try { fb.toast(await c.sendBack(review, comment), 'success'); setReview(null); return true; } catch (e) { fb.error(e); return false; }
          }} />
      )}
    </Screen>
  );
}
