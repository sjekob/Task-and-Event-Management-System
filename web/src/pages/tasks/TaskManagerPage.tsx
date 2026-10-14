import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon, Badge, Box, Button, Group, Menu, Paper, Progress, SegmentedControl, Stack, Text, TextInput,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconBan, IconCalendarDue, IconClipboardList, IconDots, IconFlag, IconPencil, IconSearch } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, CURRENT_YEAR, formatDate, qk, taskDeadline, useSession, type SchoolYearFilter, type Task,
} from '@tasknet/shared';
import { SchoolYearPicker } from '../../components/SchoolYearPicker';
import { DepedTaskModal } from '../../components/deped';
import { EmptyState, ErrorState, notifyError, notifySuccess, PageBanner, PageLoader } from '../../components/ui';
import { colors } from '../../theme';

const BANNERS: Record<string, [string, string]> = {
  admin: ['Task Manager', 'Create and manage tasks. Assign to your team.'],
  principal: ['Task Manager', 'Create and manage tasks. Assign to your team.'],
  coordinator: ['Task Manager', 'Manage tasks assigned to you. Reassign to deans or teachers.'],
  dean: ['Task Manager', 'Manage tasks assigned to you. Assign to your grade-level teachers.'],
};

function dueText(t: Task) {
  const dl = taskDeadline(t);
  if (!dl) return 'No deadline';
  const time = (t.due_time ?? '').trim();
  return time && time.toUpperCase() !== '11:59 PM' ? `Due ${formatDate(dl)}, ${time}` : `Due ${formatDate(dl)}`;
}

export function TaskManagerPage({ category }: { category: 'common' | 'special' }) {
  const { user, can } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // Principal-only: 'mine' = tasks they created, 'all' = every task.
  const [scope, setScope] = useState('mine');
  const [filter, setFilter] = useState<SchoolYearFilter>(CURRENT_YEAR);
  const [depedOpen, setDepedOpen] = useState(false);

  const tasks = useQuery({
    queryKey: qk.tasks({ scope, filter }),
    queryFn: () => api.tasks.list({ scope, filter }),
  });

  const base = category === 'special' ? '/special-tasks' : '/tasks';
  const [title, subtitle] = category === 'special'
    ? ['Special Tasks', 'Create and manage special tasks. Assign to your team.']
    : BANNERS[user?.role ?? ''] ?? ['Tasks', 'Tasks assigned to you. Submit reports on time.'];

  const setStatus = async (t: Task, status: 'active' | 'disabled') => {
    try {
      await api.tasks.update(t.id, { status });
      notifySuccess(status === 'active' ? 'Task enabled' : 'Task disabled');
      await queryClient.invalidateQueries({ queryKey: qk.allTasks });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
    } catch (e) {
      notifyError(e);
    }
  };

  const confirmDisable = (t: Task) => modals.openConfirmModal({
    title: 'Confirm Disable',
    children: <Text size="sm">Are you sure you want to disable the task?</Text>,
    labels: { confirm: 'Yes', cancel: 'No' },
    onConfirm: () => void setStatus(t, 'disabled'),
  });

  const q = search.trim().toLowerCase();
  const mine = (tasks.data ?? []).filter((t) => t.task_category === category && (!q || t.title.toLowerCase().includes(q)));
  const active = mine.filter((t) => t.status === 'active');
  const disabled = mine.filter((t) => t.status !== 'active');

  return (
    <Stack gap="md">
      <PageBanner title={title} subtitle={subtitle} />

      <Group gap="sm">
        {can('view_all_tasks') && (
          <SegmentedControl value={scope} onChange={setScope} color="ink.8"
            data={[{ value: 'mine', label: 'My Created Tasks' }, { value: 'all', label: 'All Tasks' }]} />
        )}
        <SchoolYearPicker value={filter} onChange={setFilter} />
        {/* Principal/admin: system-wide compliance tasks from DepEd dates. */}
        {category === 'common' && can('manage_school_years') && (
          <Button variant="outline" bg="white" leftSection={<IconCalendarDue size={18} />} onClick={() => setDepedOpen(true)}>
            Generate from DepEd Calendar
          </Button>
        )}
      </Group>

      <TextInput size="md" radius="md" placeholder="Search tasks by title..." leftSection={<IconSearch size={18} />}
        value={search} onChange={(e) => setSearch(e.currentTarget.value)} aria-label="Search tasks" />

      {tasks.isPending ? <PageLoader />
        : tasks.isError ? <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
          : !active.length && !disabled.length ? (
            <EmptyState icon={<IconClipboardList size={44} color={colors.textLight} />}
              title={q ? `No tasks match "${search}"` : 'No tasks in this school year'}
              message={!q && filter.schoolYear === 'current'
                ? 'Tasks from earlier school years are archived. Choose a year in the selector above to see them.'
                : undefined} />
          ) : (
            <>
              {active.length > 0 && (
                <TaskGroup label={category === 'special' ? 'Active special tasks' : 'Active tasks'} count={active.length}>
                  {active.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={() => navigate(`${base}/${t.id}`)}
                      menu={t.can_edit && (
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" onClick={(e) => e.stopPropagation()} aria-label="Task actions">
                              <IconDots size={20} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                            <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => navigate(`${base}/${t.id}/edit`)}>Edit task</Menu.Item>
                            <Menu.Item color="red" leftSection={<IconBan size={16} />} onClick={() => confirmDisable(t)}>Disable task</Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      )} />
                  ))}
                </TaskGroup>
              )}
              {disabled.length > 0 && (
                <TaskGroup label="Disabled" count={disabled.length}>
                  {disabled.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={() => navigate(`${base}/${t.id}`)}
                      menu={t.can_edit && (
                        <Button variant="subtle" color="green" size="compact-sm"
                          onClick={(e) => { e.stopPropagation(); void setStatus(t, 'active'); }}>Enable</Button>
                      )} />
                  ))}
                </TaskGroup>
              )}
            </>
          )}

      <DepedTaskModal opened={depedOpen} onClose={() => setDepedOpen(false)} onDone={(n) => {
        setDepedOpen(false);
        notifySuccess(`Mandatory task assigned to ${n} faculty account${n === 1 ? '' : 's'}.`);
        void queryClient.invalidateQueries({ queryKey: qk.allTasks });
      }} />
    </Stack>
  );
}

function TaskGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <Stack gap={10}>
      <Group gap={8}>
        <Text fw={700} size="sm">{label}</Text>
        <Badge variant="outline" color="gray" bg="white" radius="xl">{count}</Badge>
      </Group>
      {children}
    </Stack>
  );
}

function Chip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return <Badge radius="xl" tt="none" fw={600} size="sm" style={{ background: bg, color: fg }}>{label}</Badge>;
}

function TaskCard({ task, onOpen, menu }: { task: Task; onOpen: () => void; menu?: ReactNode }) {
  const isDisabled = task.status !== 'active';
  const total = task.team_total ?? 0;
  const done = task.team_submitted ?? 0;
  const complete = total > 0 && done >= total;
  const dl = taskDeadline(task);
  const overdue = !isDisabled && !complete && !!dl && dl < new Date();
  const dot = isDisabled ? colors.textLight : complete ? colors.green : overdue ? colors.red : colors.accent;
  const instructions = (task.instructions ?? '').replace(/\n/g, ' ').trim();

  return (
    <Paper radius="lg" withBorder bg={isDisabled ? '#F8FAFC' : 'white'}>
      <Box p="md" pr={6} role="link" tabIndex={0} style={{ cursor: 'pointer' }} onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
        <Group wrap="nowrap" gap={16}>
          <Box w={10} h={10} style={{ borderRadius: '50%', background: dot, boxShadow: `0 0 0 3px ${dot}40`, flexShrink: 0 }} />
          <Group style={{ flex: 1, minWidth: 0 }} wrap="wrap" gap={20} justify="space-between">
            <Box style={{ flex: '1 1 260px', minWidth: 0 }}>
              <Text fw={700} truncate c={isDisabled ? 'dimmed' : undefined}>{task.title}</Text>
              <Group gap={8} mt={4}>
                <Group gap={4} wrap="nowrap">
                  <IconFlag size={14} color={overdue ? colors.red : colors.textLight} />
                  <Text size="xs" fw={overdue ? 600 : 500} c={overdue ? 'red' : 'dimmed'}>{dueText(task)}</Text>
                </Group>
                {overdue && <Chip label="Overdue" fg="#B91C1C" bg={colors.redBg} />}
                {complete && !isDisabled && <Chip label="All submitted" fg="#15803D" bg={colors.greenBg} />}
                {isDisabled && <Chip label="Disabled" fg={colors.textMuted} bg="#F1F5F9" />}
              </Group>
              {instructions && instructions.toLowerCase() !== task.title.toLowerCase() && (
                <Text size="sm" c="dimmed" truncate mt={6}>{instructions}</Text>
              )}
            </Box>
            {total === 0 ? <Chip label="Not assigned" fg={colors.textMuted} bg="#F1F5F9" /> : (
              <Box w={{ base: '100%', sm: 150 }}>
                <Text size="xs" fw={600} ta="right" c={complete ? '#16A34A' : 'dimmed'}>{done} of {total} submitted</Text>
                <Progress value={(done / total) * 100} size={6} mt={6} radius="xl" color={complete ? 'green' : 'brand'} bg="#EEF2FA" />
              </Box>
            )}
          </Group>
          <Box w={36} style={{ display: 'flex', justifyContent: 'center' }}>{menu}</Box>
        </Group>
      </Box>
    </Paper>
  );
}
