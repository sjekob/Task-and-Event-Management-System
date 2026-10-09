/// One page of a paginated list endpoint ({items, total, offset, has_more}).
class PageResult<T> {
  final List<T> items;
  final int total;
  final int offset;
  final bool hasMore;
  const PageResult({
    required this.items,
    required this.total,
    required this.offset,
    required this.hasMore,
  });

  factory PageResult.fromJson(
      Map<String, dynamic> json, T Function(Map<String, dynamic>) parse) {
    return PageResult<T>(
      items: (json['items'] as List? ?? [])
          .map((e) => parse(e as Map<String, dynamic>))
          .toList(),
      total: json['total'] ?? 0,
      offset: json['offset'] ?? 0,
      hasMore: json['has_more'] == true,
    );
  }
}

class UserSubject {
  final String subject;
  final String? gradeLevel;

  UserSubject({required this.subject, this.gradeLevel});

  factory UserSubject.fromJson(Map<String, dynamic> json) => UserSubject(
        subject: (json['subject'] ?? '').toString(),
        gradeLevel: json['grade_level']?.toString(),
      );
}

List<String> _stringList(dynamic v) =>
    (v as List? ?? []).map((e) => e.toString()).toList();

/// DepEd-aligned educational background (EDUCATION_BACKGROUND).
class Education {
  final String? highestAttainment;
  final String? undergraduateDegree;
  final String? specialization;
  final String? postgraduateFocus;

  const Education({
    this.highestAttainment,
    this.undergraduateDegree,
    this.specialization,
    this.postgraduateFocus,
  });

  factory Education.fromJson(Map<String, dynamic>? json) => Education(
        highestAttainment: json?['highest_attainment']?.toString(),
        undergraduateDegree: json?['undergraduate_degree']?.toString(),
        specialization: json?['specialization']?.toString(),
        postgraduateFocus: json?['postgraduate_focus']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        // Empty string clears a field server-side.
        'highest_attainment': highestAttainment ?? '',
        'undergraduate_degree': undergraduateDegree ?? '',
        'specialization': specialization ?? '',
        'postgraduate_focus': postgraduateFocus ?? '',
      };

  bool get isEmpty =>
      highestAttainment == null &&
      undergraduateDegree == null &&
      specialization == null &&
      postgraduateFocus == null;
}

/// A skill held by a person, with its taxonomy category.
class SkillInfo {
  final String name;
  final String? category;
  const SkillInfo({required this.name, this.category});

  factory SkillInfo.fromJson(Map<String, dynamic> json) => SkillInfo(
        name: (json['name'] ?? '').toString(),
        category: json['category']?.toString(),
      );
}

/// A certification held by a person, with its category and accrediting body.
class CertificationInfo {
  final String name;
  final String? category;
  final String? issuer;
  final String? issuerAcronym;
  /// verified | submitted (awaiting review) | rejected | self_declared (no file).
  final String credibility;
  /// Result of the automated checks on the uploaded file: high | medium | low.
  final String? authenticity;
  const CertificationInfo(
      {required this.name, this.category, this.issuer, this.issuerAcronym,
       this.credibility = 'self_declared', this.authenticity});

  factory CertificationInfo.fromJson(Map<String, dynamic> json) =>
      CertificationInfo(
        name: (json['name'] ?? '').toString(),
        category: json['category']?.toString(),
        issuer: json['issuer']?.toString(),
        issuerAcronym: json['issuer_acronym']?.toString(),
        credibility: (json['credibility'] ?? 'self_declared').toString(),
        authenticity: json['authenticity']?.toString(),
      );

  /// Short issuer label, e.g. "PRC" or "Philippine Red Cross".
  String? get issuerLabel => issuerAcronym ?? issuer;
}

/// One automated check run on an uploaded certificate.
class CertificateCheck {
  final String key;
  final String label;
  final String status; // pass | warn | fail | info
  final String detail;
  const CertificateCheck(
      {required this.key, required this.label, required this.status, required this.detail});

  factory CertificateCheck.fromJson(Map<String, dynamic> json) => CertificateCheck(
        key: (json['key'] ?? '').toString(),
        label: (json['label'] ?? '').toString(),
        status: (json['status'] ?? 'info').toString(),
        detail: (json['detail'] ?? '').toString(),
      );
}

