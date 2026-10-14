import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionIcon, Affix, Badge, Box, Button, Grid, Group, Menu, Paper, SegmentedControl, Stack, Text, Title, Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowsMaximize, IconDots, IconFileTypePdf, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, CURRENT_YEAR, depedByDay, depedRangeLabel, isoDate, parseEventDate, parseIsoDate, qk, useSession, useUser,
  type EventRecord, type SchoolYearFilter,
} from '@tasknet/shared';
import { AppCalendar } from '../../components/AppCalendar';
import { SchoolYearPicker } from '../../components/SchoolYearPicker';
import { notifyError, notifySuccess, PageLoader } from '../../components/ui';
import { printProposal } from '../../lib/printProposal';
import { EventCalendarView } from './EventCalendarView';
import { colors } from '../../theme';

const STATUS_PILL: Record<string, [string, string]> = {
  approved: ['Approved', '#48BB78'],
  pending_approval: ['Pending', '#ED8936'],
  disabled: ['Disabled', '#E53E3E'],
  draft: ['Draft', '#718096'],
};

export function EventStatusPill({ status }: { status: string }) {
  const [label, color] = STATUS_PILL[status] ?? ['Pending', '#ED8936'];
  return <Badge radius={6} tt="none" fw={600} style={{ background: `${color}1F`, color }}>{label}</Badge>;
}

export function useEventActions() {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.allEvents }),
    queryClient.invalidateQueries({ queryKey: qk.dashboard }),
  ]);
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) notifySuccess(done);
      await refresh();
    } catch (e) {
      notifyError(e);
    }
  };
  return {
    async approve(e: EventRecord) {
      try {
        const res = await api.events.approve(e.id);
        const created = res.special_tasks_created ?? 0;
        const skipped = (res.special_tasks_skipped ?? []).join(', ');
        notifySuccess([
          'Event approved.',
          created > 0 ? `${created} TWG special task${created === 1 ? '' : 's'} assigned.` : '',
          skipped ? `Not assigned (no matching TaskNet user): ${skipped}.` : '',
        ].filter(Boolean).join(' '));
        await refresh();
      } catch (err) {
        notifyError(err);
      }
    },
    disable: (e: EventRecord) => modals.openConfirmModal({
      title: 'Confirm Disable',
      children: <Text size="sm">Disable &quot;{e.title}&quot;?</Text>,
      labels: { confirm: 'Disable', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => void run(() => api.events.disable(e.id), 'Event disabled'),
    }),
    enable: (e: EventRecord) => run(() => api.events.enable(e.id), 'Event re-enabled'),
    deleteDraft: (e: EventRecord) => modals.openConfirmModal({
      title: 'Delete Draft',
      children: <Text size="sm">Delete &quot;{e.title.trim() || 'Untitled Draft'}&quot;? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => void run(() => api.events.remove(e.id), 'Draft deleted'),
    }),
    async print(e: EventRecord) {
      if (!(await printProposal(e))) notifyError(new Error('Allow pop-ups for this site to print the proposal.'));
    },
  };
}

