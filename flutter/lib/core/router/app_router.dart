import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/tasks/presentation/pages/my_tasks_page.dart';
import '../../features/tasks/presentation/pages/task_manager_page.dart';
import '../../features/appraisal/presentation/pages/appraisal_page.dart';
import '../../features/calendar/presentation/pages/activity_calendar_page.dart';
import '../../features/calendar/presentation/pages/add_event_page.dart';

class AppRouter {
  static final router = GoRouter(
    initialLocation: AppRoutes.login,
    routes: [
      GoRoute(
        path: AppRoutes.login,
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoutes.dashboard,
        name: 'dashboard',
        builder: (context, state) => const DashboardPage(),
        routes: [
          GoRoute(
            path: 'task-manager',
            name: 'task-manager',
            builder: (context, state) => const TaskManagerPage(),
          ),
          GoRoute(
            path: 'my-tasks',
            name: 'my-tasks',
            builder: (context, state) => const MyTasksPage(),
          ),
          GoRoute(
            path: 'appraisal',
            name: 'appraisal',
            builder: (context, state) => const AppraisalPage(),
          ),
          GoRoute(
            path: 'calendar',
            name: 'activity-calendar',
            builder: (context, state) =>
                const ActivityCalendarPage(),
          ),
          GoRoute(
            path: 'add-event',
            name: 'add-event',
            builder: (context, state) => const AddEventPage(),
          ),
        ],
      ),
    ],
  );
}

class AppRoutes {
  static const String login       = '/login';
  static const String dashboard   = '/dashboard';
  static const String taskManager = '/dashboard/task-manager';
  static const String myTasks     = '/dashboard/my-tasks';
  static const String appraisal   = '/dashboard/appraisal';
  static const String calendar    = '/dashboard/calendar';
  static const String addEvent    = '/dashboard/add-event';
}