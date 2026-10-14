// The five Appraisal tabs (ported from appraisal_screen_widgets.dart / appraisal_badges_tab.dart).
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon, Badge, Box, Button, Center, Collapse, CopyButton, Divider, Group, Loader, Modal, Paper, Progress,
  Rating, Select, SimpleGrid, Stack, Table, Text, Textarea, ThemeIcon, Tooltip, UnstyledButton,
} from '@mantine/core';
import { BarChart } from '@mantine/charts';
import {
  IconAlertCircle, IconArrowRight, IconAward, IconCalendarMonth, IconCheck, IconChecklist, IconChevronDown,
  IconChevronRight, IconChevronUp, IconCircleCheck, IconClipboardList, IconClock, IconCopy, IconDownload, IconFlame,
  IconInfoCircle, IconLink, IconLock, IconPercentage, IconQrcode, IconRefresh, IconRosetteDiscountCheck,
  IconStar, IconSun, IconTrendingUp, IconTrophy, IconUsers, IconUsersGroup,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  api, APPRAISAL_STATUS, BADGE_TIER_COLORS, estimatedTaskScore, evaluationAverage, eventAppraisalStatus,
  evidencyRate, formatDateTime, formatIsoDate, parseIsoDate, parseTimestamp, qk, rateColor, scoreOutOf100,
  titleCase, type AppraisalBadge, type EventForAppraisal, type LeaderboardEntry, type ReportSubmission,
  type SchoolYearFilter, type SpecialTask,
} from '@tasknet/shared';
import { EmptyState, ErrorState, notifyError, notifySuccess, PageLoader, UserAvatar } from '../../components/ui';
import { colors } from '../../theme';

// ── Shared bits ──────────────────────────────────────────────────────────────

function TabStat({ value, label, sub, icon, iconColor, iconBg, valueColor }: {
  value: ReactNode; label: string; sub?: string; icon: ReactNode; iconColor: string; iconBg: string; valueColor?: string;
}) {
  return (
    <Paper p="md" radius="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text fz={26} fw={800} lh={1.2} c={valueColor}>{value}</Text>
          <Text size="sm" fw={600} truncate>{label}</Text>
          {sub && <Text size="xs" c="dimmed" truncate>{sub}</Text>}
        </div>
        <ThemeIcon size={38} radius="xl" style={{ background: iconBg, color: iconColor }}>{icon}</ThemeIcon>
      </Group>
    </Paper>
  );
}

function AppraisalStatus({ status }: { status: string }) {
  const [label, color] = APPRAISAL_STATUS[status] ?? [titleCase(status.replace(/_/g, ' ')), '#9CA3AF'];
  return (
    <Badge radius="xl" variant="light" tt="none" fw={600} style={{ background: `${color}1F`, color, minWidth: 'max-content' }}>{label}</Badge>
  );
}

function QueryGate<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}

const shortDate = (raw?: string | null) => formatIsoDate(raw);
const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

function Stars({ label, value, onChange }: { label: string; value: number; onChange?: (v: number) => void }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Text size="sm" fw={500}>{label}</Text>
      <Rating value={value} onChange={onChange} readOnly={!onChange} size="md" />
    </Group>
  );
}

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">{label}</Text>
      <Text size="sm" fw={500}>{value}</Text>
    </div>
  );
}

// ── Timing Points ────────────────────────────────────────────────────────────

const TIMING_COLORS: Record<string, string> = { 'On Time': '#16A34A', 'Late within 24 hours': '#EA580C' };
const isOnTime = (s: ReportSubmission) => s.timing_status === 'On Time';

export function TimingPointsTab({ query }: { query: UseQueryResult<ReportSubmission[]> }) {
  return <QueryGate query={query}>{(subs) => <TimingPoints subs={subs} onRefresh={() => query.refetch()} />}</QueryGate>;
}

