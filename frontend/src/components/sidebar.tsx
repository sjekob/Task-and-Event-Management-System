import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Json } from '../models/models';
import { ApiService } from '../services/apiService';
import { densityDy, ts, tsAvatar, tsField, withOpacity } from '../theme/appTheme';
import { HoverScale, TaskNetLogo } from './commonWidgets';
import { Icon, IconName } from './ui/Icon';
import { IconButton, Tap } from './ui/buttons';
import { CircleAvatar, CircularProgressIndicator, Divider } from './ui/misc';
import { Dialog, showDialog } from './ui/overlay';

export enum NavPage {
  dashboard,
  taskManager,
  myTasks,
  specialTasks,
  mySpecialTasks,
  activity,
  personnelManagement,
  appraisal,
  eventManagement,
  schoolYears,
  auditLog,
}

// ── Shared dark sidebar palette ───────────────────────────────────────────────
const kSidebarBg = '#1A1A2E';
const kActiveBg = 'rgba(255,255,255,0.102)'; // white 10%
const kHoverBg = 'rgba(255,255,255,0.051)'; // white 5%
const kMuted = '#8892A4';
const kDivider = 'rgba(255,255,255,0.122)';

interface NavEntry {
  page: NavPage;
  icon: IconName;
  label: string;
}

/// The nav entries the granted permissions allow, split into the two sections.
function navEntries(permissions: Set<string>): { main: NavEntry[]; management: NavEntry[] } {
  // Sections follow the permissions the backend granted this session.
  const receivesTasks = permissions.has('receive_tasks');
  const createsTasks = permissions.has('create_tasks');
  const canManagePersonnel = permissions.has('view_personnel');
  const canManageSchoolYears = permissions.has('manage_school_years');
  const canViewAudit = permissions.has('view_audit');
  const hasAppraisalAccess = permissions.has('view_appraisal');

  const main: NavEntry[] = [{ page: NavPage.dashboard, icon: 'dashboard_outlined', label: 'Dashboard' }];
  if (receivesTasks) main.push({ page: NavPage.myTasks, icon: 'assignment_outlined', label: 'My Tasks' });
  if (receivesTasks) main.push({ page: NavPage.mySpecialTasks, icon: 'star_outline', label: 'My Special Tasks' });
  main.push({ page: NavPage.activity, icon: 'calendar_today_outlined', label: 'Activity' });

  const management: NavEntry[] = [];
  if (createsTasks) management.push({ page: NavPage.taskManager, icon: 'check_box_outlined', label: 'Task Manager' });
  if (createsTasks) management.push({ page: NavPage.specialTasks, icon: 'star_border_purple500_outlined', label: 'Special Tasks' });
  if (canManagePersonnel) management.push({ page: NavPage.personnelManagement, icon: 'people_outlined', label: 'Personnel' });
  if (hasAppraisalAccess) management.push({ page: NavPage.appraisal, icon: 'star_border_outlined', label: 'Appraisal' });
  management.push({ page: NavPage.eventManagement, icon: 'event_outlined', label: 'Events' });
  if (canManageSchoolYears) management.push({ page: NavPage.schoolYears, icon: 'date_range_outlined', label: 'School Year' });
  if (canViewAudit) management.push({ page: NavPage.auditLog, icon: 'history_outlined', label: 'Audit Log' });
  return { main, management };
}

// ── Desktop Sidebar ───────────────────────────────────────────────────────────

interface AppSidebarProps {
  currentPage: NavPage;
  userName: string;
  userRole: string;
  /// Permissions granted by the backend; decide which sections show.
  permissions?: Set<string>;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
  onCreateTask?: () => void;
  showCreateTask?: boolean;
}

