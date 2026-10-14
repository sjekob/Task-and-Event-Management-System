import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@tasknet/shared';
import { AppLayout } from './layout/AppLayout';
import { PageLoader } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TaskManagerPage } from './pages/tasks/TaskManagerPage';
import { MyTasksPage } from './pages/tasks/MyTasksPage';
import { TaskFormPage } from './pages/tasks/TaskFormPage';
import { TaskDetailPage } from './pages/tasks/TaskDetailPage';
import { ActivityPage } from './pages/ActivityPage';
import { PersonnelPage } from './pages/personnel/PersonnelPage';
import { AppraisalPage } from './pages/appraisal/AppraisalPage';
import { EventsPage } from './pages/events/EventsPage';
import { EventFormPage } from './pages/events/EventFormPage';
import { EventDetailPage } from './pages/events/EventDetailPage';
import { PublicEvaluationPage } from './pages/events/PublicEvaluationPage';
import { AttendanceScanPage } from './pages/events/AttendanceScanPage';
import { SchoolYearsPage } from './pages/SchoolYearsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { ProfilePage } from './pages/profile/ProfilePage';

/** Signed-out users go to /login, remembering where they were headed (e.g. a scanned QR). */
function RequireAuth() {
  const { user, restoring } = useSession();
  const location = useLocation();
  if (restoring) return <PageLoader />;
  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
  }
  return <Outlet />;
}

function LoginRoute() {
  const { user, restoring } = useSession();
  const location = useLocation();
  if (restoring) return <PageLoader />;
  if (user) {
    const from = new URLSearchParams(location.search).get('from');
    const safe = from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login');
    return <Navigate to={safe ? from : '/dashboard'} replace />;
  }
  return <LoginPage />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  // Public QR evaluation landing page — no login.
  { path: '/eval/:eventId', element: <PublicEvaluationPage /> },
  {
    element: <RequireAuth />,
    children: [
      // Attendance QR landing (login required): Time In / Time Out, then the activity evaluation.
      { path: '/attendance/:eventId/:index/scan', element: <AttendanceScanPage /> },
      { path: '/attendance/:eventId/:index/evaluate', element: <PublicEvaluationPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/tasks', element: <TaskManagerPage category="common" /> },
          { path: '/tasks/new', element: <TaskFormPage category="common" /> },
          { path: '/tasks/template', element: <TaskFormPage category="common" template /> },
          { path: '/tasks/:id', element: <TaskDetailPage backTo="/tasks" /> },
          { path: '/tasks/:id/edit', element: <TaskFormPage category="common" /> },
          { path: '/special-tasks', element: <TaskManagerPage category="special" /> },
          { path: '/special-tasks/new', element: <TaskFormPage category="special" /> },
          { path: '/special-tasks/:id', element: <TaskDetailPage backTo="/special-tasks" /> },
          { path: '/special-tasks/:id/edit', element: <TaskFormPage category="special" /> },
          { path: '/my-tasks', element: <MyTasksPage category="common" /> },
          { path: '/my-tasks/:id', element: <TaskDetailPage backTo="/my-tasks" ownView /> },
          { path: '/my-special-tasks', element: <MyTasksPage category="special" /> },
          { path: '/my-special-tasks/:id', element: <TaskDetailPage backTo="/my-special-tasks" ownView /> },
          { path: '/activity', element: <ActivityPage /> },
          { path: '/personnel', element: <PersonnelPage /> },
          { path: '/appraisal', element: <AppraisalPage /> },
          { path: '/events', element: <EventsPage /> },
          { path: '/events/new', element: <EventFormPage /> },
          { path: '/events/:id', element: <EventDetailPage /> },
          { path: '/events/:id/edit', element: <EventFormPage /> },
          { path: '/school-years', element: <SchoolYearsPage /> },
          { path: '/audit-log', element: <AuditLogPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
]);
