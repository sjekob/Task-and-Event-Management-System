/// Role-based access control service
/// Enforces permissions for TEACHER, DEAN, COORDINATOR, and PRINCIPAL roles

class RolePermissions {
  final String role;

  RolePermissions(this.role);

  // ── TEACHER Permissions ─────────────────────────────────────────────────
  bool get canViewOwnReportScores => role == 'teacher';
  bool get canViewOwnCompliancePoints => role == 'teacher' || role == 'dean';
  bool get canViewOwnEventSubmissions => role == 'teacher' || role == 'dean';
  bool get canViewOwnPerformanceSummary => role == 'teacher' || role == 'dean';
  bool get canReceiveNotifications => role == 'teacher' || role == 'dean' || role == 'coordinator';
  bool get canReceiveEscalationAlerts => role == 'teacher' || role == 'dean' || role == 'coordinator';

  // ── DEAN Permissions ────────────────────────────────────────────────────
  bool get canEvaluateTeachers => role == 'dean';
  bool get canViewOwnTaskRatings => role == 'dean';

  // ── COORDINATOR Permissions ─────────────────────────────────────────────
  bool get canEvaluateDeans => role == 'coordinator';
  bool get canViewComplianceDashboard => role == 'coordinator' || role == 'principal';
  bool get canViewEscalationAlerts => role == 'coordinator' || role == 'principal';
  bool get canViewAreaPersonnel => role == 'coordinator';

  // ── PRINCIPAL Permissions ───────────────────────────────────────────────
  bool get canViewSchoolWideDashboard => role == 'principal';
  bool get canViewDepartmentAverages => role == 'principal';
  bool get canViewAllEscalationAlerts => role == 'principal';
  bool get canExportPerformanceSummary => role == 'principal';

  // ── Negations ───────────────────────────────────────────────────────────
  bool get cannotEvaluateAnyone => role == 'teacher' || role == 'principal';
  bool get cannotViewOthersData => role == 'teacher' || role == 'dean';
  bool get cannotEditReceivedEvaluation => role == 'teacher' || role == 'dean' || role == 'coordinator';
  bool get cannotEvaluateOutsideArea => role == 'coordinator';
  bool get cannotEvaluateTeachers => role == 'coordinator' || role == 'principal';
  bool get cannotEvaluateOtherDeans => role == 'dean';

  /// Returns true if role can view the given personnel's data
  bool canViewPersonnelData(String? currentUsername, String? targetUsername) {
    // Everyone can view their own data
    if (currentUsername == targetUsername) return true;

    // Teachers can only view their own
    if (role == 'teacher') return false;

    // Deans cannot view other personnel's data (from requirements)
    if (role == 'dean') return false;

    // Coordinators can view personnel in their area (simplified: all for now)
    if (role == 'coordinator') return true;

    // Principals can view everyone
    if (role == 'principal') return true;

    return false;
  }

  /// Returns true if role can evaluate the target role
  bool canEvaluateRole(String targetRole) {
    if (role == 'teacher') return false;
    if (role == 'dean') return targetRole == 'teacher';
    if (role == 'coordinator') return targetRole == 'dean';
    if (role == 'principal') return false;
    return false;
  }

  /// Filter tasks based on role
  /// Teachers: none (cannot see special tasks)
  /// Deans: see their own
  /// Coordinators: see all (to evaluate)
  /// Principals: see all (for dashboard)
  bool canViewTask(String? taskPersonnel, String? currentUsername) {
    if (role == 'teacher') return false; // teachers don't see special tasks
    if (role == 'dean') return taskPersonnel == currentUsername; // see own
    if (role == 'coordinator' || role == 'principal') return true; // see all
    return false;
  }

  /// Filter events based on role
  bool canViewEvent(String? currentUsername) {
    // All roles can view events
    return true;
  }

  /// Filter analytics based on role
  bool canViewAnalytics(String? currentUsername) {
    if (role == 'principal') return true; // principal sees everything
    if (role == 'coordinator') return true; // coordinator sees their area
    if (role == 'teacher' || role == 'dean') return false; // cannot see analytics
    return false;
  }
}