/// An uploaded certificate (PDF/photo), what was read from it and its review
/// state. Self-declared certifications (listed without a file) have no [id].
class CertificateFile {
  final int? id;
  final int? certificationId;
  final String? title;
  final String? detectedTitle;
  final String? issuer;
  final String? issuerAcronym;
  final String? category;
  final String description;
  final String? originalName;
  final String? mime;
  final String? authenticity; // high | medium | low
  final String status; // pending | submitted | verified | rejected | self_declared
  final List<CertificateCheck> checks;
  final String? reviewNote;
  final String? reviewedByName;

  const CertificateFile({
    this.id, this.certificationId, this.title, this.detectedTitle, this.issuer,
    this.issuerAcronym, this.category, this.description = '', this.originalName,
    this.mime, this.authenticity, required this.status, this.checks = const [],
    this.reviewNote, this.reviewedByName,
  });

  factory CertificateFile.fromJson(Map<String, dynamic> json) => CertificateFile(
        id: (json['id'] as num?)?.toInt(),
        certificationId: (json['certification_id'] as num?)?.toInt(),
        title: json['title']?.toString(),
        detectedTitle: json['detected_title']?.toString(),
        issuer: json['issuer']?.toString(),
        issuerAcronym: json['issuer_acronym']?.toString(),
        category: json['category']?.toString(),
        description: (json['description'] ?? '').toString(),
        originalName: json['original_name']?.toString(),
        mime: json['mime']?.toString(),
        authenticity: json['authenticity']?.toString(),
        status: (json['status'] ?? 'pending').toString(),
        checks: _objList(json['checks'], CertificateCheck.fromJson),
        reviewNote: json['review_note']?.toString(),
        reviewedByName: json['reviewed_by_name']?.toString(),
      );

  bool get hasFile => id != null;
  String? get issuerLabel => issuer ?? issuerAcronym;
}

/// A person's certifications: uploaded ones, ones listed without a file, and
/// uploads still waiting for the owner to confirm what they are.
class CertificateSet {
  final List<CertificateFile> certificates;
  final List<CertificateFile> selfDeclared;
  final List<CertificateFile> pending;
  const CertificateSet(
      {this.certificates = const [], this.selfDeclared = const [], this.pending = const []});

  factory CertificateSet.fromJson(Map<String, dynamic> json) => CertificateSet(
        certificates: _objList(json['certificates'], CertificateFile.fromJson),
        selfDeclared: _objList(json['self_declared'], CertificateFile.fromJson),
        pending: _objList(json['pending'], CertificateFile.fromJson),
      );

  bool get isEmpty => certificates.isEmpty && selfDeclared.isEmpty && pending.isEmpty;
}

/// A catalog certification that an upload can be identified as.
class CertificationCatalogItem {
  final int id;
  final String name;
  final String? category;
  final String? issuer;
  final String description;
  const CertificationCatalogItem(
      {required this.id, required this.name, this.category, this.issuer, this.description = ''});

  factory CertificationCatalogItem.fromJson(Map<String, dynamic> json) =>
      CertificationCatalogItem(
        id: (json['id'] as num).toInt(),
        name: (json['cert_name'] ?? '').toString(),
        category: json['category_name']?.toString(),
        issuer: (json['issuer_name'] ?? json['acronym'])?.toString(),
        description: (json['description'] ?? '').toString(),
      );
}

List<T> _objList<T>(dynamic v, T Function(Map<String, dynamic>) parse) =>
    (v as List? ?? []).map((e) => parse(e as Map<String, dynamic>)).toList();

class User {
  final int id;
  final String username;
  final String fullName;
  final String? firstName;
  final String? middleName;
  final String? lastName;
  final String? suffix;
  final String role;
  final String? avatarUrl;
  final int? gradeLevelId;
  final String? gradeLevel;
  final String? email;
  final String? phoneNumber;
  final int numberOfChildren;
  final List<String> skills;
  final List<String> certifications;
  final List<SkillInfo> skillDetails;
  final List<CertificationInfo> certificationDetails;
  final Education education;
  /// What this session may do, decided by the backend (login / /api/auth/me).
  /// Empty for users loaded from other endpoints (e.g. personnel lists).
  final Set<String> permissions;
  /// Roles this session may assign tasks to ("Assign as"), from the backend.
  final List<String> assignableRoles;
  final String? dateOfAppointment;
  final String? birthdate;
  final String? address;
  final bool isActive;
  final List<UserSubject> subjects;
  final String? coordinatorType;
  final bool alsoTeaching;
  final int? deanGradeLevelId;
  final String? deanGradeLevel;
  final int? departmentId;
  final String? department;

