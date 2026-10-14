import { useState, type ComponentType } from 'react';
import { NavLink as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ActionIcon, AppShell, Badge, Box, Burger, Button, Group, Image, Indicator, Modal, ScrollArea,
  Stack, Text, Tooltip, UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconBell, IconCalendarEvent, IconCalendarStats, IconChecklist, IconChevronLeft, IconChevronRight,
  IconClipboardList, IconHistory, IconLayoutDashboard, IconLogout, IconStar, IconStarFilled,
  IconTimeline, IconUsers, IconAward, IconLibraryPlus,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, initials, qk, roleLabel, useSession, useUser, type Permission } from '@tasknet/shared';
import { NotificationList } from './NotificationList';
import { colors } from '../theme';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; stroke?: number }>;
  /** shown only when the session holds this permission */
  permission?: Permission;
}

const MAIN: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/my-tasks', label: 'My Tasks', icon: IconClipboardList, permission: 'receive_tasks' },
  { to: '/my-special-tasks', label: 'My Special Tasks', icon: IconStar, permission: 'receive_tasks' },
  { to: '/activity', label: 'Activity', icon: IconTimeline },
];

const MANAGEMENT: NavItem[] = [
  { to: '/tasks', label: 'Task Manager', icon: IconChecklist, permission: 'create_tasks' },
  { to: '/special-tasks', label: 'Special Tasks', icon: IconStarFilled, permission: 'create_tasks' },
  { to: '/personnel', label: 'Personnel', icon: IconUsers, permission: 'view_personnel' },
  { to: '/appraisal', label: 'Appraisal', icon: IconAward, permission: 'view_appraisal' },
  { to: '/events', label: 'Events', icon: IconCalendarEvent },
  { to: '/school-years', label: 'School Year', icon: IconCalendarStats, permission: 'manage_school_years' },
  { to: '/audit-log', label: 'Audit Log', icon: IconHistory, permission: 'view_audit' },
];

const MUTED = '#8892A4';

