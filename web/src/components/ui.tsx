import type { ReactNode } from 'react';
import { Alert, Avatar, Badge, Button, Center, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconInbox } from '@tabler/icons-react';
import { initials } from '@tasknet/shared';
import { colors } from '../theme';

export function notifySuccess(message: string, title?: string) {
  notifications.show({ color: 'green', title, message });
}

export function notifyError(error: unknown, fallback = 'Something went wrong') {
  const message = error instanceof Error ? error.message : fallback;
  notifications.show({ color: 'red', title: 'Error', message });
}

export function PageLoader() {
  return (
    <Center py={80}>
      <Loader color="ink.8" />
    </Center>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't load this" radius="md">
      <Stack gap="xs">
        <Text size="sm">{error instanceof Error ? error.message : 'Unexpected error'}</Text>
        {onRetry && (
          <Group>
            <Button size="xs" variant="light" color="red" onClick={onRetry}>Try again</Button>
          </Group>
        )}
      </Stack>
    </Alert>
  );
}

export function EmptyState({ title, message, icon, action }: {
  title: string; message?: string; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <Paper p="xl" radius="lg">
      <Stack align="center" gap={6} py="md">
        {icon ?? <IconInbox size={36} color={colors.textLight} />}
        <Text fw={600}>{title}</Text>
        {message && <Text size="sm" c="dimmed" ta="center" maw={420}>{message}</Text>}
        {action}
      </Stack>
    </Paper>
  );
}

/** Dark banner at the top of a page. */
export function PageBanner({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <Paper
      radius="lg"
      p="xl"
      style={{
        background: `radial-gradient(circle at 100% 50%, rgba(139,0,0,0.3), transparent 220px), ${colors.dark}`,
        color: 'white',
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <div>
          <Title order={2} c="white" fw={800}>{title}</Title>
          {subtitle && <Text size="sm" c="#9CA3AF" mt={4}>{subtitle}</Text>}
        </div>
        {right}
      </Group>
    </Paper>
  );
}

export function SectionTitle({ title, count, unit = 'task', right }: {
  title: string; count?: number; unit?: string; right?: ReactNode;
}) {
  return (
    <Group justify="space-between" mb="sm" wrap="nowrap">
      <Group gap={6} wrap="nowrap">
        <Text fw={600} size="md">{title}</Text>
        {count != null && <Text size="sm" c="dimmed">({count} {unit}{count !== 1 ? 's' : ''})</Text>}
      </Group>
      {right}
    </Group>
  );
}

const STATUS_STYLES: Record<string, { bg: string; fg: string; label?: string }> = {
  pending: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Pending' },
  submitted: { bg: '#DCFCE7', fg: '#15803D', label: 'Submitted' },
  completed: { bg: '#DCFCE7', fg: '#15803D', label: 'Completed' },
  approved: { bg: '#DCFCE7', fg: '#15803D', label: 'Approved' },
  verified: { bg: '#DCFCE7', fg: '#15803D', label: 'Verified' },
  missing: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Missing' },
  overdue: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Overdue' },
  rejected: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Rejected' },
  disabled: { bg: '#F3F4F6', fg: '#6B7280', label: 'Disabled' },
  draft: { bg: '#F3F4F6', fg: '#4B5563', label: 'Draft' },
  pending_approval: { bg: '#FEF3C7', fg: '#B45309', label: 'Pending approval' },
  evaluated: { bg: '#EDE9FE', fg: '#6D28D9', label: 'Evaluated' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STATUS_STYLES[status.toLowerCase()] ?? { bg: '#F3F4F6', fg: '#4B5563' };
  return (
    <Badge radius="xl" variant="filled" style={{ background: s.bg, color: s.fg }} tt="none" fw={600}>
      {label ?? s.label ?? status}
    </Badge>
  );
}

export function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <Avatar size={size} radius="xl" styles={{ placeholder: { background: colors.sidebarActive } }}>
      <Text size={size > 36 ? 'md' : 'xs'} fw={700} c="white">{initials({ full_name: name })}</Text>
    </Avatar>
  );
}

export function StatCard({ value, label, icon, iconBg, iconColor }: {
  value: ReactNode; label: string; icon: ReactNode; iconBg: string; iconColor: string;
}) {
  return (
    <Paper p="md" radius="lg">
      <Center w={36} h={36} style={{ borderRadius: '50%', background: iconBg, color: iconColor }}>{icon}</Center>
      <Text fz={28} fw={800} mt={10} lh={1.2}>{value}</Text>
      <Text size="sm" c="dimmed" truncate>{label}</Text>
    </Paper>
  );
}