  User({
    required this.id,
    required this.username,
    required this.fullName,
    this.firstName,
    this.middleName,
    this.lastName,
    this.suffix,
    required this.role,
    this.avatarUrl,
    this.gradeLevelId,
    this.gradeLevel,
    this.email,
    this.phoneNumber,
    this.numberOfChildren = 0,
    this.skills = const [],
    this.certifications = const [],
    this.skillDetails = const [],
    this.certificationDetails = const [],
    this.education = const Education(),
    this.permissions = const {},
    this.assignableRoles = const [],
    this.dateOfAppointment,
    this.birthdate,
    this.address,
    this.isActive = true,
    this.subjects = const [],
    this.coordinatorType,
    this.alsoTeaching = false,
    this.deanGradeLevelId,
    this.deanGradeLevel,
    this.departmentId,
    this.department,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    List<UserSubject> subjects = [];
    try {
      subjects = (json['subjects'] as List? ?? [])
          .map((s) => UserSubject.fromJson(s as Map<String, dynamic>))
          .toList();
    } catch (_) {}
    return User(
      id: json['id'] ?? 0,
      username: (json['username'] ?? '').toString(),
      fullName: (json['full_name'] ?? '').toString(),
      firstName: json['first_name']?.toString(),
      middleName: json['middle_name']?.toString(),
      lastName: json['last_name']?.toString(),
      suffix: json['suffix']?.toString(),
      role: (json['role'] ?? 'teacher').toString(),
      avatarUrl: json['avatar_url']?.toString(),
      gradeLevelId: json['grade_level_id'] as int?,
      gradeLevel: json['grade_level']?.toString(),
      email: json['email']?.toString(),
      phoneNumber: json['phone_number']?.toString(),
      numberOfChildren: (json['number_of_children'] as num?)?.toInt() ?? 0,
      skills: _stringList(json['skills']),
      certifications: _stringList(json['certifications']),
      skillDetails: _objList(json['skill_details'], SkillInfo.fromJson),
      certificationDetails:
          _objList(json['certification_details'], CertificationInfo.fromJson),
      education: Education.fromJson(json['education'] as Map<String, dynamic>?),
      permissions: _stringList(json['permissions']).toSet(),
      assignableRoles: _stringList(json['assignable_roles']),
      dateOfAppointment: json['date_of_appointment']?.toString(),
      birthdate: json['birthdate']?.toString(),
      address: json['address']?.toString(),
      isActive: (json['is_active'] ?? 1) == 1,
      subjects: subjects,
      coordinatorType: json['coordinator_type']?.toString(),
      alsoTeaching: json['also_teaching'] == true,
      deanGradeLevelId: json['dean_grade_level_id'] as int?,
      deanGradeLevel: json['dean_grade_level']?.toString(),
      departmentId: json['department_id'] as int?,
      department: json['department']?.toString(),
    );
  }

  bool get isAdmin => role == 'admin';
  bool get isPrincipal => role == 'principal';
  bool get isCoordinator => role == 'coordinator';
  bool get isDean => role == 'dean';
  bool get isTeacher => role == 'teacher';
  bool get isRegistrar => role == 'registrar';

  /// Whether the backend granted this session [permission]. Only meaningful
  /// for the signed-in user; the server enforces every one of these anyway.
  bool can(String permission) => permissions.contains(permission);

  bool get isManager => can('create_tasks');
  bool get canReviewSubmissions => can('review_submissions');
  bool get canAssign => can('assign_tasks');

  String get initials => fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U';

  String get roleLabel {
    switch (role) {
      case 'admin':       return 'Admin';
      case 'principal':   return 'Principal';
      case 'coordinator': return 'Coordinator';
      case 'dean':        return 'Dean';
      case 'registrar':   return 'Registrar';
      default:            return 'Teacher';
    }
  }
}

/// An assignable person ranked for a task by POST /api/users/assignable/suggestions.
/// Specialization, certifications, skills and education fitting the task raise
/// [score]; number of children and open workload lower it. [reasons] explains
/// the fit and [loadFactors] what lowered the rank.
class AssigneeSuggestion {
  final User user;
  final double score;
  final bool isMatch;
  final List<String> reasons;
  final List<String> loadFactors;
  final List<String> matchedSkills;
  final List<String> matchedCertifications;
  /// Certifications in a category related to the task (count less than a direct match).
  final List<String> relatedCertifications;
  final int openTasks;

  AssigneeSuggestion({
    required this.user,
    required this.score,
    required this.isMatch,
    this.reasons = const [],
    this.loadFactors = const [],
    this.matchedSkills = const [],
    this.matchedCertifications = const [],
    this.relatedCertifications = const [],
    this.openTasks = 0,
  });

