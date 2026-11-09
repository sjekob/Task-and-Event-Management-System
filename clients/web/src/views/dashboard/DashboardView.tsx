import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarCheck, CheckCircle2, ClipboardCheck, ClipboardList, Clock, FilePlus2, Hourglass, ListTodo } from 'lucide-react';
import { DashboardController } from '@shared/controllers/DashboardController';
import { parseEventDate } from '@shared/models';
import { useServices, useSession } from '../../app/AppContext';
import { useLiveRefresh, useScreenController } from '../../app/hooks';
import { Banner, ErrorBox } from '../../ui/kit';
import './dashboard.css';
import { CalendarCard } from './DashboardCalendar';
import { Chip, DashboardSkeleton, DateTile, Kpi, MiniProgress, Row, Section, StatusDot } from './DashboardParts';

export default function DashboardView() {
  const services = useServices();
  const { user } = useSession();
  const navigate = useNavigate();
  const [c, s] = useScreenController(() => new DashboardController(services, user), [user?.id]);
  useEffect(() => { void c.load(); }, [c]);
  useLiveRefresh(() => void c.load());   // pending approvals and the calendar stay current

  if (s.loading) return <DashboardSkeleton />;
  const d = s.data;
  const approver = c.isApprover;

  return (
    <div className="col gap-16">
      <Banner title={c.greeting()} subtitle={c.subtitle()} />
      {s.error && <ErrorBox message={s.error} onRetry={() => void c.load()} />}

      <div className="grid-3">
        <Kpi value={d?.pending ?? 0} label="Pending" caption={approver ? 'Not yet submitted, still on time' : 'Open and still on time'}
          icon={<Clock size={22} />} tone="amber" onClick={() => navigate(c.tasksRoute)} />
        <Kpi value={d?.submitted ?? 0} label="Submitted" caption={approver ? 'Turned in by assignees' : 'Turned in by you'}
          icon={<CheckCircle2 size={22} />} tone="green" onClick={() => navigate(c.tasksRoute)} />
        <Kpi value={d?.missing ?? 0} label="Missing" caption="Past deadline, not submitted" icon={<AlertCircle size={22} />} tone="red"
          alert={(d?.missing ?? 0) > 0} onClick={() => navigate(c.tasksRoute)} />
      </div>

      <div className="dash-grid">
        <div className="col gap-16" style={{ minWidth: 0 }}>
          {!approver && (
            <Section icon={<ClipboardList size={18} />} title="My tasks" count={d?.myTasks.length ?? 0} action="View all"
              onAction={() => navigate('/my-tasks')}
              empty={!d?.myTasks.length ? { icon: <ListTodo size={20} />, text: 'Nothing to submit — you are all caught up.' } : undefined}>
              {d?.myTasks.map((t) => {
                const chip = DashboardController.dueChip(t);
                return (
                  <Row key={t.id} leading={<StatusDot tone={DashboardController.dueTone(t)} />} title={t.title}
                    meta={DashboardController.taskMeta(t)} trailing={<Chip tone={chip.tone}>{chip.label}</Chip>}
                    onClick={() => navigate(DashboardController.myTaskPath(t))} />
                );
              })}
            </Section>
          )}
          {c.canCreateTasks && (
            <Section icon={<ClipboardCheck size={18} />} title="Task manager" count={d?.taskManagerTasks.length ?? 0} action="View all"
              onAction={() => navigate('/tasks')}
              empty={!d?.taskManagerTasks.length ? { icon: <FilePlus2 size={20} />, text: 'You have no active tasks. Tasks you create appear here.' } : undefined}>
              {d?.taskManagerTasks.map((t) => (
                <Row key={t.id} leading={<StatusDot tone={t.isOverdue ? 'red' : 'amber'} />} title={t.title}
                  meta={DashboardController.taskMeta(t, true)}
                  trailing={(t.teamTotal ?? 0) === 0
                    ? <Chip tone="gray">Not assigned</Chip>
                    : <MiniProgress done={t.teamSubmitted ?? 0} total={t.teamTotal!} />}
                  onClick={() => navigate(DashboardController.managedTaskPath(t))} />
              ))}
            </Section>
          )}
          <Section icon={<Hourglass size={18} />} title={approver ? 'Awaiting your approval' : 'My pending proposals'}
            count={d?.eventsTotal ?? 0} action="View events" onAction={() => navigate('/events')}
            empty={!d?.events.length ? {
              icon: <CalendarCheck size={20} />,
              text: approver ? 'No event proposals are waiting for you.' : 'None of your event proposals are waiting for approval.',
            } : undefined}
            footer={d && d.eventsTotal > d.events.length ? `+${d.eventsTotal - d.events.length} more in Events` : undefined}>
            {d?.events.map((e) => (
              <Row key={e.id} leading={<DateTile date={parseEventDate(e.targetDate)} />} title={e.title || 'Untitled event'}
                meta={DashboardController.eventMeta(e)} trailing={<Chip tone="amber">Pending</Chip>}
                onClick={() => navigate(DashboardController.eventPath(e))} />
            ))}
          </Section>
        </div>

        <CalendarCard c={c} />
      </div>
    </div>
  );

}
