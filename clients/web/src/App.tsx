import { lazy, ReactElement, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, RouterProvider, createBrowserRouter, createRoutesFromElements, useLocation } from 'react-router-dom';
import { useApp, useSession } from './app/AppContext';
import { Loading } from './ui/kit';
import Shell from './views/shell/Shell';
import LoginView from './views/auth/LoginView';

const DashboardView = lazy(() => import('./views/dashboard/DashboardView'));
const TaskManagerView = lazy(() => import('./views/tasks/TaskManagerView'));
const CreateTaskView = lazy(() => import('./views/tasks/CreateTaskView'));
const TaskDetailView = lazy(() => import('./views/tasks/TaskDetailView'));
const MyTasksView = lazy(() => import('./views/tasks/MyTasksView'));
const ActivityView = lazy(() => import('./views/activity/ActivityView'));
const PersonnelView = lazy(() => import('./views/personnel/PersonnelView'));
const AppraisalView = lazy(() => import('./views/appraisal/AppraisalView'));
const EventsView = lazy(() => import('./views/events/EventsView'));
const EventFormView = lazy(() => import('./views/events/EventFormView'));
const PublicEvaluationView = lazy(() => import('./views/events/PublicEvaluationView'));
const AttendanceScanView = lazy(() => import('./views/events/AttendanceScanView'));
const SchoolYearsView = lazy(() => import('./views/schoolYears/SchoolYearsView'));
const AuditLogView = lazy(() => import('./views/audit/AuditLogView'));
const ProfileView = lazy(() => import('./views/profile/ProfileView'));

/** Signed-out visitors go to /login; signed-in ones skip it. */
function Guard({ children }: { children: ReactElement }) {
  const { user, restoring } = useSession();
  const loc = useLocation();
  if (restoring) return <Loading />;
  // Keep the query too: an attendance QR link carries its action and signed code there.
  if (!user) return <Navigate to="/login" replace state={{ from: `${loc.pathname}${loc.search}` }} />;
  return children;
}

/** Pages the backend did not grant this session (its `permissions`) fall back to the dashboard. */
function Need({ perm, children }: { perm: string; children: ReactElement }) {
  const { user } = useSession();
  return user?.can(perm) ? children : <Navigate to="/dashboard" replace />;
}

/** Signed-in visitors continue to where they were sent from (e.g. a scanned QR), else the dashboard. */
function LoginRoute() {
  const { user, restoring } = useSession();
  const from = (useLocation().state as { from?: string } | null)?.from;
  if (restoring) return <Loading />;
  return user ? <Navigate to={from && from.startsWith('/') ? from : '/dashboard'} replace /> : <LoginView />;
}

/** Every page: lazy pages show the loader while their code arrives. */
function Root() {
  return <Suspense fallback={<Loading />}><Outlet /></Suspense>;
}

// A data router, so forms can warn before you leave with unsaved changes (useBlocker).
const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<Root />}>
      <Route path="/login" element={<LoginRoute />} />
      {/* Public QR landing page: no sign-in. */}
      <Route path="/eval/:eventId" element={<PublicEvaluationView />} />
      {/* Attendance QR landing pages: signed in, without the app shell (phones). */}
      {/* Public: signed-in personnel scan as themselves, everyone else as a guest. */}
      <Route path="/attendance/:eventId/:index/scan" element={<AttendanceScanView />} />
      <Route path="/attendance/:eventId/:index/evaluate" element={<Guard><PublicEvaluationView /></Guard>} />
      <Route element={<Guard><Shell /></Guard>}>
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/tasks" element={<Need perm="create_tasks"><TaskManagerView category="common" /></Need>} />
        <Route path="/tasks/new" element={<Need perm="create_tasks"><CreateTaskView backTo="/tasks" /></Need>} />
        <Route path="/tasks/template" element={<Need perm="manage_templates"><CreateTaskView backTo="/tasks" isTemplate /></Need>} />
        <Route path="/tasks/:id" element={<TaskDetailView backTo="/tasks" />} />
        <Route path="/advisory" element={<Need perm="advise_section"><TaskManagerView category="common" advisory /></Need>} />
        <Route path="/advisory/:id" element={<TaskDetailView backTo="/advisory" />} />
        <Route path="/tasks/:id/edit" element={<Need perm="create_tasks"><CreateTaskView backTo="/tasks" edit /></Need>} />
        <Route path="/special-tasks" element={<Need perm="create_tasks"><TaskManagerView category="special" /></Need>} />
        <Route path="/special-tasks/new" element={<Need perm="create_tasks"><CreateTaskView backTo="/special-tasks" lockedCategory="special" /></Need>} />
        <Route path="/special-tasks/:id" element={<TaskDetailView backTo="/special-tasks" />} />
        <Route path="/special-tasks/:id/edit" element={<Need perm="create_tasks"><CreateTaskView backTo="/special-tasks" edit /></Need>} />
        <Route path="/my-tasks" element={<Need perm="receive_tasks"><MyTasksView category="common" /></Need>} />
        <Route path="/my-tasks/:id" element={<TaskDetailView backTo="/my-tasks" ownTaskView />} />
        <Route path="/my-special-tasks" element={<Need perm="receive_tasks"><MyTasksView category="special" /></Need>} />
        <Route path="/my-special-tasks/:id" element={<TaskDetailView backTo="/my-special-tasks" ownTaskView />} />
        <Route path="/activity" element={<ActivityView />} />
        <Route path="/personnel" element={<Need perm="view_personnel"><PersonnelView /></Need>} />
        <Route path="/appraisal" element={<Need perm="view_appraisal"><AppraisalView /></Need>} />
        <Route path="/events" element={<EventsView />} />
        <Route path="/events/new" element={<EventFormView />} />
        <Route path="/events/:id/edit" element={<EventFormView />} />
        <Route path="/school-years" element={<Need perm="manage_school_years"><SchoolYearsView /></Need>} />
        <Route path="/audit-log" element={<Need perm="view_audit"><AuditLogView /></Need>} />
        <Route path="/profile" element={<ProfileView />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Route>,
));

export default function App() {
  const app = useApp();
  useEffect(() => { void app.session.restore(); }, [app]);

  return <RouterProvider router={router} />;
}
