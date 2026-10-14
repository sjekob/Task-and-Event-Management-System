import { useMemo, useState } from 'react';
import {
  ActionIcon, Badge, Box, Button, Chip, Group, Loader, Modal, Paper, Select, Stack, Switch, Text,
  Textarea, TextInput, Title, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconListCheck, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, DEPED_BG, DEPED_CATEGORIES, DEPED_COLOR, depedRangeLabel, parseIsoDate, qk, startOfDay,
  type DepedCategory, type DepedEntry,
} from '@tasknet/shared';
import { ErrorState, notifyError, notifySuccess } from './ui';

/** "DepEd Memo" tag used wherever official DepEd dates appear. */
export function DepedTag() {
  return <Badge radius="xl" tt="none" fw={700} style={{ background: DEPED_BG, color: DEPED_COLOR }}>DepEd Memo</Badge>;
}

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Teachers', dean: 'Deans', coordinator: 'Coordinators', registrar: 'Registrars',
};

/**
 * Principal/admin: turn a DepEd calendar entry into one mandatory task
 * assigned to every active faculty member in the chosen roles.
 */
export function DepedTaskModal({ opened, onClose, onDone }: {
  opened: boolean; onClose: () => void; onDone: (assigned: number) => void;
}) {
  const entries = useQuery({ queryKey: qk.deped(), queryFn: () => api.depedCalendar.list(), enabled: opened });
  const [entryId, setEntryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>(['teacher']);

  // Upcoming entries first, then past ones (most recent first).
  const ordered = useMemo(() => {
    const today = startOfDay(new Date());
    const all = entries.data ?? [];
    const ended = (e: DepedEntry) => (parseIsoDate(e.end_date) ?? today) < today;
    return [...all.filter((e) => !ended(e)), ...all.filter(ended).reverse()];
  }, [entries.data]);

  const generate = useMutation({
    mutationFn: () => api.depedCalendar.generateTasks(Number(entryId), {
      title: title.trim(), instructions: instructions.trim() || undefined, due_date: due ?? undefined, roles,
    }),
    onSuccess: (res) => {
      onDone(res.assigned);
      setEntryId(null);
      setTitle('');
      setInstructions('');
      setDue(null);
    },
    onError: (e) => notifyError(e),
  });

  const select = (id: string | null) => {
    setEntryId(id);
    const e = ordered.find((x) => String(x.id) === id);
    if (e) {
      setTitle(e.category === 'Quarter Compliance' ? e.title : `${e.title} Compliance`);
      setDue(e.end_date);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} size="lg"
      title={<Group gap="sm"><Text fw={700}>Generate from DepEd Calendar</Text><DepedTag /></Group>}>
      {entries.isError ? <ErrorState error={entries.error} /> : entries.isPending ? <Loader /> : (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">Creates one mandatory task assigned to every active faculty account in the selected roles.</Text>
          <Select label="DepEd calendar entry" searchable value={entryId} onChange={select}
            data={ordered.map((e) => ({ value: String(e.id), label: `${e.title}  ·  ${depedRangeLabel(e)}` }))} />
          <TextInput label="Task title" placeholder="e.g. Submit Quarter 1 Grades & Appraisal"
            value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <Textarea label="Instructions (optional)" autosize minRows={3}
            placeholder="Defaults to a note naming the DepEd entry and its dates"
            value={instructions} onChange={(e) => setInstructions(e.currentTarget.value)} />
          <DatePickerInput label="Due date" placeholder="Defaults to the entry's end date" clearable
            value={due} onChange={(v) => setDue(v)} valueFormat="YYYY-MM-DD" />
          <Text size="sm" fw={600}>Assign to</Text>
          <Chip.Group multiple value={roles} onChange={setRoles}>
            <Group gap={8}>
              {Object.entries(ROLE_LABELS).map(([k, label]) => <Chip key={k} value={k}>{label}</Chip>)}
            </Group>
          </Chip.Group>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} disabled={generate.isPending}>Cancel</Button>
            <Button color="ink.8" leftSection={<IconListCheck size={18} />} loading={generate.isPending}
              disabled={!entryId || !title.trim() || !roles.length} onClick={() => generate.mutate()}>
              Generate tasks
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

/** List of DepEd calendar entries with add / edit / remove (principal/admin). */
export function DepedCalendarManager() {
  const queryClient = useQueryClient();
  const entries = useQuery({ queryKey: qk.deped(), queryFn: () => api.depedCalendar.list() });
  const [editing, setEditing] = useState<DepedEntry | 'new' | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => api.depedCalendar.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.allDeped }),
    onError: (e) => notifyError(e),
  });

  const confirmRemove = (e: DepedEntry) => modals.openConfirmModal({
    title: `Remove "${e.title}"?`,
    children: <Text size="sm">It disappears from every calendar and no longer triggers date warnings. Tasks already generated from it are kept.</Text>,
    labels: { confirm: 'Remove', cancel: 'Keep it' },
    confirmProps: { color: 'red' },
    onConfirm: () => remove.mutate(e.id),
  });

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Group gap="sm"><Title order={3} fz={18}>DepEd school calendar</Title><DepedTag /></Group>
        <Button color="ink.8" leftSection={<IconPlus size={18} />} onClick={() => setEditing('new')}>Add DepEd date</Button>
      </Group>
      <Text size="xs" c="dimmed">
        Official memorandum dates shown on every calendar. Mandatory entries warn proponents who pick an
        overlapping event date. Confirm the baseline dates against the DepEd Order for the school year.
      </Text>
      <Paper radius="lg" withBorder>
        {entries.isError ? <Box p="md"><ErrorState error={entries.error} /></Box>
          : entries.isPending ? <Group p="xl" justify="center"><Loader /></Group>
            : !entries.data.length ? <Text p="md" size="sm" c="dimmed">No DepEd dates yet.</Text>
              : entries.data.map((e) => (
                <Group key={e.id} px="md" py="sm" wrap="nowrap" style={{ borderBottom: '1px solid var(--tn-border)' }}>
                  <Box w={6} h={36} style={{ background: DEPED_COLOR, borderRadius: 3, flexShrink: 0 }} />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600}>{e.title}</Text>
                    <Text size="xs" c="dimmed">{depedRangeLabel(e)} · {e.category}{e.is_mandatory ? ' · Mandatory' : ''}</Text>
                  </Box>
                  <Tooltip label="Edit">
                    <ActionIcon variant="subtle" color="gray" onClick={() => setEditing(e)} aria-label="Edit"><IconPencil size={18} /></ActionIcon>
                  </Tooltip>
                  <Tooltip label="Remove">
                    <ActionIcon variant="subtle" color="red" onClick={() => confirmRemove(e)} aria-label="Remove"><IconTrash size={18} /></ActionIcon>
                  </Tooltip>
                </Group>
              ))}
      </Paper>
      {editing && (
        <DepedEntryModal existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Stack>
  );
}

