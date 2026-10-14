import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, formatActivityMatrix, formatCommittee, formatDate, formatMethodology, formatMoney, formatOutputs,
  formatParticipants, formatTwg, hasContent, parseEventDate, qk, useSession, useUser, type EventRecord,
} from '@tasknet/shared';
import { EventStatusPill } from '@/components/cards';
import {
  Button, Card, confirm, ErrorView, Gap, IconButton, InfoLine, Loading, notifyError, notifySuccess, Row, Screen,
  SectionHeader, Segmented, T,
} from '@/components/ui';
import { WEB_BASE } from '@/lib/api';
import { shareProposal } from '@/lib/printProposal';
import { colors } from '@/theme';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const user = useUser();
  const { can } = useSession();
  const qc = useQueryClient();
  const event = useQuery({ queryKey: qk.event(eventId), queryFn: () => api.events.get(eventId) });
  const [busy, setBusy] = useState<string | null>(null);
  const [qr, setQr] = useState<'attendance' | 'evaluation' | null>(null);

  if (event.isPending) return <Loading />;
  if (event.isError) return <ErrorView error={event.error} onRetry={() => event.refetch()} />;
  const e = event.data;

  const canManage = can('manage_events');
  const canApprove = can('approve_events');
  const pending = e.status === 'pending_approval';
  const isOwner = e.created_by === user.id;
  const showQr = e.status === 'approved' && (canApprove || isOwner);

  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      const res = await fn();
      if (done) notifySuccess(typeof res === 'string' ? res : done);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.event(eventId) }),
        qc.invalidateQueries({ queryKey: qk.allEvents }),
        qc.invalidateQueries({ queryKey: qk.dashboard }),
      ]);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  };

  const approve = () => run('approve', async () => {
    const res = await api.events.approve(e.id);
    const created = res.special_tasks_created ?? 0;
    const skipped = (res.special_tasks_skipped ?? []).join(', ');
    return ['Event approved.',
      created > 0 ? `${created} TWG special task${created === 1 ? '' : 's'} assigned.` : '',
      skipped ? `Not assigned (no matching TaskNet user): ${skipped}.` : ''].filter(Boolean).join(' ');
  }, 'Event approved.');
  const disable = async () => {
    if (await confirm('Disable event', `Disable "${e.title}"?`, 'Disable', true)) await run('disable', () => api.events.disable(e.id), 'Event disabled');
  };

  const date = parseEventDate(e.target_date);
  const sections: [string, string | null | undefined, (raw: string) => string][] = [
    ['Target participants', e.participants, formatParticipants],
    ['Expected outputs', e.expected_outputs, formatOutputs],
    ['Rationale', e.rationale, (s) => s],
    ['Objectives', e.objectives, formatOutputs],
    ['Methodology', e.phase1, formatMethodology],
    ['Activity matrix', e.activity_matrix, formatActivityMatrix],
    ['Executive committee', e.exec_committee, formatCommittee],
    ['Technical working groups', e.twg_groups, formatTwg],
    ['Monitoring & evaluation', e.monitoring_criteria, (s) => s],
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Event' }} />
      <Screen onRefresh={() => event.refetch()}>
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <T v="h2" style={{ flex: 1 }}>{e.title || 'Untitled event'}</T>
            <EventStatusPill status={e.status} />
          </Row>
          <Gap size={6} />
          <InfoLine icon="calendar-outline">{date ? formatDate(date) : e.target_date || 'Date to be set'}</InfoLine>
          {e.venue ? <InfoLine icon="location-outline">{e.venue}</InfoLine> : null}
          {e.nature ? <InfoLine icon="pricetag-outline">{e.nature}</InfoLine> : null}
          {e.proposed_budget ? <InfoLine icon="wallet-outline">{formatMoney(e.proposed_budget)}{e.fund_source ? ` · ${e.fund_source}` : ''}</InfoLine> : null}
          {e.creator_name ? <InfoLine icon="person-outline">Proposed by {e.creator_name}</InfoLine> : null}
          {e.focal_name ? <InfoLine icon="id-card-outline">Focal: {[e.focal_name, e.focal_role, e.focal_contact].filter(Boolean).join(' · ')}</InfoLine> : null}
        </Card>

        <View style={{ gap: 8, marginTop: 12 }}>
          {canApprove && pending && <Button title="Approve event" kind="success" icon="checkmark-circle-outline" loading={busy === 'approve'} onPress={() => void approve()} />}
          {canApprove && !canManage && pending && <Button title="Disable event" kind="danger" icon="ban-outline" loading={busy === 'disable'} onPress={() => void disable()} />}
          {canApprove && e.status === 'disabled' && <Button title="Re-enable event" kind="outline" icon="refresh-outline" loading={busy === 'enable'}
            onPress={() => void run('enable', () => api.events.enable(e.id), 'Event re-enabled')} />}
          {showQr && <Button title="Attendance QR codes" kind="outline" icon="qr-code-outline" onPress={() => setQr('attendance')} />}
          {showQr && <Button title="Evaluation QR code" kind="outline" icon="star-outline" onPress={() => setQr('evaluation')} />}
          <Button title="Print / share proposal" kind="outline" icon="print-outline" loading={busy === 'print'}
            onPress={() => void run('print', () => shareProposal(e))} />
        </View>

        {sections.filter(([, raw]) => hasContent(raw)).map(([title, raw, fmt]) => (
          <View key={title}>
            <SectionHeader title={title} />
            <Card><T style={{ lineHeight: 21 }}>{fmt(raw!)}</T></Card>
          </View>
        ))}
      </Screen>
      <QrSheet event={e} kind={qr} onClose={() => setQr(null)} />
    </>
  );
}

