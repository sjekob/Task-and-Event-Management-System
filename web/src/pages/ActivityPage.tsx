import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Box, Button, Divider, Group, Modal, Paper, SimpleGrid, Stack, Text, Tooltip,
} from '@mantine/core';
import {
  IconCalendar, IconCalendarOff, IconChevronRight, IconMapPin, IconNotes, IconRefresh, IconUser,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  api, CURRENT_YEAR, formatActivityMatrix, formatCommittee, formatDate, formatIsoDate, formatMethodology,
  formatOutputs, formatParticipants, formatTwg, parseTimestamp, qk, type EventRecord, type SchoolYearFilter,
} from '@tasknet/shared';
import { SchoolYearPicker } from '../components/SchoolYearPicker';
import { EmptyState, ErrorState, PageBanner, PageLoader, StatusBadge } from '../components/ui';
import { colors } from '../theme';

export function ActivityPage() {
  // Current school year by default; earlier years are archived.
  const [filter, setFilter] = useState<SchoolYearFilter>(CURRENT_YEAR);
  const [open, setOpen] = useState<EventRecord | null>(null);
  const schoolYear = filter.schoolYear === 'current' ? undefined : filter.schoolYear;
  const events = useQuery({ queryKey: qk.events(schoolYear), queryFn: () => api.events.list(schoolYear) });

  return (
    <Stack gap="md">
      <PageBanner title="Activity Calendar" subtitle="View all scheduled events and activities." />
      <Paper p="lg" radius="lg">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>{filter.schoolYear === 'current' ? 'Upcoming Events' : 'Events'}</Text>
          <Group gap={6}>
            <SchoolYearPicker value={filter} onChange={setFilter} />
            <Tooltip label="Refresh">
              <ActionIcon variant="subtle" color="gray" onClick={() => events.refetch()} aria-label="Refresh"
                loading={events.isFetching}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        {events.isPending ? <PageLoader />
          : events.isError ? <ErrorState error={events.error} onRetry={() => events.refetch()} />
            : !events.data.length ? (
              <EmptyState icon={<IconCalendarOff size={40} color={colors.textLight} />} title="No events yet" />
            ) : events.data.map((e) => (
              <Group key={e.id} wrap="nowrap" py={12} px={4} gap={10} className="tn-row" role="button" tabIndex={0}
                style={{ borderBottom: '1px solid var(--tn-border)', cursor: 'pointer', borderRadius: 6 }}
                onClick={() => setOpen(e)} onKeyDown={(k) => { if (k.key === 'Enter') setOpen(e); }}>
                <IconNotes size={16} color={colors.textLight} />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>{e.title || 'Untitled'}</Text>
                  <Group gap={8} mt={2} wrap="nowrap">
                    {e.target_date && (
                      <Group gap={3} wrap="nowrap"><IconCalendar size={11} color={colors.textLight} />
                        <Text size="xs" c="dimmed">{formatIsoDate(e.target_date)}</Text></Group>
                    )}
                    {e.venue && (
                      <Group gap={3} wrap="nowrap" style={{ minWidth: 0 }}><IconMapPin size={11} color={colors.textLight} />
                        <Text size="xs" c="dimmed" truncate>{e.venue}</Text></Group>
                    )}
                  </Group>
                </Box>
                <Stack gap={3} align="flex-end">
                  <StatusBadge status={e.status} />
                  <Group gap={0}><IconChevronRight size={14} color={colors.textLight} /><Text size="xs" c="dimmed">View details</Text></Group>
                </Stack>
              </Group>
            ))}
      </Paper>
      {open && <EventDetailModal event={open} onClose={() => setOpen(null)} />}
    </Stack>
  );
}

const has = (v: unknown) => v != null && String(v).trim() !== '';

function Label({ children }: { children: ReactNode }) {
  return <Text size="xs" fw={500} c={colors.accent} mt="md" mb={6}>{children}</Text>;
}

function Block({ text }: { text: string }) {
  return <Box p={10} style={{ background: colors.bg, borderRadius: 6 }}><Text size="sm" c="dimmed" className="tn-prewrap">{text}</Text></Box>;
}

