import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { api, qk } from '@tasknet/shared';
import type { IconName } from '@/components/ui';
import { colors } from '@/theme';

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  const unread = useQuery({ queryKey: qk.unreadCount, queryFn: api.notifications.unreadCount, refetchInterval: 30_000 });
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.dark, tabBarInactiveTintColor: colors.light,
      headerStyle: { backgroundColor: colors.card }, headerTitleStyle: { fontWeight: '700' },
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: icon('checkbox-outline') }} />
      <Tabs.Screen name="events" options={{ title: 'Events', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="alerts" options={{
        title: 'Alerts', tabBarIcon: icon('notifications-outline'),
        tabBarBadge: unread.data ? (unread.data > 99 ? '99+' : unread.data) : undefined,
      }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('menu-outline') }} />
    </Tabs>
  );
}
