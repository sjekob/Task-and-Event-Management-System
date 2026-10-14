import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Box, Group, Modal, Paper, SimpleGrid, Text, Tooltip, UnstyledButton,
} from '@mantine/core';
import { IconCaretDownFilled, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { DEPED_COLOR, isoDate, MONTHS_LONG, MONTHS_SHORT, sameDay } from '@tasknet/shared';
import { colors } from '../theme';

export interface CalendarAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface Props {
  /** any day in the month to show */
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDay?: Date | null;
  onDaySelect?: (day: Date) => void;
  /** "YYYY-MM-DD" days with events → blue dot */
  eventDays?: Set<string>;
  /** days with open task deadlines → amber dot (omit to hide from the legend) */
  deadlineDays?: Set<string>;
  /** days covered by DepEd memorandum entries → violet dot */
  depedDays?: Set<string>;
  tooltipFor?: (day: Date) => string | null | undefined;
  actions?: CalendarAction[];
  /** wrap in the standard white card */
  card?: boolean;
  /** larger cells for the expanded calendar */
  large?: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The month calendar used across TaskNet: "Month YYYY" title (click → month
 * picker), prev/next arrows, today filled dark, the selected day filled blue,
 * and dots for events (blue), task deadlines (amber) and DepEd dates (violet).
 */
export function AppCalendar({
  month, onMonthChange, selectedDay, onDaySelect, eventDays, deadlineDays, depedDays,
  tooltipFor, actions = [], card = true, large = false,
}: Props) {
  const [picking, setPicking] = useState(false);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = first.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const d = i - lead + 1;
    return d >= 1 && d <= days ? new Date(month.getFullYear(), month.getMonth(), d) : null;
  });
  const today = new Date();
  const shift = (n: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + n, 1));

  const content = (
    <>
      <Group gap={2} wrap="nowrap">
        <UnstyledButton onClick={() => setPicking(true)} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={2} wrap="nowrap">
            <Text fw={700} size="md" truncate>{MONTHS_LONG[month.getMonth()]} {month.getFullYear()}</Text>
            <IconCaretDownFilled size={14} color={colors.textMuted} />
          </Group>
        </UnstyledButton>
        <Tooltip label="Previous month">
          <ActionIcon variant="subtle" color="gray" onClick={() => shift(-1)} aria-label="Previous month">
            <IconChevronLeft size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Next month">
          <ActionIcon variant="subtle" color="gray" onClick={() => shift(1)} aria-label="Next month">
            <IconChevronRight size={18} />
          </ActionIcon>
        </Tooltip>
        {actions.map((a) => (
          <Tooltip key={a.label} label={a.label}>
            <ActionIcon variant="subtle" color="gray" onClick={a.onClick} aria-label={a.label}>{a.icon}</ActionIcon>
          </Tooltip>
        ))}
      </Group>

      <SimpleGrid cols={7} spacing={0} mt={10} mb={4}>
        {WEEKDAYS.map((d, i) => <Text key={i} ta="center" size="11px" fw={600} c={colors.textLight}>{d}</Text>)}
      </SimpleGrid>

      <SimpleGrid cols={7} spacing={4} verticalSpacing={4}>
        {cells.map((date, i) => {
          if (!date) return <Box key={i} />;
          const key = isoDate(date);
          const isSelected = !!selectedDay && sameDay(date, selectedDay);
          const isToday = sameDay(date, today);
          const dots = [
            eventDays?.has(key) && (isSelected ? 'white' : colors.accent),
            deadlineDays?.has(key) && colors.amber,
            depedDays?.has(key) && (isSelected ? '#DDD6FE' : DEPED_COLOR),
          ].filter(Boolean) as string[];
          const filled = isSelected || isToday;
          const tip = tooltipFor?.(date);
          const cell = (
            <UnstyledButton
              onClick={onDaySelect ? () => onDaySelect(date) : undefined}
              style={{
                width: '100%', borderRadius: 8, aspectRatio: large ? undefined : '1', height: large ? 64 : undefined,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? colors.accent : isToday ? colors.dark : 'transparent',
                cursor: onDaySelect ? 'pointer' : 'default', transition: 'background 160ms',
              }}
              aria-label={key}
            >
              <Text size={large ? 'sm' : 'xs'} fw={filled ? 700 : 500} c={filled ? 'white' : colors.textPrimary}>
                {date.getDate()}
              </Text>
              <Group gap={3} h={5} mt={3} justify="center" wrap="nowrap">
                {dots.map((c, j) => <Box key={j} w={5} h={5} style={{ borderRadius: '50%', background: c }} />)}
              </Group>
            </UnstyledButton>
          );
          return tip ? (
            <Tooltip key={key} label={<Text size="xs" style={{ whiteSpace: 'pre-line' }}>{tip}</Text>}
              openDelay={200} color="ink.8" multiline maw={280}>
              {cell}
            </Tooltip>
          ) : <Box key={key}>{cell}</Box>;
        })}
      </SimpleGrid>

      <Group gap={16} mt={8}>
        <Legend color={colors.accent} label="Event" />
        {deadlineDays && <Legend color={colors.amber} label="Task deadline" />}
        {depedDays && <Legend color={DEPED_COLOR} label="DepEd Memo" />}
      </Group>

      <MonthPicker opened={picking} initial={month} onClose={() => setPicking(false)}
        onPick={(d) => { setPicking(false); onMonthChange(d); }} />
    </>
  );

  return card ? <Paper p="md" radius="lg" withBorder>{content}</Paper> : content;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={5} h={5} style={{ borderRadius: '50%', background: color }} />
      <Text size="xs" c="dimmed">{label}</Text>
    </Group>
  );
}

function MonthPicker({ opened, initial, onClose, onPick }: {
  opened: boolean; initial: Date; onClose: () => void; onPick: (d: Date) => void;
}) {
  const [year, setYear] = useState(initial.getFullYear());
  const now = new Date();
  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} size={340}>
      <Group justify="space-between" mb="sm">
        <ActionIcon variant="subtle" color="gray" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Text fw={700}>{year}</Text>
        <ActionIcon variant="subtle" color="gray" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
      <SimpleGrid cols={3} spacing={6}>
        {MONTHS_SHORT.map((m, i) => {
          const current = year === initial.getFullYear() && i === initial.getMonth();
          const thisMonth = year === now.getFullYear() && i === now.getMonth();
          return (
            <UnstyledButton key={m} onClick={() => onPick(new Date(year, i, 1))} py={10} ta="center"
              style={{
                borderRadius: 8, background: current ? colors.dark : undefined,
                border: thisMonth && !current ? `1px solid ${colors.accent}` : '1px solid transparent',
              }}>
              <Text size="sm" fw={current ? 700 : 500} c={current ? 'white' : undefined}>{m}</Text>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Modal>
  );
}