export function EventsPage() {
  const user = useUser();
  const { can } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [filter, setFilter] = useState<SchoolYearFilter>(CURRENT_YEAR);
  const [month, setMonth] = useState(() => new Date());
  const actions = useEventActions();

  const schoolYear = filter.schoolYear === 'current' ? undefined : filter.schoolYear;
  const events = useQuery({ queryKey: qk.events(schoolYear), queryFn: () => api.events.list(schoolYear) });
  const deped = useQuery({ queryKey: qk.deped(), queryFn: () => api.depedCalendar.list() });

  // Dashboard links: /events?open=12 opens that proposal.
  const openId = Number(params.get('open'));
  useEffect(() => {
    if (openId) navigate(`/events/${openId}`, { replace: true });
  }, [openId, navigate]);

  const canManage = can('manage_events');
  const canApprove = can('approve_events');
  const isPrincipal = canApprove && !canManage; // oversight only: approves, doesn't propose

  const all = events.data ?? [];
  const active = all.filter((e) => e.status !== 'disabled' && e.status !== 'draft');
  const shown = tab === 'mine' ? active.filter((e) => e.created_by === user.id) : active;
  const disabled = all.filter((e) => e.status === 'disabled');
  const drafts = all.filter((e) => e.status === 'draft' && e.created_by === user.id);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRecord[]>();
    for (const e of active) {
      const d = parseEventDate(e.target_date);
      if (d) map.set(isoDate(d), [...(map.get(isoDate(d)) ?? []), e]);
    }
    return map;
  }, [active]);
  const depedDays = useMemo(() => depedByDay(deped.data ?? []), [deped.data]);

  // Expanded calendar: /events?view=calendar[&date=YYYY-MM-DD | &month=YYYY-MM-DD]
  const expanded = params.get('view') === 'calendar';
  const day = parseIsoDate(params.get('date')) ?? parseIsoDate(params.get('month'));
  const expand = (d?: Date) => setParams(d ? { view: 'calendar', date: isoDate(d) } : { view: 'calendar' });

  if (events.isPending) return <PageLoader />;

  const open = (e: EventRecord) => navigate(`/events/${e.id}`);

  const section = (label: string, items: EventRecord[], render: (e: EventRecord) => ReactNode) => items.length > 0 && (
    <Stack gap={10}>
      <Text size="sm" fw={500} c="#718096">{label}</Text>
      {items.map(render)}
    </Stack>
  );

  const list = (
    <Stack gap="lg">
      <Group gap={8}>
        {!isPrincipal ? (
          <SegmentedControl value={tab} onChange={(v) => setTab(v as 'all' | 'mine')} color="ink.8"
            data={[{ value: 'all', label: 'All Events' }, { value: 'mine', label: 'My Events' }]} />
        ) : <Button color="ink.8" size="sm" radius={10}>All Events</Button>}
        <SchoolYearPicker value={filter} onChange={setFilter} />
      </Group>
      {all.length === 0 && <Paper p={40} radius="lg"><Text ta="center" size="sm" c="#718096">No events yet.</Text></Paper>}
      {section('Upcoming / Approved Events', shown.filter((e) => e.status === 'approved'), (e) => (
        <EventCard key={e.id} event={e} onOpen={() => open(e)} onPrint={() => void actions.print(e)} />
      ))}
      {section('Pending Approval', shown.filter((e) => e.status === 'pending_approval'), (e) => (
        <EventCard key={e.id} event={e} onOpen={() => open(e)} onPrint={() => void actions.print(e)}
          menu={isPrincipal && canApprove ? (
            <>
              <Menu.Item c="#48BB78" onClick={() => void actions.approve(e)}>Approve</Menu.Item>
              <Menu.Item color="red" onClick={() => actions.disable(e)}>Disable</Menu.Item>
            </>
          ) : canManage ? <Menu.Item onClick={() => navigate(`/events/${e.id}/edit`)}>Edit</Menu.Item> : null} />
      ))}
      {tab === 'all' && section('Disabled Events', disabled, (e) => (
        <EventCard key={e.id} event={e} disabled onOpen={() => open(e)} onPrint={() => void actions.print(e)}
          right={canManage && (
            <Button variant="subtle" color="green" size="compact-sm"
              onClick={(ev) => { ev.stopPropagation(); void actions.enable(e); }}>Enable</Button>
          )} />
      ))}
      {/* Drafts are private to their creator. */}
      {section('Drafts', drafts, (e) => (
        <Paper key={e.id} radius="lg" px={18} py={14} withBorder>
          <Group wrap="nowrap" align="flex-start">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Group gap={8}><Text size="sm" fw={600}>{e.title.trim() || 'Untitled Draft'}</Text><EventStatusPill status="draft" /></Group>
              <Text size="xs" c="#718096" mt={3}>Continue where you left off.</Text>
            </Box>
            <Button variant="subtle" color="ink.8" size="compact-sm" onClick={() => navigate(`/events/${e.id}/edit`)}>Continue Editing</Button>
            <Tooltip label="Delete draft">
              <ActionIcon variant="subtle" color="red" onClick={() => actions.deleteDraft(e)} aria-label="Delete draft"><IconTrash size={18} /></ActionIcon>
            </Tooltip>
          </Group>
        </Paper>
      ))}
    </Stack>
  );

  const sideCalendar = (
    <AppCalendar month={month} onMonthChange={setMonth} onDaySelect={(d) => expand(d)}
      eventDays={new Set(eventsByDay.keys())} depedDays={new Set(depedDays.keys())}
      tooltipFor={(d) => [
        ...(depedDays.get(isoDate(d)) ?? []).map((x) => `DepEd Memo · ${x.category}\n${x.title}\n${depedRangeLabel(x)}`),
        ...(eventsByDay.get(isoDate(d)) ?? []).map((e) => [e.title, e.target_date?.trim() && `When: ${e.target_date.trim()}`,
          e.venue?.trim() && `Where: ${e.venue.trim()}`].filter(Boolean).join('\n')),
      ].join('\n\n') || null}
      actions={[{ icon: <IconArrowsMaximize size={16} />, label: 'Open full calendar', onClick: () => expand() }]} />
  );

  return (
    <Stack gap="lg">
      <Paper radius="lg" p={28} h={148} style={{
        background: '#1E2126 repeating-linear-gradient(60deg, rgba(255,255,255,0.03) 0 20px, transparent 20px 40px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <Title order={1} c="white" fz={32} fw={700}>Event Calendar</Title>
        <Text c="rgba(255,255,255,0.6)" size="sm" mt={6}>Great things are on the horizon — stay active, stay organized!</Text>
      </Paper>

      {expanded ? (
        <EventCalendarView key={params.toString()} events={active} deped={deped.data ?? []}
          initialDay={day} selectInitialDay={!!params.get('date')}
          onOpenEvent={open} onCollapse={() => setParams({})} />
      ) : (
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, md: 'auto' }}>{list}</Grid.Col>
          <Grid.Col span={{ base: 12, md: 'content' }} w={{ md: 300 }}>{sideCalendar}</Grid.Col>
        </Grid>
      )}

      {canManage && (
        <Affix position={{ bottom: 24, right: 24 }}>
          <Button color="#1E2126" radius="xl" size="md" leftSection={<IconPlus size={20} />} onClick={() => navigate('/events/new')}
            style={{ boxShadow: '0 6px 16px rgba(0,0,0,0.2)' }}>
            Add Event
          </Button>
        </Affix>
      )}
    </Stack>
  );
}

