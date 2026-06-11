import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'services/app_state.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/dashboard_screen.dart';
import 'screens/task_manager_screen.dart';
import 'screens/my_tasks_screen.dart';
import 'screens/activity_screen.dart';
import 'screens/create_task_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/task_detail_screen.dart';
import 'features/personnel/screens/personnel_screen.dart';
import 'screens/appraisal_screen.dart';
import 'screens/event_management_screen.dart';
import 'screens/add_event_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appState = AppState();
  await appState.tryAutoLogin().timeout(
    const Duration(seconds: 5),
    onTimeout: () => false,
  );
  runApp(
    ChangeNotifierProvider.value(
      value: appState,
      child: TaskNetApp(appState: appState),
    ),
  );
}

class TaskNetApp extends StatefulWidget {
  final AppState appState;
  const TaskNetApp({super.key, required this.appState});

  @override
  State<TaskNetApp> createState() => _TaskNetAppState();
}

class _TaskNetAppState extends State<TaskNetApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = GoRouter(
      refreshListenable: widget.appState,
      initialLocation: widget.appState.isLoggedIn ? '/dashboard' : '/login',
      redirect: (context, state) {
        final loggedIn = widget.appState.isLoggedIn;
        final loc = state.matchedLocation;
        if (!loggedIn && loc != '/login') return '/login';
        if (loggedIn && loc == '/login') return '/dashboard';
        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (_, __) => const LoginScreen(),
        ),
        ShellRoute(
          builder: (context, state, child) => MainShell(child: child),
          routes: [
            GoRoute(
              path: '/dashboard',
              builder: (_, __) => const DashboardScreen(),
            ),
            GoRoute(
              path: '/tasks',
              builder: (context, state) => TaskManagerScreen(
                onSelectTask: (id) => context.go('/tasks/$id'),
              ),
              routes: [
                GoRoute(
                  path: 'new',
                  builder: (context, state) => CreateTaskScreen(
                    onBack: () => context.go('/tasks'),
                    onCreated: () => context.go('/tasks'),
                  ),
                ),
                GoRoute(
                  path: 'template',
                  builder: (context, state) => CreateTaskScreen(
                    isTemplate: true,
                    onBack: () => context.go('/tasks'),
                    onCreated: () => context.go('/tasks'),
                  ),
                ),
                GoRoute(
                  path: ':id',
                  builder: (context, state) => TaskDetailScreen(
                    taskId: int.parse(state.pathParameters['id']!),
                    onBack: () => context.go('/tasks'),
                  ),
                ),
              ],
            ),
            GoRoute(
              path: '/my-tasks',
              builder: (context, state) => MyTasksScreen(
                onSelectTask: (id) => context.go('/my-tasks/$id'),
              ),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (context, state) => TaskDetailScreen(
                    taskId: int.parse(state.pathParameters['id']!),
                    onBack: () => context.go('/my-tasks'),
                  ),
                ),
              ],
            ),
            GoRoute(
              path: '/activity',
              builder: (_, __) => const ActivityScreen(),
            ),
            GoRoute(
              path: '/personnel',
              builder: (_, __) => const PersonnelScreen(),
            ),
            GoRoute(
              path: '/appraisal',
              builder: (_, __) => const AppraisalScreen(),
            ),
            GoRoute(
              path: '/events',
              builder: (context, state) => EventManagementScreen(
                onAddEvent: () => context.go('/events/new'),
              ),
              routes: [
                GoRoute(
                  path: 'new',
                  builder: (context, state) => AddEventScreen(
                    onBack: () => context.go('/events'),
                    onCreated: () => context.go('/events'),
                  ),
                ),
              ],
            ),
            GoRoute(
              path: '/profile',
              builder: (_, __) => const ProfileScreen(),
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'TaskNet',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.theme,
      routerConfig: _router,
    );
  }
}