  factory AssigneeSuggestion.fromJson(Map<String, dynamic> json) =>
      AssigneeSuggestion(
        user: User.fromJson(json),
        score: (json['score'] as num?)?.toDouble() ?? 0,
        isMatch: json['is_match'] == true,
        reasons: _stringList(json['reasons']),
        loadFactors: _stringList(json['load_factors']),
        matchedSkills: _stringList(json['matched_skills']),
        matchedCertifications: _stringList(json['matched_certifications']),
        relatedCertifications: _stringList(json['related_certifications']),
        openTasks: (json['open_tasks'] as num?)?.toInt() ?? 0,
      );
}

class TaskFile {
  final int? id;
  final String fileType;
  final String name;
  final String url;

  TaskFile({this.id, required this.fileType, required this.name, required this.url});

  factory TaskFile.fromJson(Map<String, dynamic> json) => TaskFile(
        id: json['id'],
        fileType: (json['attachment_type'] ?? json['file_type'] ?? 'file').toString(),
        name: (json['name'] ?? '').toString(),
        url: (json['url'] ?? '').toString(),
      );
}

class Submission {
  final int id;
  final int taskId;
  final int userId;
  final String status;
  final int pointsEarned;
  final String submittedAt;
  final String? fullName;
  final List<TaskFile> files;

  Submission({
    required this.id,
    required this.taskId,
    required this.userId,
    required this.status,
    required this.pointsEarned,
    required this.submittedAt,
    this.fullName,
    required this.files,
  });

  factory Submission.fromJson(Map<String, dynamic> json) => Submission(
        id: json['id'] ?? 0,
        taskId: json['task_id'] ?? 0,
        userId: json['user_id'] ?? json['personnel_id'] ?? 0,
        status: (json['status'] ?? json['report_status'] ?? 'Pending').toString(),
        pointsEarned: json['points_earned'] ?? 0,
        submittedAt: (json['submitted_at'] ?? json['report_date'] ?? '').toString(),
        fullName: json['full_name']?.toString(),
        files: (json['files'] as List? ?? [])
            .map((f) => TaskFile.fromJson(f as Map<String, dynamic>))
            .toList(),
      );
}

class Report {
  final int id;
  final int taskId;
  final int personnelId;
  final String reportTitle;
  final String? reportDescription;
  final String? reportType;
  final String? reportLinkUrl;
  final String? reportFilePath;
  final String? reportFilename;
  final String reportDate;
  final String reportStatus;
  final String? fullName;
  final String? avatarUrl;
  final String? gradeLevel;

  Report({
    required this.id,
    required this.taskId,
    required this.personnelId,
    required this.reportTitle,
    this.reportDescription,
    this.reportType,
    this.reportLinkUrl,
    this.reportFilePath,
    this.reportFilename,
    required this.reportDate,
    required this.reportStatus,
    this.fullName,
    this.avatarUrl,
    this.gradeLevel,
  });

  factory Report.fromJson(Map<String, dynamic> json) => Report(
        id: json['id'] ?? 0,
        taskId: json['task_id'] ?? 0,
        personnelId: json['personnel_id'] ?? 0,
        reportTitle: (json['report_title'] ?? '').toString(),
        reportDescription: json['report_description']?.toString(),
        reportType: json['report_type']?.toString(),
        reportLinkUrl: json['report_link_url']?.toString(),
        reportFilePath: json['report_file_path']?.toString(),
        reportFilename: json['report_filename']?.toString(),
        reportDate: (json['report_date'] ?? '').toString(),
        reportStatus: (json['report_status'] ?? 'Pending').toString(),
        fullName: json['full_name']?.toString(),
        avatarUrl: json['avatar_url']?.toString(),
        gradeLevel: json['grade_level']?.toString(),
      );
}

class Comment {
  final int id;
  final int userId;
  final String fullName;
  final String content;
  final String commentType;
  final String createdAt;
  final int? reportId;

  Comment({
    required this.id,
    required this.userId,
    required this.fullName,
    required this.content,
    required this.commentType,
    required this.createdAt,
    this.reportId,
  });

