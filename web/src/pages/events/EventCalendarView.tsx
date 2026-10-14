import { useMemo, useState } from 'react';
import { Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowsMinimize, IconCalendarMonth, IconCalendarOff, IconClock, IconMapPin, IconNotes, IconTarget } from '@tabler/icons-react';
import {
  DEPED_BG, DEPED_COLOR, depedByDay, depedRangeLabel, eventTimesOn, isoDate, minutesToHm, MONTHS_LONG,
  MONTHS_SHORT, parseEventDate, parseIsoDate, sameDay, startOfDay, type DepedEntry, type EventRecord,
} from '@tasknet/shared';
import { AppCalendar } from '../../components/AppCalendar';
import { colors } from '../../theme';

const STATUS: Record<string, [string, string]> = {
  approved: ['Approved', colors.green],
  pending_approval: ['Pending', colors.amber],
  draft: ['Draft', colors.textMuted],
  disabled: ['Disabled', colors.red],
};

interface Entry { event: EventRecord; date: Date; times: [number, number] | null }

const when = (e: Entry) => {
  const d = `${MONTHS_SHORT[e.date.getMonth()]} ${e.date.getDate()}, ${e.date.getFullYear()}`;
  return e.times ? `${d} | ${minutesToHm(e.times[0])} - ${minutesToHm(e.times[1])}` : d;
};

/**
 * Expanded event calendar: the shared month grid with the events of the shown
 * month — or of the selected day — listed underneath as cards.
 */
