import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Divider, Grid, Group, Loader, Modal, Paper, Pill, Stack, Text, Textarea, TextInput,
  ThemeIcon, Title, UnstyledButton,
} from '@mantine/core';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import {
  IconCalendarEvent, IconCalendar, IconChevronRight, IconClock, IconFileDescription, IconLibrary,
  IconSparkles, IconUsersGroup,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, qk, to12h, to24h, useUser, type Attachment, type AssigneeSuggestion, type Task, type TaskTemplate,
} from '@tasknet/shared';
import { AssignPicker, AssignRoleSelector } from '../../components/AssignPicker';
import { AttachmentEditor } from '../../components/Attachments';
import { ErrorState, notifyError, notifySuccess, PageLoader, UserAvatar } from '../../components/ui';
import { colors } from '../../theme';

interface Props {
  category: 'common' | 'special';
  /** creating a reusable template instead of a task */
  template?: boolean;
}

/** Create a task / special task / template, or edit a task (route has :id). */
export function TaskFormPage(props: Props) {
  const { id } = useParams();
  const existing = useQuery({
    queryKey: qk.task(Number(id)), queryFn: () => api.tasks.get(Number(id)), enabled: !!id,
  });
  if (id && existing.isPending) return <PageLoader />;
  if (id && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  return <TaskForm key={id ?? 'new'} {...props} task={existing.data} />;
}

function TaskForm({ category, template = false, task }: Props & { task?: Task }) {
  const user = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = !!task;
  const effectiveCategory = task?.task_category ?? category;
  const listPath = effectiveCategory === 'special' ? '/special-tasks' : '/tasks';

  const [title, setTitle] = useState(task?.title ?? '');
  const [subject] = useState(task?.subject ?? '');
  const [instructions, setInstructions] = useState(task?.instructions ?? '');
  const [startDate, setStartDate] = useState<string | null>(task?.start_date?.slice(0, 10) ?? null);
  const [endDate, setEndDate] = useState<string | null>(task?.end_date?.slice(0, 10) ?? null);
  const [dueTime, setDueTime] = useState<string>(to24h(task?.due_time) ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const roleOptions = template ? [] : user.assignable_roles;
  const [targetRole, setTargetRole] = useState<string | null>(roleOptions[0] ?? null);
  const originalIds = (task?.assigned_users ?? []).map((u) => u.id);
  const [selected, setSelected] = useState<number[]>(originalIds);
  // Identity each newly added person receives the task as (remembered per person).
  const [addedAs, setAddedAs] = useState<Record<number, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AssigneeSuggestion[] | undefined>();
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const assignable = useQuery({
    queryKey: qk.assignable(targetRole), queryFn: () => api.users.assignable(targetRole), enabled: !template,
  });

  const hasTaskText = [title, subject, instructions].some((s) => s.trim());

  const openPicker = () => {
    setPickerOpen(true);
    setSuggestions(undefined);
    setSuggestionsLoading(true);
    api.users.suggestions({
      targetRole, title, subject, instructions, taskCategory: effectiveCategory,
      startDate, endDate, dueTime: to12h(dueTime),
    }).then(setSuggestions, () => setSuggestions(undefined)) // suggestions are an aid only
      .finally(() => setSuggestionsLoading(false));
  };

  const changeRole = (r: string) => {
    if (r === targetRole) return;
    setTargetRole(r);
    if (!editing) setSelected([]); // a new task's people must hold the chosen role
  };

  const onPicked = (ids: number[]) => {
    setSelected(ids);
    if (editing && targetRole) {
      setAddedAs((prev) => Object.fromEntries(ids.filter((i) => !originalIds.includes(i))
        .map((i) => [i, prev[i] ?? targetRole])));
    }
  };

  const applyTemplate = (t: TaskTemplate) => {
    setTitle(t.title);
    setInstructions(t.instructions ?? '');
    if (t.start_date) setStartDate(t.start_date.slice(0, 10));
    if (t.end_date) setEndDate(t.end_date.slice(0, 10));
    if (t.due_time) setDueTime(to24h(t.due_time) ?? '');
    setTemplatesOpen(false);
  };

  const submit = async () => {
    if (!title.trim()) return notifyError(new Error(`${template ? 'Template' : 'Task'} title is required`));
    setSaving(true);
    const base = {
      title: title.trim(),
      instructions: instructions.trim() || undefined,
      start_date: startDate ?? undefined,
      end_date: endDate ?? undefined,
      due_time: to12h(dueTime) ?? undefined,
    };
    try {
      if (template) {
        await api.templates.create({ ...base, instructions: base.instructions ?? null, points_early: 100,
          points_ontime: 100, points_late24: 50, points_after24: 0 });
        notifySuccess('Template saved');
      } else if (editing && task) {
        await api.tasks.update(task.id, { ...base, ...(subject.trim() ? { subject: subject.trim() } : {}),
          ...(attachments.length ? { attachments } : {}) });
        // Assignment changes go through the assign endpoints, which enforce the hierarchy.
        const byRole = new Map<string, number[]>();
        for (const [uid, role] of Object.entries(addedAs)) byRole.set(role, [...(byRole.get(role) ?? []), Number(uid)]);
        let skipped = 0;
        for (const [role, ids] of byRole) skipped += (await api.tasks.assign(task.id, ids, role)).length;
        for (const uid of originalIds.filter((i) => !selected.includes(i))) await api.tasks.unassign(task.id, uid);
        if (skipped) {
          notifyError(new Error(`${skipped} ${skipped === 1 ? 'person was' : 'people were'} not assigned — outside what your role may assign.`));
        }
        notifySuccess('Task updated');
      } else {
        await api.tasks.create({ ...base, task_category: effectiveCategory, target_role: targetRole,
          ...(subject.trim() ? { subject: subject.trim() } : {}), assigned_user_ids: selected, attachments });
        notifySuccess(effectiveCategory === 'special' ? 'Special task created' : 'Task created');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.allTasks }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard }),
        task && queryClient.invalidateQueries({ queryKey: qk.task(task.id) }),
      ]);
      navigate(editing && task ? `${listPath}/${task.id}` : listPath);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  const isSpecial = effectiveCategory === 'special';
  const pageTitle = editing ? 'Edit Task' : template ? 'Create Template' : isSpecial ? 'Create Special Task' : 'Create Task';
  const subtitle = editing ? 'Update the details, schedule and people.'
    : template ? 'Save a reusable task outline.'
      : isSpecial ? 'Special tasks are appraised separately from regular duties.'
        : 'Describe the task, set when it is due, then choose who does it.';

  // People shown as selected: from the assignable list, plus already-assigned
  // people no longer in it (e.g. after a role change).
  const known = new Map([...(task?.assigned_users ?? []), ...(assignable.data ?? [])].map((u) => [u.id, u]));
  const selectedUsers = selected.map((i) => known.get(i)).filter((u) => !!u);

  return (
    <Box maw={1240} mx="auto">
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} fz={24} fw={800}>{pageTitle}</Title>
          <Text c="dimmed" size="sm" mt={4}>{subtitle}</Text>
        </div>
        {!template && !editing && (
          <Button variant="outline" bg="white" leftSection={<IconLibrary size={16} />} onClick={() => setTemplatesOpen(true)}>
            Use template
          </Button>
        )}
      </Group>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Section icon={<IconFileDescription size={16} />} title="Task details">
            <TextInput label={template ? 'Template name' : 'Title'} required
              placeholder={template ? 'e.g. Quarterly report' : 'e.g. First aid station for the sports fest'}
              value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
            <Textarea label="Instructions" autosize minRows={7} maxRows={14}
              placeholder="What needs to be done, what to submit, and anything the assignee should know."
              value={instructions} onChange={(e) => setInstructions(e.currentTarget.value)} />
            {!template && (
              <div>
                <Text size="sm" fw={500} mb={6}>Attachments</Text>
                <AttachmentEditor value={attachments} onChange={setAttachments} />
                {editing && !!task?.attachments?.length && (
                  <Text size="xs" c="dimmed" mt={6}>
                    {task.attachments.length} existing attachment{task.attachments.length > 1 ? 's are' : ' is'} kept; files added here are appended.
                  </Text>
                )}
              </div>
            )}
          </Section>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="lg">
            <Section icon={<IconCalendarEvent size={16} />} title="Schedule">
              <DatePickerInput label="Start date" placeholder="Not set" clearable valueFormat="ddd, MMM D, YYYY"
                leftSection={<IconCalendar size={18} />} value={startDate} onChange={setStartDate} />
              <DatePickerInput label="Due date" placeholder="Not set" clearable valueFormat="ddd, MMM D, YYYY"
                leftSection={<IconCalendarEvent size={18} />} value={endDate} onChange={setEndDate} />
              <TimePicker label="Due time" format="12h" withDropdown clearable leftSection={<IconClock size={18} />}
                value={dueTime} onChange={setDueTime} />
            </Section>

            {!template && (
              <Section icon={<IconUsersGroup size={16} />} title="Assignment">
                {roleOptions.length >= 2 && (
                  <div>
                    <Text size="sm" fw={500} mb={6}>Assign as</Text>
                    <AssignRoleSelector options={roleOptions} value={targetRole} onChange={changeRole} />
                    {editing && <Text size="xs" c="dimmed" mt={4}>Filters who you can add. People already assigned stay assigned.</Text>}
                  </div>
                )}
                <div>
                  <Text size="sm" fw={500} mb={8}>People</Text>
                  {selectedUsers.length === 0 ? <Text size="xs" c="dimmed">No one selected yet.</Text> : (
                    <Group gap={6}>
                      {selectedUsers.map((u) => (
                        <Pill key={u.id} size="lg" withRemoveButton bg="white"
                          style={{ border: `1px solid ${colors.border}` }}
                          onRemove={() => onPicked(selected.filter((i) => i !== u.id))}>
                          <Group gap={6} wrap="nowrap"><UserAvatar name={u.full_name} size={20} />{u.full_name}</Group>
                        </Pill>
                      ))}
                    </Group>
                  )}
                </div>
                <Button variant="outline" fullWidth leftSection={assignable.isFetching ? <Loader size={14} /> : <IconSparkles size={16} />}
                  disabled={assignable.isFetching || !assignable.data?.length} onClick={openPicker}>
                  {selectedUsers.length ? 'Change people' : 'Choose people'}
                </Button>
                {assignable.data?.length === 0 && <Text size="xs" c="dimmed">There is no one you can assign as this role.</Text>}
                <Text size="xs" c="dimmed">
                  Suggestions match the title and instructions against each person&apos;s skills and certifications, and weigh their current workload.
                </Text>
              </Section>
            )}
          </Stack>
        </Grid.Col>
      </Grid>

      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={() => navigate(editing && task ? `${listPath}/${task.id}` : listPath)}>Cancel</Button>
        <Button color="ink.8" loading={saving} onClick={() => void submit()}>
          {editing ? 'Save changes' : template ? 'Save template' : isSpecial ? 'Create special task' : 'Create task'}
        </Button>
      </Group>

      {pickerOpen && (
        <AssignPicker opened onClose={() => setPickerOpen(false)} users={assignable.data ?? []} selected={selected}
          onChange={onPicked} suggestions={suggestions} suggestionsLoading={suggestionsLoading} hasTaskText={hasTaskText} />
      )}
      <TemplatePicker opened={templatesOpen} onClose={() => setTemplatesOpen(false)} onPick={applyTemplate} />
    </Box>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Paper p={20} radius="lg" withBorder>
      <Group gap={10}>
        <ThemeIcon size={30} radius={8} style={{ background: '#EEF2FA', color: colors.dark }}>{icon}</ThemeIcon>
        <Text fw={700}>{title}</Text>
      </Group>
      <Divider my={14} />
      <Stack gap="md">{children}</Stack>
    </Paper>
  );
}

