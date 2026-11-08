import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, CalendarDays, CalendarRange, CheckSquare, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, History, LayoutDashboard, LogOut, Star, Users, Award, ListChecks, X } from 'lucide-react';
import { IconName, Navigation } from '@shared/controllers/Navigation';
import { useSession } from '../../app/AppContext';
import { Avatar } from '../../ui/kit';
import { NotificationBell } from './Notifications';

// Dark sidebar (also the phone drawer): pages allowed by the session's permissions.
export const NAV_ICONS: Record<IconName, React.ComponentType<{ size?: number }>> = {
  dashboard: LayoutDashboard,
  assignment: ClipboardList,
  star: Star,
  calendar: Calendar,
  checkbox: CheckSquare,
  starTask: ListChecks,
  people: Users,
  appraisal: Award,
  event: CalendarDays,
  dateRange: CalendarRange,
  history: History,
  advisory: GraduationCap,
};

export function Sidebar({ collapsed, onToggle, mobile, onNotifications }: {
  collapsed: boolean; onToggle: () => void; mobile: boolean; onNotifications: () => void;
}) {
  const { user, session } = useSession();
  const loc = useLocation();
  const navigate = useNavigate();
  const items = Navigation.itemsFor(user);
  const current = Navigation.pageOf(loc.pathname);
  const name = Navigation.displayName(user);

  const section = (label: string) => !collapsed && <div className="sidebar-section">{label}</div>;
  const renderItems = (sec: string) => items.filter((i) => i.section === sec).map((i) => {
    const Icon = NAV_ICONS[i.icon];
    return (
      <button key={i.page} className={`nav-item ${current === i.page ? 'active' : ''}`} title={collapsed ? i.label : undefined}
        onClick={() => navigate(i.path)}>
        <span className="nav-bar" />
        <Icon size={17} />
        <span className="nav-label ellipsis">{i.label}</span>
      </button>
    );
  });

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {collapsed ? (
          <button className="icon-btn-plain" onClick={onToggle} aria-label="Expand sidebar"><ChevronRight size={18} /></button>
        ) : (
          <>
            <img src="/images/tasknet-logo.png" alt="" width={30} height={30} />
            <div className="grow">
              <div className="sidebar-brand">TaskNet</div>
              <div className="sidebar-sub">Management System</div>
            </div>
            <button className="icon-btn-plain" onClick={onToggle} aria-label={mobile ? 'Close menu' : 'Collapse sidebar'}>
              {mobile ? <X size={18} /> : <ChevronLeft size={18} />}
            </button>
          </>
        )}
      </div>
      <nav className="sidebar-nav">
        {section('MAIN MENU')}
        {renderItems('MAIN MENU')}
        {section('MANAGEMENT')}
        {renderItems('MANAGEMENT')}
      </nav>
      <div className="sidebar-footer">
        {collapsed ? (
          <button className="icon-btn-plain" style={{ width: '100%', justifyContent: 'center' }} onClick={() => void session.logout()} title="Logout">
            <LogOut size={18} />
          </button>
        ) : (
          <>
            <div className="row gap-12">
              <Avatar url={user?.avatarUrl} initials={name.charAt(0).toUpperCase() || 'U'} size={34} bg="rgba(255,255,255,0.15)" />
              <div className="grow">
                <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{Navigation.roleTitle(user?.role ?? '')}</div>
              </div>
            </div>
            <div className="row mt-12">
              {!mobile && <NotificationBell onClick={onNotifications} light />}
              <button className="sidebar-btn grow" onClick={() => void session.logout()}>
                <LogOut size={15} /> Logout
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