/** "Coordinator Grace Tan" → "Grace Tan" when the role is coordinator. */
function displayName(user: { full_name: string; first_name?: string | null; last_name?: string | null; role: string }) {
  const raw = user.first_name ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}` : user.full_name;
  const prefix = `${user.role.toLowerCase()} `;
  return raw.toLowerCase().startsWith(prefix) ? raw.slice(prefix.length).trim() : raw;
}

export function AppLayout() {
  const user = useUser();
  const { logout, can } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [mobileOpen, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unread = useQuery({
    queryKey: qk.unreadCount,
    queryFn: api.notifications.unreadCount,
    refetchInterval: 30_000,
  });

  const openNotifications = async () => {
    setNotifOpen(true);
    try {
      await api.notifications.markAllRead();
    } finally {
      queryClient.setQueryData(qk.unreadCount, 0);
    }
  };

  const name = displayName(user);
  const path = location.pathname;
  const onTaskList = path === '/tasks' || path === '/special-tasks';
  const narrow = collapsed && !isMobile;

  const renderItems = (items: NavItem[]) => items
    .filter((i) => !i.permission || can(i.permission))
    .map((item) => {
      // /tasks must not light up for /my-tasks etc.
      const active = path === item.to || path.startsWith(`${item.to}/`);
      const Icon = item.icon;
      const link = (
        <UnstyledButton
          key={item.to}
          component={RouterLink}
          to={item.to}
          onClick={closeMobile}
          px={narrow ? 0 : 10}
          py={9}
          mb={2}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, borderRadius: 8,
            justifyContent: narrow ? 'center' : 'flex-start',
            background: active ? 'rgba(255,255,255,0.10)' : undefined,
            color: active ? 'white' : MUTED,
            borderLeft: `3px solid ${active ? 'white' : 'transparent'}`,
          }}
          className="tn-nav-item"
        >
          <Icon size={18} stroke={1.7} />
          {!narrow && <Text size="sm" fw={active ? 600 : 400} c="inherit" truncate>{item.label}</Text>}
        </UnstyledButton>
      );
      return narrow ? <Tooltip key={item.to} label={item.label} position="right">{link}</Tooltip> : link;
    });

  const sectionLabel = (text: string) => !narrow && (
    <Text size="10px" fw={600} c={MUTED} opacity={0.75} px={12} pt={10} pb={4} lts={0.8}>{text}</Text>
  );

  return (
    <AppShell
      navbar={{ width: narrow ? 64 : 230, breakpoint: 'sm', collapsed: { mobile: !mobileOpen } }}
      padding={0}
      styles={{ main: { background: colors.bg, minHeight: '100dvh' } }}
    >
      <AppShell.Navbar style={{ background: colors.dark, border: 'none' }}>
        <Group h={62} px={narrow ? 0 : 16} justify={narrow ? 'center' : 'space-between'} wrap="nowrap"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          {!narrow && (
            <Group gap={10} wrap="nowrap">
              <Image src="/logo.png" w={30} h={30} fit="contain" alt="" />
              <div>
                <Text c="white" fw={700} size="sm" lh={1.2}>TaskNet</Text>
                <Text c="rgba(255,255,255,0.55)" size="10px">Management System</Text>
              </div>
            </Group>
          )}
          {!isMobile && (
            <ActionIcon variant="subtle" color="gray" onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <IconChevronRight size={18} color={MUTED} /> : <IconChevronLeft size={18} color={MUTED} />}
            </ActionIcon>
          )}
        </Group>

        <AppShell.Section grow component={ScrollArea} px={8} py={8}>
          {sectionLabel('MAIN MENU')}
          {renderItems(MAIN)}
          {sectionLabel('MANAGEMENT')}
          {renderItems(MANAGEMENT)}
        </AppShell.Section>

        <AppShell.Section p={12} style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {narrow ? (
            <Stack align="center" gap={8}>
              <Indicator label={unread.data} disabled={!unread.data} color="red" size={16}>
                <ActionIcon variant="subtle" color="gray" onClick={openNotifications} aria-label="Notifications">
                  <IconBell size={18} color="rgba(255,255,255,0.8)" />
                </ActionIcon>
              </Indicator>
              <ActionIcon variant="subtle" color="gray" onClick={() => void logout()} aria-label="Log out">
                <IconLogout size={18} color={MUTED} />
              </ActionIcon>
            </Stack>
          ) : (
            <>
              <Group gap={10} wrap="nowrap">
                <Box w={34} h={34} style={{
                  borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'grid',
                  placeItems: 'center', color: 'white', fontSize: 13, fontWeight: 600, flexShrink: 0,
                }}>{initials({ full_name: name })}</Box>
                <div style={{ minWidth: 0 }}>
                  <Text c="white" size="sm" fw={600} truncate>{name}</Text>
                  <Text c="rgba(255,255,255,0.6)" size="xs">{user.role === 'admin' ? 'Administrator' : roleLabel(user.role)}</Text>
                </div>
              </Group>
              <Group gap={8} mt={10} wrap="nowrap">
                <Indicator label={unread.data && unread.data > 9 ? '9+' : unread.data} disabled={!unread.data}
                  color="red" size={16} offset={2}>
                  <ActionIcon size={34} radius={7} variant="filled" color="rgba(255,255,255,0.1)"
                    onClick={openNotifications} aria-label="Notifications">
                    <IconBell size={17} color="rgba(255,255,255,0.8)" />
                  </ActionIcon>
                </Indicator>
                <Button flex={1} size="xs" h={34} radius={7} color="rgba(255,255,255,0.1)"
                  leftSection={<IconLogout size={15} />} onClick={() => void logout()} c="rgba(255,255,255,0.8)">
                  Logout
                </Button>
              </Group>
            </>
          )}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Group px={{ base: 12, sm: 24 }} py={16} justify="space-between" wrap="nowrap" className="tn-no-print">
          {isMobile ? (
            <Burger opened={mobileOpen} onClick={toggleMobile} size="sm" aria-label="Menu" />
          ) : (
            <Text fz={22} fw={700} truncate>{name}</Text>
          )}
          <Group gap={8} wrap="nowrap">
            {!isMobile && path === '/tasks' && can('manage_templates') && (
              <Button variant="outline" size="sm" leftSection={<IconLibraryPlus size={15} />}
                onClick={() => navigate('/tasks/template')}>
                Create Template
              </Button>
            )}
            {onTaskList && can('create_tasks') && (
              <Button color="ink.8" size="sm" onClick={() => navigate(`${path}/new`)}>
                {path === '/special-tasks' ? 'Create Special Task' : 'Create Task'}
              </Button>
            )}
            <Tooltip label="My profile">
              <UnstyledButton component={RouterLink} to="/profile" aria-label="My profile">
                <Box w={40} h={40} style={{
                  borderRadius: '50%', background: colors.sidebarActive, display: 'grid', placeItems: 'center',
                  color: 'white', fontWeight: 700,
                }}>{initials(user)}</Box>
              </UnstyledButton>
            </Tooltip>
            {isMobile && unread.data ? (
              <Badge color="red" circle onClick={openNotifications} style={{ cursor: 'pointer' }}>{unread.data}</Badge>
            ) : null}
          </Group>
        </Group>
        <Box px={{ base: 12, sm: 24 }} pb={32}>
          <Outlet />
        </Box>
      </AppShell.Main>

      <Modal opened={notifOpen} onClose={() => setNotifOpen(false)} title="Notifications" size="md">
        <NotificationList />
      </Modal>
    </AppShell>
  );
}
