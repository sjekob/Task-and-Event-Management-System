import { FlatList, Pressable, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, parseTimestamp, qk, timeAgo, type AppNotification } from '@tasknet/shared';
import { Button, Empty, ErrorView, IconButton, Loading, notifyError, Row, T, type IconName } from '@/components/ui';
import { colors } from '@/theme';

const ICONS: Record<AppNotification['type'], IconName> = {
  task: 'checkbox-outline', event: 'calendar-outline', comment: 'chatbubble-outline', general: 'notifications-outline',
};

export default function AlertsScreen() {
  const qc = useQueryClient();
  const navigation = useNavigation();
  const list = useQuery({ queryKey: qk.notifications, queryFn: api.notifications.list });
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: qk.notifications }),
  ]);
  const markAll = useMutation({ mutationFn: api.notifications.markAllRead, onSuccess: refresh, onError: (e) => notifyError(e) });
  const remove = useMutation({ mutationFn: api.notifications.remove, onSuccess: refresh, onError: (e) => notifyError(e) });
  const hasUnread = (list.data ?? []).some((n) => !n.is_read);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => hasUnread
        ? <Button title="Mark all read" kind="ghost" small onPress={() => markAll.mutate()} loading={markAll.isPending} /> : null,
    });
  }, [navigation, hasUnread, markAll]);

  const open = async (n: AppNotification) => {
    if (!n.is_read) {
      try { await api.notifications.markRead(n.id); } catch { /* still open it */ }
      void refresh();
    }
    if (!n.ref_id) return;
    if (n.type === 'event') router.push({ pathname: '/event/[id]', params: { id: String(n.ref_id) } });
    else if (n.type === 'task' || n.type === 'comment') router.push({ pathname: '/task/[id]', params: { id: String(n.ref_id) } });
  };

  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorView error={list.error} onRetry={() => list.refetch()} />;
  return (
    <FlatList data={list.data} keyExtractor={(n) => String(n.id)} style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }} onRefresh={() => void list.refetch()} refreshing={list.isRefetching}
      ListEmptyComponent={<Empty title="No notifications" icon="notifications-off-outline" />}
      renderItem={({ item: n }) => (
        <Pressable onPress={() => void open(n)} accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: n.is_read ? colors.card : '#EEF4FF', borderRadius: 14, padding: 14, marginBottom: 8,
            opacity: pressed ? 0.85 : 1,
          })}>
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={ICONS[n.type] ?? 'notifications-outline'} size={17} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: n.is_read ? '500' : '700' }}>{n.title}</T>
              {n.body ? <T v="muted" numberOfLines={3}>{n.body}</T> : null}
              <T v="small" style={{ marginTop: 4 }}>{timeAgo(parseTimestamp(n.created_at))}</T>
            </View>
            <IconButton icon="close" size={18} color={colors.light} label="Dismiss notification" onPress={() => remove.mutate(n.id)} />
          </Row>
        </Pressable>
      )} />
  );
}