function TimingPoints({ subs, onRefresh }: { subs: ReportSubmission[]; onRefresh: () => void }) {
  const [mode, setMode] = useState<'all' | 'personnel' | 'task'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const keyOf = (s: ReportSubmission) => (mode === 'task' ? s.task_name : s.personnel_name);
  const filtered = selected && mode !== 'all' ? subs.filter((s) => keyOf(s) === selected) : subs;
  const total = filtered.length;
  const totalPts = filtered.reduce((a, s) => a + (s.timing_points ?? 0), 0);
  const compliance = total ? (filtered.filter(isOnTime).length / total) * 100 : 0;

  const grouped = new Map<string, ReportSubmission[]>();
  for (const s of filtered) grouped.set(keyOf(s), [...(grouped.get(keyOf(s)) ?? []), s]);
  const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  const options = useMemo(() => [...new Set(subs.map((s) => (mode === 'task' ? s.task_name : s.personnel_name)))].sort(),
    [subs, mode]);

  const toggle = (k: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TabStat value={total} label="Total Reports Submitted" sub="Across all tracked tasks"
          icon={<IconChecklist size={20} />} iconColor="#3B82F6" iconBg="#EFF6FF" />
        <TabStat value={`${totalPts} pts`} label="Total Timing Points" sub="Earned from all submissions"
          icon={<IconClock size={20} />} iconColor="#10B981" iconBg="#ECFDF5" />
        <TabStat value={pct(compliance, 1)} valueColor={total ? rateColor(compliance) : undefined}
          label="Compliance Rate" sub="On-time submissions"
          icon={<IconTrendingUp size={20} />} iconColor="#8B5CF6" iconBg="#F5F3FF" />
      </SimpleGrid>

      <Paper radius="lg">
        <Group justify="space-between" p="md" gap="sm">
          <Text fw={700}>Teacher Submissions & Compliance</Text>
          <Group gap="xs">
            <Select size="xs" w={150} allowDeselect={false} value={mode}
              data={[{ value: 'all', label: 'Show All' }, { value: 'personnel', label: 'By Personnel' }, { value: 'task', label: 'By Task' }]}
              onChange={(v) => { setMode((v ?? 'all') as typeof mode); setSelected(null); setOpen(new Set()); }} />
            {mode !== 'all' && (
              <Select size="xs" w={220} searchable clearable data={options} value={selected} onChange={setSelected}
                placeholder={mode === 'task' ? 'All Tasks' : 'All Personnel'} />
            )}
            <Tooltip label="Refresh">
              <ActionIcon variant="subtle" color="gray" onClick={onRefresh} aria-label="Refresh"><IconRefresh size={16} /></ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Divider />
        {groups.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" py="xl">No report submissions yet.</Text>
        ) : groups.map(([key, list]) => {
          const n = list.length;
          const rate = (list.filter(isOnTime).length / n) * 100;
          const avgPts = list.reduce((a, s) => a + (s.timing_points ?? 0), 0) / n;
          const dept = list[0].personnel_department;
          const isOpen = open.has(key);
          return (
            <Box key={key} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <UnstyledButton w="100%" px="md" py="sm" onClick={() => toggle(key)} aria-expanded={isOpen}>
                <Group wrap="nowrap" gap="sm">
                  <UserAvatar name={key} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>{key}</Text>
                    {mode !== 'task' && dept && <Text size="xs" c="dimmed">{dept}</Text>}
                  </div>
                  <Text size="xs" c="dimmed">Subs: {n}</Text>
                  <Badge radius="xl" tt="none" style={{ background: `${rateColor(rate)}1F`, color: rateColor(rate) }}>
                    {pct(rate)} Compliant
                  </Badge>
                  {isOpen ? <IconChevronUp size={18} color={colors.textMuted} /> : <IconChevronDown size={18} color={colors.textMuted} />}
                </Group>
              </UnstyledButton>
              <Collapse expanded={isOpen}>
                <Box px="md" pb="md" pt={4} bg="#FAFBFC">
                  <SimpleGrid cols={{ base: 1, sm: 3 }} mb="sm" mt="xs">
                    <MiniStat label="Total Submissions" value={n} />
                    <MiniStat label="Avg Timing Points" value={`${avgPts.toFixed(1)} / 100`} />
                    <MiniStat label="Compliance Rate" value={pct(rate, 1)} />
                  </SimpleGrid>
                  <Text size="sm" fw={600} mb={6}>Submission History</Text>
                  <Table.ScrollContainer minWidth={760}>
                    <Table fz="sm" verticalSpacing={6}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{mode === 'task' ? 'Personnel' : 'Task name'}</Table.Th><Table.Th>Deadline</Table.Th>
                          <Table.Th>Submitted at</Table.Th><Table.Th>Timing status</Table.Th>
                          <Table.Th ta="center">Points</Table.Th><Table.Th>Rubric scores</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {list.map((s) => {
                          const scored = s.content_quality_score != null || s.format_compliance_score != null || s.completeness_score != null;
                          const c = TIMING_COLORS[s.timing_status] ?? '#EF4444';
                          return (
                            <Table.Tr key={s.id}>
                              <Table.Td fw={500}>{mode === 'task' ? s.personnel_name : s.task_name}</Table.Td>
                              <Table.Td c="dimmed">{formatDateTime(parseTimestamp(s.deadline, false))}</Table.Td>
                              <Table.Td c="dimmed">{formatDateTime(parseTimestamp(s.submitted_at))}</Table.Td>
                              <Table.Td><Text size="sm" fw={600} c={c}>{s.timing_status}</Text></Table.Td>
                              <Table.Td ta="center" fw={700}>{s.timing_points} pts</Table.Td>
                              <Table.Td>
                                {scored ? (
                                  <Text size="xs" c="dimmed" lh={1.4}>
                                    Content: {s.content_quality_score ?? '—'}<br />Format: {s.format_compliance_score ?? '—'}<br />
                                    Completeness: {s.completeness_score ?? '—'}
                                  </Text>
                                ) : <Text size="xs" c="dimmed" fs="italic">Not scored</Text>}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Paper>
    </Stack>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Paper p="sm" radius="md" withBorder shadow="none">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={700}>{value}</Text>
    </Paper>
  );
}

// ── Special Tasks ────────────────────────────────────────────────────────────

const isRated = (t: SpecialTask) => t.status === 'evaluated' || t.status === 'flagged';
const dept = (t: SpecialTask) => t.assignee?.grade_level || '';
const uniqueSorted = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();

export function SpecialTasksTab({ query }: { query: UseQueryResult<SpecialTask[]> }) {
  return <QueryGate query={query}>{(tasks) => <SpecialTasks tasks={tasks} />}</QueryGate>;
}

function SpecialTasks({ tasks }: { tasks: SpecialTask[] }) {
  const [fDept, setFDept] = useState<string | null>(null);
  const [fRole, setFRole] = useState<string | null>(null);
  const [fPerson, setFPerson] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState<SpecialTask | null>(null);
  const [viewing, setViewing] = useState<SpecialTask | null>(null);

  const filtered = tasks.filter((t) => (!fDept || dept(t) === fDept)
    && (!fRole || (t.assignee?.role ?? '').toLowerCase() === fRole.toLowerCase())
    && (!fPerson || t.assignee?.full_name === fPerson));

  const scored = tasks.filter((t) => t.evaluation?.weighted_average != null);
  const avg = scored.length ? scored.reduce((a, t) => a + scoreOutOf100(t), 0) / scored.length : 0;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <TabStat value={tasks.filter((t) => t.status === 'evaluated').length} label="Total Faculty Evaluated"
          icon={<IconCircleCheck size={20} />} iconColor="#22C55E" iconBg="#DCFCE7" />
        <TabStat value={tasks.filter((t) => t.status === 'flagged').length} label="Flagged Personnel"
          icon={<IconAlertCircle size={20} />} iconColor="#EF4444" iconBg="#FEE2E2" />
        <TabStat value={uniqueSorted(tasks.map(dept)).length} label="Departments Monitored"
          icon={<IconUsers size={20} />} iconColor="#8B5CF6" iconBg="#EDE9FE" />
        <TabStat value={avg > 0 ? avg.toFixed(0) : '—'} label="School Avg Score / 100"
          icon={<IconTrophy size={20} />} iconColor="#6B7280" iconBg="#F3F4F6" />
      </SimpleGrid>

      <Paper p="md" radius="lg">
        <Text fw={700} mb="sm">Appraisal Coverage — All Evaluation Types</Text>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          <Coverage icon={<IconClipboardList size={18} />} color="#3B82F6" bg="#EFF6FF" title="Special Task Timing" sub="Task completion and timeline" />
          <Coverage icon={<IconCalendarMonth size={18} />} color="#10B981" bg="#ECFDF5" title="Event Evaluation" sub="Multi-stakeholder" />
          <Coverage icon={<IconChecklist size={18} />} color="#8B5CF6" bg="#EDE9FE" title="Special Task Ratings" sub="Weighted rubric" />
          <Coverage icon={<IconAlertCircle size={18} />} color="#EF4444" bg="#FEE2E2" title="Escalation Threshold" sub="Below 3 stars auto-flags" />
        </SimpleGrid>
      </Paper>

      <Paper radius="lg">
        <Group justify="space-between" p="md" gap="sm">
          <Text fw={700}>Special Task Submissions</Text>
          <Group gap="xs">
            <Select size="xs" w={150} clearable placeholder="All departments" data={uniqueSorted(tasks.map(dept))} value={fDept} onChange={setFDept} />
            <Select size="xs" w={130} clearable placeholder="All roles" value={fRole} onChange={setFRole}
              data={uniqueSorted(tasks.map((t) => t.assignee?.role ?? '')).map((r) => ({ value: r, label: titleCase(r.replace(/_/g, ' ')) }))} />
            <Select size="xs" w={180} clearable searchable placeholder="All personnel" value={fPerson} onChange={setFPerson}
              data={uniqueSorted(tasks.map((t) => t.assignee?.full_name ?? ''))} />
          </Group>
        </Group>
        <Divider />
        {filtered.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" py="xl">No special tasks match.</Text>
        ) : (
          <Table.ScrollContainer minWidth={1040}>
            <Table striped highlightOnHover fz="sm" verticalSpacing="sm" horizontalSpacing="sm" style={{ whiteSpace: 'nowrap' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th><Table.Th>Personnel</Table.Th><Table.Th>Department</Table.Th><Table.Th>Task</Table.Th>
                  <Table.Th>Assigned by</Table.Th><Table.Th>Due date</Table.Th><Table.Th>Submitted</Table.Th>
                  <Table.Th ta="center">Score</Table.Th><Table.Th>Status</Table.Th><Table.Th ta="right">Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((t) => {
                  const rated = isRated(t);
                  return (
                    <Table.Tr key={t.id}>
                      <Table.Td c="dimmed">ST{String(t.id).padStart(3, '0')}</Table.Td>
                      <Table.Td>
                        <Group gap={8} wrap="nowrap">
                          <UserAvatar name={t.assignee?.full_name ?? '?'} size={26} />
                          <Text size="sm" fw={600} truncate maw={170}>{t.assignee?.full_name ?? '—'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td c="dimmed">{dept(t) || '—'}</Table.Td>
                      <Table.Td><Text size="sm" lineClamp={1} maw={260}>{t.title}</Text></Table.Td>
                      <Table.Td c="dimmed">{t.assigner?.full_name ?? '—'}</Table.Td>
                      <Table.Td c="dimmed">{shortDate(t.due_date)}</Table.Td>
                      <Table.Td c={rated ? 'green.7' : 'dimmed'}>{rated ? shortDate(t.created_at) : '—'}</Table.Td>
                      <Table.Td ta="center">
                        {rated ? <ScoreBadge score={scoreOutOf100(t)} flagged={t.status === 'flagged'} /> : <Text c="dimmed">—</Text>}
                      </Table.Td>
                      <Table.Td><AppraisalStatus status={t.status} /></Table.Td>
                      <Table.Td ta="right">
                        {rated
                          ? <Button size="xs" variant="default" onClick={() => setViewing(t)}>View</Button>
                          : <Button size="xs" color="ink.8" onClick={() => setEvaluating(t)}>Evaluate</Button>}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Paper p="md" radius="lg" withBorder style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <Group justify="space-between" gap="md">
          <div style={{ flex: 1, minWidth: 240 }}>
            <Text fw={700} c="#1D4ED8">Annual Faculty Performance Summary</Text>
            <Text size="sm" c="#3B82F6">Aggregated from the special task appraisals shown above, ready for the DepEd Annual Faculty Performance Evaluation.</Text>
          </div>
          <Button color="ink.8" leftSection={<IconDownload size={16} />} onClick={() => exportSummary(tasks)} disabled={!scored.length}>
            Export Performance Summary
          </Button>
        </Group>
      </Paper>

      <EvaluateTaskModal task={evaluating} onClose={() => setEvaluating(null)} />
      <ViewTaskModal task={viewing} onClose={() => setViewing(null)} />
    </Stack>
  );
}

function Coverage({ icon, color, bg, title, sub }: { icon: ReactNode; color: string; bg: string; title: string; sub: string }) {
  return (
    <Group gap="sm" wrap="nowrap" p="sm" style={{ border: `1px solid ${colors.border}`, borderRadius: 10 }}>
      <ThemeIcon size={34} radius="md" style={{ background: bg, color }}>{icon}</ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>{title}</Text>
        <Text size="xs" c="dimmed" truncate>{sub}</Text>
      </div>
    </Group>
  );
}

function ScoreBadge({ score, flagged }: { score: number; flagged?: boolean }) {
  const c = flagged ? '#EF4444' : '#16A34A';
  return <Badge variant="light" tt="none" style={{ background: `${c}1A`, color: c, minWidth: 'max-content' }}>{score}/100</Badge>;
}

/** CSV of each person's evaluated special tasks (one row per person). */
function exportSummary(tasks: SpecialTask[]) {
  const people = new Map<string, { dept: string; scores: number[]; flagged: number }>();
  for (const t of tasks) {
    if (t.evaluation?.weighted_average == null) continue;
    const name = t.assignee?.full_name ?? 'Unknown';
    const p = people.get(name) ?? { dept: dept(t), scores: [], flagged: 0 };
    p.scores.push(scoreOutOf100(t));
    if (t.status === 'flagged') p.flagged += 1;
    people.set(name, p);
  }
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Personnel', 'Department', 'Tasks evaluated', 'Average score (/100)', 'Flagged'].map(esc).join(',')];
  for (const [name, p] of [...people.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const avg = p.scores.reduce((a, b) => a + b, 0) / p.scores.length;
    rows.push([name, p.dept, p.scores.length, avg.toFixed(1), p.flagged].map(esc).join(','));
  }
  const url = URL.createObjectURL(new Blob([rows.join('\r\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'faculty-performance-summary.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

function EvaluateTaskModal({ task, onClose }: { task: SpecialTask | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [completion, setCompletion] = useState(0);
  const [timeliness, setTimeliness] = useState(0);
  const [initiative, setInitiative] = useState(0);
  const [remarks, setRemarks] = useState('');

  const close = () => { setStep(1); setCompletion(0); setTimeliness(0); setInitiative(0); setRemarks(''); onClose(); };
  const submit = useMutation({
    mutationFn: () => api.appraisal.evaluateSpecialTask(task!.id, {
      completion_quality_score: completion, timeliness_score: timeliness,
      // The rubric has three criteria; coordination mirrors initiative as in the Flutter app.
      initiative_score: initiative, coordination_score: initiative, remarks: remarks.trim(),
    }),
    onSuccess: () => {
      notifySuccess('Evaluation submitted');
      qc.invalidateQueries({ queryKey: qk.allAppraisal });
      close();
    },
    onError: (e) => notifyError(e),
  });
  const ready = completion > 0 && timeliness > 0 && initiative > 0;

  return (
    <Modal opened={!!task} onClose={close} size="lg"
      title={<div><Text fw={700} size="lg">Evaluate Special Task</Text><Text size="sm" c="dimmed">{task?.title}</Text></div>}>
      {task && step === 1 && (
        <Stack>
          <SimpleGrid cols={2} spacing="lg">
            <InfoField label="Personnel" value={task.assignee?.full_name ?? '—'} />
            <InfoField label="Department" value={dept(task) || '—'} />
            <InfoField label="Assigned by" value={task.assigner?.full_name ?? '—'} />
            <InfoField label="Due date" value={shortDate(task.due_date)} />
            <InfoField label="Task" value={task.title} />
            <InfoField label="Created" value={shortDate(task.created_at)} />
          </SimpleGrid>
          {task.description && <InfoField label="Description" value={task.description} />}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={close}>Close</Button>
            <Button color="ink.8" rightSection={<IconArrowRight size={16} />} onClick={() => setStep(2)}>Start Evaluation</Button>
          </Group>
        </Stack>
      )}
      {task && step === 2 && (
        <Stack>
          <Stars label="Task Completion Quality (40%)" value={completion} onChange={setCompletion} />
          <Stars label="Timeliness and Reliability (30%)" value={timeliness} onChange={setTimeliness} />
          <Stars label="Initiative and Problem-Solving (30%)" value={initiative} onChange={setInitiative} />
          <Textarea label="Remarks" placeholder="Add remarks..." autosize minRows={3} value={remarks}
            onChange={(e) => setRemarks(e.currentTarget.value)} />
          <Text size="sm" c="dimmed">Estimated score: {estimatedTaskScore(completion, timeliness, initiative)}/100</Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setStep(1)}>Back</Button>
            <Button variant="subtle" color="gray" onClick={close}>Close</Button>
            <Tooltip label="Rate all three criteria first" disabled={ready}>
              <Button color="ink.8" disabled={!ready} loading={submit.isPending} onClick={() => submit.mutate()}>
                Submit Evaluation
              </Button>
            </Tooltip>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function ViewTaskModal({ task, onClose }: { task: SpecialTask | null; onClose: () => void }) {
  const ev = task?.evaluation;
  return (
    <Modal opened={!!task} onClose={onClose} size="lg"
      title={<div><Text fw={700} size="lg">View Evaluation</Text><Text size="sm" c="dimmed">{task?.title}</Text></div>}>
      {task && (
        <Stack>
          <SimpleGrid cols={2} spacing="lg">
            <InfoField label="Personnel" value={task.assignee?.full_name ?? '—'} />
            <InfoField label="Department" value={dept(task) || '—'} />
            <InfoField label="Assigned by" value={task.assigner?.full_name ?? '—'} />
            <InfoField label="Due date" value={shortDate(task.due_date)} />
          </SimpleGrid>
          <Divider label="Ratings" labelPosition="left" />
          {ev ? (
            <>
              <Stars label="Task Completion Quality (40%)" value={ev.completion_quality_score} />
              <Stars label="Timeliness and Reliability (30%)" value={ev.timeliness_score} />
              <Stars label="Initiative and Problem-Solving (30%)" value={ev.initiative_score} />
              <Paper p="sm" radius="md" bg="#F8FAFC" shadow="none">
                <Group justify="space-between">
                  <Text fw={600}>Total Weighted Score</Text>
                  <ScoreBadge score={scoreOutOf100(task)} flagged={task.status === 'flagged'} />
                </Group>
              </Paper>
              {ev.remarks && <InfoField label="Coordinator remarks" value={ev.remarks} />}
            </>
          ) : <Text c="dimmed" size="sm">No evaluation recorded.</Text>}
          <Group justify="flex-end"><Button variant="default" onClick={onClose}>Close</Button></Group>
        </Stack>
      )}
    </Modal>
  );
}

// ── Events ───────────────────────────────────────────────────────────────────

const EVENT_CRITERIA = [
  ['planning_score', 'Planning & Preparation'],
  ['objectives_score', 'Achievement of Objectives'],
  ['personnel_score', 'Personnel Management'],
  ['time_mgmt_score', 'Time Management'],
  ['engagement_score', 'Audience Engagement'],
  ['resource_score', 'Resource Management'],
] as const;
type CriterionKey = typeof EVENT_CRITERIA[number][0];

const evalLink = (e: EventForAppraisal) => `${window.location.origin}/eval/${e.id}`;

export function EventsTab({ query }: { query: UseQueryResult<EventForAppraisal[]> }) {
  return <QueryGate query={query}>{(events) => <Events events={events} />}</QueryGate>;
}

function Events({ events }: { events: EventForAppraisal[] }) {
  const [fTitle, setFTitle] = useState<string | null>(null);
  const [options, setOptions] = useState<EventForAppraisal | null>(null);
  const [demographics, setDemographics] = useState<EventForAppraisal | null>(null);
  const [resultsId, setResultsId] = useState<number | null>(null);

  const filtered = fTitle ? events.filter((e) => e.title === fTitle) : events;
  const rated = events.filter((e) => e.evaluations.length);
  const avg = rated.length ? rated.reduce((a, e) => a + evidencyRate(e), 0) / rated.length : null;
  const awaiting = events.filter((e) => eventAppraisalStatus(e) === 'awaiting_ratings').length;
  // Look the event up on each render so the results modal reflects a just-submitted rating.
  const results = events.find((e) => e.id === resultsId) ?? null;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TabStat value={events.length} label="Total Events" sub={`${awaiting} awaiting ratings`}
          icon={<IconCalendarMonth size={20} />} iconColor={colors.textMuted} iconBg="#F3F4F6" />
        <TabStat value={rated.length} label="Rated Events"
          icon={<IconChecklist size={20} />} iconColor="#10B981" iconBg="#ECFDF5" />
        <TabStat value={avg == null ? '—' : pct(avg)} valueColor={avg == null ? undefined : rateColor(avg)}
          label="Avg Evidency Rate" icon={<IconPercentage size={20} />}
          iconColor={avg == null ? colors.textMuted : rateColor(avg)} iconBg="#F3F4F6" />
      </SimpleGrid>

      <Paper p="md" radius="lg" withBorder shadow="none" bg="#F8FAFC">
        <Group gap={8} mb="xs"><IconInfoCircle size={18} color="#64748B" /><Text fw={700} size="sm">Evidency Rate Legend</Text></Group>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          {([['#16A34A', 'Green', 'High (≥ 80%)'], ['#EA580C', 'Amber', 'Mid (50% – 79%)'], ['#EF4444', 'Red', 'Low (< 50%)']] as const)
            .map(([c, label, desc]) => (
              <Group key={label} gap={8} wrap="nowrap">
                <Box w={12} h={12} style={{ borderRadius: 3, background: c, flexShrink: 0 }} />
                <Text size="sm"><b>{label}</b> <Text span c="dimmed" size="sm">{desc}</Text></Text>
              </Group>
            ))}
        </SimpleGrid>
      </Paper>

      <Paper radius="lg">
        <Group justify="space-between" p="md" gap="sm">
          <Text fw={700}>School-Wide Events</Text>
          <Select size="xs" w={240} clearable searchable placeholder="All events" value={fTitle} onChange={setFTitle}
            data={uniqueSorted(events.map((e) => e.title))} />
        </Group>
        <Divider />
        {filtered.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" py="xl">No events for this period.</Text>
        ) : (
          <Table.ScrollContainer minWidth={1040}>
            <Table striped highlightOnHover fz="sm" verticalSpacing="sm" horizontalSpacing="sm" style={{ whiteSpace: 'nowrap' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Event name</Table.Th><Table.Th>Date</Table.Th><Table.Th>Department</Table.Th><Table.Th>Organizer</Table.Th>
                  <Table.Th ta="center">Responses</Table.Th><Table.Th ta="center">Evidency rate</Table.Th>
                  <Table.Th ta="center">Status</Table.Th><Table.Th ta="center">Evaluation</Table.Th><Table.Th ta="right">Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((e) => {
                  const has = e.evaluations.length > 0;
                  const rate = has ? evidencyRate(e) : null;
                  return (
                    <Table.Tr key={e.id}>
                      <Table.Td><Text size="sm" fw={600} lineClamp={1} maw={260}>{e.title}</Text></Table.Td>
                      <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>{shortDate(e.target_date)}</Table.Td>
                      <Table.Td c="dimmed">{e.department || '—'}</Table.Td>
                      <Table.Td c="dimmed">{e.organizer?.full_name ?? '—'}</Table.Td>
                      <Table.Td ta="center">{e.expected_attendees ? `${e.evaluations.length} / ${e.expected_attendees}` : e.evaluations.length}</Table.Td>
                      <Table.Td ta="center" fw={700} c={rate == null ? 'dimmed' : rateColor(rate)}>{rate == null ? '—' : pct(rate)}</Table.Td>
                      <Table.Td ta="center"><AppraisalStatus status={eventAppraisalStatus(e)} /></Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center" wrap="nowrap">
                          <Tooltip label="Evaluation QR code / link">
                            <ActionIcon variant="subtle" onClick={() => setOptions(e)} aria-label="Evaluation options"><IconQrcode size={18} /></ActionIcon>
                          </Tooltip>
                          <Tooltip label="Evaluator demographics">
                            <ActionIcon variant="subtle" color={has ? 'brand' : 'gray'} onClick={() => setDemographics(e)} aria-label="Evaluator demographics">
                              <IconUsersGroup size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        {has
                          ? <Button size="xs" color="ink.8" onClick={() => setResultsId(e.id)}>View Results</Button>
                          : <Button size="xs" variant="default" onClick={() => setResultsId(e.id)}>Rate</Button>}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <EvaluationOptionsModal event={options} onClose={() => setOptions(null)} />
      <DemographicsModal event={demographics} onClose={() => setDemographics(null)} />
      <EventResultsModal event={results} onClose={() => setResultsId(null)} />
    </Stack>
  );
}

function EvaluationOptionsModal({ event, onClose }: { event: EventForAppraisal | null; onClose: () => void }) {
  const [view, setView] = useState<'menu' | 'qr' | 'link'>('menu');
  const close = () => { setView('menu'); onClose(); };
  const link = event ? evalLink(event) : '';
  const titles = { menu: 'Evaluation Options', qr: 'Event Evaluation QR Code', link: 'Evaluation Link' };
  return (
    <Modal opened={!!event} onClose={close} title={<Text fw={700}>{titles[view]}</Text>} size="md">
      {event && (
        <Stack align="stretch">
          <div>
            <Text fw={700} ta="center">{event.title}</Text>
            {(event.organizer?.full_name || event.department) && (
              <Text size="sm" c="dimmed" ta="center">{[event.organizer?.full_name, event.department].filter(Boolean).join(' · ')}</Text>
            )}
          </div>
          {view === 'menu' && (
            <>
              <OptionCard icon={<IconQrcode size={22} />} title="Show QR Code"
                sub="Generate a QR code for attendees to scan on their devices" onClick={() => setView('qr')} />
              <OptionCard icon={<IconLink size={22} />} title="Get Evaluation Link"
                sub="Copy the direct URL to the evaluation web page" onClick={() => setView('link')} />
            </>
          )}
          {view === 'qr' && (
            <Stack align="center" gap="xs">
              <Paper p="md" withBorder shadow="none"><QRCodeSVG value={link} size={220} /></Paper>
              <Text size="xs" c="dimmed">Event ID: {event.id} · Scan to open the evaluation form</Text>
            </Stack>
          )}
          {view === 'link' && (
            <Group gap="xs" wrap="nowrap">
              <Paper px="sm" py={8} withBorder shadow="none" style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" truncate ff="monospace">{link}</Text>
              </Paper>
              <CopyButton value={link}>
                {({ copied, copy }) => (
                  <Button color={copied ? 'green' : 'ink.8'} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
            </Group>
          )}
          <Group justify="flex-end">
            {view !== 'menu' && <Button variant="subtle" color="gray" onClick={() => setView('menu')}>Back</Button>}
            <Button variant="default" onClick={close}>Close</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function OptionCard({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick} p="md" style={{ border: `1px solid ${colors.border}`, borderRadius: 12 }}>
      <Group wrap="nowrap">
        <ThemeIcon size={42} radius="md" variant="light">{icon}</ThemeIcon>
        <div style={{ flex: 1 }}>
          <Text fw={600}>{title}</Text>
          <Text size="xs" c="dimmed">{sub}</Text>
        </div>
        <IconChevronRight size={18} color={colors.textLight} />
      </Group>
    </UnstyledButton>
  );
}

function DemographicsModal({ event, onClose }: { event: EventForAppraisal | null; onClose: () => void }) {
  const d = (event?.demographics ?? {}) as Record<string, unknown>;
  const total = Number(d.total ?? event?.evaluations.length ?? 0);
  const section = (title: string, key: string) => {
    const counts = Object.entries((d[key] ?? {}) as Record<string, number>).sort(([, a], [, b]) => b - a);
    if (!counts.length) return null;
    return (
      <div key={key}>
        <Text fw={700} size="sm" mb={8}>{title}</Text>
        <Stack gap={8}>
          {counts.map(([label, n]) => {
            const muted = label === 'Not specified';
            return (
              <Group key={label} gap="sm" wrap="nowrap">
                <Text size="sm" w={140} truncate c={muted ? 'dimmed' : undefined}>{label ? titleCase(label) : '—'}</Text>
                <Progress value={total ? (n / total) * 100 : 0} size="md" radius="sm" style={{ flex: 1 }}
                  color={muted ? 'gray.4' : 'brand'} aria-label={`${label}: ${n}`} />
                <Text size="xs" c="dimmed" w={80} ta="right">{n} · {total ? Math.round((n * 100) / total) : 0}%</Text>
              </Group>
            );
          })}
        </Stack>
      </div>
    );
  };
  return (
    <Modal opened={!!event} onClose={onClose} size="lg"
      title={<div><Text fw={700}>Evaluator demographics</Text>
        <Text size="sm" c="dimmed">{event?.title} · {total} {total === 1 ? 'evaluation' : 'evaluations'}</Text></div>}>
      {total === 0
        ? <Text c="dimmed" size="sm">No evaluations yet.</Text>
        : <Stack gap="lg">{section('By role', 'by_role')}{section('By sex', 'by_sex')}{section('By age group', 'by_age_group')}</Stack>}
    </Modal>
  );
}

/** Results per criterion and each evaluator's comments, with a form to add a rating. */
function EventResultsModal({ event, onClose }: { event: EventForAppraisal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const empty = { planning_score: 0, objectives_score: 0, personnel_score: 0, time_mgmt_score: 0, engagement_score: 0, resource_score: 0 };
  const [rating, setRating] = useState(false);
  const [scores, setScores] = useState<Record<CriterionKey, number>>(empty);
  const [comments, setComments] = useState('');
  const close = () => { setRating(false); setScores(empty); setComments(''); onClose(); };

  const submit = useMutation({
    mutationFn: () => api.appraisal.evaluateEvent(event!.id, {
      evaluator_name: 'Evaluator', evaluator_role: 'Coordinator', ...scores, feedback_comments: comments.trim(),
    }),
    onSuccess: async () => {
      notifySuccess('Evaluation submitted');
      await qc.invalidateQueries({ queryKey: qk.allAppraisal });
      setRating(false); setScores(empty); setComments('');
    },
    onError: (e) => notifyError(e),
  });

  const evals = event?.evaluations ?? [];
  const showForm = rating || evals.length === 0;
  const ready = Object.values(scores).every((v) => v > 0);
  const formAvg = Object.values(scores).reduce((a, b) => a + b, 0) / 6;

  return (
    <Modal opened={!!event} onClose={close} size="lg"
      title={<div><Text fw={700}>{showForm ? 'Rate event' : 'Evaluation results'}</Text><Text size="sm" c="dimmed">{event?.title}</Text></div>}>
      {event && !showForm && (
        <Stack>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{evals.length} {evals.length === 1 ? 'response' : 'responses'}</Text>
            <Text fw={700} c={rateColor(evidencyRate(event))}>Evidency rate {pct(evidencyRate(event))}</Text>
          </Group>
          <Stack gap={8}>
            {EVENT_CRITERIA.map(([key, label]) => {
              const avg = evals.reduce((a, x) => a + x[key], 0) / evals.length;
              return (
                <Group key={key} gap="sm" wrap="nowrap">
                  <Text size="sm" w={200}>{label}</Text>
                  <Progress value={(avg / 5) * 100} color={rateColor((avg / 5) * 100)} style={{ flex: 1 }} aria-label={label} />
                  <Text size="sm" fw={600} w={60} ta="right">{avg.toFixed(2)}</Text>
                </Group>
              );
            })}
          </Stack>
          <Divider label="Responses" labelPosition="left" />
          <Stack gap="xs" mah={260} style={{ overflowY: 'auto' }}>
            {evals.map((x) => (
              <Paper key={x.id} p="sm" withBorder shadow="none">
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={600}>{x.evaluator_name}{x.evaluator_role ? <Text span size="xs" c="dimmed"> · {x.evaluator_role}</Text> : null}</Text>
                  <Group gap={4}><IconStar size={14} color="#F59E0B" fill="#F59E0B" /><Text size="sm" fw={600}>{evaluationAverage(x).toFixed(1)}</Text></Group>
                </Group>
                {x.feedback_comments && <Text size="sm" mt={4}>{x.feedback_comments}</Text>}
                {x.date_submitted && <Text size="xs" c="dimmed" mt={2}>{formatDateTime(parseTimestamp(x.date_submitted))}</Text>}
              </Paper>
            ))}
          </Stack>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>Close</Button>
            <Button color="ink.8" onClick={() => setRating(true)}>Add a rating</Button>
          </Group>
        </Stack>
      )}
      {event && showForm && (
        <Stack>
          <Text size="sm" fw={700}>Rating criteria</Text>
          {EVENT_CRITERIA.map(([key, label]) => (
            <Stars key={key} label={label} value={scores[key]} onChange={(v) => setScores((s) => ({ ...s, [key]: v }))} />
          ))}
          {formAvg > 0 && <Text size="sm" c="dimmed">Average score: {formAvg.toFixed(2)} / 5</Text>}
          <Textarea label="Feedback / comments" autosize minRows={3} value={comments} onChange={(e) => setComments(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => (evals.length ? setRating(false) : close())}>{evals.length ? 'Back' : 'Cancel'}</Button>
            <Tooltip label="Rate every criterion first" disabled={ready}>
              <Button color="ink.8" disabled={!ready} loading={submit.isPending} onClick={() => submit.mutate()}>Submit</Button>
            </Tooltip>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────

const BADGE_ICONS: Record<string, typeof IconAward> = {
  schedule: IconClock, wb_sunny: IconSun, local_fire_department: IconFlame, verified: IconRosetteDiscountCheck,
  star: IconStar, emoji_events: IconTrophy, groups: IconUsersGroup,
};
const badgeColor = (b: AppraisalBadge) => (!b.earned ? '#CBD5E1' : BADGE_TIER_COLORS[b.tier ?? ''] ?? colors.accent);

export function BadgesTab({ filter, showOwn, showLeaderboard }: { filter: SchoolYearFilter; showOwn: boolean; showLeaderboard: boolean }) {
  const mine = useQuery({ queryKey: qk.appraisal('badges', filter), queryFn: () => api.appraisal.badges({ filter }), enabled: showOwn });
  const board = useQuery({ queryKey: qk.appraisal('leaderboard', filter), queryFn: () => api.appraisal.leaderboard(filter), enabled: showLeaderboard });
  const [person, setPerson] = useState<LeaderboardEntry | null>(null);

  if (!showOwn && !showLeaderboard) return <EmptyState title="No badges to show" />;
  const earned = (mine.data ?? []).filter((b) => b.earned).length;
  return (
    <Stack gap="lg">
      {showOwn && (
        <div>
          <Text fw={700} size="lg">My badges</Text>
          <Text size="sm" c="dimmed" mb="sm">{mine.data ? `${earned} of ${mine.data.length} earned this period` : ' '}</Text>
          <QueryGate query={mine}>{(badges) => <BadgeGrid badges={badges} />}</QueryGate>
        </div>
      )}
      {showLeaderboard && (
        <div>
          <Text fw={700} size="lg">Badge leaderboard</Text>
          <Text size="sm" c="dimmed" mb="sm">Personnel ranked by badges earned this period</Text>
          <QueryGate query={board}>{(rows) => (
            <Paper radius="lg">
              {rows.length === 0 ? <Text c="dimmed" size="sm" ta="center" py="xl">No personnel to show.</Text>
                : rows.map((p, i) => (
                  <LeaderRow key={p.id} rank={i + 1} person={p} onClick={() => setPerson(p)} last={i === rows.length - 1} />
                ))}
            </Paper>
          )}</QueryGate>
        </div>
      )}
      <PersonBadgesModal person={person} filter={filter} onClose={() => setPerson(null)} />
    </Stack>
  );
}

function BadgeGrid({ badges }: { badges: AppraisalBadge[] }) {
  // Earned first, then closest to earning.
  const sorted = [...badges].sort((a, b) => (a.earned !== b.earned ? (a.earned ? -1 : 1)
    : (b.target ? b.progress / b.target : 0) - (a.target ? a.progress / a.target : 0)));
  if (!sorted.length) return <Text c="dimmed" size="sm">No badges defined.</Text>;
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 4 }} spacing="sm">
      {sorted.map((b) => <BadgeCard key={b.code} badge={b} />)}
    </SimpleGrid>
  );
}

function BadgeCard({ badge: b }: { badge: AppraisalBadge }) {
  const color = badgeColor(b);
  const Icon = b.earned ? BADGE_ICONS[b.icon] ?? IconAward : IconLock;
  return (
    <Paper p="md" radius="lg" shadow="none" withBorder
      style={{ background: b.earned ? 'white' : '#F8FAFC', borderColor: b.earned ? `${color}73` : '#E2E8F0', borderWidth: b.earned ? 1.5 : 1 }}>
      <Group align="flex-start" wrap="nowrap" gap="sm">
        <Center w={50} h={50} style={{ borderRadius: '50%', flexShrink: 0, border: `2px solid ${color}`, background: b.earned ? `${color}24` : '#F1F5F9' }}>
          <Icon size={24} color={b.earned ? color : '#94A3B8'} />
        </Center>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text fw={700} size="sm" c={b.earned ? undefined : 'dimmed'} truncate>{b.name}</Text>
            {b.earned && b.tier && <Badge size="xs" variant="light" tt="capitalize" style={{ background: `${color}1F`, color }}>{b.tier}</Badge>}
          </Group>
          <Text size="xs" c="dimmed">{b.description}</Text>
          {b.earned ? (
            <Group gap={4} mt={6}><IconCircleCheck size={15} color={color} /><Text size="xs" fw={600} c={color}>Earned</Text></Group>
          ) : (
            <>
              <Progress mt={8} size="sm" value={b.target ? (b.progress / b.target) * 100 : 0} aria-label={`${b.name} progress`} />
              <Text size="xs" c="dimmed" mt={4}>{b.progress} / {b.target}</Text>
            </>
          )}
        </div>
      </Group>
    </Paper>
  );
}

function LeaderRow({ rank, person: p, onClick, last }: { rank: number; person: LeaderboardEntry; onClick: () => void; last: boolean }) {
  const earned = p.badges.filter((b) => b.earned);
  return (
    <UnstyledButton w="100%" px="md" py="sm" onClick={onClick} className="hover-row"
      style={{ borderBottom: last ? undefined : '1px solid #F0F2F6' }}>
      <Group wrap="nowrap" gap="sm">
        <Text fw={800} w={28} ta="center" c={rank <= 3 && earned.length ? BADGE_TIER_COLORS.gold : 'dimmed'}>#{rank}</Text>
        <UserAvatar name={p.full_name} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} truncate>{p.full_name}</Text>
          <Text size="xs" c="dimmed">{[titleCase(p.role.replace(/_/g, ' ')), p.grade_level].filter(Boolean).join(' · ')}</Text>
        </div>
        {earned.length === 0 ? <Text size="xs" c="dimmed">No badges yet</Text> : (
          <Group gap={4} visibleFrom="xs">
            {earned.map((b) => {
              const Icon = BADGE_ICONS[b.icon] ?? IconAward;
              const c = badgeColor(b);
              return (
                <Tooltip key={b.code} label={b.name}>
                  <Center w={28} h={28} style={{ borderRadius: '50%', border: `1.5px solid ${c}`, background: `${c}24` }}>
                    <Icon size={15} color={c} />
                  </Center>
                </Tooltip>
              );
            })}
          </Group>
        )}
        <Text fw={800} w={28} ta="right">{p.earned_count}</Text>
        <IconChevronRight size={18} color={colors.textLight} />
      </Group>
    </UnstyledButton>
  );
}

function PersonBadgesModal({ person, filter, onClose }: { person: LeaderboardEntry | null; filter: SchoolYearFilter; onClose: () => void }) {
  const badges = useQuery({
    queryKey: qk.appraisal('badges', filter, { userId: person?.id }),
    queryFn: () => api.appraisal.badges({ userId: person!.id, filter }),
    enabled: !!person,
  });
  return (
    <Modal opened={!!person} onClose={onClose} size={860} title={<Text fw={700}>{person?.full_name}&rsquo;s badges</Text>}>
      {badges.isPending ? <Center py="xl"><Loader color="ink.8" /></Center>
        : badges.isError ? <ErrorState error={badges.error} onRetry={() => badges.refetch()} />
          : <BadgeGrid badges={badges.data} />}
    </Modal>
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────

const SCHOOL_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
const MONTH_INDEX: Record<number, string> = { 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec', 0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr' };

function averageBy<T>(items: T[], key: (t: T) => string, value: (t: T) => number) {
  const m = new Map<string, number[]>();
  for (const it of items) m.set(key(it), [...(m.get(key(it)) ?? []), value(it)]);
  return [...m.entries()]
    .map(([name, xs]) => ({ name, avg: xs.reduce((a, b) => a + b, 0) / xs.length, count: xs.length }))
    .sort((a, b) => b.avg - a.avg);
}

export function AnalyticsTab({ tasks, events }: { tasks: SpecialTask[]; events: EventForAppraisal[] }) {
  const evaluated = tasks.filter((t) => t.evaluation?.weighted_average != null);
  const overall = evaluated.length ? evaluated.reduce((a, t) => a + scoreOutOf100(t), 0) / evaluated.length : 0;
  const personnel = new Set(tasks.map((t) => t.assignee?.id).filter((x) => x != null)).size;
  const eventEvals = events.reduce((a, e) => a + e.evaluations.length, 0);
  const depts = averageBy(evaluated, (t) => dept(t) || 'Unassigned', scoreOutOf100);
  const top = averageBy(evaluated, (t) => t.assignee?.full_name ?? 'Unknown', scoreOutOf100).slice(0, 5);

  const trend = useMemo(() => {
    const buckets = new Map<string, number[]>(SCHOOL_MONTHS.map((m) => [m, []]));
    for (const t of evaluated) {
      const d = parseIsoDate(t.created_at);
      const m = d ? MONTH_INDEX[d.getMonth()] : undefined;
      if (m) buckets.get(m)!.push(scoreOutOf100(t));
    }
    // Months without evaluations stay empty (no bar) rather than reading as a score of 0.
    return SCHOOL_MONTHS.map((month) => {
      const xs = buckets.get(month)!;
      return { month, score: xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null, count: xs.length };
    });
  }, [evaluated]);
  const hasTrend = trend.some((t) => t.score != null);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <TabStat value={overall > 0 ? pct(overall, 1) : '—'} label="Overall Performance" sub="Average special-task score"
          icon={<IconTrophy size={20} />} iconColor="#10B981" iconBg="#ECFDF5" />
        <TabStat value={personnel} label="Total Personnel" sub="In your scope"
          icon={<IconUsers size={20} />} iconColor="#3B82F6" iconBg="#EFF6FF" />
        <TabStat value={evaluated.length} label="Special Tasks" sub="Evaluated tasks"
          icon={<IconClipboardList size={20} />} iconColor="#F59E0B" iconBg="#FEF3C7" />
        <TabStat value={eventEvals} label="Event Evaluations" sub="Responses received"
          icon={<IconCalendarMonth size={20} />} iconColor="#8B5CF6" iconBg="#EDE9FE" />
      </SimpleGrid>

      <Paper p="md" radius="lg">
        <Text fw={700}>Monthly Performance Trend</Text>
        <Text size="xs" c="dimmed" mb="md">Average special-task score per month (out of 100)</Text>
        {hasTrend ? (
          <BarChart h={220} data={trend} dataKey="month" series={[{ name: 'score', label: 'Avg score (/100)', color: colors.dark }]}
            yAxisProps={{ domain: [0, 100], ticks: [0, 25, 50, 75, 100], width: 36 }} gridAxis="y" strokeDasharray="3 3"
            barProps={{ radius: [4, 4, 0, 0], maxBarSize: 36 }} withTooltip tooltipAnimationDuration={150}
            unit="" />
        ) : <Text c="dimmed" size="sm" ta="center" py="xl">No evaluated special tasks in this period yet.</Text>}
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper p="md" radius="lg">
          <Text fw={700} mb="md">Department Performance</Text>
          {depts.length === 0 ? <Text c="dimmed" size="sm">No data yet.</Text> : (
            <Stack gap="sm">
              {depts.map((d) => (
                <div key={d.name}>
                  <Group justify="space-between" mb={4}>
                    <div><Text size="sm" fw={600}>{d.name}</Text><Text size="xs" c="dimmed">{d.count} task{d.count !== 1 ? 's' : ''} evaluated</Text></div>
                    <Text fw={700}>{pct(d.avg, 1)}</Text>
                  </Group>
                  <Progress value={d.avg} color="ink.8" size="sm" aria-label={`${d.name} average`} />
                </div>
              ))}
            </Stack>
          )}
        </Paper>
        <Paper p="md" radius="lg">
          <Text fw={700} mb="md">Top Performers</Text>
          {top.length === 0 ? <Text c="dimmed" size="sm">No data yet.</Text> : (
            <Stack gap="sm">
              {top.map((p, i) => (
                <Group key={p.name} wrap="nowrap" gap="sm">
                  <Center w={30} h={30} style={{ borderRadius: '50%', background: i < 3 ? '#FEF3C7' : '#F3F4F6', flexShrink: 0 }}>
                    <Text size="xs" fw={800} c={i < 3 ? '#B45309' : 'dimmed'}>#{i + 1}</Text>
                  </Center>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>{p.name}</Text>
                    <Text size="xs" c="dimmed">{p.count} task{p.count !== 1 ? 's' : ''}</Text>
                  </div>
                  <Text fw={700}>{pct(p.avg, 1)}</Text>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
