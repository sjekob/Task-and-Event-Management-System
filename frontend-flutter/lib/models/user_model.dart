// TaskNet - User Dart Models
// File: frontend-flutter/lib/models/user_model.dart

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
enum UserRole {
  principal,
  dean,
  coordinator,
  registrar,
  teacher;

  String get displayName => switch (this) {
        UserRole.principal => 'Principal',
        UserRole.dean => 'Dean',
        UserRole.coordinator => 'Coordinator',
        UserRole.registrar => 'Registrar',
        UserRole.teacher => 'Teacher',
      };
}

enum UserStatus {
  active,
  deactivated;

  String get displayName => switch (this) {
        UserStatus.active => 'Active',
        UserStatus.deactivated => 'Deactivated',
      };
}

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------
class GradeLevelModel {
  final int id;
  final String name;

  const GradeLevelModel({required this.id, required this.name});

  factory GradeLevelModel.fromJson(Map<String, dynamic> j) =>
      GradeLevelModel(id: j['id'] as int, name: j['name'] as String);

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

class SubjectModel {
  final int id;
  final String name;

  const SubjectModel({required this.id, required this.name});

  factory SubjectModel.fromJson(Map<String, dynamic> j) =>
      SubjectModel(id: j['id'] as int, name: j['name'] as String);
}

class DepartmentModel {
  final int id;
  final String name;
  final String? gradeRange;

  const DepartmentModel({required this.id, required this.name, this.gradeRange});

  factory DepartmentModel.fromJson(Map<String, dynamic> j) => DepartmentModel(
        id: j['id'] as int,
        name: j['name'] as String,
        gradeRange: j['grade_range'] as String?,
      );
}

class CoordinatorTypeModel {
  final int id;
  final String name;

  const CoordinatorTypeModel({required this.id, required this.name});

  factory CoordinatorTypeModel.fromJson(Map<String, dynamic> j) =>
      CoordinatorTypeModel(id: j['id'] as int, name: j['name'] as String);
}

class SubjectGradeAssignment {
  final int gradeLevelId;
  final int subjectId;

  const SubjectGradeAssignment({required this.gradeLevelId, required this.subjectId});

  factory SubjectGradeAssignment.fromJson(Map<String, dynamic> j) => SubjectGradeAssignment(
        gradeLevelId: j['grade_level_id'] as int,
        subjectId: j['subject_id'] as int,
      );

  Map<String, dynamic> toJson() => {
        'grade_level_id': gradeLevelId,
        'subject_id': subjectId,
      };
}

// ---------------------------------------------------------------------------
// User Brief (table row)
// ---------------------------------------------------------------------------
class UserBriefModel {
  final int id;
  final String? employeeNo;
  final String fullName;
  final String? username;
  final String? contactNumber;
  final String email;
  final UserRole role;
  final UserStatus status;
  final List<GradeLevelModel> gradeLevels;
  final List<String> subjects;

  const UserBriefModel({
    required this.id,
    this.employeeNo,
    required this.fullName,
    this.username,
    this.contactNumber,
    required this.email,
    required this.role,
    required this.status,
    required this.gradeLevels,
    required this.subjects,
  });

  factory UserBriefModel.fromJson(Map<String, dynamic> j) => UserBriefModel(
        id: j['id'] as int,
        employeeNo: j['employee_no'] as String?,
        fullName: j['full_name'] as String,
        username: j['username'] as String?,
        contactNumber: j['contact_number'] as String?,
        email: j['email'] as String,
        role: UserRole.values.byName(j['role'] as String),
        status: UserStatus.values.byName(j['status'] as String),
        gradeLevels: (j['grade_levels'] as List)
            .map((e) => GradeLevelModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        subjects: (j['subjects'] as List).map((e) => e as String).toList(),
      );

  String get gradeLevelsDisplay =>
      gradeLevels.isEmpty ? '—' : gradeLevels.map((g) => g.name).join(', ');

  String get subjectsDisplay =>
      subjects.isEmpty ? '—' : subjects.join(', ');
}

// ---------------------------------------------------------------------------
// User Detail (full record)
// ---------------------------------------------------------------------------
class UserDetailModel {
  final int id;
  final String? employeeNo;
  final String firstName;
  final String? middleName;
  final String lastName;
  final String? suffix;
  final String fullName;
  final String? username;
  final String email;
  final UserRole role;
  final UserStatus status;

  final String? contactNumber;
  final String? birthdate;
  final String? address;

  final String? tinNumber;
  final String? gsisNumber;
  final String? pagibigNumber;
  final String? philhealthNumber;

  final String? dateHired;
  final String? dateOfAppointment;

