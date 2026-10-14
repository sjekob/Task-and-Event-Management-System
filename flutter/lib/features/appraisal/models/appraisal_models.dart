enum TaskStatus { pending, evaluated, flagged, notSubmitted }
enum EventStatus { awaitingRatings, rated, flagged }
enum TrendDirection { up, down, stable }
enum AppraisalGrade { outstanding, verySatisfactory, satisfactory, unsatisfactory }
enum EvaluatorRole { teacher, student, coordinator, dean, principal }

extension EvaluatorRoleLabel on EvaluatorRole {
  String get label {
    switch (this) {
      case EvaluatorRole.teacher:     return 'Teacher';
      case EvaluatorRole.student:     return 'Student';
      case EvaluatorRole.coordinator: return 'Coordinator';
      case EvaluatorRole.dean:        return 'Dean';
      case EvaluatorRole.principal:   return 'Principal';
    }
  }
}

// ── Event Rubric Scores (6 criteria, data dictionary) ─────────────────────────
class EventRubricScores {
  final double planning;    // Planning & Organization
  final double objectives;  // Achievement of Objectives
  final double personnel;   // Personnel Performance
  final double timeMgmt;    // Time Management
  final double engagement;  // Participant Engagement
  final double resource;    // Resource Management

  const EventRubricScores({
    required this.planning,
    required this.objectives,
    required this.personnel,
    required this.timeMgmt,
    required this.engagement,
    required this.resource,
  });

  double get average =>
      (planning + objectives + personnel + timeMgmt + engagement + resource) / 6;

  /// Clockwise from top: planning, objectives, personnel, timeMgmt, engagement, resource
  List<double> get asList =>
      [planning, objectives, personnel, timeMgmt, engagement, resource];

  static EventRubricScores aggregate(List<AttendeeRating> ratings) {
    if (ratings.isEmpty) {
      return const EventRubricScores(
          planning: 0, objectives: 0, personnel: 0,
          timeMgmt: 0, engagement: 0, resource: 0);
    }
    double p = 0, o = 0, pe = 0, t = 0, e = 0, r = 0;
    for (final rt in ratings) {
      p  += rt.scores.planning;
      o  += rt.scores.objectives;
      pe += rt.scores.personnel;
      t  += rt.scores.timeMgmt;
      e  += rt.scores.engagement;
      r  += rt.scores.resource;
    }
    final n = ratings.length.toDouble();
    return EventRubricScores(
        planning: p / n, objectives: o / n, personnel: pe / n,
        timeMgmt: t / n, engagement: e / n, resource: r / n);
  }
}

// ── Attendee Rating (one submission per evaluator) ────────────────────────────
class AttendeeRating {
  final String name;
  final EvaluatorRole role;
  final EventRubricScores scores;
  final String? comments;
  final String dateSubmitted;

  const AttendeeRating({
    required this.name,
    required this.role,
    required this.scores,
    this.comments,
    required this.dateSubmitted,
  });

  double get overallScore => scores.average;
}

// ── Special Task Evaluation ──────────────────────────────────────────────────
/// Coordinator evaluates Dean/Teacher on special tasks using weighted rubric.
/// Weights: completion 35% | timeliness 30% | initiative 20% | coordination 15%
class SpecialTaskEvaluation {
  final int completionQualityScore;  // 35% — Task Completion Quality
  final int timelinessScore;          // 30% — Timeliness and Reliability
  final int initiativeScore;          // 20% — Initiative and Problem-Solving
  final int coordinationScore;        // 15% — Coordination & Communication
  final double weightedAverage;       // Computed [0.00–5.00]
  final bool isFlagged;               // TRUE if weighted_average < 3.0
  final String? remarks;
  final String evaluatorName;
  final String dateSubmitted;

  const SpecialTaskEvaluation({
    required this.completionQualityScore,
    required this.timelinessScore,
    required this.initiativeScore,
    required this.coordinationScore,
    required this.weightedAverage,
    required this.isFlagged,
    this.remarks,
    required this.evaluatorName,
    required this.dateSubmitted,
  });