  factory Comment.fromJson(Map<String, dynamic> json) => Comment(
        id: json['id'] ?? 0,
        userId: json['user_id'] ?? 0,
        fullName: (json['full_name'] ?? '').toString(),
        content: (json['content'] ?? '').toString(),
        commentType: (json['comment_type'] ?? 'public').toString(),
        createdAt: (json['created_at'] ?? '').toString(),
        reportId: json['report_id'] as int?,
      );
}

class Task {
  final int id;
  final String title;
  final String? subject;
  final String? startDate;
  final String? endDate;
  final String? dueTime;
  final String? instructions;
  final String status;
  final String taskCategory; // 'common' | 'special'
  final int submissionCount;
  final List<User> assignedUsers;
  final List<Comment> publicComments;
  final List<Comment> privateComments;
  final Report? myReport;
  final int pointsEarly;
  final int pointsOntime;
  final int pointsLate24;
  final int pointsAfter24;
  final String? submissionStatus;
  final int? teamTotal;
  final int? teamSubmitted;
  final List<Report> reports;
  /// Assignees who have submitted (task log or report), for reviewers.
  final Set<int> submittedAssigneeIds;
  /// Server-decided: may the current user edit/disable/delete this task.
  final bool canEdit;
  /// Who assigned each assignee (user id → assigner id).
  final Map<int, int?> assignedByOf;
  /// Whose progress teamTotal/teamSubmitted cover: 'all' assignees (task
  /// creator, principal/admin) or 'mine' (people the viewer assigned).
  final String? teamScope;

  Task({
    required this.id,
    required this.title,
    this.subject,
    this.startDate,
    this.endDate,
    this.dueTime,
    this.instructions,
    required this.status,
    this.taskCategory = 'common',
    required this.submissionCount,
    required this.assignedUsers,
    required this.publicComments,
    required this.privateComments,
    this.myReport,
    required this.pointsEarly,
    required this.pointsOntime,
    required this.pointsLate24,
    required this.pointsAfter24,
    this.submissionStatus,
    this.teamTotal,
    this.teamSubmitted,
    required this.reports,
    this.submittedAssigneeIds = const {},
    this.canEdit = false,
    this.assignedByOf = const {},
    this.teamScope,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    List<User> assignedUsers = [];
    final submittedIds = <int>{};
    final assignedBy = <int, int?>{};
    try {
      final raw = (json['assigned_users'] as List? ?? []).cast<Map<String, dynamic>>();
      assignedUsers = raw.map(User.fromJson).toList();
      for (final u in raw) {
        if (u['submitted'] == true || u['submitted'] == 1) submittedIds.add(u['id'] as int);
        assignedBy[u['id'] as int] = u['assigned_by'] as int?;
      }
    } catch (_) {}

    List<Comment> publicComments = [];
    try {
      publicComments = (json['public_comments'] as List? ?? [])
          .map((c) => Comment.fromJson(c as Map<String, dynamic>))
          .toList();
    } catch (_) {}

    List<Comment> privateComments = [];
    try {
      privateComments = (json['private_comments'] as List? ?? [])
          .map((c) => Comment.fromJson(c as Map<String, dynamic>))
          .toList();
    } catch (_) {}

    Report? myReport;
    try {
      if (json['my_report'] != null) {
        myReport = Report.fromJson(json['my_report'] as Map<String, dynamic>);
      }
    } catch (_) {}

    List<Report> reports = [];
    try {
      reports = (json['reports'] as List? ?? [])
          .map((r) => Report.fromJson(r as Map<String, dynamic>))
          .toList();
    } catch (_) {}

    return Task(
      id: json['id'] ?? 0,
      title: (json['title'] ?? '').toString(),
      subject: json['subject']?.toString(),
      startDate: json['start_date']?.toString(),
      endDate: json['end_date']?.toString(),
      dueTime: json['due_time']?.toString(),
      instructions: json['instructions']?.toString(),
      status: (json['status'] ?? 'active').toString(),
      taskCategory: (json['task_category'] ?? 'common').toString(),
      submissionCount: json['submission_count'] ?? 0,
      assignedUsers: assignedUsers,
      publicComments: publicComments,
      privateComments: privateComments,
      myReport: myReport,
      pointsEarly: json['points_early'] ?? 100,
      pointsOntime: json['points_ontime'] ?? 100,
      pointsLate24: json['points_late24'] ?? 50,
      pointsAfter24: json['points_after24'] ?? 0,
      submissionStatus: json['submission_status']?.toString(),
      teamTotal: (json['team_total'] ?? json['teacher_total']) as int?,
      teamSubmitted: (json['team_submitted'] ?? json['teacher_submitted']) as int?,
      reports: reports,
      submittedAssigneeIds: submittedIds,
      canEdit: json['can_edit'] == true,
      assignedByOf: assignedBy,
      teamScope: json['team_scope']?.toString(),
    );
  }

  bool get isSubmitted =>
      submissionStatus == 'submitted' || myReport != null;

  /// When the task is due: [endDate] at [dueTime] ('5:00 PM'), or the end of
  /// [endDate] when no time is set. Mirrors task_deadline in the backend
  /// (date_utils.py) so the dashboard and My Tasks agree on "overdue".
  DateTime? get deadline {
    final end = endDate;
    if (end == null || end.isEmpty) return null;
    final d = DateTime.tryParse(end.length >= 10 ? end.substring(0, 10) : end);
    if (d == null) return null;
    final m = RegExp(r'^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$')
        .firstMatch((dueTime ?? '').trim());
    if (m == null) return DateTime(d.year, d.month, d.day, 23, 59, 59);
    var h = int.parse(m.group(1)!) % 12;
    if (m.group(3)!.toUpperCase() == 'PM') h += 12;
    return DateTime(d.year, d.month, d.day, h, int.parse(m.group(2)!));
  }

  /// Unsubmitted and past its deadline.
  bool get isOverdue {
    final dl = deadline;
    return !isSubmitted && dl != null && dl.isBefore(DateTime.now());
  }
}

class TaskTemplate {
  final int id;
  final String title;
  final String? instructions;
  final String? startDate;
  final String? endDate;
  final String? dueTime;
  final int pointsEarly;
  final int pointsOntime;
  final int pointsLate24;
  final int pointsAfter24;
  final String? createdByName;

