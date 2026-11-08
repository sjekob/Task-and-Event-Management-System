import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppNotification } from '@shared/models';
import { Format } from '@shared/utils/format';
import { useApp } from '../../core/AppModel';
import { useControllerState } from '../../core/hooks';
import { C, Empty, Icon, IconButton, Loading, Modal, T } from '../../ui/kit';

/** Bell with the unread count (polled by the NotificationController). */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const app = useApp();
  const { unread } = useControllerState(app.notifications);
  return (
    <Pressable onPress={onPress} accessibilityLabel="Notifications" hitSlop={6} style={{ padding: 6 }}>
      <Icon name="bell" size={21} />
      {unread > 0 && (
        <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#e53e3e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <T size={9} weight={700} color="#fff">{unread > 9 ? '9+' : unread}</T>
        </View>
      )}
    </Pressable>
  );
}

const TYPE: Record<string, { icon: 'check-square' | 'calendar' | 'info'; color: string }> = {
  task: { icon: 'check-square', color: '#60a5fa' },
  event: { icon: 'calendar', color: '#48bb78' },
};

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const s = useControllerState(app.notifications);
  useEffect(() => { void app.notifications.open(); }, [app]);

  const open = (n: AppNotification) => {
    if (!n.refId) return;
    onClose();
    if (n.type === 'task') router.push({ pathname: '/task/[id]', params: { id: String(n.refId), own: '1' } });
    else if (n.type === 'event') router.push({ pathname: '/events', params: { open: String(n.refId) } });
  };

  return (
    <Modal title="Notifications" icon="bell" onClose={onClose}>
      {s.loading ? <Loading /> : s.items.length === 0 ? <Empty icon="bell-off" title="No notifications yet" /> : s.items.map((n) => {
        const t = TYPE[n.type] ?? { icon: 'info' as const, color: '#ed8936' };
        return (
          <Pressable key={n.id} onPress={() => open(n)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${t.color}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={t.icon} size={16} color={t.color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={13.5} weight={n.isRead ? 400 : 600}>{n.title}</T>
              {n.message ? <T size={12} color={C.muted} lines={2}>{n.message}</T> : null}
              <T size={11.5} color={C.light}>{Format.ago(n.createdAt)}</T>
            </View>
            <IconButton name="x" size={16} label="Dismiss" color={C.muted} onPress={() => void app.notifications.remove(n.id)} />
          </Pressable>
        );
      })}
    </Modal>
  );
}
