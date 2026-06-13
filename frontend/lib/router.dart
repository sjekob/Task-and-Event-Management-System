import 'package:go_router/go_router.dart';
import 'services/app_state.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/dashboard_screen.dart';
import 'screens/task_manager_screen.dart';
import 'screens/create_task_screen.dart';
import 'screens/task_detail_screen.dart';
import 'screens/my_tasks_screen.dart';
import 'screens/activity_screen.dart';
import 'screens/personnel_management_screen.dart';
import 'screens/appraisal_screen.dart';
import 'screens/event_management_screen.dart';
import 'screens/add_event_screen.dart';

/// Builds the app-wide GoRouter.
///
/// [appState] is passed as [GoRouter.refreshListenable] so the redirect
/// fires automatically whenever login / logout happens (ChangeNotifier).
GoRouter createRouter(AppState appState) => GoRouter(
      refreshListenable: appState,
      initialLocation: '/dashboard',

      // ── Global redirect: enforce authentication ────────────────────────────
      // OWASP A01 — unauthenticated users are always pushed to /login;
      // authenticated users are pushed away from /login to /dashboard.
      redirect: (context, state) {
        final loggedIn = appState.isLoggedIn;
        final onLogin = state.uri.path == '/login';
        if (!loggedIn && !onLogin) return '/login';
        if (loggedIn && onLogin) return '/dashboard';
        return null; // no redirect needed
      },

      routes: [
        // ── Public route ──────────────────────────────────────────────────────
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),

        // ── Authenticated shell ───────────────────────────────────────────────
        // ShellRoute keeps the sidebar and top-bar visible across all sub-routes.
        // The current sub-route's widget is delivered as [child].
        ShellRoute(
          builder: (context, state, child) => MainShell(
            location: state.uri.path, // full path, e.g. /task-manager/create
            child: child,
          ),
          routes: [
            // Dashboard ────────────────────────────────────────────────────────
            GoRoute(
              path: '/dashboard',
              builder: (context, state) => const DashboardScreen(),
            ),

            // Task Manager ─────────────────────────────────────────────────────
            GoRoute(
              path: '/task-manager',
              builder: (context, state) => TaskManagerScreen(
                onCreateTask: () => context.go('/task-manager/create'),
                onCreateTemplate: () => context.go('/task-manager/template'),
                onSelectTask: (id) => context.go('/task-manager/$id'),
              ),
              routes: [
                // Create task
                GoRoute(
                  path: 'create',
                  builder: (context, state) => CreateTaskScreen(
                    onBack: () => context.go('/task-manager'),
                    onCreated: () => context.go('/task-manager'),
                  ),
                ),
                // Create template
                GoRoute(
                  path: 'template',
                  builder: (context, state) => CreateTaskScreen(
                    isTemplate: true,
                    onBack: () => context.go('/task-manager'),
                    onCreated: () => context.go('/task-manager'),
                  ),
                ),
                // Task detail — opened from task manager
                GoRoute(
                  path: ':taskId',
                  builder: (context, state) => TaskDetailScreen(
                    taskId: int.tryParse(
                            state.pathParameters['taskId'] ?? '') ??
                        0,
                    onBack: () => context.go('/task-manager'),
                  ),
                ),
              ],
            ),

            // My Tasks ─────────────────────────────────────────────────────────
            GoRoute(
              path: '/my-tasks',
              builder: (context, state) => MyTasksScreen(
                onSelectTask: (id) => context.go('/my-tasks/$id'),
              ),
              routes: [
                // Task detail — opened from my-tasks (back returns to my-tasks)
                GoRoute(
                  path: ':taskId',
                  builder: (context, state) => TaskDetailScreen(
                    taskId: int.tryParse(
                            state.pathParameters['taskId'] ?? '') ??
                        0,
                    onBack: () => context.go('/my-tasks'),
                  ),
                ),
              ],
            ),

            // Activity ─────────────────────────────────────────────────────────
            GoRoute(
              path: '/activity',
              builder: (context, state) => const ActivityScreen(),
            ),

            // Personnel Management ─────────────────────────────────────────────
            GoRoute(
              path: '/personnel',
              builder: (context, state) => const PersonnelManagementScreen(),
            ),

            // Appraisal ────────────────────────────────────────────────────────
            GoRoute(
              path: '/appraisal',
              builder: (context, state) => const AppraisalScreen(),
            ),

            // Event Management ─────────────────────────────────────────────────
            GoRoute(
              path: '/events',
              builder: (context, state) => EventManagementScreen(
                onAddEvent: () => context.go('/events/add'),
              ),
              routes: [
                // Add event form
                GoRoute(
                  path: 'add',
                  builder: (context, state) => AddEventScreen(
                    onBack: () => context.go('/events'),
                    onCreated: () => context.go('/events'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