  TaskTemplate({
    required this.id,
    required this.title,
    this.instructions,
    this.startDate,
    this.endDate,
    this.dueTime,
    this.pointsEarly = 100,
    this.pointsOntime = 100,
    this.pointsLate24 = 50,
    this.pointsAfter24 = 0,
    this.createdByName,
  });

  factory TaskTemplate.fromJson(Map<String, dynamic> json) => TaskTemplate(
        id: json['id'] as int,
        title: (json['title'] ?? '').toString(),
        instructions: json['instructions']?.toString(),
        startDate: json['start_date']?.toString(),
        endDate: json['end_date']?.toString(),
        dueTime: json['due_time']?.toString(),
        pointsEarly: json['points_early'] ?? 100,
        pointsOntime: json['points_ontime'] ?? 100,
        pointsLate24: json['points_late24'] ?? 50,
        pointsAfter24: json['points_after24'] ?? 0,
        createdByName: json['created_by_name']?.toString(),
      );
}

class DashboardData {
  final int pending;
  final int submitted;
  final int missing;
  final int totalTasks;
  final List<Task> taskManagerTasks;
  final List<Task> myTasks;
  final List<Map<String, dynamic>> events;
  final int eventsTotal;
  final Set<DateTime> deadlineDates; // days with open task deadlines

  DashboardData({
    required this.pending,
    required this.submitted,
    required this.missing,
    required this.totalTasks,
    required this.taskManagerTasks,
    required this.myTasks,
    required this.events,
    this.eventsTotal = 0,
    this.deadlineDates = const {},
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    List<Task> tmTasks = [];
    try {
      tmTasks = (json['task_manager_tasks'] as List? ?? [])
          .map((t) => Task.fromJson(t as Map<String, dynamic>))
          .toList();
    } catch (_) {}

    List<Task> myTasks = [];
    try {
      myTasks = (json['my_tasks'] as List? ?? [])
          .map((t) => Task.fromJson(t as Map<String, dynamic>))
          .toList();
    } catch (_) {}

    return DashboardData(
      pending: json['pending'] ?? 0,
      submitted: json['submitted'] ?? 0,
      missing: json['missing'] ?? 0,
      totalTasks: json['total_tasks'] ?? 0,
      taskManagerTasks: tmTasks,
      myTasks: myTasks,
      events: List<Map<String, dynamic>>.from(json['events'] ?? []),
      eventsTotal: json['events_total'] ?? 0,
      deadlineDates: {
        for (final d in (json['deadline_dates'] as List? ?? []))
          if (DateTime.tryParse(d.toString()) != null)
            DateTime.parse(d.toString()),
      },
    );
  }
}

// ── Appraisal Models ──────────────────────────────────────────────────────────

class SpecialTask {
  final int id;
  final String title;
  final String? description;
  final int? assigneeId;
  final String? assigneeName;
  final String? assigneeRole;
  final String? assigneeDepartment;
  final String? assignerName;
  final String? dueDate;
  final String? submittedDate;
  final String status;
  final SpecialTaskEvaluation? evaluation;

