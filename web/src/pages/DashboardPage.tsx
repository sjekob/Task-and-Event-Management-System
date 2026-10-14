import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Center, Divider, Grid, Group, Paper, Progress, SimpleGrid, Stack, Text,
  ThemeIcon, UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircleFilled, IconArrowRight, IconArrowsMaximize, IconCalendarCheck, IconChecklist,
  IconCircleCheckFilled, IconClipboardList, IconClockHour4, IconCalendarEvent, IconHourglass,
  IconChevronRight,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  api, daysUntil, depedByDay, depedRangeLabel, dueState, formatDue, isoDate, isTaskOverdue,
  MONTHS_LONG, MONTHS_SHORT, parseEventDate, qk, startOfDay, taskDeadline, useSession, useUser,
  type DashboardData, type EventRecord, type SessionUser, type Task,
} from '@tasknet/shared';
import { AppCalendar } from '../components/AppCalendar';
import { ErrorState, PageBanner, PageLoader } from '../components/ui';
import { colors } from '../theme';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function greeting(user: SessionUser) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  // Some accounts store a role-prefixed full name ("Principal Liza Ramos").
  const name = (user.first_name?.trim() || user.full_name || '').trim()
    .replace(/^(principal|coordinator|dean|registrar|teacher|admin)\s+/i, '');
  const first = name.split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** One line on what needs attention, built from the same data as the cards. */
function summary(d: DashboardData | undefined, isApprover: boolean) {
  if (!d) return 'Here is what is happening today.';
  const parts: string[] = [];
  if (isApprover) {
    if (d.events_total > 0) parts.push(`${d.events_total} event ${d.events_total === 1 ? 'proposal' : 'proposals'} awaiting your approval`);
    if (d.missing > 0) parts.push(`${d.missing} ${d.missing === 1 ? 'assignment' : 'assignments'} past deadline on your tasks`);
    return parts.length ? `${parts.join(' · ')}.` : 'Nothing needs your attention right now.';
  }
  const dueSoon = d.my_tasks.filter((t) => {
    const dl = taskDeadline(t);
    return dl && !isTaskOverdue(t) && daysUntil(dl) <= 7;
  }).length;
  if (d.missing > 0) parts.push(`${d.missing} overdue ${d.missing === 1 ? 'task' : 'tasks'}`);
  if (dueSoon > 0) parts.push(`${dueSoon} due this week`);
  if (!parts.length) {
    return d.pending > 0
      ? `No deadlines this week — ${d.pending} ${d.pending === 1 ? 'task' : 'tasks'} still open.`
      : 'You are all caught up.';
  }
  return `You have ${parts.join(' and ')}.`;
}

const CHIP: Record<string, { fg: string; bg: string }> = {
  overdue: { fg: '#B91C1C', bg: colors.redBg },
  today: { fg: '#B45309', bg: colors.amberBg },
  tomorrow: { fg: '#B45309', bg: colors.amberBg },
  week: { fg: colors.accent, bg: colors.blueBg },
  later: { fg: colors.textMuted, bg: '#F1F5F9' },
  none: { fg: colors.textMuted, bg: '#F1F5F9' },
  pending: { fg: '#B45309', bg: colors.amberBg },
};

function Chip({ label, kind }: { label: string; kind: string }) {
  const c = CHIP[kind] ?? CHIP.none;
  return <Badge radius="xl" tt="none" fw={600} style={{ background: c.bg, color: c.fg }}>{label}</Badge>;
}

function dueColor(t: Task) {
  const s = dueState(t).state;
  return s === 'overdue' ? colors.red : s === 'today' || s === 'tomorrow' ? colors.amber : colors.accent;
}

