import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon, Anchor, Badge, Box, Button, Center, Divider, FileButton, Grid, Group, Loader, Paper, Progress,
  SegmentedControl, Stack, Text, TextInput, ThemeIcon, Title, Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconArrowLeft, IconBolt, IconChevronRight, IconCircleCheckFilled, IconClipboardList, IconClock,
  IconDownload, IconExternalLink, IconFile, IconFileDescription, IconFlag, IconLink, IconLock,
  IconMessageCircle, IconPaperclip, IconPencil, IconPlayerPlay, IconSend, IconStar, IconUserCheck,
  IconUserMinus, IconUserPlus, IconUsersGroup,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, assigneeStatus, formatDateTime, formatIsoDate, isTaskSubmitted, parseTimestamp, qk, reportPoints,
  resolveUrl, roleLabel, teamProgress, TONES, useSession, useUser, type Comment, type Report, type Task,
  type Tone, type User,
} from '@tasknet/shared';
import { AssignPicker, AssignRoleSelector } from '../../components/AssignPicker';
import { AttachmentRow } from '../../components/Attachments';
import { CommentInput, CommentItem, EditCommentModal } from '../../components/Comments';
import { ErrorState, notifyError, notifySuccess, PageLoader, UserAvatar } from '../../components/ui';
import { colors } from '../../theme';

function Pill({ label, tone = 'gray' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return <Badge radius="xl" tt="none" fw={600} style={{ background: tone === 'gray' ? '#F1F5F9' : t.bg, color: t.fg }}>{label}</Badge>;
}

function Card({ children }: { children: ReactNode }) {
  return <Paper p={20} radius="lg" withBorder>{children}</Paper>;
}

/**
 * Task detail. Separation of duties is route-based: from the Task Manager the
 * assigner sees assignees and their submissions; from My Tasks (ownView) the
 * viewer only sees and submits their own work.
 */
export function TaskDetailPage({ backTo, ownView = false }: { backTo: string; ownView?: boolean }) {
  const { id } = useParams();
  const taskId = Number(id);
  const user = useUser();
  const { can } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const task = useQuery({ queryKey: qk.task(taskId), queryFn: () => api.tasks.get(taskId) });
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.task(taskId) }),
    queryClient.invalidateQueries({ queryKey: qk.allTasks }),
    queryClient.invalidateQueries({ queryKey: qk.dashboard }),
  ]);

  if (task.isPending) return <PageLoader />;
  if (task.isError) return <ErrorState error={task.error} onRetry={() => task.refetch()} />;
  const t = task.data;

  const canAssign = can('assign_tasks') && !ownView;
  const canReview = can('review_submissions') && !ownView;
  const reviewing = canAssign || canReview;
  const reports = t.reports ?? [];
  const selectedReport = reports.find((r) => r.id === selectedReportId) ?? reports[0] ?? null;

  const sendComment = async (content: string, type: 'public' | 'private', reportId?: number) => {
    try {
      await api.tasks.addComment(taskId, content, type, reportId);
      await refresh();
    } catch (e) {
      notifyError(e);
    }
  };
  const deleteComment = async (c: Comment) => {
    try {
      await api.tasks.deleteComment(c.id);
      await refresh();
    } catch (e) {
      notifyError(e);
    }
  };
  const ownActions = (c: Comment) => c.user_id === user.id
    ? { onEdit: () => setEditing(c), onDelete: () => void deleteComment(c) } : {};

  return (
    <Box>
      <Tooltip label="Back">
        <ActionIcon variant="default" radius="xl" size={34} mb={10} onClick={() => navigate(backTo)} aria-label="Back">
          <IconArrowLeft size={16} />
        </ActionIcon>
      </Tooltip>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 'auto' }}>
          <MainContent task={t} reviewing={reviewing} canAssign={canAssign} viewerId={user.id}
            selectedUserId={selectedReport?.personnel_id ?? null}
            onSelectReport={(r) => setSelectedReportId(r.id)}
            onEdit={() => navigate(`${t.task_category === 'special' ? '/special-tasks' : '/tasks'}/${t.id}/edit`)}
            onChanged={refresh}
            comments={(
              <Card>
                <Group gap={8}>
                  <IconMessageCircle size={18} color={colors.textMuted} />
                  <Text fw={700}>Public comments</Text>
                  {!!t.public_comments?.length && <Pill label={String(t.public_comments.length)} />}
                </Group>
                <Text size="xs" c="dimmed" mt={4} mb={12}>Visible to everyone assigned to this task.</Text>
                {t.public_comments?.map((c) => <CommentItem key={c.id} comment={c} {...ownActions(c)} />)}
                <CommentInput placeholder="Add a comment..." onSend={(c) => sendComment(c, 'public')} />
              </Card>
            )} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 'content' }} w={{ md: 340 }}>
          {reviewing
            ? <ReviewPanel task={t} report={selectedReport} onChanged={refresh}
                comments={selectedReport ? (t.private_comments ?? []).filter((c) =>
                  c.user_id === selectedReport.personnel_id || (c.report_id != null && c.report_id === selectedReport.id)) : []}
                ownActions={ownActions}
                onSend={(c) => sendComment(c, 'private', selectedReport?.id)} />
            : <SubmitPanel task={t} onChanged={refresh} ownActions={ownActions}
                onSend={(c) => sendComment(c, 'private')} />}
        </Grid.Col>
      </Grid>
      {editing && (
        <EditCommentModal initial={editing.content} onClose={() => setEditing(null)}
          onSave={async (text) => {
            try {
              await api.tasks.editComment(editing.id, text);
              await refresh();
            } catch (e) {
              notifyError(e);
            }
          }} />
      )}
    </Box>
  );
}