  SpecialTask({
    required this.id,
    required this.title,
    this.description,
    this.assigneeId,
    this.assigneeName,
    this.assigneeRole,
    this.assigneeDepartment,
    this.assignerName,
    this.dueDate,
    this.submittedDate,
    required this.status,
    this.evaluation,
  });

  factory SpecialTask.fromJson(Map<String, dynamic> json) {
    final assignee = json['assignee'] as Map<String, dynamic>?;
    final assigner = json['assigner'] as Map<String, dynamic>?;
    final evalJson = json['evaluation'] as Map<String, dynamic>?;
    return SpecialTask(
      id: json['id'] ?? 0,
      title: (json['title'] ?? '').toString(),
      description: json['description']?.toString(),
      assigneeId: assignee?['id'] as int?,
      assigneeName: assignee?['full_name']?.toString(),
      assigneeRole: assignee?['role']?.toString(),
      assigneeDepartment: assignee?['grade_level']?.toString(),
      assignerName: assigner?['full_name']?.toString(),
      dueDate: json['due_date']?.toString(),
      submittedDate: json['created_at']?.toString(),
      status: (json['status'] ?? 'pending').toString(),
      evaluation: evalJson != null ? SpecialTaskEvaluation.fromJson(evalJson) : null,
    );
  }

  int get scoreOutOf100 {
    final ev = evaluation;
    if (ev == null || ev.weightedAverage == null) return 0;
    return (ev.weightedAverage! * 20).round();
  }
}

class SpecialTaskEvaluation {
  final int completionScore;
  final int timelinessScore;
  final int initiativeScore;
  final int coordinationScore;
  final double? weightedAverage;
  final String? remarks;

  SpecialTaskEvaluation({
    required this.completionScore,
    required this.timelinessScore,
    required this.initiativeScore,
    required this.coordinationScore,
    this.weightedAverage,
    this.remarks,
  });

  factory SpecialTaskEvaluation.fromJson(Map<String, dynamic> json) =>
      SpecialTaskEvaluation(
        completionScore: json['completion_quality_score'] ?? 0,
        timelinessScore: json['timeliness_score'] ?? 0,
        initiativeScore: json['initiative_score'] ?? 0,
        coordinationScore: json['coordination_score'] ?? 0,
        weightedAverage: (json['weighted_average'] as num?)?.toDouble(),
        remarks: json['remarks']?.toString(),
      );
}

class EventForAppraisal {
  final int id;
  final String title;
  final String? description;
  final String? targetDate;
  final String? venue;
  final String status;
  final String? organizerName;
  final String? department;
  final int? expectedAttendees;
  final List<EventEvaluation> evaluations;
  /// Evaluator breakdown: {total, by_role, by_sex, by_age_group} (counts).
  final Map<String, dynamic> demographics;

  EventForAppraisal({
    required this.id,
    required this.title,
    this.description,
    this.targetDate,
    this.venue,
    required this.status,
    this.organizerName,
    this.department,
    this.expectedAttendees,
    this.evaluations = const [],
    this.demographics = const {},
  });

  factory EventForAppraisal.fromJson(Map<String, dynamic> json) {
    final organizer = json['organizer'] as Map<String, dynamic>?;
    final evals = (json['evaluations'] as List? ?? [])
        .map((e) => EventEvaluation.fromJson(e as Map<String, dynamic>))
        .toList();
    return EventForAppraisal(
      id: json['id'] ?? 0,
      title: (json['title'] ?? '').toString(),
      description: json['description']?.toString(),
      targetDate: json['target_date']?.toString(),
      venue: json['venue']?.toString(),
      status: (json['status'] ?? 'pending_approval').toString(),
      organizerName: organizer?['full_name']?.toString(),
      department: json['department']?.toString(),
      expectedAttendees: json['expected_attendees'] as int?,
      evaluations: evals,
      demographics: Map<String, dynamic>.from(json['demographics'] as Map? ?? {}),
    );
  }

  double get avgRating {
    if (evaluations.isEmpty) return 0;
    return evaluations.map((e) => e.average).reduce((a, b) => a + b) / evaluations.length;
  }

  // Evidency Rate: 0-5 average mapped to 0-100% for display, matching Lok's UI.
  double get evidencyRate => avgRating / 5.0 * 100.0;

  String get shortDate => targetDate?.split('T').first ?? '—';
}

class EventEvaluation {
  final int id;
  final String evaluatorName;
  final String? evaluatorRole;
  final int planningScore;
  final int objectivesScore;
  final int personnelScore;
  final int timeMgmtScore;
  final int engagementScore;
  final int resourceScore;
  final String? feedbackComments;
  final String? dateSubmitted;

