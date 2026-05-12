import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'services/app_state.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AppState(),
      child: const TaskNetApp(),
    ),
  );
}

class TaskNetApp extends StatelessWidget {
  const TaskNetApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TaskNet',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.theme,
      home: const _SplashRouter(),
    );
  }
}

class _SplashRouter extends StatefulWidget {
  const _SplashRouter();

  @override
  State<_SplashRouter> createState() => _SplashRouterState();
}

class _SplashRouterState extends State<_SplashRouter> {
  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final state = context.read<AppState>();
    final ok = await state.tryAutoLogin();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => ok ? const MainShell() : const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppTheme.bgColor,
      body: Center(
        child: CircularProgressIndicator(color: AppTheme.accentBlue),
      ),
    );
  }
}