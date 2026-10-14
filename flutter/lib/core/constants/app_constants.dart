class AppConstants {
  // ─── API ────────────────────────────────────────────────────
  static const String baseUrl         = 'http://localhost:8000/api/v1';
  static const int    connectTimeout  = 30000;
  static const int    receiveTimeout  = 30000;

  // ─── Storage Keys ───────────────────────────────────────────
  static const String tokenKey        = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey         = 'current_user';

  // ─── Pagination ─────────────────────────────────────────────
  static const int defaultPageSize    = 20;

  // ─── Task Status ────────────────────────────────────────────
  static const String statusPending   = 'pending';
  static const String statusSubmitted = 'submitted';
  static const String statusMissing   = 'missing';
  static const String statusApproved  = 'approved';

  // ─── User Roles ─────────────────────────────────────────────
  static const String roleCoordinator = 'coordinator';
  static const String roleTeacher     = 'teacher';
  static const String roleAdmin       = 'admin';
}
