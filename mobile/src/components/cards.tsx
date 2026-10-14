import { View } from 'react-native';
import { router } from 'expo-router';
import {
  dueState, formatDate, formatDue, isTaskSubmitted, MONTHS_SHORT, parseEventDate, type EventRecord, type Task,
} from '@tasknet/shared';
import { Card, InfoLine, Pill, Row, T } from './ui';

const DUE_TONE: Record<string, string> = {
  overdue: 'red', today: 'amber', tomorrow: 'amber', week: 'blue', later: 'gray', none: 'gray',
};

export const EVENT_STATUS: Record<string, [string, string]> = {
  approved: ['Approved', '#2F855A'],
  pending_approval: ['Pending', '#C05621'],
  disabled: ['Disabled', '#C53030'],
  draft: ['Draft', '#4A5568'],
};

export function EventStatusPill({ status }: { status: string }) {
  const [label, color] = EVENT_STATUS[status] ?? ['Pending', '#C05621'];
  return <Pill label={label} color={color} />;
}

/**
 * A task row. `mine` shows the viewer's own submission state; otherwise the
 * team's submission count.
 */
export function TaskCard({ task: t, mine }: { task: Task; mine?: boolean }) {
  const due = dueState(t);
  const submitted = mine && isTaskSubmitted(t);
  return (
    <Card onPress={() => router.push({ pathname: '/task/[id]', params: { id: String(t.id), own: mine ? '1' : '0' } })}
      style={{ marginBottom: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <T v="h3" style={{ flex: 1 }} numberOfLines={2}>{t.title}</T>
        {t.status === 'disabled' ? <Pill label="Disabled" tone="gray" />
          : submitted ? <Pill label="Submitted" tone="green" />
            : <Pill label={due.label} tone={DUE_TONE[due.state]} />}
      </Row>
      <View style={{ marginTop: 4 }}>
        <InfoLine icon="time-outline">Due {formatDue(t)}</InfoLine>
        {t.task_category === 'special' && <InfoLine icon="star-outline">Special task</InfoLine>}
        {!mine && t.assigned_users && (
          <InfoLine icon="people-outline">
            {t.team_submitted ?? t.submission_count ?? 0} of {t.team_total ?? t.assigned_users.length} submitted
          </InfoLine>
        )}
        {mine && t.created_by_name && <InfoLine icon="person-outline">From {t.created_by_name}</InfoLine>}
      </View>
    </Card>
  );
}

export function EventCard({ event: e }: { event: EventRecord }) {
  const date = parseEventDate(e.target_date);
  return (
    <Card onPress={() => router.push({ pathname: '/event/[id]', params: { id: String(e.id) } })} style={{ marginBottom: 10 }}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 48, alignItems: 'center', backgroundColor: '#EEF2FA', borderRadius: 10, paddingVertical: 6 }}>
          <T v="small" style={{ fontWeight: '700', color: '#8B0000' }}>
            {date ? MONTHS_SHORT[date.getMonth()].toUpperCase() : '—'}
          </T>
          <T style={{ fontSize: 20, fontWeight: '800' }}>{date ? date.getDate() : '?'}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <T v="h3" style={{ flex: 1 }} numberOfLines={2}>{e.title}</T>
            <EventStatusPill status={e.status} />
          </Row>
          {e.venue ? <InfoLine icon="location-outline">{e.venue}</InfoLine> : null}
          <InfoLine icon="calendar-outline">{date ? formatDate(date) : e.target_date || 'Date to be set'}</InfoLine>
          {e.creator_name ? <InfoLine icon="person-outline">{e.creator_name}</InfoLine> : null}
        </View>
      </Row>
    </Card>
  );
}
