import { useState, type ReactNode } from 'react';
import { Badge, Group, Paper, Stack, Tabs } from '@mantine/core';
import { IconAward, IconCalendarMonth, IconChartBar, IconClipboardList, IconClock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, CURRENT_YEAR, qk, useSession, type SchoolYearFilter } from '@tasknet/shared';
import { SchoolYearPicker } from '../../components/SchoolYearPicker';
import { PageBanner } from '../../components/ui';
import { AnalyticsTab, BadgesTab, EventsTab, SpecialTasksTab, TimingPointsTab } from './tabs';

export function AppraisalPage() {
  const { can } = useSession();
  const [filter, setFilter] = useState<SchoolYearFilter>(CURRENT_YEAR);
  const [tab, setTab] = useState<string | null>('timing');

  const submissions = useQuery({ queryKey: qk.appraisal('submissions', filter), queryFn: () => api.appraisal.reportSubmissions(filter) });
  const tasks = useQuery({ queryKey: qk.appraisal('special-tasks', filter), queryFn: () => api.appraisal.specialTasks(filter) });
  const events = useQuery({ queryKey: qk.appraisal('events', filter), queryFn: () => api.appraisal.events(filter) });

  const pendingTasks = (tasks.data ?? []).filter((t) => t.status === 'pending').length;
  const pendingEvents = (events.data ?? []).filter((e) => e.status === 'pending' || e.status === 'upcoming').length;
  // Without school-wide access people see their own / their grade level's records and no Analytics.
  const showAnalytics = can('view_all_appraisals');

  const label = (text: string, count = 0): ReactNode => (count > 0
    ? <Group gap={6} wrap="nowrap">{text}<Badge size="xs" color="red" circle>{count}</Badge></Group> : text);

  return (
    <Stack gap="md">
      <PageBanner title="Performance Appraisal"
        subtitle="Evaluate special tasks and events · Track faculty performance · View annual analytics" />
      <Tabs value={tab} onChange={setTab} variant="pills" color="ink.8" keepMounted={false}>
        <Group justify="space-between" mb="md" gap="sm">
          <Paper p={4} radius="md">
            <Tabs.List>
              <Tabs.Tab value="timing" leftSection={<IconClock size={15} />}>Timing Points</Tabs.Tab>
              <Tabs.Tab value="special" leftSection={<IconClipboardList size={15} />}>{label('Special Tasks', pendingTasks)}</Tabs.Tab>
              <Tabs.Tab value="events" leftSection={<IconCalendarMonth size={15} />}>{label('Events', pendingEvents)}</Tabs.Tab>
              <Tabs.Tab value="badges" leftSection={<IconAward size={15} />}>Badges</Tabs.Tab>
              {showAnalytics && <Tabs.Tab value="analytics" leftSection={<IconChartBar size={15} />}>Analytics</Tabs.Tab>}
            </Tabs.List>
          </Paper>
          <SchoolYearPicker value={filter} onChange={setFilter} includeTerms />
        </Group>
        <Tabs.Panel value="timing"><TimingPointsTab query={submissions} /></Tabs.Panel>
        <Tabs.Panel value="special"><SpecialTasksTab query={tasks} /></Tabs.Panel>
        <Tabs.Panel value="events"><EventsTab query={events} /></Tabs.Panel>
        <Tabs.Panel value="badges">
          {/* Principal/admin aren't appraised themselves; supervisors also rank staff. */}
          <BadgesTab filter={filter} showOwn={can('receive_tasks')} showLeaderboard={can('evaluate_appraisal')} />
        </Tabs.Panel>
        {showAnalytics && <Tabs.Panel value="analytics"><AnalyticsTab tasks={tasks.data ?? []} events={events.data ?? []} /></Tabs.Panel>}
      </Tabs>
    </Stack>
  );
}

