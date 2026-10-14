import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  api, isTaskSubmitted, parseEventDate, qk, roleLabel, startOfDay, taskDeadline, useSession, useUser, type Task,
} from '@tasknet/shared';
import { EventCard, TaskCard } from '@/components/cards';
import { Button, Empty, ErrorView, Loading, Row, Screen, SectionHeader, StatTile, T } from '@/components/ui';

const byDeadline = (a: Task, b: Task) =>
  (taskDeadline(a)?.getTime() ?? Infinity) - (taskDeadline(b)?.getTime() ?? Infinity);

export default function HomeScreen() {
  const user = useUser();
  const { can } = useSession();
  const dash = useQuery({ queryKey: qk.dashboard, queryFn: api.dashboard.get });

  if (dash.isPending) return <Loading />;
  if (dash.isError) return <ErrorView error={dash.error} onRetry={() => dash.refetch()} />;
  const d = dash.data;

  const receives = can('receive_tasks');
  const manages = can('create_tasks') || can('view_all_tasks');
  const dueSoon = d.my_tasks.filter((t) => !isTaskSubmitted(t) && t.status !== 'disabled').sort(byDeadline).slice(0, 5);
  const today = startOfDay(new Date());
  const upcoming = d.events
    .filter((e) => e.status === 'approved' && (parseEventDate(e.target_date) ?? today) >= today)
    .sort((a, b) => (parseEventDate(a.target_date)?.getTime() ?? 0) - (parseEventDate(b.target_date)?.getTime() ?? 0))
    .slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen onRefresh={() => dash.refetch()}>
      <View style={{ backgroundColor: '#1A1A2E', borderRadius: 16, padding: 18 }}>
        <T style={{ color: '#9CA3AF' }}>{greeting},</T>
        <T style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{user.first_name || user.full_name}</T>
        <T v="small" style={{ color: '#9CA3AF', marginTop: 2 }}>
          {roleLabel(user.role)}{user.grade_level ? ` · ${user.grade_level}` : ''}
        </T>
        <Button title="Scan attendance QR" icon="qr-code-outline" kind="outline" small style={{ marginTop: 14, alignSelf: 'flex-start' }}
          onPress={() => router.push('/scan')} />
      </View>

      {receives && (
        <Row gap={10} style={{ marginTop: 14 }}>
          <StatTile value={d.pending} label="Pending" icon="hourglass-outline" tone="amber" />
          <StatTile value={d.submitted} label="Submitted" icon="checkmark-done-outline" tone="green" />
          <StatTile value={d.missing} label="Missing" icon="alert-circle-outline" tone="red" />
        </Row>
      )}

      {receives && (
        <>
          <SectionHeader title="Due soon" right={<Button title="All" kind="ghost" small onPress={() => router.navigate('/tasks')} />} />
          {dueSoon.length ? dueSoon.map((t) => <TaskCard key={t.id} task={t} mine />)
            : <Empty title="You're all caught up" message="No open tasks right now." icon="checkmark-circle-outline" />}
        </>
      )}

      {manages && (
        <>
          <SectionHeader title="Tasks you manage" />
          {d.task_manager_tasks.length ? d.task_manager_tasks.slice(0, 5).map((t) => <TaskCard key={t.id} task={t} />)
            : <Empty title="No tasks yet" message="Tasks you create appear here." />}
        </>
      )}

      <SectionHeader title="Upcoming events" right={<Button title="All" kind="ghost" small onPress={() => router.navigate('/events')} />} />
      {upcoming.length ? upcoming.map((e) => <EventCard key={e.id} event={e} />)
        : <Empty title="No upcoming events" icon="calendar-outline" />}
    </Screen>
  );
}