/** Full-screen QR for the organizer to show attendees (attendance time in/out, or the evaluation form). */
function QrSheet({ event, kind, onClose }: { event: EventRecord; kind: 'attendance' | 'evaluation' | null; onClose: () => void }) {
  const codes = useQuery({
    queryKey: ['attendance-qr', event.id],
    queryFn: () => api.events.attendanceQrCodes(event.id),
    enabled: kind === 'attendance',
  });
  const [index, setIndex] = useState(0);
  const [action, setAction] = useState<'time_in' | 'time_out'>('time_in');

  let body: ReactNode = null;
  if (kind === 'evaluation') {
    body = <QrBlock value={`${WEB_BASE}/eval/${event.id}`} caption="Scan to rate this event" />;
  } else if (kind === 'attendance') {
    if (codes.isPending) body = <Loading />;
    else if (codes.isError) body = <ErrorView error={codes.error} onRetry={() => codes.refetch()} />;
    else if (!codes.data.activities.length) body = <T v="muted">This event has no activity matrix rows to take attendance for.</T>;
    else {
      const acts = codes.data.activities;
      const a = acts[Math.min(index, acts.length - 1)];
      const code = action === 'time_in' ? a.time_in_code : a.time_out_code;
      body = (
        <View style={{ gap: 12, alignItems: 'stretch' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {acts.map((x, i) => (
              <Pressable key={x.index} onPress={() => setIndex(i)} accessibilityRole="tab" accessibilityState={{ selected: i === index }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: i === index ? colors.dark : '#fff', maxWidth: 220 }}>
                <T v="small" numberOfLines={1} style={{ color: i === index ? '#fff' : colors.text, fontWeight: '600' }}>
                  {[x.day, x.time].filter(Boolean).join(' · ') || `Activity ${x.index + 1}`}
                </T>
              </Pressable>
            ))}
          </ScrollView>
          <Segmented value={action} onChange={setAction} options={[{ value: 'time_in', label: 'Time in' }, { value: 'time_out', label: 'Time out' }]} />
          <QrBlock value={`${WEB_BASE}/attendance/${event.id}/${a.index}/scan?action=${action}&code=${encodeURIComponent(code)}`}
            caption={`${a.event || 'Activity'} — ${action === 'time_in' ? 'Time in' : 'Time out'}`} />
          {!a.schedule_readable && <T v="small" style={{ color: colors.amber, textAlign: 'center' }}>This row&apos;s day/time can&apos;t be read, so scanning isn&apos;t time-limited.</T>}
        </View>
      );
    }
  }

  return (
    <Modal visible={kind != null} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Row style={{ justifyContent: 'space-between', padding: 12 }}>
          <T v="h3" style={{ flex: 1 }} numberOfLines={1}>{kind === 'evaluation' ? 'Evaluation QR' : 'Attendance QR'} · {event.title}</T>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </Row>
        <ScrollView contentContainerStyle={{ padding: 16 }}>{body}</ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function QrBlock({ value, caption }: { value: string; caption: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ backgroundColor: '#fff', padding: 18, borderRadius: 16 }}>
        <QRCode value={value} size={240} />
      </View>
      <T style={{ fontWeight: '700', textAlign: 'center' }}>{caption}</T>
      <T v="small" selectable style={{ textAlign: 'center' }}>{value}</T>
    </View>
  );
}
