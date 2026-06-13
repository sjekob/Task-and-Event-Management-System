import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'services/app_state.dart';
import 'router.dart';

/// Initialise auth before the first frame so the router never shows a
/// spurious /login flash for users who already have a stored token.
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final appState = AppState();
  await appState.tryAutoLogin(); // checks stored JWT token against /api/auth/me

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
    // Create the router once — refreshListenable wires auth state changes
    // so GoRouter re-evaluates the redirect whenever login/logout happens.
    _router = createRouter(widget.appState);
  }

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
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
