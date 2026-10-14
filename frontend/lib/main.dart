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
import 'screens/public_evaluation_screen.dart';
import 'screens/attendance_scan_screen.dart';
import 'screens/school_years_screen.dart';
import 'screens/audit_log_screen.dart';

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
        if (loc.startsWith('/eval/')) return null; // public QR landing page — no auth
        // Remember where a signed-out user was headed (e.g. a scanned attendance
        // QR) and send them back there after login.
        if (!loggedIn && loc != '/login') {
          return '/login?from=${Uri.encodeComponent(state.uri.toString())}';
        }
        if (loggedIn && loc == '/login') {
          final from = state.uri.queryParameters['from'];
          return (from != null && from.startsWith('/') && !from.startsWith('/login'))
              ? from : '/dashboard';
        }
        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (_, __) => const LoginScreen(),
        ),
        GoRoute(
          path: '/eval/:eventId',
          builder: (context, state) => PublicEvaluationScreen(
            eventId: state.pathParameters['eventId']!,
          ),
        ),
        // Attendance QR landing (login required): records Time In / Time Out
        // with the device's location, then the activity's evaluation.
        GoRoute(
          path: '/attendance/:eventId/:index/scan',
          builder: (context, state) => AttendanceScanScreen(
            eventId: int.parse(state.pathParameters['eventId']!),
            activityIndex: int.parse(state.pathParameters['index']!),
            action: state.uri.queryParameters['action'] ?? '',
            code: state.uri.queryParameters['code'] ?? '',
          ),
        ),
        GoRoute(
          path: '/attendance/:eventId/:index/evaluate',
          builder: (context, state) => PublicEvaluationScreen(
            eventId: state.pathParameters['eventId']!,
            activityIndex: int.parse(state.pathParameters['index']!),
          ),
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
                category: 'common',
                onCreateTask: () => context.go('/tasks/new'),
                onSelectTask: (id) => context.go('/tasks/$id'),
              ),
            ),
            GoRoute(
              path: '/tasks/new',
              builder: (context, state) => CreateTaskScreen(
                onBack: () => context.go('/tasks'),
                onCreated: () => context.go('/tasks'),
              ),
            ),
            // ── Special Tasks (manage/create) ──
            GoRoute(
              path: '/special-tasks',
              builder: (context, state) => TaskManagerScreen(
                category: 'special',
                onCreateTask: () => context.go('/special-tasks/new'),
                onSelectTask: (id) => context.go('/special-tasks/$id'),
              ),
            ),
            GoRoute(
              path: '/special-tasks/new',
              builder: (context, state) => CreateTaskScreen(
                lockedCategory: 'special',
                onBack: () => context.go('/special-tasks'),
                onCreated: () => context.go('/special-tasks'),
              ),
            ),
            GoRoute(
              path: '/special-tasks/:id',
              builder: (context, state) => TaskDetailScreen(
                taskId: int.parse(state.pathParameters['id']!),
                onBack: () => context.go('/special-tasks'),
              ),
            ),
            // ── My Special Tasks (assignee view/submit) ──
            GoRoute(
              path: '/my-special-tasks',
              builder: (context, state) => MyTasksScreen(
                category: 'special',
                onSelectTask: (id) => context.go('/my-special-tasks/$id'),
              ),
            ),
            GoRoute(
              path: '/my-special-tasks/:id',
              builder: (context, state) => TaskDetailScreen(
                taskId: int.parse(state.pathParameters['id']!),
                onBack: () => context.go('/my-special-tasks'),
                ownTaskView: true,
              ),
            ),
            GoRoute(
              path: '/tasks/template',
              builder: (context, state) => CreateTaskScreen(
                isTemplate: true,
                onBack: () => context.go('/tasks'),
                onCreated: () => context.go('/tasks'),
              ),
            ),
            GoRoute(
              path: '/tasks/:id',
              builder: (context, state) => TaskDetailScreen(
                taskId: int.parse(state.pathParameters['id']!),
                onBack: () => context.go('/tasks'),
              ),
            ),
            GoRoute(
              path: '/my-tasks',
              builder: (context, state) => MyTasksScreen(
                category: 'common',
                onSelectTask: (id) => context.go('/my-tasks/$id'),
              ),
            ),
            GoRoute(
              path: '/my-tasks/:id',
              builder: (context, state) => TaskDetailScreen(
                taskId: int.parse(state.pathParameters['id']!),
                onBack: () => context.go('/my-tasks'),
                ownTaskView: true,
              ),
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
              builder: (context, state) {
                final q = state.uri.queryParameters;
                final open = int.tryParse(q['open'] ?? '');
                final selectedDay = DateTime.tryParse(q['date'] ?? '');
                final calendarDay = selectedDay ?? DateTime.tryParse(q['month'] ?? '');
                return EventManagementScreen(
                  // New key per request so a second dashboard click re-opens.
                  key: ValueKey('events-$open-${q['view']}-${q['date']}-${q['month']}'),
                  onAddEvent: () => context.go('/events/new'),
                  openEventId: open,
                  expandCalendar: q['view'] == 'calendar',
                  calendarDay: calendarDay,
                  selectCalendarDay: selectedDay != null,
                );
              },
            ),
            GoRoute(
              path: '/events/new',
              builder: (context, state) => AddEventScreen(
                onBack: () => context.go('/events'),
                onCreated: () => context.go('/events'),
              ),
            ),
            GoRoute(
              path: '/events/:id/edit',
              builder: (context, state) => AddEventScreen(
                onBack: () => context.go('/events'),
                onCreated: () => context.go('/events'),
                existingEvent: state.extra as Map<String, dynamic>?,
              ),
            ),
            GoRoute(
              path: '/school-years',
              builder: (_, __) => const SchoolYearsScreen(),
            ),
            GoRoute(
              path: '/audit-log',
              builder: (_, __) => const AuditLogScreen(),
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
