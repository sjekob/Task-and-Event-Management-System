import { Badge, Box, Group, Loader, Stack, Table, Text } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, formatDistance, LIVE_EVENT_QUERY, parseTimestamp, titleCase, type AttendanceList } from '@tasknet/shared';

/** "1:42 PM" from a school-local "YYYY-MM-DD HH:MM:SS" (scan times are stored in school time). */
function clock(raw?: string | null) {
  const d = parseTimestamp(raw, false);
  return d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
}

/**
 * Who scanned the attendance QR codes, per session: personnel and guests
 * (people without a TaskNet account, marked "Guest").
 */
export function EventAttendance({ eventId }: { eventId: number }) {
  const q = useQuery({ queryKey: ['attendance-list', eventId], queryFn: () => api.events.attendanceList(eventId), ...LIVE_EVENT_QUERY });
  if (q.isPending) return <Group justify="center" py="md"><Loader size="sm" /></Group>;
  if (q.isError) return <Text size="sm" c="red">{(q.error as Error).message}</Text>;
  const data: AttendanceList = q.data;
  if (!data.attendees.length) {
    return <Text size="sm" c="dimmed">No one has scanned in yet. Time In / Time Out scans will appear here.</Text>;
  }
  const guests = data.attendees.filter((a) => a.is_guest).length;
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {data.attendees.length} scan record{data.attendees.length === 1 ? '' : 's'}
        {guests ? ` · ${guests} guest${guests === 1 ? '' : 's'} without a TaskNet account` : ''}
      </Text>
      {data.sessions.map((s) => {
        const rows = data.attendees.filter((a) => a.activity_index === s.index);
        if (!rows.length) return null;
        return (
          <Box key={s.index}>
            <Text fw={700} size="sm" mb={6}>{s.event}{s.time ? <Text span c="dimmed" fw={400}> · {s.time}</Text> : null}</Text>
            <Table.ScrollContainer minWidth={640}>
              <Table withTableBorder fz="sm" verticalSpacing={8}>
                <Table.Thead bg="#F7F9FC">
                  <Table.Tr>
                    <Table.Th>Name</Table.Th><Table.Th>Role</Table.Th><Table.Th>Time In</Table.Th>
                    <Table.Th>Time Out</Table.Th><Table.Th>Evaluation</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Text size="sm" fw={600}>{a.name || '—'}</Text>
                          {a.is_guest && <Badge size="xs" radius="sm" variant="light" color="grape" tt="none">Guest</Badge>}
                        </Group>
                        {a.is_guest && (a.email || a.affiliation) && (
                          <Text size="xs" c="dimmed">{[a.email, a.affiliation].filter(Boolean).join(' · ')}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>{a.role ? titleCase(a.role.replace(/_/g, ' ')) : '—'}</Table.Td>
                      <Table.Td>
                        {clock(a.time_in_at)}
                        {a.time_in_distance_m != null && <Text size="xs" c="dimmed">{formatDistance(a.time_in_distance_m)} from venue</Text>}
                      </Table.Td>
                      <Table.Td>
                        {clock(a.time_out_at)}
                        {a.time_out_distance_m != null && <Text size="xs" c="dimmed">{formatDistance(a.time_out_distance_m)} from venue</Text>}
                      </Table.Td>
                      <Table.Td>
                        {a.evaluated_at
                          ? <Group gap={4} wrap="nowrap"><IconCircleCheck size={15} color="#16A34A" /><Text size="sm">Submitted</Text></Group>
                          : <Text size="sm" c="dimmed">{a.time_out_at ? 'Not yet' : '—'}</Text>}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Box>
        );
      })}
    </Stack>
  );
}