function EventCard({ event: e, onOpen, onPrint, menu, right, disabled }: {
  event: EventRecord; onOpen: () => void; onPrint: () => void; menu?: ReactNode; right?: ReactNode; disabled?: boolean;
}) {
  return (
    <Paper radius="lg" px={18} py={14} role="link" tabIndex={0} onClick={onOpen}
      onKeyDown={(k) => { if (k.key === 'Enter') onOpen(); }}
      style={{ cursor: 'pointer', border: disabled ? '1px solid rgba(229,62,62,0.3)' : undefined }}>
      <Group wrap="nowrap" align="flex-start" gap={4}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={8} wrap="nowrap">
            <Text size="sm" fw={600} truncate td={disabled ? 'line-through' : undefined} c={disabled ? colors.textLight : undefined}>{e.title}</Text>
            <EventStatusPill status={e.status} />
          </Group>
          <Text size="xs" c={disabled ? '#B0B7C3' : '#718096'} mt={3} lineClamp={2}>{e.rationale || e.title}</Text>
          {!disabled && e.creator_name && <Text size="11px" c="#B0B7C3" mt={4}>By {e.creator_name}</Text>}
        </Box>
        <Tooltip label="Print / Save as PDF">
          <ActionIcon variant="subtle" color="gray" aria-label="Print / Save as PDF"
            onClick={(ev) => { ev.stopPropagation(); onPrint(); }}>
            <IconFileTypePdf size={18} />
          </ActionIcon>
        </Tooltip>
        {right}
        {menu && (
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" onClick={(ev) => ev.stopPropagation()} aria-label="Event actions"><IconDots size={20} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown onClick={(ev) => ev.stopPropagation()}>{menu}</Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Paper>
  );
}