export function EventCalendarView({ events, deped, initialDay, selectInitialDay, onOpenEvent, onCollapse }: {
  events: EventRecord[]; deped: DepedEntry[]; initialDay?: Date | null; selectInitialDay?: boolean;
  onOpenEvent: (e: EventRecord) => void; onCollapse: () => void;
}) {
  const [focused, setFocused] = useState(() => startOfDay(initialDay ?? new Date()));
  const [selected, setSelected] = useState<Date | null>(() => (selectInitialDay && initialDay ? startOfDay(initialDay) : null));

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of events) {
      const d = parseEventDate(e.target_date);
      if (!d) continue; // undated events can't be placed on the grid
      const key = isoDate(d);
      map.set(key, [...(map.get(key) ?? []), { event: e, date: d, times: eventTimesOn(e.activity_matrix, d) }]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.times?.[0] ?? -1) - (b.times?.[0] ?? -1));
    return map;
  }, [events]);
  const depedDays = useMemo(() => depedByDay(deped), [deped]);

  const visible: Entry[] = selected ? byDay.get(isoDate(selected)) ?? []
    : [...byDay.entries()].filter(([k]) => {
      const d = parseIsoDate(k)!;
      return d.getFullYear() === focused.getFullYear() && d.getMonth() === focused.getMonth();
    }).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, list]) => list);

  const visibleDeped = selected ? depedDays.get(isoDate(selected)) ?? []
    : deped.filter((e) => {
      const first = new Date(focused.getFullYear(), focused.getMonth(), 1);
      const last = new Date(focused.getFullYear(), focused.getMonth() + 1, 0);
      return (parseIsoDate(e.end_date) ?? first) >= first && (parseIsoDate(e.start_date) ?? last) <= last;
    }).sort((a, b) => a.start_date.localeCompare(b.start_date));

  const label = selected
    ? `Events on ${MONTHS_SHORT[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`
    : `Events in ${MONTHS_LONG[focused.getMonth()]} ${focused.getFullYear()}`;

  return (
    <Stack gap="md">
      <AppCalendar large
        month={focused}
        onMonthChange={(m) => { setFocused(m); setSelected(null); }}
        selectedDay={selected}
        // Clicking the selected day again goes back to the whole month.
        onDaySelect={(d) => { setSelected((s) => (s && sameDay(s, d) ? null : d)); setFocused(d); }}
        eventDays={new Set(byDay.keys())}
        depedDays={new Set(depedDays.keys())}
        tooltipFor={(day) => [
          ...(depedDays.get(isoDate(day)) ?? []).map((d) => `DepEd Memo · ${d.category}\n${d.title}\n${depedRangeLabel(d)}`),
          ...(byDay.get(isoDate(day)) ?? []).map((e) => [e.event.title, `When: ${when(e)}`, e.event.venue && `Where: ${e.event.venue}`].filter(Boolean).join('\n')),
        ].join('\n\n') || null}
        actions={[
          { icon: <IconTarget size={18} />, label: 'Today', onClick: () => { const t = startOfDay(new Date()); setFocused(t); setSelected(t); } },
          { icon: <IconArrowsMinimize size={18} />, label: 'Collapse calendar', onClick: onCollapse },
        ]}
      />

      <Group gap={10}>
        <Text fw={700}>{label}</Text>
        <Badge radius="xl" style={{ background: colors.blueBg, color: colors.accent }}>{visible.length + visibleDeped.length}</Badge>
        {selected && (
          <Button size="compact-sm" variant="default" leftSection={<IconCalendarMonth size={16} />} onClick={() => setSelected(null)}>
            Whole month
          </Button>
        )}
      </Group>

      {!visible.length && !visibleDeped.length ? (
        <Paper p="xl" radius="lg">
          <Stack align="center" gap={8}>
            <IconCalendarOff size={32} color={colors.textLight} />
            <Text size="xs" c="dimmed">{selected ? 'No events on this day.' : 'No events this month.'}</Text>
          </Stack>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={12}>
          {/* Official DepEd dates first, then the school's own events. */}
          {visibleDeped.map((d) => (
            <Paper key={`d${d.id}`} radius="lg" p={0} mih={88} style={{ overflow: 'hidden' }}>
              <Box px={14} py={12} h="100%" style={{ borderLeft: `4px solid ${DEPED_COLOR}` }}>
                <Group gap={6} wrap="nowrap">
                  <IconNotes size={14} color={colors.textMuted} />
                  <Text size="xs" fw={600} c="dimmed" style={{ flex: 1 }}>{depedRangeLabel(d)}</Text>
                  <Badge radius="xl" size="sm" tt="none" style={{ background: DEPED_BG, color: DEPED_COLOR }}>DepEd Memo</Badge>
                </Group>
                <Text fw={700} mt={6} lineClamp={2}>{d.title}</Text>
                <Text size="sm" c="dimmed" mt={4}>{d.is_mandatory ? `${d.category} · Mandatory` : d.category}</Text>
              </Box>
            </Paper>
          ))}
          {visible.map((e) => {
            const [statusLabel, color] = STATUS[e.event.status] ?? ['Event', colors.accent];
            return (
              <Paper key={`e${e.event.id}`} radius="lg" p={0} mih={88} style={{ overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => onOpenEvent(e.event)} role="button" tabIndex={0}
                onKeyDown={(k) => { if (k.key === 'Enter') onOpenEvent(e.event); }}>
                <Box px={14} py={12} h="100%" style={{ borderLeft: `4px solid ${color}` }}>
                  <Group gap={6} wrap="nowrap">
                    <IconClock size={14} color={colors.textMuted} />
                    <Text size="xs" fw={600} c="dimmed" style={{ flex: 1 }}>{when(e)}</Text>
                    <Badge radius="xl" size="sm" tt="none" style={{ background: `${color}1F`, color }}>{statusLabel}</Badge>
                  </Group>
                  <Text fw={700} mt={6} lineClamp={2}>{e.event.title || 'Untitled event'}</Text>
                  {e.event.venue?.trim() && (
                    <Group gap={4} mt={4} wrap="nowrap">
                      <IconMapPin size={14} color={colors.textMuted} />
                      <Text size="sm" c="dimmed" truncate>{e.event.venue}</Text>
                    </Group>
                  )}
                </Box>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
