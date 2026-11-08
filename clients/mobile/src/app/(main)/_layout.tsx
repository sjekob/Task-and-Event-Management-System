import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Navigation } from '@shared/controllers/Navigation';
import { useApp, useSession } from '../../core/AppModel';
import { RequireAuth } from '../../core/RequireAuth';
import { Avatar, C, FONT, IconButton } from '../../ui/kit';
import { NotificationBell, NotificationPanel } from '../../views/shell/Notifications';
import { Sidebar } from '../../views/shell/Sidebar';

const SCREENS: [string, string][] = [
  ['dashboard', 'Dashboard'], ['my-tasks', 'My Tasks'], ['my-special-tasks', 'My Special Tasks'], ['advisory', 'Advisory'], ['activity', 'Activity'],
  ['tasks', 'Task Manager'], ['special-tasks', 'Special Tasks'], ['personnel', 'Personnel'], ['appraisal', 'Appraisal'],
  ['events', 'Events'], ['school-years', 'School Year'], ['audit-log', 'Audit Log'], ['profile', 'My Profile'],
];

/** Signed-in layout: drawer navigation, a header with create / notifications / profile, and notification polling. */
export default function MainLayout() {
  const app = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  useEffect(() => {
    app.notifications.start();
    return () => app.notifications.stop();
  }, [app]);

  return (
    <RequireAuth>
      <Drawer
        drawerContent={(props) => <Sidebar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: FONT[700], fontSize: 17, color: C.text },
          headerTintColor: C.text,
          drawerStyle: { width: 280, backgroundColor: C.dark },
          sceneStyle: { backgroundColor: C.bg },
          headerRight: () => <HeaderActions onNotifications={() => setNotifOpen(true)} />,
        }}
      >
        {SCREENS.map(([name, title]) => <Drawer.Screen key={name} name={name} options={{ title }} />)}
      </Drawer>
      {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
    </RequireAuth>
  );
}

/** Create button for the current page (task manager), notifications and the profile avatar. */
function HeaderActions({ onNotifications }: { onNotifications: () => void }) {
  const { user } = useSession();
  const path = usePathname();
  const actions = Navigation.topBarActions(path, user);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 12 }}>
      {actions.createTemplate && <IconButton name="book" label="Create template" onPress={() => router.push({ pathname: '/task-form', params: { mode: 'template' } })} />}
      {actions.createTask && (
        <IconButton name="plus" label={actions.createTask.label} bg={C.dark} color="#fff" size={18}
          onPress={() => router.push({ pathname: '/task-form', params: { mode: 'create', category: path.startsWith('/special-tasks') ? 'special' : 'common' } })} />
      )}
      <NotificationBell onPress={onNotifications} />
      <Pressable onPress={() => router.navigate('/profile')} accessibilityLabel="My profile" style={{ marginLeft: 4 }}>
        <Avatar url={user?.avatarUrl} initials={user?.initials ?? 'U'} size={32} />
      </Pressable>
    </View>
  );
}
