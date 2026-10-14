import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AppSidebar, MobileNavDrawer, NavPage } from '../components/sidebar';
import { Icon } from '../components/ui/Icon';
import { ElevatedButton, OutlinedButton, Tap } from '../components/ui/buttons';
import { CircleAvatar, useIsMobile } from '../components/ui/misc';
import { useAppState } from '../services/appState';
import { AppTheme, ts, tsAvatar, tsPlain } from '../theme/appTheme';

function locationToPage(loc: string): NavPage {
  if (loc.startsWith('/my-special-tasks')) return NavPage.mySpecialTasks;
  if (loc.startsWith('/special-tasks')) return NavPage.specialTasks;
  if (loc.startsWith('/tasks')) return NavPage.taskManager;
  if (loc.startsWith('/my-tasks')) return NavPage.myTasks;
  if (loc.startsWith('/activity')) return NavPage.activity;
  if (loc.startsWith('/personnel')) return NavPage.personnelManagement;
  if (loc.startsWith('/appraisal')) return NavPage.appraisal;
  if (loc.startsWith('/events')) return NavPage.eventManagement;
  if (loc.startsWith('/school-years')) return NavPage.schoolYears;
  if (loc.startsWith('/audit-log')) return NavPage.auditLog;
  return NavPage.dashboard;
}

const PAGE_PATHS: Record<NavPage, string> = {
  [NavPage.dashboard]: '/dashboard',
  [NavPage.taskManager]: '/tasks',
  [NavPage.myTasks]: '/my-tasks',
  [NavPage.specialTasks]: '/special-tasks',
  [NavPage.mySpecialTasks]: '/my-special-tasks',
  [NavPage.activity]: '/activity',
  [NavPage.personnelManagement]: '/personnel',
  [NavPage.appraisal]: '/appraisal',
  [NavPage.eventManagement]: '/events',
  [NavPage.schoolYears]: '/school-years',
  [NavPage.auditLog]: '/audit-log',
};

// The create target depends on which task screen we're on.
const createPath = (loc: string): string =>
  loc.startsWith('/special-tasks') ? '/special-tasks/new' : '/tasks/new';

function stripRolePrefix(name: string, role: string): string {
  if (name.length === 0 || role.length === 0) return name;
  const prefix = role.toLowerCase();
  if (name.toLowerCase().startsWith(`${prefix} `)) {
    return name.substring(role.length + 1).trim();
  }
  return name;
}

const DRAWER_WIDTH = 240;

export default function MainShell({ children }: { children: React.ReactNode }) {
  const state = useAppState();
  const router = useRouter();
  const loc = usePathname();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  const role = state.userRole;
  const user = state.currentUser;
  const currentPage = locationToPage(loc);
  const rawName =
    user != null && (user.firstName?.length ?? 0) > 0
      ? `${user.firstName}${user.lastName != null ? ` ${user.lastName}` : ''}`
      : user?.fullName ?? 'User';
  const displayName = stripRolePrefix(rawName, role);
  const initials = user?.initials ?? 'U';
  const permissions = user?.permissions ?? new Set<string>();

  useEffect(() => {
    if (drawerOpen) setDrawerMounted(true);
    Animated.timing(drawerAnim, { toValue: drawerOpen ? 1 : 0, duration: 246, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished && !drawerOpen) setDrawerMounted(false);
      },
    );
  }, [drawerOpen, drawerAnim]);

  // The drawer only exists on mobile widths.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const onNavigate = (page: NavPage) => router.push(PAGE_PATHS[page] as never);

  const logout = async () => {
    await state.logout();
    // The root layout redirects to /login once the user is signed out.
  };

  const showCreateBtn = (loc === '/tasks' || loc === '/special-tasks') && state.can('create_tasks');
  const showTemplateBtn = loc === '/tasks' && state.can('manage_templates');

  return (
    <View style={styles.scaffold}>
      {!isMobile && (
        <AppSidebar
          currentPage={currentPage}
          userName={displayName}
          userRole={role}
          permissions={permissions}
          onNavigate={onNavigate}
          onLogout={logout}
          showCreateTask={showCreateBtn}
          onCreateTask={() => router.push(createPath(loc) as never)}
        />
      )}
      <View style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingHorizontal: isMobile ? 12 : 24 }]}>
          {isMobile ? (
            <Tap onPress={() => setDrawerOpen(true)}>
              <View style={styles.menuButton}>
                <Icon name="menu_rounded" size={20} color="#FFFFFF" />
              </View>
            </Tap>
          ) : (
            <Text style={ts({ size: 22, weight: 700, color: AppTheme.textPrimary })}>{displayName}</Text>
          )}
          <View style={{ flex: 1 }} />
          {!isMobile && showTemplateBtn && (
            <>
              <OutlinedButton
                onPress={() => router.push('/tasks/template' as never)}
                icon="library_add_outlined"
                iconSize={15}
                foregroundColor={AppTheme.accentBlue}
                side={{ color: AppTheme.accentBlue }}
                padding={[14, 10]}
                radius={8}
                textStyle={tsPlain({ weight: 600, size: 13 })}
              >
                Create Template
              </OutlinedButton>
              <View style={{ width: 8 }} />
            </>
          )}
          {showCreateBtn && (
            <ElevatedButton
              onPress={() => router.push(createPath(loc) as never)}
              backgroundColor={AppTheme.darkBanner}
              foregroundColor="#FFFFFF"
              padding={[18, 10]}
              radius={8}
              textStyle={tsPlain({ weight: 600, size: 13 })}
            >
              {loc.startsWith('/special-tasks') ? 'Create Special Task' : 'Create Task'}
            </ElevatedButton>
          )}
          <View style={{ width: 12 }} />
          <Tap onPress={() => router.push('/profile' as never)}>
            <CircleAvatar radius={20} backgroundColor={AppTheme.sidebarActive}>
              <Text style={tsAvatar(16, 700, '#FFFFFF')}>{initials}</Text>
            </CircleAvatar>
          </Tap>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>

      {isMobile && drawerMounted && (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.54)', opacity: drawerAnim }]}>
            <Pressable style={[StyleSheet.absoluteFill, { cursor: 'auto' } as ViewStyle]} onPress={() => setDrawerOpen(false)} />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: DRAWER_WIDTH,
              transform: [{ translateX: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] }) }],
            }}
          >
            <MobileNavDrawer
              currentPage={currentPage}
              userName={displayName}
              userRole={role}
              permissions={permissions}
              userInitials={initials}
              onNavigate={onNavigate}
              onLogout={logout}
              onClose={() => setDrawerOpen(false)}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scaffold: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: AppTheme.bgColor,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: AppTheme.bgColor,
  },
  menuButton: {
    width: 38,
    height: 38,
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