function Meta({ icon, label, value, danger, note }: { icon: ReactNode; label: string; value: string; danger?: boolean; note?: string }) {
  return (
    <Group gap={8} wrap="nowrap">
      <Box c="dimmed">{icon}</Box>
      <div>
        <Text size="xs" c="dimmed">{label}</Text>
        <Group gap={8}>
          <Text size="sm" fw={600} c={danger ? 'red' : undefined}>{value}</Text>
          {note && <Pill label={note} tone="red" />}
        </Group>
      </div>
    </Group>
  );
}

function MainContent({ task: t, reviewing, canAssign, viewerId, selectedUserId, onSelectReport, onEdit, onChanged, comments }: {
  task: Task; reviewing: boolean; canAssign: boolean; viewerId: number; selectedUserId: number | null;
  onSelectReport: (r: Report) => void; onEdit: () => void; onChanged: () => Promise<unknown>; comments: ReactNode;
}) {
  const { can } = useSession();
  const p = teamProgress(t, viewerId);
  const reportsBy = new Map((t.reports ?? []).map((r) => [r.personnel_id, r]));
  const isLeaf = can('receive_tasks');
  const deadlineText = t.end_date
    ? `${formatIsoDate(t.end_date)}${t.due_time && t.due_time.toUpperCase() !== '11:59 PM' ? `, ${t.due_time}` : ''}`
    : 'No deadline';
  const instructions = (t.instructions ?? '').trim();

  return (
    <Stack gap="md">
      <Card>
        <Group align="flex-start" wrap="nowrap" gap={14}>
          <ThemeIcon size={48} radius={12} style={{ background: '#EEF2FA', color: colors.dark }}>
            {t.task_category === 'special' ? <IconStar size={24} /> : <IconClipboardList size={24} />}
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Title order={2} fz={22} fw={700} lh={1.25}>{t.title}</Title>
            <Group gap={6} mt={8}>
              <Pill label={t.task_category === 'special' ? 'Special task' : 'Task'} />
              {t.status !== 'active' && <Pill label="Disabled" />}
              {isLeaf && !reviewing && (isTaskSubmitted(t) ? <Pill label="Submitted" tone="green" />
                : p.pastDue ? <Pill label="Missing" tone="red" /> : <Pill label="Not submitted" tone="amber" />)}
            </Group>
          </Box>
          {t.can_edit && (
            <Button variant="default" leftSection={<IconPencil size={16} />} onClick={onEdit}>Edit task</Button>
          )}
        </Group>
        <Divider my={14} />
        <Group gap={32}>
          <Meta icon={<IconPlayerPlay size={18} />} label="Start" value={t.start_date ? formatIsoDate(t.start_date) : 'Not set'} />
          <Meta icon={<IconFlag size={18} />} label="Deadline" value={deadlineText} danger={p.pastDue}
            note={p.pastDue ? 'Past deadline' : undefined} />
          {reviewing && (
            <Meta icon={<IconUsersGroup size={18} />} label={p.mineOnly ? 'Assigned by you' : 'Assigned'}
              value={p.mineOnly ? `${p.total} of ${p.everyone} people` : `${p.total} ${p.total === 1 ? 'person' : 'people'}`} />
          )}
        </Group>
      </Card>

      {reviewing && (p.total > 0 || p.mineOnly) && (
        <Card>
          <Group justify="space-between">
            <Text fw={700}>Submission progress</Text>
            <Text fw={700} size="sm" c={p.submitted >= p.total ? '#15803D' : undefined}>{p.submitted} of {p.total} submitted</Text>
          </Group>
          {p.mineOnly && (
            <Text size="xs" c="dimmed" mt={2}>
              Counting the {p.total} {p.total === 1 ? 'person' : 'people'} you assigned ({p.everyone} on this task in total).
            </Text>
          )}
          <Progress mt={12} size={10} radius="xl" bg="#EEF2FA" value={p.total ? (p.submitted / p.total) * 100 : 0}
            color={p.submitted >= p.total ? 'green' : 'brand'} />
          <Group gap={20} mt={12}>
            <Legend color={colors.green} label="Submitted" count={p.submitted} />
            <Legend color={colors.amber} label="Not yet submitted" count={Math.max(0, p.total - p.submitted - p.missing)} />
            <Legend color={colors.red} label="Missing (past deadline)" count={p.missing} />
          </Group>
        </Card>
      )}

      <Card>
        <Text fw={700} mb={10}>Instructions</Text>
        <Text className="tn-prewrap" lh={1.6} c={instructions ? undefined : 'dimmed'}>
          {instructions || 'No instructions provided.'}
        </Text>
        {!!t.attachments?.length && (
          <Stack gap={8} mt="md">
            <Group gap={6}><IconPaperclip size={16} color={colors.textMuted} /><Text size="sm" fw={600}>Attachments</Text></Group>
            {t.attachments.map((a, i) => <AttachmentRow key={a.id ?? i} att={{ ...a, url: resolveUrl(a.url) }} />)}
          </Stack>
        )}
      </Card>

      {reviewing && (
        <AssigneesCard task={t} users={p.team} title={p.mineOnly ? 'People you assigned' : 'Assigned personnel'}
          canEdit={canAssign} pastDue={p.pastDue} reportsBy={reportsBy} selectedUserId={selectedUserId}
          onSelect={onSelectReport} onChanged={onChanged} />
      )}

      {comments}
    </Stack>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={10} h={10} style={{ borderRadius: '50%', background: color }} />
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xs" fw={700}>{count}</Text>
    </Group>
  );
}