export function DashboardPage() {
  const user = useUser();
  const { can } = useSession();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => new Date());

  const dash = useQuery({ queryKey: qk.dashboard, queryFn: api.dashboard.get });
  const events = useQuery({ queryKey: qk.events(), queryFn: () => api.events.list() });
  const deped = useQuery({ queryKey: qk.deped(), queryFn: () => api.depedCalendar.list() });

  // Approvers (principal/admin) receive no tasks; only task creators have a Task Manager.
  const isApprover = !can('receive_tasks');
  const canCreate = can('create_tasks');

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRecord[]>();
    for (const e of events.data ?? []) {
      if (e.status === 'disabled' || e.status === 'draft') continue;
      const d = parseEventDate(e.target_date);
      if (d) map.set(isoDate(d), [...(map.get(isoDate(d)) ?? []), e]);
    }
    return map;
  }, [events.data]);
  const depedDays = useMemo(() => depedByDay(deped.data ?? []), [deped.data]);

  if (dash.isPending) return <PageLoader />;
  if (dash.isError) return <ErrorState error={dash.error} onRetry={() => dash.refetch()} />;
  const d = dash.data;
  const now = new Date();

  const openCalendar = (day: Date, select = true) =>
    navigate(`/events?view=calendar&${select ? 'date' : 'month'}=${isoDate(day)}`);

  const kpiRoute = isApprover ? '/tasks' : '/my-tasks';
  const today = startOfDay(now);
  const upcoming = [...eventsByDay.entries()]
    .map(([k, list]) => [parseEventDate(k)!, list] as const)
    .filter(([day]) => day >= today)
    .sort((a, b) => a[0].getTime() - b[0].getTime())
    .flatMap(([day, list]) => list.map((e) => ({ day, e })))
    .slice(0, 3);

  const sections: ReactNode[] = [];
  if (!isApprover) {
    sections.push(
      <SectionCard key="mine" icon={<IconClipboardList size={18} />} title="My tasks" count={d.my_tasks.length}
        actionLabel="View all" onAction={() => navigate('/my-tasks')}
        empty={!d.my_tasks.length && <Empty icon={<IconCircleCheckFilled size={20} />}
          message="Nothing to submit — you are all caught up." />}>
        {d.my_tasks.map((t) => {
          const due = dueState(t);
          return (
            <Row key={t.id} leading={<Dot color={dueColor(t)} />} title={t.title}
              meta={`${t.task_category === 'special' ? 'Special task' : 'Task'} · Due ${formatDue(t)}`}
              trailing={<Chip label={due.label} kind={due.state} />}
              onClick={() => navigate(`${t.task_category === 'special' ? '/my-special-tasks' : '/my-tasks'}/${t.id}`)} />
          );
        })}
      </SectionCard>,
    );
  }
  if (canCreate) {
    sections.push(
      <SectionCard key="tm" icon={<IconChecklist size={18} />} title="Task manager" count={d.task_manager_tasks.length}
        actionLabel="View all" onAction={() => navigate('/tasks')}
        empty={!d.task_manager_tasks.length && <Empty icon={<IconCalendarCheck size={20} />}
          message="You have no active tasks. Tasks you create appear here." />}>
        {d.task_manager_tasks.map((t) => {
          const total = t.team_total ?? 0;
          const done = t.team_submitted ?? 0;
          return (
            <Row key={t.id} leading={<Dot color={isTaskOverdue(t) ? colors.red : colors.accent} />} title={t.title}
              meta={`${t.task_category === 'special' ? 'Special task' : 'Task'} · Due ${formatDue(t)}${total ? ` · ${total} assigned` : ''}`}
              trailing={total === 0 ? <Chip label="Not assigned" kind="none" /> : (
                <Box w={120}>
                  <Text size="xs" fw={600} ta="right" c={done >= total ? '#16A34A' : 'dimmed'}>{done}/{total} submitted</Text>
                  <Progress value={(done / total) * 100} size={6} mt={5} radius="xl"
                    color={done >= total ? 'green' : 'brand'} bg="#EEF2FA" />
                </Box>
              )}
              onClick={() => navigate(`${t.task_category === 'special' ? '/special-tasks' : '/tasks'}/${t.id}`)} />
          );
        })}
      </SectionCard>,
    );
  }
  const total = d.events_total ?? d.events.length;
  sections.push(
    <SectionCard key="pending" icon={<IconHourglass size={18} />}
      title={isApprover ? 'Awaiting your approval' : 'My pending proposals'} count={total}
      actionLabel="View events" onAction={() => navigate('/events')}
      footer={total > d.events.length ? `+${total - d.events.length} more in Events` : undefined}
      empty={!d.events.length && <Empty icon={<IconCalendarEvent size={20} />} message={isApprover
        ? 'No event proposals are waiting for you.'
        : 'None of your event proposals are waiting for approval.'} />}>
      {d.events.map((e) => (
        <Row key={e.id} leading={<DateTile date={parseEventDate(e.target_date)} />} title={e.title || 'Untitled event'}
          meta={[e.nature, e.venue].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ')}
          trailing={<Chip label="Pending" kind="pending" />}
          onClick={() => navigate(`/events?open=${e.id}`)} />
      ))}
    </SectionCard>,
  );

  const kpis = [
    { value: d.pending, label: 'Pending', caption: isApprover ? 'Not yet submitted, still on time' : 'Open and still on time',
      icon: <IconClockHour4 size={22} />, color: colors.accent, tint: colors.blueBg },
    { value: d.submitted, label: 'Submitted', caption: isApprover ? 'Turned in by assignees' : 'Turned in by you',
      icon: <IconCircleCheckFilled size={22} />, color: '#16A34A', tint: colors.greenBg },
    { value: d.missing, label: 'Missing', caption: 'Past deadline, not submitted',
      icon: <IconAlertCircleFilled size={22} />, color: colors.red, tint: colors.redBg, alert: d.missing > 0 },
  ];

  return (
    <Stack gap="md">
      <PageBanner title={greeting(user)}
        subtitle={`${WEEKDAYS[now.getDay()]}, ${MONTHS_LONG[now.getMonth()]} ${now.getDate()} — ${summary(d, isApprover)}`} />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {kpis.map((k) => (
          <UnstyledButton key={k.label} onClick={() => navigate(kpiRoute)}>
            <Paper p="md" radius="lg" withBorder>
              <Group wrap="nowrap" gap={14}>
                <ThemeIcon size={44} radius={12} style={{ background: k.tint, color: k.color }}>{k.icon}</ThemeIcon>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={8} align="baseline" wrap="nowrap">
                    <Text fz={26} fw={800} lh={1.1} c={k.alert ? k.color : undefined}>{k.value}</Text>
                    <Text fw={600} size="sm" truncate>{k.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" truncate>{k.caption}</Text>
                </Box>
                <IconChevronRight size={20} color={colors.textLight} />
              </Group>
            </Paper>
          </UnstyledButton>
        ))}
      </SimpleGrid>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 'auto' }}>
          <Stack gap="md">{sections}</Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 'content' }} w={{ lg: 320 }}>
          <Paper p="md" radius="lg" withBorder>
            <AppCalendar
              card={false}
              month={month}
              onMonthChange={setMonth}
              onDaySelect={(day) => openCalendar(day)}
              eventDays={new Set(eventsByDay.keys())}
              deadlineDays={new Set(d.deadline_dates)}
              depedDays={new Set(depedDays.keys())}
              tooltipFor={(day) => {
                const key = isoDate(day);
                const parts = [
                  ...(depedDays.get(key) ?? []).map((e) => `DepEd Memo · ${e.category}\n${e.title}\n${depedRangeLabel(e)}`),
                  ...(eventsByDay.get(key) ?? []).map((e) => [e.title,
                    e.target_date?.trim() && `When: ${e.target_date.trim()}`,
                    e.venue?.trim() && `Where: ${e.venue.trim()}`].filter(Boolean).join('\n')),
                ];
                return parts.join('\n\n') || null;
              }}
              actions={[{
                icon: <IconArrowsMaximize size={16} />, label: 'Open full calendar',
                onClick: () => openCalendar(new Date(month.getFullYear(), month.getMonth(), 1), false),
              }]}
            />
            <Divider my={14} />
            <Text fw={700} size="sm" mb={10}>Upcoming events</Text>
            {upcoming.length === 0 ? <Text size="xs" c="dimmed">No upcoming events</Text> : upcoming.map(({ day, e }) => (
              <UnstyledButton key={e.id} onClick={() => navigate(`/events?open=${e.id}`)} py={5} w="100%">
                <Group gap={10} wrap="nowrap">
                  <DateTile date={day} compact />
                  <Box style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>{e.title || 'Event'}</Text>
                    {e.venue?.trim() && <Text size="xs" c="dimmed" truncate>{e.venue}</Text>}
                  </Box>
                </Group>
              </UnstyledButton>
            ))}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

