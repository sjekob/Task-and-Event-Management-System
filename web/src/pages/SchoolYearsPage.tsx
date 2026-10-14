import { useState } from 'react';
import {
  ActionIcon, Badge, Box, Button, CloseButton, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, TextInput,
  ThemeIcon, Title, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { IconArchive, IconInfoCircle, IconPencil, IconPlus, IconSchool, IconTrash } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, api, formatIsoDate, isoDate, parseIsoDate, qk, type SchoolYear } from '@tasknet/shared';
import { DepedCalendarManager } from '../components/deped';
import { ErrorState, notifyError, notifySuccess, PageBanner } from '../components/ui';
import { colors } from '../theme';

const STATUS: Record<string, [string, string, string]> = {
  current: ['Current', '#15803D', colors.greenBg],
  archived: ['Archived', '#92400E', colors.amberBg],
  upcoming: ['Upcoming', colors.accent, colors.blueBg],
};

function StatusChip({ status }: { status: string }) {
  const [label, fg, bg] = STATUS[status] ?? STATUS.upcoming;
  return <Badge radius="xl" tt="none" fw={700} size="sm" style={{ background: bg, color: fg }}>{label}</Badge>;
}

const range = (a: string, b: string) => `${formatIsoDate(a)} – ${formatIsoDate(b)}`;

/**
 * Principal/admin: when each school year and its terms start and end. Records
 * dated in a school year that has ended are archived (lists show the current
 * year by default; older years stay viewable from each page's selector).
 */
