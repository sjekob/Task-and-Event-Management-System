class UserSubject {
  final String subject;
  final String? gradeLevel;

  UserSubject({required this.subject, this.gradeLevel});

  factory UserSubject.fromJson(Map<String, dynamic> json) => UserSubject(
        subject: (json['subject'] ?? '').toString(),
        gradeLevel: json['grade_level']?.toString(),
      );
}

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
  final String? tin;
  final String? qsis;
  final String? hdmf;
  final String? phic;
  final String? dateOfAppointment;
  final String? birthdate;
  final String? address;
  final bool isActive;
  final List<UserSubject> subjects;

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
    this.tin,
    this.qsis,
    this.hdmf,
    this.phic,
    this.dateOfAppointment,
    this.birthdate,
    this.address,
    this.isActive = true,
    this.subjects = const [],
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
      tin: json['tin']?.toString(),
      qsis: json['qsis']?.toString(),
      hdmf: json['hdmf']?.toString(),
      phic: json['phic']?.toString(),
      dateOfAppointment: json['date_of_appointment']?.toString(),
      birthdate: json['birthdate']?.toString(),
      address: json['address']?.toString(),
      isActive: (json['is_active'] ?? 1) == 1,
      subjects: subjects,
    );
  }

  bool get isAdmin => role == 'admin';
  bool get isPrincipal => role == 'principal';
  bool get isCoordinator => role == 'coordinator';
  bool get isDean => role == 'dean';
  bool get isTeacher => role == 'teacher';
  bool get isRegistrar => role == 'registrar';

  // Can create/manage tasks at the top level
  bool get isManager => isAdmin || isPrincipal || isCoordinator;
  // Can review submissions from their assigned subordinates
  bool get canReviewSubmissions => isAdmin || isPrincipal || isCoordinator || isDean;
  // Can assign tasks to others
  bool get canAssign => isAdmin || isPrincipal || isCoordinator || isDean;

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

  Task({
    required this.id,
    required this.title,
    this.subject,
    this.startDate,
    this.endDate,
    this.dueTime,
    this.instructions,
    required this.status,
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
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    List<User> assignedUsers = [];
    try {
      assignedUsers = (json['assigned_users'] as List? ?? [])
          .map((u) => User.fromJson(u as Map<String, dynamic>))
          .toList();
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
    );
  }

  bool get isSubmitted =>
      submissionStatus == 'submitted' || myReport != null;
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

  DashboardData({
    required this.pending,
    required this.submitted,
    required this.missing,
    required this.totalTasks,
    required this.taskManagerTasks,
    required this.myTasks,
    required this.events,
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
  final String? dueDate;
  final String status;
  final SpecialTaskEvaluation? evaluation;

  SpecialTask({
    required this.id,
    required this.title,
    this.description,
    this.assigneeId,
    this.assigneeName,
    this.assigneeRole,
    this.dueDate,
    required this.status,
    this.evaluation,
  });

  factory SpecialTask.fromJson(Map<String, dynamic> json) {
    final assignee = json['assignee'] as Map<String, dynamic>?;
    final evalJson = json['evaluation'] as Map<String, dynamic>?;
    return SpecialTask(
      id: json['id'] ?? 0,
      title: (json['title'] ?? '').toString(),
      description: json['description']?.toString(),
      assigneeId: assignee?['id'] as int?,
      assigneeName: assignee?['full_name']?.toString(),
      assigneeRole: assignee?['role']?.toString(),
      dueDate: json['due_date']?.toString(),
      status: (json['status'] ?? 'pending').toString(),
      evaluation: evalJson != null ? SpecialTaskEvaluation.fromJson(evalJson) : null,
    );
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

class SchoolEvent {
  final int id;
  final String title;
  final String? description;
  final String? eventDate;
  final String status;
  final List<EventEvaluation> evaluations;

  SchoolEvent({
    required this.id,
    required this.title,
    this.description,
    this.eventDate,
    required this.status,
    this.evaluations = const [],
  });

  factory SchoolEvent.fromJson(Map<String, dynamic> json) {
    final evals = (json['evaluations'] as List? ?? [])
        .map((e) => EventEvaluation.fromJson(e as Map<String, dynamic>))
        .toList();
    return SchoolEvent(
      id: json['id'] ?? 0,
      title: (json['title'] ?? '').toString(),
      description: json['description']?.toString(),
      eventDate: json['event_date']?.toString(),
      status: (json['status'] ?? 'upcoming').toString(),
      evaluations: evals,
    );
  }
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
