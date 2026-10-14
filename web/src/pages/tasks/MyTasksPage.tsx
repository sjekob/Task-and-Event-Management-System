import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Box, Button, Center, Chip, Group, Loader, Paper, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconCalendar, IconCircleCheck, IconClipboardList, IconSearch } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  api, CURRENT_YEAR, formatIsoDate, isTaskOverdue, isTaskSubmitted, qk, type SchoolYearFilter, type Task,
} from '@tasknet/shared';
import { SchoolYearPicker } from '../../components/SchoolYearPicker';
import { EmptyState, ErrorState, PageBanner, PageLoader, StatusBadge } from '../../components/ui';
import { colors } from '../../theme';

const PAGE = 30;

export function MyTasksPage({ category }: { category: 'common' | 'special' }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'submitted'>('all');
  // Current school year by default; past years hold archived work.
  const [filter, setFilter] = useState<SchoolYearFilter>(CURRENT_YEAR);

  const pages = useInfiniteQuery({
    queryKey: qk.tasks({ assigned: true, category, filter }),
    queryFn: ({ pageParam }) => api.tasks.page({ assigned: true, category, filter, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.offset + last.items.length : undefined),
  });

  const all = pages.data?.pages.flatMap((p) => p.items) ?? [];
  const q = search.trim().toLowerCase();
  const filtered = all.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (status === 'pending' && isTaskSubmitted(t)) return false;
    if (status === 'submitted' && !isTaskSubmitted(t)) return false;
    return true;
  });
  const base = category === 'special' ? '/my-special-tasks' : '/my-tasks';

  return (
    <Stack gap="md">
      <PageBanner title={category === 'special' ? 'My Special Tasks' : 'My Tasks'}
        subtitle={category === 'special'
          ? 'Track special tasks assigned to you and submit reports on time.'
          : 'Track your assigned tasks and submit reports on time.'} />

      <TextInput size="md" placeholder="Search tasks..." leftSection={<IconSearch size={16} />}
        value={search} onChange={(e) => setSearch(e.currentTarget.value)} aria-label="Search tasks" />

      <Group gap={8}>
        <Chip.Group value={status} onChange={(v) => setStatus(v as typeof status)}>
          <Group gap={8}>
            <Chip value="all" color="ink.8">All</Chip>
            <Chip value="pending" color="ink.8">Pending</Chip>
            <Chip value="submitted" color="ink.8">Submitted</Chip>
          </Group>
        </Chip.Group>
        <SchoolYearPicker value={filter} onChange={setFilter} />
      </Group>

      {pages.isPending ? <PageLoader />
        : pages.isError ? <ErrorState error={pages.error} onRetry={() => pages.refetch()} />
          : filtered.length === 0 ? (
            <EmptyState icon={<IconClipboardList size={44} color={colors.textLight} />}
              title={all.length === 0 ? 'No tasks assigned yet.' : 'No tasks match your filter.'} />
          ) : (
            <Stack gap={10}>
              {filtered.map((t) => <MyTaskCard key={t.id} task={t} onOpen={() => navigate(`${base}/${t.id}`)} />)}
            </Stack>
          )}

      {pages.hasNextPage && !q && (
        <Center>
          {pages.isFetchingNextPage ? <Loader size="sm" />
            : <Button variant="default" onClick={() => void pages.fetchNextPage()}>Load more</Button>}
        </Center>
      )}
    </Stack>
  );
}

function MyTaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const overdue = isTaskOverdue(task);
  const submitted = isTaskSubmitted(task);
  const instructions = (task.instructions ?? '').replace(/\n/g, ' ');
  return (
    <Paper p="md" radius="lg" withBorder role="link" tabIndex={0} style={{
      cursor: 'pointer', borderColor: overdue ? 'rgba(239,68,68,0.35)' : undefined, borderWidth: overdue ? 1.5 : undefined,
    }} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <Group wrap="nowrap" align="flex-start" gap={14}>
        <ThemeIcon size={42} radius={10} style={{
          background: submitted ? colors.greenBg : colors.blueBg, color: submitted ? colors.green : colors.accent,
        }}>
          {submitted ? <IconCircleCheck size={22} /> : <IconClipboardList size={22} />}
        </ThemeIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600}>{task.title}</Text>
          {task.subject && <Text size="xs" fw={500} c={colors.accent} mt={4}>{task.subject}</Text>}
          {task.end_date && (
            <Group gap={4} mt={3}>
              <IconCalendar size={12} color={overdue ? colors.red : colors.textLight} />
              <Text size="xs" fw={500} c={overdue ? 'red' : 'dimmed'}>Due {formatIsoDate(task.end_date)}</Text>
              {overdue && <Badge size="xs" radius={4} color="red" variant="light">Overdue</Badge>}
            </Group>
          )}
          {instructions && <Text size="sm" c="dimmed" mt={4} lineClamp={1}>{instructions}</Text>}
        </Box>
        <StatusBadge status={submitted ? 'submitted' : 'pending'} />
      </Group>
    </Paper>
  );
}