function DepedEntryModal({ existing, onClose }: { existing: DepedEntry | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [start, setStart] = useState<string | null>(existing?.start_date ?? null);
  const [end, setEnd] = useState<string | null>(existing?.end_date ?? null);
  const [category, setCategory] = useState<DepedCategory>(existing?.category ?? DEPED_CATEGORIES[0]);
  const [mandatory, setMandatory] = useState(existing?.is_mandatory ?? true);

  const save = useMutation({
    mutationFn: () => api.depedCalendar.save(existing?.id ?? null, {
      title: title.trim(), description: description.trim() || null, start_date: start!,
      end_date: end ?? start!, category, is_mandatory: mandatory,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.allDeped });
      notifySuccess(existing ? 'DepEd date updated' : 'DepEd date added');
      onClose();
    },
    onError: (e) => notifyError(e),
  });

  return (
    <Modal opened onClose={onClose} title={existing ? 'Edit DepEd date' : 'Add DepEd date'} size="md">
      <Stack gap="sm">
        <TextInput label="Title" placeholder="e.g. First Quarter Examinations" value={title}
          onChange={(e) => setTitle(e.currentTarget.value)} />
        <Group grow>
          <DatePickerInput label="Start date" placeholder="Select" value={start} valueFormat="YYYY-MM-DD"
            onChange={(v) => { setStart(v); if (v && end && end < v) setEnd(v); }} />
          <DatePickerInput label="End date" placeholder="Same as start" clearable value={end} valueFormat="YYYY-MM-DD"
            minDate={start ? parseIsoDate(start) ?? undefined : undefined} onChange={setEnd} />
        </Group>
        <Select label="Category" allowDeselect={false} value={category} data={[...DEPED_CATEGORIES]}
          onChange={(v) => v && setCategory(v as DepedCategory)} />
        <Switch label="Mandatory" description="Warn proponents who schedule an event on these dates"
          checked={mandatory} onChange={(e) => setMandatory(e.currentTarget.checked)} />
        <Textarea label="Description (optional)" autosize minRows={2} value={description}
          onChange={(e) => setDescription(e.currentTarget.value)} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button color="ink.8" loading={save.isPending} disabled={!title.trim() || !start} onClick={() => save.mutate()}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

