import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;

class ApiConstants {
  ApiConstants._();

  // 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
  // On web and all other platforms, use localhost directly.
  static String get _host {
    const envUrl = String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8000';
    }
    return 'http://localhost:8000';
  }

  static String get host    => _host;
  static String get baseUrl => '$_host/api/v1';

  // User Management
  static String get users              => '$baseUrl/users';
  static String user(int id)           => '$baseUrl/users/$id';
  static String userStatus(int id)     => '$baseUrl/users/$id/status';
  static String userAvatar(int id)     => '$baseUrl/users/$id/avatar';
  static String staticUrl(String path) => '$_host$path';

  // Lookups (dropdowns)
  static String get gradeLevels  => '$baseUrl/users/meta/grade-levels';
  static String get subjects     => '$baseUrl/users/meta/subjects';
  static String get departments       => '$baseUrl/users/meta/departments';
  static String get coordinatorTypes  => '$baseUrl/users/meta/coordinator-types';

  // Quick-create (admin adds user with just email + username)
  static String get usersQuickCreate         => '$baseUrl/users/quick-create';
  static String userDelegationHistory(int id) => '$baseUrl/users/$id/history';

  // Auth
  static String get authToken => '$baseUrl/auth/token';
}