function InfoGrid({ items }: { items: [string, unknown][] }) {
  const shown = items.filter(([, v]) => has(v));
  if (!shown.length) return null;
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing={12} verticalSpacing={8}>
      {shown.map(([label, v]) => (
        <div key={label}>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="sm" fw={500}>{String(v)}</Text>
        </div>
      ))}
    </SimpleGrid>
  );
}

/** Read-only view of a whole event proposal (Activity feed). */
export function EventDetailModal({ event: e, onClose }: { event: EventRecord; onClose: () => void }) {
  const phases: [string, string | null | undefined][] = [
    ['Phase 1 – Pre-Activity', e.phase1], ['Phase 2 – During Activity', e.phase2], ['Phase 3 – Post-Activity', e.phase3],
  ];
  return (
    <Modal opened onClose={onClose} size={640} padding={0} withCloseButton={false}>
      <Group px={20} py={16} gap={8} wrap="nowrap" bg={colors.dark}>
        <IconCalendar size={18} color="rgba(255,255,255,0.7)" />
        <Text c="white" fw={600} truncate style={{ flex: 1 }}>{e.title || 'Event Details'}</Text>
        <StatusBadge status={e.status} />
        <Modal.CloseButton c="white" aria-label="Close" />
      </Group>
      <Box p={20}>
        <Text size="xs" fw={500} c={colors.accent} mb={10}>Event Information</Text>
        <InfoGrid items={[['Nature', e.nature], ['Target Date', e.target_date ? formatIsoDate(e.target_date) : null],
          ['Venue', e.venue], ['Fund Source', e.fund_source], ['Proposed Budget', e.proposed_budget ? `₱${e.proposed_budget}` : null]]} />
        {has(e.participants) && <><Label>Participants</Label><Block text={formatParticipants(e.participants!)} /></>}
        {has(e.focal_name) && <><Label>Focal Person</Label>
          <InfoGrid items={[['Name', e.focal_name], ['Role', e.focal_role], ['Contact', e.focal_contact]]} /></>}
        {has(e.rationale) && <><Label>Rationale</Label><Block text={e.rationale!} /></>}
        {has(e.objectives) && <><Label>Objectives</Label><Block text={formatOutputs(e.objectives!)} /></>}
        {has(e.expected_outputs) && <><Label>Expected Outputs</Label><Block text={formatOutputs(e.expected_outputs!)} /></>}
        {phases.some(([, v]) => has(v)) && (
          <>
            <Label>Implementation Phases</Label>
            <Stack gap={10}>
              {phases.filter(([, v]) => has(v)).map(([title, v]) => (
                <div key={title}><Text size="xs" fw={500} mb={4}>{title}</Text><Block text={formatMethodology(v!)} /></div>
              ))}
            </Stack>
          </>
        )}
        {has(e.activity_matrix) && <><Label>Activity Matrix</Label><Block text={formatActivityMatrix(e.activity_matrix!)} /></>}
        {has(e.exec_committee) && <><Label>Executive Committee</Label><Block text={formatCommittee(e.exec_committee!)} /></>}
        {has(e.twg_groups) && <><Label>TWG Groups</Label><Block text={formatTwg(e.twg_groups!)} /></>}
        {has(e.monitoring_criteria) && <><Label>Monitoring Criteria</Label><Block text={e.monitoring_criteria!} /></>}
        {has(e.indicators) && <><Label>Indicators</Label><Block text={formatOutputs(e.indicators!)} /></>}
        {has(e.comments) && <><Label>Comments / Notes</Label><Block text={e.comments!} /></>}
        {has(e.creator_name) && (
          <>
            <Divider my="md" />
            <Group gap={6} wrap="nowrap">
              <IconUser size={14} color={colors.textLight} />
              <Text size="xs" c="dimmed">Created by</Text>
              <Text size="xs" fw={500} truncate>{e.creator_name}{e.creator_role ? ` (${e.creator_role})` : ''}</Text>
              {e.created_at && <Text size="xs" c="dimmed">· {formatDate(parseTimestamp(e.created_at), '')}</Text>}
            </Group>
          </>
        )}
      </Box>
      <Group justify="flex-end" px={20} py={12} style={{ borderTop: '1px solid var(--tn-border)' }}>
        <Button variant="subtle" onClick={onClose}>Close</Button>
      </Group>
    </Modal>
  );
}

