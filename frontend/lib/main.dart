import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/appraisal/public_evaluation_screen.dart';

void main() {
  runApp(const TaskNetApp());
}

class TaskNetApp extends StatelessWidget {
  const TaskNetApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Deep link extraction for event evaluation scanning
    final uri = Uri.base;
    String? evalEventId;
    if (uri.queryParameters.containsKey('eval')) {
      evalEventId = uri.queryParameters['eval'];
    } else if (uri.fragment.contains('/eval/')) {
      final parts = uri.fragment.split('/eval/');
      if (parts.length > 1) {
        evalEventId = parts[1].split('?').first;
      }
    } else {
      final pathSegments = uri.pathSegments;
      final idx = pathSegments.indexOf('eval');
      if (idx != -1 && idx + 1 < pathSegments.length) {
        evalEventId = pathSegments[idx + 1];
      }
    }

    return MaterialApp(
      title: 'TaskNet — Personnel Appraisal',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: (evalEventId != null && evalEventId.isNotEmpty)
          ? PublicEvaluationScreen(eventId: evalEventId)
          : const LoginScreen(),
    );
  }
}
