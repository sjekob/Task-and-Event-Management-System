import { Box, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAward, IconBan, IconCalendarEvent, IconCalendarStats, IconHistory, IconRosetteDiscountCheck,
  IconUserCog, IconUserOff, IconUserPlus, IconUserShare,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, formatDateTime, parseTimestamp, qk, roleLabel, type AuditEntry } from '@tasknet/shared';
import { colors } from '../theme';

function iconFor(action: string): [typeof IconHistory, string] {
  if (action.startsWith('account.deactivate')) return [IconUserOff, colors.red];
  if (action.startsWith('account')) return [IconUserPlus, colors.green];
  if (action.startsWith('personnel')) return [IconUserCog, colors.accent];
  if (action === 'certificate.verified') return [IconRosetteDiscountCheck, colors.green];
  if (action === 'certificate.rejected') return [IconBan, colors.red];
  if (action.startsWith('certificate')) return [IconAward, colors.accent];
  if (action.startsWith('school_year')) return [IconCalendarStats, colors.amber];
  if (action.startsWith('event')) return [IconCalendarEvent, '#7C3AED'];
  if (action.startsWith('task')) return [IconUserShare, colors.accent];
  return [IconHistory, colors.textMuted];
}

const value = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));

export function AuditEntryTile({ entry: e, showEntity = true }: { entry: AuditEntry; showEntity?: boolean }) {
  const [Icon, color] = iconFor(e.action);
  return (
    <Group wrap="nowrap" align="flex-start" gap={12} p={14} mb={8} bg="white"
      style={{ borderRadius: 10, border: `1px solid ${colors.border}` }}>
      <ThemeIcon size={34} radius={8} style={{ background: `${color}1A`, color }}><Icon size={18} /></ThemeIcon>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Group gap={8}>
          <Text size="sm" fw={500}>{e.summary}</Text>
          {showEntity && e.entity_label && <Text size="xs" c="dimmed">· {e.entity_label}</Text>}
        </Group>
        <Text size="xs" c="dimmed" mt={3}>
          {formatDateTime(parseTimestamp(e.created_at))}  ·  by {e.actor_name ?? 'system'}{e.actor_role ? ` (${roleLabel(e.actor_role)})` : ''}
        </Text>
        {Object.entries(e.changes ?? {}).length > 0 && (
          <Stack gap={3} mt={8}>
            {Object.entries(e.changes).map(([field, [before, after]]) => (
              <Text key={field} size="xs">
                <b>{field.replace(/_/g, ' ')}: </b>
                <Text span size="xs" c="dimmed" td="line-through">{value(before)}</Text>
                {'  →  '}{value(after)}
              </Text>
            ))}
          </Stack>
        )}
      </Box>
    </Group>
  );
}

/** The change history of one record (e.g. a person's account and delegation). */
export function AuditHistory({ entityType, entityId }: { entityType: string; entityId: number }) {
  const q = useQuery({
    queryKey: qk.audit({ entityType, entityId }),
    queryFn: () => api.audit.list({ entityType, entityId, limit: 50 }),
  });
  if (q.isError) return <Text size="xs" c="dimmed">{(q.error as Error).message}</Text>;
  if (q.isPending) return <Group justify="center" p={8}><Loader size="sm" /></Group>;
  if (!q.data.items.length) return <Text size="xs" c="dimmed">No recorded changes yet.</Text>;
  return <Stack gap={0}>{q.data.items.map((e) => <AuditEntryTile key={e.id} entry={e} showEntity={false} />)}</Stack>;
}
