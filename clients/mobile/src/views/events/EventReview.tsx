import { ReactNode, useState } from 'react';
import { Linking, View } from 'react-native';
import { EventDetailController, REVIEW_DECISION, SEND_BACK, SendBack } from '@shared/controllers/EventControllers';
import { AttendanceList, EventItem, EventReview, VenuePin } from '@shared/models';
import { formatDistance } from '@shared/utils/geo';
import { Badge, Button, C, Field, Input, Modal, Row, T } from '../../ui/kit';
import { Panel } from './EventDetailParts';

const TONE = { green: C.green, orange: '#c2410c', red: C.red };

/** Reject / Request revisions: the comment is required. [send] resolves true when it went through. */
export function SendBackSheet({ event, decision, onClose, send }: {
  event: EventItem; decision: SendBack; onClose: () => void; send: (comment: string) => Promise<boolean>;
}) {
  const t = SEND_BACK[decision];
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={t.title} subtitle={event.title} icon={decision === 'rejected' ? 'x-circle' : 'corner-up-left'} locked={busy} onClose={onClose}
      footer={<>
        <Button variant="ghost" disabled={busy} onPress={onClose}>Cancel</Button>
        <Button variant={decision === 'rejected' ? 'danger' : 'dark'} disabled={!comment.trim()} loading={busy}
          onPress={async () => { setBusy(true); if (!(await send(comment.trim()))) setBusy(false); }}>{t.confirm}</Button>
      </>}>
      <T size={13} color={C.muted}>{t.hint}</T>
      <Field label={t.label} required>
        <Input multiline rows={5} maxLength={4000} placeholder={t.placeholder} value={comment} onChangeText={setComment} />
      </Field>
    </Modal>
  );
}

/** The approver's comment on a returned proposal, shown to the proponent. */
export function ReturnedCard({ event, action }: { event: EventItem; action?: ReactNode }) {
  if (!event.isReturned) return null;
  const latest = event.latestReturn;
  const tone = event.status === 'rejected' ? C.red : '#c2410c';
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 8, borderLeftWidth: 4, borderLeftColor: tone }}>
      <T size={15} weight={700} color={tone}>{event.status === 'rejected' ? 'This proposal was rejected' : 'Revisions requested'}</T>
      {latest?.comment ? <T size={14} style={{ lineHeight: 21 }}>{latest.comment}</T> : null}
      {latest ? <T size={12} color={C.muted}>{latest.reviewerName ?? 'Approver'} · {EventDetailController.when(latest.createdAt)}</T> : null}
      <T size={13}>{event.status === 'rejected' ? 'You can revise the proposal and submit it again for approval.' : 'Make the changes, then resubmit the proposal for approval.'}</T>
      {action}
    </View>
  );
}

/** Every decision on the proposal, newest first. */
export function ReviewHistory({ reviews }: { reviews: EventReview[] }) {
  return (
    <Panel icon="clock" title="Review history">
      <View style={{ gap: 12 }}>
        {reviews.map((r) => {
          const d = REVIEW_DECISION[r.decision] ?? REVIEW_DECISION.approved;
          return (
            <View key={r.id} style={{ gap: 3 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T size={13.5} weight={700} color={TONE[d.tone]}>{d.label}</T>
                <T size={11.5} color={C.muted}>{EventDetailController.when(r.createdAt)}</T>
              </Row>
              <T size={12} color={C.muted}>{r.reviewerName ?? 'Approver'}</T>
              {r.comment ? <T size={13.5} style={{ lineHeight: 20 }}>{r.comment}</T> : null}
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

/** The pinned venue and its perimeter (opens in OpenStreetMap). */
export function VenueCard({ pin, venue }: { pin: VenuePin; venue: string | null }) {
  return (
    <Panel icon="map-pin" title="Venue & attendance perimeter">
      <T size={13} color={C.muted}>Time In / Time Out scans are accepted within {pin.radius} m of the pin{venue ? ` (${venue})` : ''}.</T>
      <T size={12} color={C.muted}>Pinned at {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</T>
      <Button variant="outline-muted" size="sm" icon="map" style={{ alignSelf: 'flex-start' }}
        onPress={() => void Linking.openURL(EventDetailController.mapLink(pin.lat, pin.lng))}>Open in OpenStreetMap</Button>
    </Panel>
  );
}

/** Who scanned the attendance QR codes, per session: personnel and guests. */
export function AttendancePanel({ list, error, total, guests }: { list: AttendanceList | null; error: string | null; total: number; guests: number }) {
  const clock = EventDetailController.clock;
  return (
    <Panel icon="user-check" title="Attendance">
      {error ? <T size={13} color={C.red}>{error}</T>
        : !list ? <T size={13} color={C.muted}>Loading…</T>
        : !list.attendees.length ? <T size={13} color={C.muted}>No one has scanned in yet. Time In / Time Out scans will appear here.</T>
        : (
          <View style={{ gap: 12 }}>
            <T size={12.5} color={C.muted}>{total} scan record{total === 1 ? '' : 's'}{guests ? ` · ${guests} guest${guests === 1 ? '' : 's'} without a TaskNet account` : ''}</T>
            {list.sessions.map((sess) => {
              const rows = list.attendees.filter((a) => a.activity_index === sess.index);
              if (!rows.length) return null;
              return (
                <View key={sess.index} style={{ gap: 6 }}>
                  <T size={13.5} weight={700}>{sess.event}{sess.time ? ` · ${sess.time}` : ''}</T>
                  {rows.map((a) => (
                    <View key={a.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, gap: 3 }}>
                      <Row gap={6}><T weight={600} style={{ flexShrink: 1 }}>{a.name || '—'}</T>{a.is_guest ? <Badge tone="purple">Guest</Badge> : null}</Row>
                      {a.role ? <T size={12} color={C.muted} style={{ textTransform: 'capitalize' }}>{a.role.replace(/_/g, ' ')}{a.is_guest && a.affiliation ? ` · ${a.affiliation}` : ''}</T> : null}
                      <T size={12.5}>
                        In {clock(a.time_in_at)}{a.time_in_distance_m != null ? ` (${formatDistance(a.time_in_distance_m)} away)` : ''} · Out {clock(a.time_out_at)}
                        {a.time_out_distance_m != null ? ` (${formatDistance(a.time_out_distance_m)} away)` : ''}
                      </T>
                      <T size={12} color={a.evaluated_at ? C.green : C.muted}>{a.evaluated_at ? 'Evaluation submitted' : a.time_out_at ? 'Evaluation not yet submitted' : 'Not timed out yet'}</T>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}
    </Panel>
  );
}
