import { useEffect } from 'react';
import { Bell, BellOff, CalendarDays, CheckSquare, Info, X } from 'lucide-react';
import { AppNotification } from '@shared/models';
import { Format } from '@shared/utils/format';
import { useApp } from '../../app/AppContext';
import { useControllerState } from '../../app/hooks';
import { IconButton, Modal, Spinner } from '../../ui/kit';

// Notification bell with unread count, and the notification panel.
export function NotificationBell({ onClick, light }: { onClick: () => void; light: boolean }) {
  const app = useApp();
  const { unread } = useControllerState(app.notifications);
  return (
    <button onClick={onClick} aria-label="Notifications" title="Notifications"
      className={light ? 'sidebar-btn' : 'icon-btn'}
      style={{ position: 'relative', width: light ? 34 : 38, height: 34, padding: 0, background: light ? undefined : '#fff' }}>
      <Bell size={17} />
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4, background: '#e53e3e', color: '#fff', borderRadius: 10, fontSize: 9,
          fontWeight: 700, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
        }}>{unread > 9 ? '9+' : unread}</span>
      )}
    </button>
  );
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const s = useControllerState(app.notifications);
  useEffect(() => { void app.notifications.open(); }, [app]);
  return (
    <Modal title="Notifications" onClose={onClose} icon={<Bell size={18} style={{ marginTop: 3 }} />}>
      {s.loading ? (
        <div className="center-fill"><Spinner /></div>
      ) : s.items.length === 0 ? (
        <div className="empty"><BellOff size={40} /><div>No notifications yet</div></div>
      ) : (
        <div>
          {s.items.map((n) => <NotificationRow key={n.id} n={n} onDelete={() => void app.notifications.remove(n.id)} />)}
        </div>
      )}
    </Modal>
  );
}

export function NotificationRow({ n, onDelete }: { n: AppNotification; onDelete: () => void }) {
  const color = n.type === 'task' ? '#60a5fa' : n.type === 'event' ? '#48bb78' : '#ed8936';
  const Icon = n.type === 'task' ? CheckSquare : n.type === 'event' ? CalendarDays : Info;
  return (
    <div className="list-item">
      <span className="avatar" style={{ width: 32, height: 32, background: `${color}1f`, color }}><Icon size={16} /></span>
      <div className="grow">
        <div style={{ fontSize: 13, fontWeight: n.isRead ? 400 : 600 }}>{n.title}</div>
        {n.message && <div className="caption clamp-2">{n.message}</div>}
        <div className="body-sm">{Format.ago(n.createdAt)}</div>
      </div>
      <IconButton small title="Dismiss" onClick={onDelete}><X size={14} /></IconButton>
    </div>
  );
}