  EventEvaluation({
    required this.id,
    required this.evaluatorName,
    this.evaluatorRole,
    required this.planningScore,
    required this.objectivesScore,
    required this.personnelScore,
    required this.timeMgmtScore,
    required this.engagementScore,
    required this.resourceScore,
    this.feedbackComments,
    this.dateSubmitted,
  });

  factory EventEvaluation.fromJson(Map<String, dynamic> json) =>
      EventEvaluation(
        id: json['id'] ?? 0,
        evaluatorName: (json['evaluator_name'] ?? '').toString(),
        evaluatorRole: json['evaluator_role']?.toString(),
        planningScore: json['planning_score'] ?? 0,
        objectivesScore: json['objectives_score'] ?? 0,
        personnelScore: json['personnel_score'] ?? 0,
        timeMgmtScore: json['time_mgmt_score'] ?? 0,
        engagementScore: json['engagement_score'] ?? 0,
        resourceScore: json['resource_score'] ?? 0,
        feedbackComments: json['feedback_comments']?.toString(),
        dateSubmitted: json['date_submitted']?.toString(),
      );

  double get average =>
      (planningScore + objectivesScore + personnelScore +
       timeMgmtScore + engagementScore + resourceScore) / 6.0;
}


// ── School calendar ───────────────────────────────────────────────────────────

/// A term (e.g. "1st Quarter") inside a school year.
class SchoolTerm {
  final int id;
  final String name;
  final String startDate;
  final String endDate;
  final String status; // current | upcoming | archived
  const SchoolTerm({required this.id, required this.name, required this.startDate,
      required this.endDate, this.status = 'upcoming'});

  factory SchoolTerm.fromJson(Map<String, dynamic> j) => SchoolTerm(
        id: j['id'] ?? 0,
        name: (j['name'] ?? '').toString(),
        startDate: (j['start_date'] ?? '').toString(),
        endDate: (j['end_date'] ?? '').toString(),
        status: (j['status'] ?? 'upcoming').toString(),
      );
}

/// A school year set by the principal; records dated in years that have ended
/// are archived.
class SchoolYear {
  final int id;
  final String name;
  final String startDate;
  final String endDate;
  final String status; // current | upcoming | archived
  final bool isDefault; // what "current" resolves to
  final List<SchoolTerm> terms;
  const SchoolYear({required this.id, required this.name, required this.startDate,
      required this.endDate, this.status = 'upcoming', this.isDefault = false,
      this.terms = const []});

  factory SchoolYear.fromJson(Map<String, dynamic> j) => SchoolYear(
        id: j['id'] ?? 0,
        name: (j['name'] ?? '').toString(),
        startDate: (j['start_date'] ?? '').toString(),
        endDate: (j['end_date'] ?? '').toString(),
        status: (j['status'] ?? 'upcoming').toString(),
        isDefault: j['is_selected_default'] == true,
        terms: (j['terms'] as List? ?? [])
            .map((t) => SchoolTerm.fromJson(t as Map<String, dynamic>))
            .toList(),
      );
}

/// Which school year (and optionally term) a list is showing.
class SchoolYearFilter {
  final String schoolYear; // 'current' | 'all' | '<id>'
  final int? termId;
  const SchoolYearFilter({this.schoolYear = 'current', this.termId});
  static const current = SchoolYearFilter();

  Map<String, String> get query => {
        if (schoolYear != 'current') 'school_year': schoolYear,
        if (termId != null) 'term_id': '$termId',
      };

  @override
  bool operator ==(Object other) =>
      other is SchoolYearFilter && other.schoolYear == schoolYear && other.termId == termId;
  @override
  int get hashCode => Object.hash(schoolYear, termId);
}

// ── Appraisal badges ──────────────────────────────────────────────────────────

class AppraisalBadge {
  final String code;
  final String name;
  final String description;
  final String icon;
  final String? tier; // bronze | silver | gold
  final bool earned;
  final int progress;
  final int target;
  const AppraisalBadge({required this.code, required this.name, required this.description,
      required this.icon, this.tier, required this.earned, required this.progress,
      required this.target});

  factory AppraisalBadge.fromJson(Map<String, dynamic> j) => AppraisalBadge(
        code: (j['code'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
        icon: (j['icon'] ?? '').toString(),
        tier: j['tier']?.toString(),
        earned: j['earned'] == true,
        progress: (j['progress'] as num?)?.toInt() ?? 0,
        target: (j['target'] as num?)?.toInt() ?? 1,
      );
}