function SectionCard({ icon, title, count, actionLabel, onAction, children, empty, footer }: {
  icon: ReactNode; title: string; count: number; actionLabel: string; onAction: () => void;
  children: ReactNode; empty?: ReactNode; footer?: string;
}) {
  return (
    <Paper radius="lg" withBorder>
      <Group px={18} pt={14} pb={12} pr={10} wrap="nowrap">
        <ThemeIcon size={32} radius={9} style={{ background: '#EEF2FA', color: colors.dark }}>{icon}</ThemeIcon>
        <Group gap={8} style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
          <Text fw={700} truncate>{title}</Text>
          {count > 0 && <Badge radius="xl" color="#EEF2FA" c="dimmed" fw={700}>{count}</Badge>}
        </Group>
        <Button variant="subtle" size="compact-sm" rightSection={<IconArrowRight size={16} />} onClick={onAction}>
          {actionLabel}
        </Button>
      </Group>
      <Divider />
      {empty || <Stack gap={0}>{children}</Stack>}
      {footer && <Text size="xs" c="dimmed" px={18} pt={4} pb={14}>{footer}</Text>}
    </Paper>
  );
}

function Row({ leading, title, meta, trailing, onClick }: {
  leading: ReactNode; title: string; meta: string; trailing: ReactNode; onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick} px={18} py={12} className="tn-row"
      style={{ borderBottom: '1px solid #F0F2F6' }}>
      <Group wrap="nowrap" gap={14}>
        {leading}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} truncate>{title}</Text>
          {meta && <Text size="xs" c="dimmed" truncate mt={2}>{meta}</Text>}
        </Box>
        {trailing}
      </Group>
    </UnstyledButton>
  );
}

function Empty({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <Group px={18} py={20} gap={10} wrap="nowrap" c={colors.textLight}>
      {icon}
      <Text size="sm" c="dimmed">{message}</Text>
    </Group>
  );
}

function Dot({ color }: { color: string }) {
  return <Box w={10} h={10} style={{ borderRadius: '50%', background: color, boxShadow: `0 0 0 3px ${color}40`, flexShrink: 0 }} />;
}

/** Month/day tile for an event date ("OCT / 2"); a calendar icon if unknown. */
function DateTile({ date, compact }: { date: Date | null; compact?: boolean }) {
  const size = compact ? 38 : 44;
  return (
    <Center w={size} h={size} style={{ background: '#EEF2FA', borderRadius: 10, flexShrink: 0, flexDirection: 'column' }}>
      {date ? (
        <>
          <Text fz={compact ? 9 : 10} fw={700} c={colors.accent} lh={1.1}>{MONTHS_SHORT[date.getMonth()].toUpperCase()}</Text>
          <Text fz={compact ? 14 : 16} fw={800} lh={1.15}>{date.getDate()}</Text>
        </>
      ) : <IconCalendarEvent size={18} color={colors.textMuted} />}
    </Center>
  );
}
