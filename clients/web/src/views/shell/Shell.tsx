import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LibraryBig, Menu } from 'lucide-react';
import { Navigation } from '@shared/controllers/Navigation';
import { useApp, useSession } from '../../app/AppContext';
import { useIsMobile } from '../../app/hooks';
import { Avatar, Button } from '../../ui/kit';
import { NotificationBell, NotificationPanel } from './Notifications';
import { Sidebar } from './Sidebar';

/** Signed-in layout: sidebar (drawer on phones), top bar and the routed page. */
export default function Shell() {
  const app = useApp();
  const { user } = useSession();
  const loc = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    app.notifications.start();
    return () => app.notifications.stop();
  }, [app]);
  useEffect(() => setDrawer(false), [loc.pathname]);

  const actions = Navigation.topBarActions(loc.pathname, user);
  const name = Navigation.displayName(user);

  const sidebar = (
    <Sidebar
      collapsed={!isMobile && collapsed}
      onToggle={isMobile ? () => setDrawer(false) : () => setCollapsed((c) => !c)}
      mobile={isMobile}
      onNotifications={() => setNotifOpen(true)}
    />
  );

  return (
    <div className="shell">
      {!isMobile && sidebar}
      {isMobile && drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer">{sidebar}</div>
        </>
      )}
      <div className="shell-main">
        <header className="topbar">
          {isMobile ? (
            <button className="icon-btn" style={{ background: 'var(--dark)', color: '#fff', width: 38, height: 38, borderRadius: 10 }}
              onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
          ) : (
            <div className="topbar-title ellipsis">{name}</div>
          )}
          <div className="grow" />
          {isMobile && <NotificationBell onClick={() => setNotifOpen(true)} light={false} />}
          {!isMobile && actions.createTemplate && (
            <Button variant="outline" icon={<LibraryBig size={15} />} onClick={() => navigate(actions.createTemplate!)}>Create Template</Button>
          )}
          {actions.createTask && (
            <Button onClick={() => navigate(actions.createTask!.path)}>{isMobile ? 'Create' : actions.createTask.label}</Button>
          )}
          <button className="icon-btn-plain" onClick={() => navigate('/profile')} title="My profile" style={{ padding: 0 }}>
            <Avatar url={user?.avatarUrl} initials={user?.initials ?? 'U'} size={40} />
          </button>
        </header>
        <main className="shell-content">
          <Outlet />
        </main>
      </div>
      {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
    </div>
  );
}