export function SchoolYearsPage() {
  const queryClient = useQueryClient();
  const years = useQuery({ queryKey: qk.schoolYears, queryFn: api.schoolYears.list });
  const [editing, setEditing] = useState<SchoolYear | 'new' | null>(null);

  const remove = (y: SchoolYear) => modals.openConfirmModal({
    title: `Remove S.Y. ${y.name}?`,
    children: <Text size="sm">Only the calendar entry is removed. Tasks, events and appraisal records are kept; they just stop being grouped under this school year.</Text>,
    labels: { confirm: `Remove S.Y. ${y.name}`, cancel: 'Keep it' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await api.schoolYears.remove(y.id);
        await queryClient.invalidateQueries({ queryKey: qk.schoolYears });
      } catch (e) {
        notifyError(e);
      }
    },
  });

  return (
    <Stack gap="md">
      <PageBanner title="School Year"
        subtitle="Set when each school year and term starts and ends. Records from school years that have ended are archived automatically." />
      <Group justify="space-between">
        <Title order={3} fz={18}>School years</Title>
        <Button color="ink.8" leftSection={<IconPlus size={18} />} onClick={() => setEditing('new')}>Add school year</Button>
      </Group>
      {years.isPending ? <Group justify="center" p={40}><Loader /></Group>
        : years.isError ? <ErrorState error={years.error} onRetry={() => years.refetch()} />
          : !years.data.length ? (
            <Paper p={18} radius="lg" withBorder>
              <Group wrap="nowrap">
                <IconInfoCircle color={colors.textMuted} />
                <Text size="sm" c="dimmed">No school year set up yet, so nothing is archived. Add the current school year and its terms to start grouping tasks, events and appraisals by year.</Text>
              </Group>
            </Paper>
          ) : years.data.map((y) => (
            <Paper key={y.id} p={18} radius="lg" withBorder>
              <Group wrap="nowrap">
                <ThemeIcon size={40} radius={10} style={{ background: '#EEF2FA', color: colors.dark }}>
                  {y.status === 'archived' ? <IconArchive size={20} /> : <IconSchool size={20} />}
                </ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Group gap={10}><Text fw={700}>S.Y. {y.name}</Text><StatusChip status={y.status} /></Group>
                  <Text size="sm" c="dimmed">{range(y.start_date, y.end_date)}</Text>
                </Box>
                <Tooltip label={`Edit S.Y. ${y.name}`}>
                  <ActionIcon variant="subtle" color="gray" onClick={() => setEditing(y)} aria-label={`Edit S.Y. ${y.name}`}><IconPencil size={20} /></ActionIcon>
                </Tooltip>
                <Tooltip label={`Remove S.Y. ${y.name}`}>
                  <ActionIcon variant="subtle" color="gray" onClick={() => remove(y)} aria-label={`Remove S.Y. ${y.name}`}><IconTrash size={20} /></ActionIcon>
                </Tooltip>
              </Group>
              {!y.terms.length ? (
                <Text size="xs" c="dimmed" mt={14}>No terms set — add quarters/terms to filter appraisals by term.</Text>
              ) : (
                <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={10} mt={14}>
                  {y.terms.map((t) => (
                    <Box key={t.id} p={12} style={{
                      borderRadius: 10, background: t.status === 'current' ? '#F0FDF4' : '#F8FAFC',
                      border: `1px solid ${t.status === 'current' ? '#86EFAC' : '#E2E8F0'}`,
                    }}>
                      <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={700} truncate>{t.name}</Text><StatusChip status={t.status} /></Group>
                      <Text size="xs" c="dimmed" mt={4}>{range(t.start_date, t.end_date)}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Paper>
          ))}
      <Box mt="md"><DepedCalendarManager /></Box>
      {editing && <SchoolYearModal existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

const TERM_NAMES = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
interface TermDraft { name: string; start: string | null; end: string | null }

function SchoolYearModal({ existing, onClose }: { existing: SchoolYear | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(existing?.name ?? '');
  const [start, setStart] = useState<string | null>(existing?.start_date ?? null);
  const [end, setEnd] = useState<string | null>(existing?.end_date ?? null);
  const [terms, setTerms] = useState<TermDraft[]>(existing?.terms.map((t) => ({ name: t.name, start: t.start_date, end: t.end_date })) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addTerm = () => {
    const prevEnd = parseIsoDate(terms[terms.length - 1]?.end);
    setTerms([...terms, {
      name: terms.length < TERM_NAMES.length ? TERM_NAMES[terms.length] : `Term ${terms.length + 1}`,
      start: prevEnd ? isoDate(addDays(prevEnd, 1)) : terms.length ? null : start,
      end: null,
    }]);
  };
  const setTerm = (i: number, patch: Partial<TermDraft>) => setTerms(terms.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = async () => {
    if (!name.trim() || !start || !end) return setError('Enter the school year name and both dates.');
    if (terms.some((t) => !t.name.trim() || !t.start || !t.end)) return setError('Give every term a name, a start date and an end date.');
    setSaving(true);
    setError(null);
    try {
      await api.schoolYears.save({
        name: name.trim(), start_date: start, end_date: end,
        terms: terms.map((t) => ({ name: t.name.trim(), start_date: t.start!, end_date: t.end! })),
      }, existing?.id);
      await queryClient.invalidateQueries({ queryKey: qk.schoolYears });
      notifySuccess(existing ? 'School year updated.' : 'School year added.');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the school year');
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} size={680} title={<Text fw={700} size="lg">{existing ? `Edit S.Y. ${existing.name}` : 'Add school year'}</Text>}>
      <Stack gap="sm">
        <TextInput label="School year" placeholder="e.g. 2026-2027" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Group grow>
          <DatePickerInput label="Starts" placeholder="Select date" valueFormat="MMM D, YYYY" value={start} onChange={setStart} />
          <DatePickerInput label="Ends" placeholder="Select date" valueFormat="MMM D, YYYY" value={end} onChange={setEnd} />
        </Group>
        <Group justify="space-between" mt="sm">
          <Text fw={700} size="sm">Terms</Text>
          <Button variant="subtle" size="compact-sm" leftSection={<IconPlus size={16} />} onClick={addTerm}>Add term</Button>
        </Group>
        <Text size="xs" c="dimmed">Terms must fall inside the school year and must not overlap.</Text>
        {terms.map((t, i) => (
          <Group key={i} align="flex-end" wrap="wrap" gap={10}>
            <TextInput label="Term name" w={170} value={t.name} onChange={(e) => setTerm(i, { name: e.currentTarget.value })} />
            <DatePickerInput label="Starts" style={{ flex: 1 }} miw={150} valueFormat="MMM D, YYYY" placeholder="Select date" value={t.start} onChange={(v) => setTerm(i, { start: v })} />
            <DatePickerInput label="Ends" style={{ flex: 1 }} miw={150} valueFormat="MMM D, YYYY" placeholder="Select date" value={t.end} onChange={(v) => setTerm(i, { end: v })} />
            <CloseButton mb={6} aria-label={`Remove ${t.name}`} onClick={() => setTerms(terms.filter((_, j) => j !== i))} />
          </Group>
        ))}
        {error && <Text c="red" size="sm">{error}</Text>}
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="ink.8" loading={saving} onClick={() => void save()}>{existing ? 'Save changes' : 'Add school year'}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