  /// Convert weighted average [0.00–5.00] to compliance points [0–100]
  int getCompliancePoints() => (weightedAverage * 20).round();
}

// ── Special Task ──────────────────────────────────────────────────────────────
class SpecialTask {
  final String id;
  final String personnel;
  final String department;
  final String task;
  final String assignedBy;
  final String dueDate;
  final String? submittedDate;
  final SpecialTaskEvaluation? evaluation;
  final TaskStatus status;
  final int? score;  // Derived from evaluation

  const SpecialTask({
    required this.id,
    required this.personnel,
    required this.department,
    required this.task,
    required this.assignedBy,
    required this.dueDate,
    this.submittedDate,
    this.evaluation,
    required this.status,
    this.score,
  });

  bool get isFlagged => score != null && score! < 60;

  /// Returns the score if available, otherwise 0
  int getScore() => score ?? 0;
}

// ── School Event ──────────────────────────────────────────────────────────────
class SchoolEvent {
  final String id;
  final String name;
  final String date;
  final String organizer;
  final String department;
  final int attendees;
  final List<AttendeeRating> ratings;
  final EventStatus status;

  const SchoolEvent({
    required this.id,
    required this.name,
    required this.date,
    required this.organizer,
    required this.department,
    required this.attendees,
    required this.ratings,
    required this.status,
  });

  int get responses => ratings.length;
  double? get avgRating => ratings.isEmpty
      ? null
      : ratings.map((r) => r.overallScore).reduce((a, b) => a + b) /
          ratings.length;
  EventRubricScores get aggregatedScores =>
      EventRubricScores.aggregate(ratings);
}

// ── Faculty Performance ───────────────────────────────────────────────────────
class FacultyPerformance {
  final String name;
  final String department;
  final int? reportScore;
  final int? taskScore;
  final int? eventScore;
  final int overallScore;
  final AppraisalGrade grade;
  final TrendDirection trend;

  const FacultyPerformance({
    required this.name,
    required this.department,
    this.reportScore,
    this.taskScore,
    this.eventScore,
    required this.overallScore,
    required this.grade,
    required this.trend,
  });
}

// ── Monthly Trend ─────────────────────────────────────────────────────────────
class MonthlyTrend {
  final String month;
  final double reportScore;
  final double taskScore;
  final double eventScore;

