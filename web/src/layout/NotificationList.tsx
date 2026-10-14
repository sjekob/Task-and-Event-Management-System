import { ActionIcon, Center, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBellOff, IconCalendarEvent, IconChecklist, IconInfoCircle, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, parseTimestamp, qk, timeAgo, type AppNotification } from '@tasknet/shared';

const TYPE_STYLE: Record<string, { color: string; icon: typeof IconChecklist }> = {
  task: { color: 'blue', icon: IconChecklist },
  event: { color: 'green', icon: IconCalendarEvent },
};

export function NotificationList() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: qk.notifications, queryFn: api.notifications.list });
  const remove = useMutation({
    mutationFn: (id: number) => api.notifications.remove(id),
    onSuccess: (_, id) => queryClient.setQueryData<AppNotification[]>(
      qk.notifications, (old) => old?.filter((n) => n.id !== id)),
  });

  if (list.isPending) return <Center py="xl"><Loader size="sm" /></Center>;
  if (!list.data?.length) {
    return (
      <Stack align="center" py="xl" gap={8}>
        <IconBellOff size={40} color="#B0B7C3" />
        <Text size="sm" c="dimmed">No notifications yet</Text>
      </Stack>
    );
  }
  return (
    <Stack gap={0}>
      {list.data.map((n) => {
        const style = TYPE_STYLE[n.type] ?? { color: 'orange', icon: IconInfoCircle };
        const Icon = style.icon;
        return (
          <Group key={n.id} wrap="nowrap" align="flex-start" gap="sm" py={10}
            style={{ borderBottom: '1px solid var(--tn-border)' }}>
            <ThemeIcon variant="light" color={style.color} radius="xl" size={32}><Icon size={16} /></ThemeIcon>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={n.is_read ? 400 : 600}>{n.title}</Text>
              {n.body && <Text size="xs" c="dimmed" lineClamp={2}>{n.body}</Text>}
              <Text size="xs" c="dimmed" mt={2}>{timeAgo(parseTimestamp(n.created_at))}</Text>
            </div>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Dismiss"
              onClick={() => remove.mutate(n.id)}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        );
      })}
    </Stack>
  );
}