export function AppSidebar({ currentPage, userName, userRole, permissions = new Set(), onNavigate, onLogout }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const width = useRef(new Animated.Value(220)).current;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const fetchUnread = async () => {
      try {
        const count = await ApiService.getUnreadNotificationCount();
        if (mounted.current) setUnreadCount(count);
      } catch {}
    };
    fetchUnread();
    const pollTimer = setInterval(fetchUnread, 30000);
    return () => {
      mounted.current = false;
      clearInterval(pollTimer);
    };
  }, []);

  useEffect(() => {
    Animated.timing(width, {
      toValue: collapsed ? 60 : 220,
      duration: 220,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [collapsed, width]);

  const openNotifications = async () => {
    await ApiService.markAllNotificationsRead();
    if (mounted.current) setUnreadCount(0);
    if (!mounted.current) return;
    await showDialog((pop) => <NotificationPanel onClose={() => pop()} />);
  };

  const { main, management } = navEntries(permissions);
  const item = (e: NavEntry) => (
    <NavItem
      key={e.page}
      icon={e.icon}
      label={e.label}
      isActive={currentPage === e.page}
      collapsed={collapsed}
      onTap={() => onNavigate(e.page)}
    />
  );

  return (
    <Animated.View style={{ width, backgroundColor: kSidebarBg, overflow: 'hidden' }}>
      {/* ── Header ── */}
      <View style={styles.header}>
        {collapsed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Tap onPress={() => setCollapsed(false)}>
              <Icon name="chevron_right" color={kMuted} size={18} />
            </Tap>
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <TaskNetLogo size={30} />
            <View style={{ width: 10 }} />
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text numberOfLines={1} style={ts({ color: '#FFFFFF', size: 15, weight: 700, spacing: -0.2 })}>TaskNet</Text>
              <Text numberOfLines={1} style={ts({ color: 'rgba(255,255,255,0.55)', size: 10 })}>Management System</Text>
            </View>
            <Tap onPress={() => setCollapsed(true)}>
              <Icon name="chevron_left" color={kMuted} size={18} />
            </Tap>
          </View>
        )}
      </View>

      {/* ── Nav items ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}>
        {!collapsed && <SectionLabel text="MAIN MENU" top={8} />}
        {main.map(item)}
        {!collapsed && <SectionLabel text="MANAGEMENT" top={8} />}
        {management.map(item)}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {collapsed ? (
          <HoverScale onPress={onLogout}>
            <View style={{ alignItems: 'center' }}>
              <Icon name="logout_rounded" color={kMuted} size={18} />
            </View>
          </HoverScale>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CircleAvatar radius={17} backgroundColor="rgba(255,255,255,0.15)">
                <Text style={tsAvatar(13, 600, '#FFFFFF')}>
                  {userName.length > 0 ? userName[0].toUpperCase() : 'U'}
                </Text>
              </CircleAvatar>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={ts({ color: '#FFFFFF', size: 13, weight: 600 })}>{userName}</Text>
                <Text numberOfLines={1} style={ts({ color: 'rgba(255,255,255,0.6)', size: 11 })}>{roleLabelFor(userRole)}</Text>
              </View>
            </View>
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Notification bell */}
              <Tap onPress={openNotifications}>
                <View style={styles.bell}>
                  <Icon name="notifications_outlined" color="rgba(255,255,255,0.8)" size={17} />
                </View>
                {unreadCount > 0 && (
                  <View style={styles.unread}>
                    <Text style={ts({ color: '#FFFFFF', size: 9, weight: 700 })}>
                      {unreadCount > 9 ? '9+' : `${unreadCount}`}
                    </Text>
                  </View>
                )}
              </Tap>
              <View style={{ width: 8 }} />
              {/* Logout */}
              <HoverScale onPress={onLogout} style={{ flex: 1 }}>
                <LogoutButton />
              </HoverScale>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function LogoutButton() {
  return (
    <View style={styles.logout}>
      <Icon name="logout_rounded" color="rgba(255,255,255,0.8)" size={15} />
      <View style={{ width: 7 }} />
      <Text style={ts({ color: 'rgba(255,255,255,0.8)', size: 12, weight: 500 })}>Logout</Text>
    </View>
  );
}

function SectionLabel({ text, top }: { text: string; top: number }) {
  return (
    <View style={{ paddingLeft: 12, paddingTop: top, paddingRight: 12, paddingBottom: 4 }}>
      <Text numberOfLines={1} style={ts({ color: withOpacity(kMuted, 0.7), size: 10, weight: 600, spacing: 0.8 })}>{text}</Text>
    </View>
  );
}

// ── Nav Item (shared by desktop + mobile drawer) ──────────────────────────────

function NavItem({ icon, label, isActive, onTap, collapsed = false }: {
  icon: IconName;
  label: string;
  isActive: boolean;
  onTap: () => void;
  collapsed?: boolean;
}) {
  return (
    <Pressable onPress={onTap} style={{ cursor: 'auto' } as ViewStyle}>
      {({ hovered }: { hovered?: boolean }) => {
        const lit = isActive || hovered;
        return (
          <View
            style={[
              styles.navItem,
              { backgroundColor: isActive ? kActiveBg : hovered ? kHoverBg : 'transparent' },
            ]}
          >
            {/* Active indicator bar */}
            <View style={[styles.navBar, { backgroundColor: isActive ? '#FFFFFF' : 'transparent' }]} />
            <Icon name={icon} size={17} color={lit ? '#FFFFFF' : kMuted} />
            {!collapsed && (
              <>
                <View style={{ width: 9 }} />
                <Text
                  numberOfLines={1}
                  style={[ts({ color: lit ? '#FFFFFF' : kMuted, size: 13, weight: isActive ? 600 : 400, spacing: 0.1 }), { flex: 1 }]}
                >
                  {label}
                </Text>
              </>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

// ── Mobile Hamburger Drawer ───────────────────────────────────────────────────

interface MobileNavDrawerProps {
  currentPage: NavPage;
  userName: string;
  userRole: string;
  /// Permissions granted by the backend; decide which sections show.
  permissions?: Set<string>;
  userInitials: string;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
  /// Closes the drawer.
  onClose: () => void;
}

export function MobileNavDrawer({
  currentPage,
  userName,
  userRole,
  permissions = new Set(),
  userInitials,
  onNavigate,
  onLogout,
  onClose,
}: MobileNavDrawerProps) {
  const navigate = (page: NavPage) => {
    onClose();
    onNavigate(page);
  };
  const { main, management } = navEntries(permissions);
  const item = (e: NavEntry) => (
    <NavItem key={e.page} icon={e.icon} label={e.label} isActive={currentPage === e.page} onTap={() => navigate(e.page)} />
  );

  return (
    <View style={styles.drawer}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={[styles.header, { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }]}>
          <TaskNetLogo size={30} />
          <View style={{ width: 10 }} />
          <View style={{ justifyContent: 'center' }}>
            <Text style={ts({ color: '#FFFFFF', size: 15, weight: 700 })}>TaskNet</Text>
            <Text style={ts({ color: 'rgba(255,255,255,0.55)', size: 10 })}>Management System</Text>
          </View>
        </View>

        {/* ── Nav items ── */}
        <View style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 8, overflow: 'hidden' }}>
          <SectionLabel text="MAIN MENU" top={4} />
          {main.map(item)}
          <SectionLabel text="MANAGEMENT" top={4} />
          {management.map(item)}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CircleAvatar radius={17} backgroundColor="rgba(255,255,255,0.15)">
              <Text style={tsAvatar(12, 600, '#FFFFFF')}>{userInitials}</Text>
            </CircleAvatar>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={ts({ color: '#FFFFFF', size: 13, weight: 600 })}>{userName}</Text>
              <Text style={ts({ color: 'rgba(255,255,255,0.6)', size: 11 })}>{roleLabelFor(userRole)}</Text>
            </View>
          </View>
          <View style={{ height: 10 }} />
          <HoverScale
            onPress={() => {
              onClose();
              onLogout();
            }}
          >
            <LogoutButton />
          </HoverScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function roleLabelFor(role: string): string {
  switch (role) {
    case 'admin':       return 'Administrator';
    case 'principal':   return 'Principal';
    case 'coordinator': return 'Coordinator';
    case 'dean':        return 'Dean';
    case 'teacher':     return 'Teacher';
    case 'registrar':   return 'Registrar';
    default:            return role;
  }
}

// ── Notification Panel ────────────────────────────────────────────────────────

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Json[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await ApiService.getNotifications();
        if (mounted) {
          setItems(data);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const remove = async (id: number) => {
    await ApiService.deleteNotification(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <Dialog radius={16}>
      <View style={{ width: 360, maxWidth: '100%', height: 480, maxHeight: '100%' }}>
        <View style={{ paddingLeft: 20, paddingTop: 18, paddingRight: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="notifications_outlined" size={18} color="#1A1A2E" />
          <View style={{ width: 8 }} />
          <Text style={[ts({ size: 15, weight: 700, color: '#1A1A2E' }), { flex: 1 }]}>Notifications</Text>
          <IconButton icon="close" size={18} padding={0} minSize={32} onPress={onClose} />
        </View>
        <Divider height={16} />
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.center}>
              <CircularProgressIndicator strokeWidth={2} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.center}>
              <Icon name="notifications_none_outlined" size={40} color="#B0B7C3" />
              <View style={{ height: 10 }} />
              <Text style={ts({ size: 13, color: '#718096' })}>No notifications yet</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 4 }}>
              {items.map((n, i) => {
                const isRead = n.is_read === 1;
                const type = n.type?.toString() ?? 'general';
                const icon: IconName =
                  type === 'task' ? 'task_alt_outlined' : type === 'event' ? 'event_outlined' : 'info_outline';
                const iconColor = type === 'task' ? '#60A5FA' : type === 'event' ? '#48BB78' : '#ED8936';
                const body = n.body?.toString() ?? '';
                return (
                  <React.Fragment key={n.id as number}>
                    {i > 0 && <Divider height={1} />}
                    <View style={[styles.tile, { minHeight: (body.length > 0 ? 64 : 48) + densityDy }]}>
                      <CircleAvatar radius={16} backgroundColor={withOpacity(iconColor, 0.12)}>
                        <Icon name={icon} size={16} color={iconColor} />
                      </CircleAvatar>
                      <View style={{ width: 16 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={tsField({ size: 13, weight: isRead ? 400 : 600, color: '#1A1A2E' })}>
                          {n.title?.toString() ?? ''}
                        </Text>
                        {body.length > 0 && (
                          <Text numberOfLines={1} style={ts({ size: 11, color: '#718096' })}>{body}</Text>
                        )}
                      </View>
                      <View style={{ width: 16 }} />
                      <IconButton
                        icon="close"
                        size={14}
                        color="#B0B7C3"
                        padding={0}
                        minSize={24}
                        onPress={() => remove(n.id as number)}
                      />
                    </View>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 62,
    borderBottomWidth: 1,
    borderBottomColor: kDivider,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: kDivider,
  },
  bell: {
    width: 34,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unread: {
    position: 'absolute',
    top: -4,
    right: -4,
    padding: 3,
    backgroundColor: '#E53E3E',
    borderRadius: 999,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 7,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    paddingVertical: 9,
    borderRadius: 8,
  },
  navBar: {
    width: 3,
    height: 16,
    marginLeft: 10,
    marginRight: 8,
    borderRadius: 2,
  },
  drawer: {
    width: 240,
    flex: 1,
    backgroundColor: kSidebarBg,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
