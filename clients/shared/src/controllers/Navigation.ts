import { User } from '../models';

export type NavPage =
  | 'dashboard' | 'myTasks' | 'mySpecialTasks' | 'activity' | 'advisory' | 'taskManager' | 'specialTasks'
  | 'personnel' | 'appraisal' | 'events' | 'schoolYears' | 'auditLog';

/** Icon names are semantic; each platform maps them to its icon set. */
export type IconName =
  | 'dashboard' | 'assignment' | 'star' | 'calendar' | 'checkbox' | 'starTask' | 'people' | 'appraisal'
  | 'event' | 'dateRange' | 'history' | 'advisory';

export interface NavItem {
  page: NavPage;
  label: string;
  path: string;
  icon: IconName;
  section: 'MAIN MENU' | 'MANAGEMENT';
}

const ALL: (NavItem & { permission?: string })[] = [
  { page: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'dashboard', section: 'MAIN MENU' },
  { page: 'myTasks', label: 'My Tasks', path: '/my-tasks', icon: 'assignment', section: 'MAIN MENU', permission: 'receive_tasks' },
  { page: 'mySpecialTasks', label: 'My Special Tasks', path: '/my-special-tasks', icon: 'star', section: 'MAIN MENU', permission: 'receive_tasks' },
  // Class advisers (advise_section is granted per person by the backend): the calendar's tasks for their class.
  { page: 'advisory', label: 'Advisory', path: '/advisory', icon: 'advisory', section: 'MAIN MENU', permission: 'advise_section' },
  { page: 'activity', label: 'Activity', path: '/activity', icon: 'calendar', section: 'MAIN MENU' },
  { page: 'taskManager', label: 'Task Manager', path: '/tasks', icon: 'checkbox', section: 'MANAGEMENT', permission: 'create_tasks' },
  { page: 'specialTasks', label: 'Special Tasks', path: '/special-tasks', icon: 'starTask', section: 'MANAGEMENT', permission: 'create_tasks' },
  { page: 'personnel', label: 'Personnel', path: '/personnel', icon: 'people', section: 'MANAGEMENT', permission: 'view_personnel' },
  { page: 'appraisal', label: 'Appraisal', path: '/appraisal', icon: 'appraisal', section: 'MANAGEMENT', permission: 'view_appraisal' },
  { page: 'events', label: 'Events', path: '/events', icon: 'event', section: 'MANAGEMENT' },
  { page: 'schoolYears', label: 'School Year', path: '/school-years', icon: 'dateRange', section: 'MANAGEMENT', permission: 'manage_school_years' },
  { page: 'auditLog', label: 'Audit Log', path: '/audit-log', icon: 'history', section: 'MANAGEMENT', permission: 'view_audit' },
];

/** Which pages a session sees and how locations map to them (sidebar / drawer / tabs). */
export class Navigation {
  /** Sections follow the permissions the backend granted this session. */
  static itemsFor(user: User | null): NavItem[] {
    return ALL.filter((i) => !i.permission || (user?.can(i.permission) ?? false));
  }

  static pageOf(location: string): NavPage {
    if (location.startsWith('/my-special-tasks')) return 'mySpecialTasks';
    if (location.startsWith('/special-tasks')) return 'specialTasks';
    if (location.startsWith('/tasks')) return 'taskManager';
    if (location.startsWith('/advisory')) return 'advisory';
    if (location.startsWith('/my-tasks')) return 'myTasks';
    if (location.startsWith('/activity')) return 'activity';
    if (location.startsWith('/personnel')) return 'personnel';
    if (location.startsWith('/appraisal')) return 'appraisal';
    if (location.startsWith('/events')) return 'events';
    if (location.startsWith('/school-years')) return 'schoolYears';
    if (location.startsWith('/audit-log')) return 'auditLog';
    return 'dashboard';
  }

  /** Name shown in the top bar: first + last name, without a role prefix ("Principal Ana" → "Ana"). */
  static displayName(user: User | null): string {
    if (!user) return 'User';
    const raw = user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : user.fullName || 'User';
    const prefix = `${user.role.toLowerCase()} `;
    return raw.toLowerCase().startsWith(prefix) ? raw.slice(prefix.length).trim() : raw;
  }

  /** Sidebar role label ("Administrator" for admin). */
  static roleTitle(role: string): string {
    return role === 'admin' ? 'Administrator' : role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  }

  /** Top-bar actions for the current location. */
  static topBarActions(location: string, user: User | null): { createTask?: { label: string; path: string }; createTemplate?: string } {
    const out: { createTask?: { label: string; path: string }; createTemplate?: string } = {};
    if ((location === '/tasks' || location === '/special-tasks') && user?.can('create_tasks')) {
      const special = location.startsWith('/special-tasks');
      out.createTask = { label: special ? 'Create Special Task' : 'Create Task', path: special ? '/special-tasks/new' : '/tasks/new' };
    }
    if (location === '/tasks' && user?.can('manage_templates')) out.createTemplate = '/tasks/template';
    return out;
  }
}