  final String? avatarUrl;
  final DepartmentModel? department;
  final CoordinatorTypeModel? coordinatorType;
  final List<GradeLevelModel> gradeLevels;
  final List<SubjectGradeAssignment> subjectGradeAssignments;
  final bool firstLogin;
  final DateTime? personalInfoUpdatedAt;
  final DateTime? academicDelegationUpdatedAt;

  const UserDetailModel({
    required this.id,
    this.employeeNo,
    required this.firstName,
    this.middleName,
    required this.lastName,
    this.suffix,
    required this.fullName,
    this.username,
    required this.email,
    required this.role,
    required this.status,
    this.contactNumber,
    this.birthdate,
    this.address,
    this.tinNumber,
    this.gsisNumber,
    this.pagibigNumber,
    this.philhealthNumber,
    this.dateHired,
    this.dateOfAppointment,
    this.avatarUrl,
    this.department,
    this.coordinatorType,
    required this.gradeLevels,
    this.subjectGradeAssignments = const [],
    this.firstLogin = false,
    this.personalInfoUpdatedAt,
    this.academicDelegationUpdatedAt,
  });

  factory UserDetailModel.fromJson(Map<String, dynamic> j) => UserDetailModel(
        id: j['id'] as int,
        employeeNo: j['employee_no'] as String?,
        firstName: j['first_name'] as String,
        middleName: j['middle_name'] as String?,
        lastName: j['last_name'] as String,
        suffix: j['suffix'] as String?,
        fullName: j['full_name'] as String,
        username: j['username'] as String?,
        email: j['email'] as String,
        role: UserRole.values.byName(j['role'] as String),
        status: UserStatus.values.byName(j['status'] as String),
        contactNumber: j['contact_number'] as String?,
        birthdate: j['birthdate'] as String?,
        address: j['address'] as String?,
        tinNumber: j['tin_number'] as String?,
        gsisNumber: j['gsis_number'] as String?,
        pagibigNumber: j['pagibig_number'] as String?,
        philhealthNumber: j['philhealth_number'] as String?,
        dateHired: j['date_hired'] as String?,
        dateOfAppointment: j['date_of_appointment'] as String?,
        avatarUrl: j['avatar_url'] as String?,
        department: j['department'] == null
            ? null
            : DepartmentModel.fromJson(j['department'] as Map<String, dynamic>),
        coordinatorType: j['coordinator_type'] == null
            ? null
            : CoordinatorTypeModel.fromJson(j['coordinator_type'] as Map<String, dynamic>),
        gradeLevels: (j['grade_levels'] as List)
            .map((e) => GradeLevelModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        subjectGradeAssignments: ((j['subject_grade_assignments'] ?? []) as List)
            .map((e) => SubjectGradeAssignment.fromJson(e as Map<String, dynamic>))
            .toList(),
        firstLogin: j['first_login'] as bool? ?? false,
        personalInfoUpdatedAt:
            j['personal_info_updated_at'] == null ? null : DateTime.parse(j['personal_info_updated_at'] as String),
        academicDelegationUpdatedAt:
            j['academic_delegation_updated_at'] == null ? null : DateTime.parse(j['academic_delegation_updated_at'] as String),
      );
}

// ---------------------------------------------------------------------------
// Delegation History
// ---------------------------------------------------------------------------
class DelegationHistoryItem {
  final int id;
  final DateTime changedAt;
  final String? changedByName;
  final String? role;
  final String? gradeLevelHandled;
  final String? coordinatorType;
  final String? subjectGradeSummary;
  final String? notes;

  const DelegationHistoryItem({
    required this.id,
    required this.changedAt,
    this.changedByName,
    this.role,
    this.gradeLevelHandled,
    this.coordinatorType,
    this.subjectGradeSummary,
    this.notes,
  });

  factory DelegationHistoryItem.fromJson(Map<String, dynamic> j) => DelegationHistoryItem(
        id: j['id'] as int,
        changedAt: DateTime.parse(j['changed_at'] as String),
        changedByName: j['changed_by_name'] as String?,
        role: j['role'] as String?,
        gradeLevelHandled: j['grade_level_handled'] as String?,
        coordinatorType: j['coordinator_type'] as String?,
        subjectGradeSummary: j['subject_grade_summary'] as String?,
        notes: j['notes'] as String?,
      );
}

// ---------------------------------------------------------------------------
// List response wrapper
// ---------------------------------------------------------------------------
class UserListResponse {
  final List<UserBriefModel> active;
  final List<UserBriefModel> deactivated;
  final int total;

  const UserListResponse({
    required this.active,
    required this.deactivated,
    required this.total,
  });

  factory UserListResponse.fromJson(Map<String, dynamic> j) => UserListResponse(
        active: (j['active'] as List)
            .map((e) => UserBriefModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        deactivated: (j['deactivated'] as List)
            .map((e) => UserBriefModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: j['total'] as int,
      );
}
