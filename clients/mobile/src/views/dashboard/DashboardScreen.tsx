import { useEffect } from 'react';
import { View } from 'react-native';
import { DashboardController } from '@shared/controllers/DashboardController';
import { parseEventDate } from '@shared/models';
import { useServices, useSession } from '../../core/AppModel';
import { useLiveRefresh, useScreenController } from '../../core/hooks';
import { go } from '../../core/routes';
import { Banner, C, Card, ErrorBox, Screen, T } from '../../ui/kit';
import { MonthCalendar } from '../common/MonthCalendar';
import { Chip, DashboardSkeleton, DashRow, DateTile, Kpi, MiniProgress, Section, StatusDot } from './DashboardParts';

export default function DashboardScreen() {
  const services = useServices();
  const { user } = useSession();
  const [c, s] = useScreenController(() => new DashboardController(services, user), [user?.id]);
  useEffect(() => { void c.load(); }, [c]);
  useLiveRefresh(() => void c.load());   // pending approvals and the calendar stay current

  if (s.loading) return <Screen><DashboardSkeleton /></Screen>;
  const d = s.data;
  const approver = c.isApprover;
  const upcoming = c.upcoming();

  return (
    <Screen onRefresh={() => c.load()}>
      <Banner title={c.greeting()} subtitle={c.subtitle()} />
      {s.error && <ErrorBox message={s.error} onRetry={() => void c.load()} />}
      <Kpi value={d?.pending ?? 0} label="Pending" caption={approver ? 'Not yet submitted, still on time' : 'Open and still on time'}
        icon="clock" tone="amber" onPress={() => go(c.tasksRoute)} />
      <Kpi value={d?.submitted ?? 0} label="Submitted" caption={approver ? 'Turned in by assignees' : 'Turned in by you'}
        icon="check-circle" tone="green" onPress={() => go(c.tasksRoute)} />
      <Kpi value={d?.missing ?? 0} label="Missing" caption="Past deadline, not submitted" icon="alert-circle" tone="red"
        alert={(d?.missing ?? 0) > 0} onPress={() => go(c.tasksRoute)} />

      {!approver && (
        <Section icon="clipboard" title="My tasks" count={d?.myTasks.length ?? 0} action="View all" onAction={() => go('/my-tasks')}
          empty={!d?.myTasks.length ? { icon: 'list', text: 'Nothing to submit — you are all caught up.' } : undefined}>
          {d?.myTasks.map((t) => {
            const chip = DashboardController.dueChip(t);
            return (
              <DashRow key={t.id} leading={<StatusDot tone={DashboardController.dueTone(t)} />} title={t.title}
                meta={DashboardController.taskMeta(t)} trailing={<Chip tone={chip.tone}>{chip.label}</Chip>}
                onPress={() => go(DashboardController.myTaskPath(t))} />
            );
          })}
        </Section>
      )}

      {c.canCreateTasks && (
        <Section icon="check-square" title="Task manager" count={d?.taskManagerTasks.length ?? 0} action="View all" onAction={() => go('/tasks')}
          empty={!d?.taskManagerTasks.length ? { icon: 'file-plus', text: 'You have no active tasks. Tasks you create appear here.' } : undefined}>
          {d?.taskManagerTasks.map((t) => (
            <DashRow key={t.id} leading={<StatusDot tone={t.isOverdue ? 'red' : 'amber'} />} title={t.title} meta={DashboardController.taskMeta(t, true)}
              trailing={(t.teamTotal ?? 0) === 0 ? <Chip tone="gray">Not assigned</Chip> : <MiniProgress done={t.teamSubmitted ?? 0} total={t.teamTotal!} />}
              onPress={() => go(DashboardController.managedTaskPath(t))} />
          ))}
        </Section>
      )}

      <Section icon="loader" title={approver ? 'Awaiting your approval' : 'My pending proposals'} count={d?.eventsTotal ?? 0}
        action="Events" onAction={() => go('/events')}
        empty={!d?.events.length ? { icon: 'calendar', text: approver ? 'No event proposals are waiting for you.' : 'None of your event proposals are waiting for approval.' } : undefined}
        footer={d && d.eventsTotal > d.events.length ? `+${d.eventsTotal - d.events.length} more in Events` : undefined}>
        {d?.events.map((e) => (
          <DashRow key={e.id} leading={<DateTile date={parseEventDate(e.targetDate)} />} title={e.title || 'Untitled event'}
            meta={DashboardController.eventMeta(e)} trailing={<Chip tone="amber">Pending</Chip>} onPress={() => go(DashboardController.eventPath(e))} />
        ))}
      </Section>

      <Card>
        <MonthCalendar month={s.month} onPrev={() => c.prevMonth()} onNext={() => c.nextMonth()}
          dots={(k) => [c.eventsOn(k).length ? C.accent : '', c.hasDeadline(k) ? C.amber : '', c.depedOn(k).length ? C.purple : ''].filter(Boolean)}
          details={(k) => c.dayTooltip(k) ?? (c.hasDeadline(k) ? 'A task is due on this day.' : null)}
          legend={[{ color: C.accent, label: 'Event' }, { color: C.amber, label: 'Task deadline' }, { color: C.purple, label: 'DepEd memo' }]} />
        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12 }} />
        <T size={13} weight={700} style={{ marginBottom: 6 }}>Upcoming events</T>
        {upcoming.length === 0 ? <T size={12.5} color={C.muted}>No upcoming events</T> : upcoming.map(({ date, event }) => (
          <DashRow key={`${event.id}-${date.getTime()}`} leading={<DateTile date={date} compact />} title={event.title || 'Event'}
            meta={event.venue?.trim() ?? ''} trailing={null} onPress={() => go(DashboardController.eventPath(event))} />
        ))}
      </Card>
    </Screen>
  );
}