function AssigneesCard({ task, users, title, canEdit, pastDue, reportsBy, selectedUserId, onSelect, onChanged }: {
  task: Task; users: User[]; title: string; canEdit: boolean; pastDue: boolean; reportsBy: Map<number, Report>;
  selectedUserId: number | null; onSelect: (r: Report) => void; onChanged: () => Promise<unknown>;
}) {
  const [assigning, setAssigning] = useState(false);

  const unassign = (u: User) => modals.openConfirmModal({
    title: `Remove ${u.full_name}?`,
    children: <Text size="sm">They will no longer see this task. Anything they already submitted stays on record.</Text>,
    labels: { confirm: `Remove ${u.full_name.split(' ')[0]}`, cancel: 'Keep assigned' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await api.tasks.unassign(task.id, u.id);
        await onChanged();
      } catch (e) {
        notifyError(e);
      }
    },
  });

  return (
    <Card>
      <Group justify="space-between" mb={12}>
        <Group gap={8}><Text fw={700}>{title}</Text><Pill label={String(users.length)} /></Group>
        {canEdit && (
          <Button color="ink.8" size="sm" leftSection={<IconUserPlus size={16} />} onClick={() => setAssigning(true)}>Assign</Button>
        )}
      </Group>
      {users.length === 0 ? <Text size="sm" c="dimmed">No one is assigned yet.</Text> : (
        <Box style={{ border: '1px solid var(--tn-border)', borderRadius: 10, overflow: 'hidden' }}>
          {users.map((u) => {
            const report = reportsBy.get(u.id);
            const status = assigneeStatus(u, report, pastDue);
            const selected = selectedUserId === u.id;
            return (
              <Group key={u.id} wrap="nowrap" px={14} py={10} gap={12}
                bg={selected ? '#EFF6FF' : undefined}
                style={{ borderBottom: '1px solid #F0F2F6', cursor: report ? 'pointer' : 'default' }}
                onClick={report ? () => onSelect(report) : undefined}>
                <UserAvatar name={u.full_name} size={34} />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>{u.full_name}</Text>
                  <Text size="xs" c="dimmed">{[roleLabel(u.role), u.grade_level].filter(Boolean).join(' · ')}</Text>
                </Box>
                <Pill label={status.label} tone={status.tone} />
                {report && (
                  <Tooltip label={`View ${u.full_name.split(' ')[0]}'s report`}>
                    <IconChevronRight size={18} color={selected ? colors.accent : colors.textLight} />
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip label={`Remove ${u.full_name}`}>
                    <ActionIcon variant="subtle" color="gray" aria-label={`Remove ${u.full_name}`}
                      onClick={(e) => { e.stopPropagation(); unassign(u); }}>
                      <IconUserMinus size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            );
          })}
        </Box>
      )}
      {assigning && <AssignDialog task={task} onClose={() => setAssigning(false)} onAssigned={onChanged} />}
    </Card>
  );
}

function AssignDialog({ task, onClose, onAssigned }: { task: Task; onClose: () => void; onAssigned: () => Promise<unknown> }) {
  const user = useUser();
  const roles = user.assignable_roles;
  const [role, setRole] = useState<string>(roles[0] ?? 'teacher');
  const assignable = useQuery({ queryKey: qk.assignable(role), queryFn: () => api.users.assignable(role) });
  const suggestions = useQuery({
    queryKey: qk.suggestions({ task: task.id, role }),
    queryFn: () => api.users.suggestions({
      targetRole: role, title: task.title, subject: task.subject ?? '', instructions: task.instructions ?? '',
      taskCategory: task.task_category, startDate: task.start_date, endDate: task.end_date, dueTime: task.due_time,
    }),
  });
  const assignedIds = new Set((task.assigned_users ?? []).map((u) => u.id));
  const available = (assignable.data ?? []).filter((u) => !assignedIds.has(u.id));
  const header = roles.length > 1 && (
    <div>
      <Text size="xs" fw={500} c="dimmed" mb={6}>Assign as</Text>
      <AssignRoleSelector options={roles} value={role} onChange={setRole} />
    </div>
  );

  if (assignable.isPending || assignable.isError || !available.length) {
    return (
      <AssignPicker opened onClose={onClose} users={[]} selected={[]} title="Assign Users"
        header={<>
          {header}
          <Center py="lg">
            {assignable.isPending ? <Loader /> : <Text size="sm" c="dimmed">
              {assignable.isError ? (assignable.error as Error).message : 'Everyone with this role is already assigned.'}
            </Text>}
          </Center>
        </>} />
    );
  }
  return (
    <AssignPicker key={role} opened onClose={onClose} title="Assign Users" header={header} users={available} selected={[]}
      suggestions={suggestions.data} suggestionsLoading={suggestions.isPending}
      hasTaskText={[task.title, task.subject, task.instructions].some((v) => (v ?? '').trim())}
      onConfirm={async (ids) => {
        const skipped = await api.tasks.assign(task.id, ids, role);
        await onAssigned();
        notifySuccess(skipped.length
          ? `Assigned ${ids.length - skipped.length}; ${skipped.length} skipped (already assigned or outside your role).`
          : `Assigned ${ids.length} ${ids.length === 1 ? 'person' : 'people'}.`);
      }} />
  );
}

// ── Side panels ───────────────────────────────────────────────────────────────

function TypeLabel({ type }: { type?: string | null }) {
  const isFile = type === 'file';
  const isAttendance = type === 'attendance'; // auto-completed from attending an event activity
  const label = isAttendance ? 'Event Attendance' : isFile ? 'File Attachment' : 'Link Submission';
  const Icon = isAttendance ? IconUserCheck : isFile ? IconPaperclip : IconLink;
  const green = isFile || isAttendance;
  return (
    <Badge radius={6} tt="none" size="sm" leftSection={<Icon size={11} />}
      style={{ background: green ? '#F0FDF4' : colors.blueBg, color: green ? colors.green : colors.accent }}>
      {label}
    </Badge>
  );
}

function ReportBody({ r }: { r: Report }) {
  return (
    <Stack gap={8}>
      <TypeLabel type={r.report_type} />
      <Text size="sm" fw={500}>{r.report_title}</Text>
      {r.report_description && <Text size="sm" c="dimmed" className="tn-prewrap">{r.report_description}</Text>}
      {r.report_filename && r.report_file_path && (
        <Group wrap="nowrap" gap={6} px={10} py={8} style={{ background: '#F0FDF4', borderRadius: 6, border: '1px solid rgba(34,197,94,0.25)' }}>
          <IconFile size={14} color={colors.green} />
          <Text size="xs" truncate style={{ flex: 1 }}>{r.report_filename}</Text>
          <Button component="a" href={resolveUrl(r.report_file_path)} download={r.report_filename} target="_blank"
            size="compact-xs" color="green" leftSection={<IconDownload size={12} />}>Download</Button>
        </Group>
      )}
      {r.report_link_url && (
        <Anchor href={/^https?:/i.test(r.report_link_url) ? r.report_link_url : `https://${r.report_link_url}`}
          target="_blank" rel="noreferrer" size="xs">
          <Group wrap="nowrap" gap={6} px={10} py={8} style={{ background: colors.blueBg, borderRadius: 6 }}>
            <IconLink size={14} />
            <Text size="xs" truncate td="underline" style={{ flex: 1 }}>{r.report_link_url}</Text>
            <IconExternalLink size={13} />
          </Group>
        </Anchor>
      )}
    </Stack>
  );
}

const REPORT_TONE: Record<string, Tone> = { Completed: 'green', Missing: 'red', Pending: 'amber' };

function ReviewPanel({ task, report, comments, ownActions, onSend, onChanged }: {
  task: Task; report: Report | null; comments: Comment[]; ownActions: (c: Comment) => object;
  onSend: (c: string) => Promise<void>; onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!report) {
    return (
      <Paper p={20} radius="lg" withBorder>
        <Text fw={700}>Submission</Text>
        <Stack align="center" gap={6} py="xl">
          <ThemeIcon size={56} radius="xl" style={{ background: '#EEF2FA', color: colors.textMuted }}><IconFileDescription /></ThemeIcon>
          <Text size="sm" fw={500}>{task.reports?.length ? 'No submission selected' : 'No submissions yet'}</Text>
          <Text size="xs" c="dimmed" ta="center">
            {task.reports?.length ? 'Choose someone marked "Pending review" or "Completed" to read their report.'
              : 'Reports appear here once assignees submit.'}
          </Text>
        </Stack>
      </Paper>
    );
  }
  const mark = async (status: 'Completed' | 'Missing') => {
    setBusy(status);
    try {
      await api.reports.setStatus(report.id, status);
      await onChanged();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Paper p={20} radius="lg" withBorder>
      <Text size="xs" c="dimmed" mb={6}>Submission</Text>
      <Group wrap="nowrap" gap={10}>
        <UserAvatar name={report.full_name ?? '?'} size={36} />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} truncate>{report.full_name}</Text>
          {report.grade_level && <Text size="xs" c="dimmed">{report.grade_level}</Text>}
        </Box>
        <Pill label={report.report_status} tone={REPORT_TONE[report.report_status] ?? 'amber'} />
      </Group>
      <Box mt={16} p={14} style={{ background: '#F8FAFC', borderRadius: 10, border: '1px solid var(--tn-border)' }}>
        <ReportBody r={report} />
      </Box>
      <Text size="xs" c="dimmed" mt={12} mb={6}>Mark this submission as</Text>
      <Group gap={8}>
        <Button size="xs" variant="outline" color="green" loading={busy === 'Completed'} onClick={() => void mark('Completed')}>Completed</Button>
        <Button size="xs" variant="outline" color="red" loading={busy === 'Missing'} onClick={() => void mark('Missing')}>Missing</Button>
      </Group>
      <Divider my={16} />
      <Group gap={6}><IconLock size={15} color={colors.textMuted} /><Text fw={700}>Private comments</Text></Group>
      <Text size="xs" c="dimmed" mt={4} mb={10}>Only visible to the submitter and reviewers.</Text>
      {comments.length ? comments.map((c) => <CommentItem key={c.id} comment={c} {...ownActions(c)} />)
        : <Text size="sm" c="dimmed" mb={6}>No private comments yet.</Text>}
      <CommentInput placeholder="Add private comment..." onSend={onSend} />
    </Paper>
  );
}

function SubmitPanel({ task, ownActions, onSend, onChanged }: {
  task: Task; ownActions: (c: Comment) => object; onSend: (c: string) => Promise<void>; onChanged: () => Promise<unknown>;
}) {
  const report = task.my_report;
  // Recorded in the task log without a report (e.g. marked done before reports existed).
  const logged = !report && task.submission_status === 'submitted';
  return (
    <Stack gap={14}>
      <Text fw={700} size="lg">Your Submission</Text>
      {!report && !logged && <PointsPreview task={task} />}
      {report ? <SubmittedState task={task} report={report} onChanged={onChanged} />
        : logged ? <LoggedSubmission /> : <ReportForm task={task} onChanged={onChanged} />}
      <Paper radius="lg" withBorder>
        <Text fw={700} size="sm" p={16} pb={10}>Private Comments</Text>
        <Box px={16}>
          {task.private_comments?.length ? task.private_comments.map((c) => <CommentItem key={c.id} comment={c} {...ownActions(c)} />)
            : <Text size="sm" c="dimmed" pb={12}>No private comments yet.</Text>}
        </Box>
        <Divider />
        <InlineCommentInput onSend={onSend} />
      </Paper>
    </Stack>
  );
}

function LoggedSubmission() {
  return (
    <Group wrap="nowrap" gap={10} p={12} style={{ background: colors.greenBg, borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)' }}>
      <IconCircleCheckFilled size={20} color={colors.green} />
      <div>
        <Text fw={700} size="sm" c={colors.green}>Submitted</Text>
        <Text size="xs" c={colors.green} opacity={0.75}>Recorded in the task log; there is no report file to show.</Text>
      </div>
    </Group>
  );
}

function PointsPreview({ task }: { task: Task }) {
  const rows: [string, string, string][] = [
    ['Early Submission', `+${task.points_early ?? 100}`, '#6EE7B7'],
    ['On Time', `+${task.points_ontime ?? 100}`, '#93C5FD'],
    ['Late (within 24h)', `+${task.points_late24 ?? 50}`, '#FCD34D'],
    ['Late (after 24h)', `${task.points_after24 ?? 0}`, '#F87171'],
  ];
  return (
    <Paper p={14} radius="md" bg={colors.dark}>
      <Group gap={6} mb={10}><IconBolt size={16} color="#FBBF24" /><Text c="white" fw={700} size="sm">Points You Can Earn</Text></Group>
      {rows.map(([label, value, color]) => (
        <Group key={label} justify="space-between" mb={6}>
          <Text size="xs" c="rgba(255,255,255,0.7)">{label}</Text>
          <Text size="sm" fw={700} c={color}>{value}</Text>
        </Group>
      ))}
    </Paper>
  );
}

function ReportForm({ task, onChanged }: { task: Task; onChanged: () => Promise<unknown> }) {
  const [kind, setKind] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const hasContent = kind === 'file' ? !!file : !!link.trim();

  const submit = async () => {
    setBusy(true);
    try {
      await api.tasks.submitReport(task.id, {
        report_title: kind === 'link' ? link.trim() : file?.name ?? 'File submission',
        report_type: kind,
        ...(kind === 'link' ? { report_link_url: link.trim() } : {}),
      });
      if (kind === 'file' && file) {
        try {
          await api.tasks.uploadReportFile(task.id, file, file.name);
        } catch (e) {
          notifyError(e, 'The report was submitted but the file upload failed');
        }
      }
      notifySuccess('Report submitted');
      await onChanged();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap={10}>
      <Paper p={16} radius="lg" withBorder>
        <Text fw={700} size="sm" mb={8}>Files & Links</Text>
        <SegmentedControl fullWidth value={kind} onChange={(v) => setKind(v as 'file' | 'link')} mb={10}
          data={[{ value: 'file', label: 'File' }, { value: 'link', label: 'Link' }]} />
        {kind === 'file' ? (
          <FileButton onChange={setFile}>
            {(props) => (
              <Button {...props} variant="default" fullWidth leftSection={<IconFile size={16} />}>
                {file ? file.name : 'Select A File'}
              </Button>
            )}
          </FileButton>
        ) : (
          <TextInput placeholder="www.example.com" rightSection={<IconLink size={18} />}
            value={link} onChange={(e) => setLink(e.currentTarget.value)} />
        )}
      </Paper>
      <Button color="ink.8" size="md" leftSection={<IconSend size={16} />} disabled={!hasContent} loading={busy}
        onClick={() => void submit()}>
        Submit Report
      </Button>
    </Stack>
  );
}

function SubmittedState({ task, report, onChanged }: { task: Task; report: Report; onChanged: () => Promise<unknown> }) {
  const { points, reason } = reportPoints(task, report);
  const [busy, setBusy] = useState(false);
  const unsubmit = async () => {
    setBusy(true);
    try {
      await api.reports.remove(report.id);
      await onChanged();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack gap={10}>
      <Group wrap="nowrap" gap={10} p={12} style={{ background: colors.greenBg, borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)' }}>
        <IconCircleCheckFilled size={20} color={colors.green} />
        <div>
          <Text fw={700} size="sm" c={colors.green}>Submitted</Text>
          <Text size="xs" c={colors.green} opacity={0.75}>Your report has been received</Text>
        </div>
      </Group>
      <Paper p={14} radius="md" withBorder><ReportBody r={report} /></Paper>
      <Paper p={16} radius="md" bg={colors.dark}>
        <Text size="xs" c="rgba(255,255,255,0.65)">Points Earned</Text>
        <Text fz={28} fw={800} c="white">+{points}</Text>
        <Text size="xs" c="rgba(255,255,255,0.65)">{reason}</Text>
        {report.report_date && (
          <Group gap={4} mt={10}>
            <IconClock size={12} color="rgba(255,255,255,0.5)" />
            <Text size="xs" c="rgba(255,255,255,0.55)">Submitted: {formatDateTime(parseTimestamp(report.report_date))}</Text>
          </Group>
        )}
      </Paper>
      <Button color="#3D4350" size="md" loading={busy} onClick={() => void unsubmit()}>Unsubmit</Button>
    </Stack>
  );
}

function InlineCommentInput({ onSend }: { onSend: (c: string) => Promise<void> }) {
  const user = useUser();
  const [text, setText] = useState('');
  const send = async () => {
    if (!text.trim()) return;
    await onSend(text.trim());
    setText('');
  };
  return (
    <Group wrap="nowrap" gap={10} p={12}>
      <UserAvatar name={user.full_name} size={40} />
      <TextInput radius="xl" style={{ flex: 1 }} placeholder="Add a private comment…" value={text}
        onChange={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
        rightSection={(
          <ActionIcon radius="xl" size={28} color={text.trim() ? 'brand' : 'gray'} variant="filled"
            disabled={!text.trim()} onClick={() => void send()} aria-label="Send comment">
            <IconSend size={14} />
          </ActionIcon>
        )} />
    </Group>
  );
}
