import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { roleLabel, useSession, useUser } from '@tasknet/shared';
import { Avatar, Button, confirm, Screen, T, type IconName } from '@/components/ui';
import { API_BASE } from '@/lib/api';
import { colors } from '@/theme';

function Item({ icon, label, href }: { icon: IconName; label: string; href: Href }) {
  return (
    <Pressable onPress={() => router.push(href)} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: pressed ? '#F6F8FC' : colors.card })}>
      <Ionicons name={icon} size={21} color={colors.text} />
      <T style={{ flex: 1, fontWeight: '600' }}>{label}</T>
      <Ionicons name="chevron-forward" size={18} color={colors.light} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const user = useUser();
  const { can, logout } = useSession();
  const items: [IconName, string, Href, boolean][] = [
    ['person-circle-outline', 'My profile', '/profile', true],
    ['qr-code-outline', 'Scan attendance QR', '/scan', true],
    ['trophy-outline', 'My performance & badges', '/appraisal', can('view_appraisal') && can('receive_tasks')],
    ['people-outline', 'Personnel', '/personnel', can('view_personnel')],
    ['time-outline', 'Audit log', '/audit-log', can('view_audit')],
  ];

  const signOut = async () => {
    if (await confirm('Log out', 'Log out of TaskNet on this device?', 'Log out', true)) await logout();
  };

  return (
    <Screen>
      <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={user.full_name} size={52} />
        <View style={{ flex: 1 }}>
          <T v="h2">{user.full_name}</T>
          <T v="muted">{roleLabel(user.role)}{user.grade_level ? ` · ${user.grade_level}` : ''}</T>
        </View>
      </View>
      <View style={{ borderRadius: 16, overflow: 'hidden', marginTop: 16, gap: 1, backgroundColor: colors.border }}>
        {items.filter(([, , , show]) => show).map(([icon, label, href]) => <Item key={label} icon={icon} label={label} href={href} />)}
      </View>
      <T v="small" style={{ marginTop: 16, textAlign: 'center' }}>
        Creating tasks and event proposals, school years and the DepEd calendar are managed in the TaskNet web app.
      </T>
      <Button title="Log out" icon="log-out-outline" kind="outline" style={{ marginTop: 16 }} onPress={() => void signOut()} />
      <T v="small" style={{ marginTop: 10, textAlign: 'center', color: colors.light }}>Server: {API_BASE}</T>
    </Screen>
  );
}