function TemplatePicker({ opened, onClose, onPick }: { opened: boolean; onClose: () => void; onPick: (t: TaskTemplate) => void }) {
  const templates = useQuery({ queryKey: qk.templates, queryFn: api.templates.list, enabled: opened });
  return (
    <Modal opened={opened} onClose={onClose} title={<Group gap={8}><IconLibrary size={18} color={colors.accent} /><Text fw={600}>Use a Template</Text></Group>}>
      {templates.isPending ? <Group justify="center" py="xl"><Loader /></Group>
        : !templates.data?.length ? <Text c="dimmed" ta="center" py="xl" size="sm">No templates yet.</Text>
          : templates.data.map((t) => (
            <UnstyledButton key={t.id} onClick={() => onPick(t)} w="100%" py={12} style={{ borderBottom: '1px solid var(--tn-border)' }}>
              <Group wrap="nowrap" gap={12}>
                <ThemeIcon size={38} radius={10} style={{ background: colors.blueBg, color: colors.accent }}><IconFileDescription size={18} /></ThemeIcon>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500}>{t.title}</Text>
                  {t.instructions && <Text size="xs" c="dimmed" truncate>{t.instructions.replace(/\n/g, ' ')}</Text>}
                  {t.created_by_name && <Text size="10px" c="dimmed">By {t.created_by_name}</Text>}
                </Box>
                <IconChevronRight size={16} color={colors.textMuted} />
              </Group>
            </UnstyledButton>
          ))}
    </Modal>
  );
}