  const MonthlyTrend({
    required this.month,
    required this.reportScore,
    required this.taskScore,
    required this.eventScore,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────────────────────

final List<SpecialTask> sampleTasks = [
  const SpecialTask(
    id: 'ST001', personnel: 'John Smith', department: 'Engineering',
    task: 'Curriculum Review Documentation', assignedBy: 'Dean Garcia',
    dueDate: '4/15/2025', submittedDate: '4/14/2025',
    evaluation: null, status: TaskStatus.pending, score: null,
  ),
  const SpecialTask(
    id: 'ST002', personnel: 'Sarah Johnson', department: 'Business',
    task: 'Faculty Development Workshop Facilitation', assignedBy: 'Dean Garcia',
    dueDate: '4/10/2025', submittedDate: '4/11/2025',
    evaluation: SpecialTaskEvaluation(
      completionQualityScore: 4, timelinessScore: 3, initiativeScore: 3, coordinationScore: 0,
      weightedAverage: 3.45, isFlagged: false,
      remarks: 'Good performance overall. Timeliness needs slight improvement.',
      evaluatorName: 'Dean Garcia', dateSubmitted: '2025-04-12 09:30:00',
    ),
    status: TaskStatus.evaluated, score: 69,
  ),
  const SpecialTask(
    id: 'ST003', personnel: 'Dean Garcia', department: 'Sciences',
    task: 'Laboratory Safety Compliance Report', assignedBy: 'Coord Santos',
    dueDate: '4/5/2025', submittedDate: '4/3/2025',
    evaluation: SpecialTaskEvaluation(
      completionQualityScore: 5, timelinessScore: 5, initiativeScore: 5, coordinationScore: 0,
      weightedAverage: 5.0, isFlagged: false,
      remarks: 'Outstanding. Exemplary submission.',
      evaluatorName: 'Coord Santos', dateSubmitted: '2025-04-04 14:00:00',
    ),
    status: TaskStatus.evaluated, score: 100,
  ),
  const SpecialTask(
    id: 'ST004', personnel: 'Dean Garcia', department: 'Sciences',
    task: 'Teacher Development Program Planning', assignedBy: 'Coord Santos',
    dueDate: '4/18/2025', submittedDate: '4/22/2025',
    evaluation: SpecialTaskEvaluation(
      completionQualityScore: 2, timelinessScore: 2, initiativeScore: 2, coordinationScore: 1,
      weightedAverage: 1.85, isFlagged: true,
      remarks: 'Below expectations. Late submission and incomplete coordination.',
      evaluatorName: 'Coord Santos', dateSubmitted: '2025-04-23 10:00:00',
    ),
    status: TaskStatus.flagged, score: 37,
  ),
  const SpecialTask(
    id: 'ST005', personnel: 'Dean Reyes', department: 'Engineering',
    task: 'Faculty Development Workshop Facilitation', assignedBy: 'Coord Santos',
    dueDate: '4/20/2025', submittedDate: '4/19/2025',
    evaluation: SpecialTaskEvaluation(
      completionQualityScore: 5, timelinessScore: 4, initiativeScore: 4, coordinationScore: 0,
      weightedAverage: 4.55, isFlagged: false,
      remarks: 'Well executed. Minor areas for coordination improvement.',
      evaluatorName: 'Coord Santos', dateSubmitted: '2025-04-20 16:00:00',
    ),
    status: TaskStatus.evaluated, score: 91,
  ),
  const SpecialTask(
    id: 'ST006', personnel: 'Sarah Johnson', department: 'Business',
    task: 'Laboratory Safety Compliance Report', assignedBy: 'Dean Cruz',
    dueDate: '4/25/2025', submittedDate: null,
    evaluation: null, status: TaskStatus.notSubmitted, score: null,
  ),
];

final List<SchoolEvent> sampleEvents = [
  SchoolEvent(
    id: 'EV001', name: 'Leadership Seminar 2025', date: '4/20/2025',
    organizer: 'David Lee', department: 'HR & Training', attendees: 250,
    ratings: const [
      AttendeeRating(
        name: 'Student A', role: EvaluatorRole.student,
        scores: EventRubricScores(planning: 5, objectives: 5, personnel: 5, timeMgmt: 4, engagement: 5, resource: 4),
        dateSubmitted: '2025-04-21 10:00:00',
      ),
      AttendeeRating(
        name: 'Student B', role: EvaluatorRole.student,
        scores: EventRubricScores(planning: 4, objectives: 4, personnel: 4, timeMgmt: 5, engagement: 4, resource: 4),
        dateSubmitted: '2025-04-21 10:30:00',
      ),
      AttendeeRating(
        name: 'Prof. Garcia', role: EvaluatorRole.teacher,
        scores: EventRubricScores(planning: 5, objectives: 5, personnel: 5, timeMgmt: 5, engagement: 5, resource: 5),
        comments: 'Excellent seminar. Very well organized and impactful.',
        dateSubmitted: '2025-04-21 11:00:00',
      ),
    ],
    status: EventStatus.rated,
  ),
  SchoolEvent(
    id: 'EV002', name: 'Science Fair Coordination', date: '4/10/2025',
    organizer: 'Maria Santos', department: 'Sciences', attendees: 180,
    ratings: const [
      AttendeeRating(
        name: 'Student C', role: EvaluatorRole.student,
        scores: EventRubricScores(planning: 2, objectives: 2, personnel: 3, timeMgmt: 2, engagement: 2, resource: 3),
        comments: 'Poorly organized. Agenda was unclear.',
        dateSubmitted: '2025-04-11 09:00:00',
      ),
      AttendeeRating(
        name: 'Teacher B', role: EvaluatorRole.teacher,
        scores: EventRubricScores(planning: 3, objectives: 2, personnel: 2, timeMgmt: 3, engagement: 2, resource: 2),
        dateSubmitted: '2025-04-11 10:00:00',
      ),
    ],
    status: EventStatus.flagged,
  ),
  const SchoolEvent(
    id: 'EV003', name: 'Tech Innovation Summit', date: '5/5/2025',
    organizer: 'Robert Cruz', department: 'Engineering', attendees: 120,
    ratings: [],
    status: EventStatus.awaitingRatings,
  ),
  SchoolEvent(
    id: 'EV004', name: 'Professional Development Workshop', date: '4/25/2025',
    organizer: 'Jennifer Park', department: 'Business', attendees: 80,
    ratings: const [
      AttendeeRating(
        name: 'Dean Lopez', role: EvaluatorRole.dean,
        scores: EventRubricScores(planning: 4, objectives: 5, personnel: 4, timeMgmt: 4, engagement: 4, resource: 5),
        comments: 'Very informative. Highly recommended.',
        dateSubmitted: '2025-04-26 08:00:00',
      ),
      AttendeeRating(
        name: 'Teacher C', role: EvaluatorRole.teacher,
        scores: EventRubricScores(planning: 4, objectives: 4, personnel: 4, timeMgmt: 5, engagement: 4, resource: 4),
        dateSubmitted: '2025-04-26 08:30:00',
      ),
      AttendeeRating(
        name: 'Teacher D', role: EvaluatorRole.teacher,
        scores: EventRubricScores(planning: 5, objectives: 4, personnel: 5, timeMgmt: 4, engagement: 5, resource: 4),
        dateSubmitted: '2025-04-26 09:00:00',
      ),
      AttendeeRating(
        name: 'Student D', role: EvaluatorRole.student,
        scores: EventRubricScores(planning: 4, objectives: 4, personnel: 4, timeMgmt: 4, engagement: 4, resource: 4),
        dateSubmitted: '2025-04-26 09:30:00',
      ),
    ],
    status: EventStatus.rated,
  ),
];

final List<FacultyPerformance> sampleFaculty = [
  const FacultyPerformance(
    name: 'John Smith', department: 'Engineering',
    reportScore: 92, taskScore: 88, eventScore: null,
    overallScore: 90, grade: AppraisalGrade.outstanding, trend: TrendDirection.up,
  ),
  const FacultyPerformance(
    name: 'Sarah Johnson', department: 'Business',
    reportScore: 85, taskScore: 67, eventScore: null,
    overallScore: 76, grade: AppraisalGrade.satisfactory, trend: TrendDirection.stable,
  ),
  const FacultyPerformance(
    name: 'Mike Chen', department: 'Sciences',
    reportScore: 100, taskScore: 100, eventScore: null,
    overallScore: 100, grade: AppraisalGrade.outstanding, trend: TrendDirection.up,
  ),
  const FacultyPerformance(
    name: 'Alice Brown', department: 'Humanities',
    reportScore: 60, taskScore: 28, eventScore: null,
    overallScore: 44, grade: AppraisalGrade.unsatisfactory, trend: TrendDirection.down,
  ),
];

final List<MonthlyTrend> sampleTrends = [
  const MonthlyTrend(month: 'Sep', reportScore: 72.3, taskScore: 70.0, eventScore: 74.0),
  const MonthlyTrend(month: 'Oct', reportScore: 75.1, taskScore: 73.0, eventScore: 76.5),
  const MonthlyTrend(month: 'Nov', reportScore: 76.8, taskScore: 75.0, eventScore: 78.0),
  const MonthlyTrend(month: 'Dec', reportScore: 77.5, taskScore: 76.0, eventScore: 79.0),
  const MonthlyTrend(month: 'Jan', reportScore: 79.2, taskScore: 78.0, eventScore: 80.5),
  const MonthlyTrend(month: 'Feb', reportScore: 80.4, taskScore: 79.5, eventScore: 81.8),
  const MonthlyTrend(month: 'Mar', reportScore: 81.6, taskScore: 80.8, eventScore: 83.0),
  const MonthlyTrend(month: 'Apr', reportScore: 83.1, taskScore: 82.0, eventScore: 84.5),
];