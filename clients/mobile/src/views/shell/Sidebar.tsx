import { Image, Pressable, ScrollView, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { DrawerContentComponentProps } from 'expo-router/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navigation, NavItem } from '@shared/controllers/Navigation';
import { useApp, useSession } from '../../core/AppModel';
import { useFeedback } from '../../ui/feedback';
import { Avatar, C, Icon, NAV_ICON, T } from '../../ui/kit';

/** Drawer contents: the sections this session may see (from the backend's permissions), profile and logout. */
export function Sidebar({ navigation }: DrawerContentComponentProps) {
  const app = useApp();
  const { user } = useSession();
  const path = usePathname();
  const fb = useFeedback();
  const insets = useSafeAreaInsets();
  const items = Navigation.itemsFor(user);
  const active = Navigation.pageOf(path);
  const sections = (['MAIN MENU', 'MANAGEMENT'] as const).map((s) => [s, items.filter((i) => i.section === s)] as const).filter(([, l]) => l.length);

  const go = (item: NavItem) => {
    navigation.closeDrawer();
    router.navigate(item.path as never);
  };
  const logout = async () => {
    if (await fb.confirm({ title: 'Log out?', confirmLabel: 'Log out' })) {
      navigation.closeDrawer();
      await app.session.logout();
      router.replace('/login');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.dark, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, marginBottom: 14 }}>
        <Image source={require('../../../assets/images/tasknet-logo.png')} style={{ width: 32, height: 32, tintColor: '#fff' }} />
        <View>
          <T size={16} weight={800} color="#fff">TaskNet</T>
          <T size={11} color="rgba(255,255,255,0.6)">Management System</T>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10 }}>
        {sections.map(([title, list]) => (
          <View key={title} style={{ marginBottom: 8 }}>
            <T size={10.5} weight={700} color="rgba(255,255,255,0.45)" style={{ paddingHorizontal: 10, marginVertical: 6, letterSpacing: 0.6 }}>{title}</T>
            {list.map((item) => {
              const on = item.page === active;
              return (
                <Pressable key={item.page} onPress={() => go(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, backgroundColor: on ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
                  <Icon name={NAV_ICON[item.icon]} size={19} color={on ? '#fff' : 'rgba(255,255,255,0.7)'} />
                  <T size={14} weight={on ? 700 : 500} color={on ? '#fff' : 'rgba(255,255,255,0.78)'}>{item.label}</T>
                </Pressable>
              );
            })}
          </View>
        ))}
        {/* Phones only: scan an activity's Time In / Time Out QR. */}
        <Pressable onPress={() => { navigation.closeDrawer(); router.push('/scan'); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Icon name="camera" size={19} color="rgba(255,255,255,0.85)" />
          <T size={14} weight={600} color="rgba(255,255,255,0.9)">Scan attendance QR</T>
        </Pressable>
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 12, paddingHorizontal: 14, gap: 10 }}>
        <Pressable onPress={() => { navigation.closeDrawer(); router.navigate('/profile'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar url={user?.avatarUrl} initials={user?.initials ?? 'U'} size={38} />
          <View style={{ flex: 1 }}>
            <T size={14} weight={700} color="#fff" lines={1}>{Navigation.displayName(user)}</T>
            <T size={12} color="rgba(255,255,255,0.6)">{Navigation.roleTitle(user?.role ?? '')}</T>
          </View>
        </Pressable>
        <Pressable onPress={() => void logout()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <Icon name="log-out" size={17} color="#fff" />
          <T size={13.5} weight={600} color="#fff">Logout</T>
        </Pressable>
      </View>
    </View>
  );
}
