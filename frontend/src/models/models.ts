export type Json = Record<string, any>;

const str = (v: unknown, fallback = ''): string => (v ?? fallback).toString();
const strOrNull = (v: unknown): string | null => (v == null ? null : v.toString());
const intOrNull = (v: unknown): number | null => (typeof v === 'number' ? Math.trunc(v) : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);
const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.map((e) => String(e)) : []);
const objList = <T>(v: unknown, parse: (j: Json) => T): T[] =>
  Array.isArray(v) ? v.map((e) => parse(e as Json)) : [];

/// One page of a paginated list endpoint ({items, total, offset, has_more}).
export interface PageResult<T> {
  items: T[];
  total: number;
  offset: number;
  hasMore: boolean;
}

export function pageResultFromJson<T>(json: Json, parse: (j: Json) => T): PageResult<T> {
  return {
    items: objList(json.items, parse),
    total: json.total ?? 0,
    offset: json.offset ?? 0,
    hasMore: json.has_more === true,
  };
}

export class UserSubject {
  subject: string;
  gradeLevel: string | null;

  constructor(init: { subject: string; gradeLevel?: string | null }) {
    this.subject = init.subject;
    this.gradeLevel = init.gradeLevel ?? null;
  }

  static fromJson(json: Json): UserSubject {
    return new UserSubject({ subject: str(json.subject), gradeLevel: strOrNull(json.grade_level) });
  }
}

/// DepEd-aligned educational background (EDUCATION_BACKGROUND).
export class Education {
  highestAttainment: string | null;
  undergraduateDegree: string | null;
  specialization: string | null;
  postgraduateFocus: string | null;

  constructor(init: Partial<Education> = {}) {
    this.highestAttainment = init.highestAttainment ?? null;
    this.undergraduateDegree = init.undergraduateDegree ?? null;
    this.specialization = init.specialization ?? null;
    this.postgraduateFocus = init.postgraduateFocus ?? null;
  }

  static fromJson(json?: Json | null): Education {
    return new Education({
      highestAttainment: strOrNull(json?.highest_attainment),
      undergraduateDegree: strOrNull(json?.undergraduate_degree),
      specialization: strOrNull(json?.specialization),
      postgraduateFocus: strOrNull(json?.postgraduate_focus),
    });
  }

  toJson(): Json {
    return {
      // Empty string clears a field server-side.
      highest_attainment: this.highestAttainment ?? '',
      undergraduate_degree: this.undergraduateDegree ?? '',
      specialization: this.specialization ?? '',
      postgraduate_focus: this.postgraduateFocus ?? '',
    };
  }

  get isEmpty(): boolean {
    return (
      this.highestAttainment == null &&
      this.undergraduateDegree == null &&
      this.specialization == null &&
      this.postgraduateFocus == null
    );
  }
}

/// A skill held by a person, with its taxonomy category.
export interface SkillInfo {
  name: string;
  category: string | null;
}

const skillInfoFromJson = (json: Json): SkillInfo => ({
  name: str(json.name),
  category: strOrNull(json.category),
});

/// A certification held by a person, with its category and accrediting body.
export class CertificationInfo {
  name: string;
  category: string | null;
  issuer: string | null;
  issuerAcronym: string | null;
  /// verified | submitted (awaiting review).
  credibility: string;
  /// Result of the automated checks on the uploaded file: high | medium | low.
  authenticity: string | null;

  constructor(init: {
    name: string;
    category?: string | null;
    issuer?: string | null;
    issuerAcronym?: string | null;
    credibility?: string;
    authenticity?: string | null;
  }) {
    this.name = init.name;
    this.category = init.category ?? null;
    this.issuer = init.issuer ?? null;
    this.issuerAcronym = init.issuerAcronym ?? null;
    this.credibility = init.credibility ?? 'submitted';
    this.authenticity = init.authenticity ?? null;
  }

  static fromJson(json: Json): CertificationInfo {
    return new CertificationInfo({
      name: str(json.name),
      category: strOrNull(json.category),
      issuer: strOrNull(json.issuer),
      issuerAcronym: strOrNull(json.issuer_acronym),
      credibility: str(json.credibility, 'submitted'),
      authenticity: strOrNull(json.authenticity),
    });
  }

  /// Short issuer label, e.g. "PRC" or "Philippine Red Cross".
  get issuerLabel(): string | null {
    return this.issuerAcronym ?? this.issuer;
  }
}

/// One automated check run on an uploaded certificate.
export interface CertificateCheck {
  key: string;
  label: string;
  status: string; // pass | warn | fail | info
  detail: string;
}

const certificateCheckFromJson = (json: Json): CertificateCheck => ({
  key: str(json.key),
  label: str(json.label),
  status: str(json.status, 'info'),
  detail: str(json.detail),
});

/// An uploaded certificate (PDF/photo), what was read from it and its review
/// state. Self-declared certifications (listed without a file) have no [id].
export class CertificateFile {
  id: number | null = null;
  certificationId: number | null = null;
  title: string | null = null;
  detectedTitle: string | null = null;
  issuer: string | null = null;
  issuerAcronym: string | null = null;
  category: string | null = null;
  description = '';
  originalName: string | null = null;
  mime: string | null = null;
  authenticity: string | null = null; // high | medium | low
  status = 'pending'; // pending | submitted | verified | rejected
  checks: CertificateCheck[] = [];
  reviewNote: string | null = null;
  reviewedByName: string | null = null;

  static fromJson(json: Json): CertificateFile {
    const c = new CertificateFile();
    c.id = intOrNull(json.id);
    c.certificationId = intOrNull(json.certification_id);
    c.title = strOrNull(json.title);
    c.detectedTitle = strOrNull(json.detected_title);
    c.issuer = strOrNull(json.issuer);
    c.issuerAcronym = strOrNull(json.issuer_acronym);
    c.category = strOrNull(json.category);
    c.description = str(json.description);
    c.originalName = strOrNull(json.original_name);
    c.mime = strOrNull(json.mime);
    c.authenticity = strOrNull(json.authenticity);
    c.status = str(json.status, 'pending');
    c.checks = objList(json.checks, certificateCheckFromJson);
    c.reviewNote = strOrNull(json.review_note);
    c.reviewedByName = strOrNull(json.reviewed_by_name);
    return c;
  }

  get issuerLabel(): string | null {
    return this.issuer ?? this.issuerAcronym;
  }
}

/// A person's certificates, and uploads still waiting for the owner to
/// confirm what they are.
export class CertificateSet {
  certificates: CertificateFile[];
  pending: CertificateFile[];

  constructor(certificates: CertificateFile[] = [], pending: CertificateFile[] = []) {
    this.certificates = certificates;
    this.pending = pending;
  }

  static fromJson(json: Json): CertificateSet {
    return new CertificateSet(
      objList(json.certificates, CertificateFile.fromJson),
      objList(json.pending, CertificateFile.fromJson),
    );
  }

  get isEmpty(): boolean {
    return this.certificates.length === 0 && this.pending.length === 0;
  }
}

/// A catalog certification that an upload can be identified as.
export interface CertificationCatalogItem {
  id: number;
  name: string;
  category: string | null;
  issuer: string | null;
  description: string;
}

export const certificationCatalogItemFromJson = (json: Json): CertificationCatalogItem => ({
  id: Math.trunc(json.id as number),
  name: str(json.cert_name),
  category: strOrNull(json.category_name),
  issuer: strOrNull(json.issuer_name ?? json.acronym),
  description: str(json.description),
});

export class User {
  id = 0;
  username = '';
  fullName = '';
  firstName: string | null = null;
  middleName: string | null = null;
  lastName: string | null = null;
  suffix: string | null = null;
  role = 'teacher';
  avatarUrl: string | null = null;
  gradeLevelId: number | null = null;
  gradeLevel: string | null = null;
  email: string | null = null;
  phoneNumber: string | null = null;
  numberOfChildren = 0;
  /// Life-context guardrails for task suggestions (owner-editable).
  hasElderlyOrInfantCare = false;
  overtimeOptIn = false;
  skills: string[] = [];
  certifications: string[] = [];
  skillDetails: SkillInfo[] = [];
  certificationDetails: CertificationInfo[] = [];
  education: Education = new Education();
  /// What this session may do, decided by the backend (login / /api/auth/me).
  /// Empty for users loaded from other endpoints (e.g. personnel lists).
  permissions: Set<string> = new Set();
  /// Roles this session may assign tasks to ("Assign as"), from the backend.
  assignableRoles: string[] = [];
  dateOfAppointment: string | null = null;
  birthdate: string | null = null;
  address: string | null = null;
  isActive = true;
  subjects: UserSubject[] = [];
  coordinatorType: string | null = null;
  alsoTeaching = false;
  deanGradeLevelId: number | null = null;
  deanGradeLevel: string | null = null;
  departmentId: number | null = null;
  department: string | null = null;

  static fromJson(json: Json): User {
    const u = new User();
    try {
      u.subjects = objList(json.subjects, UserSubject.fromJson);
    } catch {}
    u.id = json.id ?? 0;
    u.username = str(json.username);
    u.fullName = str(json.full_name);
    u.firstName = strOrNull(json.first_name);
    u.middleName = strOrNull(json.middle_name);
    u.lastName = strOrNull(json.last_name);
    u.suffix = strOrNull(json.suffix);
    u.role = str(json.role, 'teacher');
    u.avatarUrl = strOrNull(json.avatar_url);
    u.gradeLevelId = intOrNull(json.grade_level_id);
    u.gradeLevel = strOrNull(json.grade_level);
    u.email = strOrNull(json.email);
    u.phoneNumber = strOrNull(json.phone_number);
    u.numberOfChildren = Math.trunc(num(json.number_of_children));
    u.hasElderlyOrInfantCare =
      json.has_elderly_or_infant_care === true || json.has_elderly_or_infant_care === 1;
    u.overtimeOptIn = json.overtime_opt_in === true || json.overtime_opt_in === 1;
    u.skills = stringList(json.skills);
    u.certifications = stringList(json.certifications);
    u.skillDetails = objList(json.skill_details, skillInfoFromJson);
    u.certificationDetails = objList(json.certification_details, CertificationInfo.fromJson);
    u.education = Education.fromJson(json.education as Json | null | undefined);
    u.permissions = new Set(stringList(json.permissions));
    u.assignableRoles = stringList(json.assignable_roles);
    u.dateOfAppointment = strOrNull(json.date_of_appointment);
    u.birthdate = strOrNull(json.birthdate);
    u.address = strOrNull(json.address);
    u.isActive = (json.is_active ?? 1) === 1;
    u.coordinatorType = strOrNull(json.coordinator_type);
    u.alsoTeaching = json.also_teaching === true;
    u.deanGradeLevelId = intOrNull(json.dean_grade_level_id);
    u.deanGradeLevel = strOrNull(json.dean_grade_level);
    u.departmentId = intOrNull(json.department_id);
    u.department = strOrNull(json.department);
    return u;
  }

  get isAdmin(): boolean { return this.role === 'admin'; }
  get isPrincipal(): boolean { return this.role === 'principal'; }
  get isCoordinator(): boolean { return this.role === 'coordinator'; }
  get isDean(): boolean { return this.role === 'dean'; }
  get isTeacher(): boolean { return this.role === 'teacher'; }
  get isRegistrar(): boolean { return this.role === 'registrar'; }

  /// Whether the backend granted this session [permission]. Only meaningful
  /// for the signed-in user; the server enforces every one of these anyway.
  can(permission: string): boolean { return this.permissions.has(permission); }

  get isManager(): boolean { return this.can('create_tasks'); }
  get canReviewSubmissions(): boolean { return this.can('review_submissions'); }
  get canAssign(): boolean { return this.can('assign_tasks'); }

  get initials(): string {
    return this.fullName.length > 0 ? this.fullName[0].toUpperCase() : 'U';
  }

  get roleLabel(): string {
    switch (this.role) {
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
export class AssigneeSuggestion {
  user: User = new User();
  score = 0;
  isMatch = false;
  reasons: string[] = [];
  loadFactors: string[] = [];
  matchedSkills: string[] = [];
  matchedCertifications: string[] = [];
  /// Certifications in a category related to the task (count less than a direct match).
  relatedCertifications: string[] = [];
  openTasks = 0;
  upcomingEvents = 0;
  /// Fit score parts: competency 0-60, workload 0-30, life context 0-10.
  fitCompetency = 0;
  fitWorkload = 0;
  fitLifeContext = 0;
  /// low | moderate | high — how loaded the person already is.
  burden = 'low';
  /// Why the task counts as off-hours (weekend, after school hours, ...).
  offHours: string[] = [];

  static fromJson(json: Json): AssigneeSuggestion {
    const s = new AssigneeSuggestion();
    const fit = (json.fit ?? null) as Json | null;
    s.user = User.fromJson(json);
    s.score = num(json.score);
    s.isMatch = json.is_match === true;
    s.reasons = stringList(json.reasons);
    s.loadFactors = stringList(json.load_factors);
    s.matchedSkills = stringList(json.matched_skills);
    s.matchedCertifications = stringList(json.matched_certifications);
    s.relatedCertifications = stringList(json.related_certifications);
    s.openTasks = Math.trunc(num(json.open_tasks));
    s.upcomingEvents = Math.trunc(num(json.upcoming_events));
    s.fitCompetency = num(fit?.competency);
    s.fitWorkload = num(fit?.workload);
    s.fitLifeContext = num(fit?.life_context);
    s.burden = str(json.burden, 'low');
    s.offHours = stringList(json.off_hours);
    return s;
  }

  get isHighBurden(): boolean { return this.burden === 'high'; }
}

export interface TaskFile {
  id: number | null;
  fileType: string;
  name: string;
  url: string;
}

export const taskFileFromJson = (json: Json): TaskFile => ({
  id: json.id ?? null,
  fileType: str(json.attachment_type ?? json.file_type, 'file'),
  name: str(json.name),
  url: str(json.url),
});

export interface Submission {
  id: number;
  taskId: number;
  userId: number;
  status: string;
  pointsEarned: number;
  submittedAt: string;
  fullName: string | null;
  files: TaskFile[];
}

export const submissionFromJson = (json: Json): Submission => ({
  id: json.id ?? 0,
  taskId: json.task_id ?? 0,
  userId: json.user_id ?? json.personnel_id ?? 0,
  status: str(json.status ?? json.report_status, 'Pending'),
  pointsEarned: json.points_earned ?? 0,
  submittedAt: str(json.submitted_at ?? json.report_date),
  fullName: strOrNull(json.full_name),
  files: objList(json.files, taskFileFromJson),
});

export interface Report {
  id: number;
  taskId: number;
  personnelId: number;
  reportTitle: string;
  reportDescription: string | null;
  reportType: string | null;
  reportLinkUrl: string | null;
  reportFilePath: string | null;
  reportFilename: string | null;
  reportDate: string;
  reportStatus: string;
  fullName: string | null;
  avatarUrl: string | null;
  gradeLevel: string | null;
}

export const reportFromJson = (json: Json): Report => ({
  id: json.id ?? 0,
  taskId: json.task_id ?? 0,
  personnelId: json.personnel_id ?? 0,
  reportTitle: str(json.report_title),
  reportDescription: strOrNull(json.report_description),
  reportType: strOrNull(json.report_type),
  reportLinkUrl: strOrNull(json.report_link_url),
  reportFilePath: strOrNull(json.report_file_path),
  reportFilename: strOrNull(json.report_filename),
  reportDate: str(json.report_date),
  reportStatus: str(json.report_status, 'Pending'),
  fullName: strOrNull(json.full_name),
  avatarUrl: strOrNull(json.avatar_url),
  gradeLevel: strOrNull(json.grade_level),
});

export interface Comment {
  id: number;
  userId: number;
  fullName: string;
  content: string;
  commentType: string;
  createdAt: string;
  reportId: number | null;
}

export const commentFromJson = (json: Json): Comment => ({
  id: json.id ?? 0,
  userId: json.user_id ?? 0,
  fullName: str(json.full_name),
  content: str(json.content),
  commentType: str(json.comment_type, 'public'),
  createdAt: str(json.created_at),
  reportId: intOrNull(json.report_id),
});

/// `DateTime.tryParse` for the date strings the API sends (ISO dates and
/// timestamps). Date-only values are read as local midnight, matching how the backend stores them.
export function tryParseDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const v = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac, zone] = m;
  const ms = frac ? Math.round(Number(`0.${frac}`) * 1000) : 0;
  if (zone) {
    const date = new Date(`${y}-${mo}-${d}T${h ?? '00'}:${mi ?? '00'}:${s ?? '00'}.${String(ms).padStart(3, '0')}${zone === 'Z' ? 'Z' : zone.replace(/^([+-]\d{2}):?(\d{2})$/, '$1:$2')}`);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0), ms);
  return isNaN(date.getTime()) ? null : date;
}

export class Task {
  id = 0;
  title = '';
  subject: string | null = null;
  startDate: string | null = null;
  endDate: string | null = null;
  dueTime: string | null = null;
  instructions: string | null = null;
  status = 'active';
  taskCategory = 'common'; // 'common' | 'special'
  submissionCount = 0;
  assignedUsers: User[] = [];
  publicComments: Comment[] = [];
  privateComments: Comment[] = [];
  myReport: Report | null = null;
  pointsEarly = 100;
  pointsOntime = 100;
  pointsLate24 = 50;
  pointsAfter24 = 0;
  submissionStatus: string | null = null;
  teamTotal: number | null = null;
  teamSubmitted: number | null = null;
  reports: Report[] = [];
  /// Assignees who have submitted (task log or report), for reviewers.
  submittedAssigneeIds: Set<number> = new Set();
  /// Server-decided: may the current user edit/disable/delete this task.
  canEdit = false;
  /// Who assigned each assignee (user id → assigner id).
  assignedByOf: Map<number, number | null> = new Map();
  /// Whose progress teamTotal/teamSubmitted cover: 'all' assignees (task
  /// creator, principal/admin) or 'mine' (people the viewer assigned).
  teamScope: string | null = null;

  static fromJson(json: Json): Task {
    const t = new Task();
    try {
      const raw = (json.assigned_users ?? []) as Json[];
      const users = raw.map(User.fromJson);
      const submittedIds = new Set<number>();
      const assignedBy = new Map<number, number | null>();
      for (const u of raw) {
        if (u.submitted === true || u.submitted === 1) submittedIds.add(u.id as number);
        assignedBy.set(u.id as number, intOrNull(u.assigned_by));
      }
      t.assignedUsers = users;
      t.submittedAssigneeIds = submittedIds;
      t.assignedByOf = assignedBy;
    } catch {}

    try { t.publicComments = objList(json.public_comments, commentFromJson); } catch {}
    try { t.privateComments = objList(json.private_comments, commentFromJson); } catch {}
    try {
      if (json.my_report != null) t.myReport = reportFromJson(json.my_report as Json);
    } catch {}
    try { t.reports = objList(json.reports, reportFromJson); } catch {}

    t.id = json.id ?? 0;
    t.title = str(json.title);
    t.subject = strOrNull(json.subject);
    t.startDate = strOrNull(json.start_date);
    t.endDate = strOrNull(json.end_date);
    t.dueTime = strOrNull(json.due_time);
    t.instructions = strOrNull(json.instructions);
    t.status = str(json.status, 'active');
    t.taskCategory = str(json.task_category, 'common');
    t.submissionCount = json.submission_count ?? 0;
    t.pointsEarly = json.points_early ?? 100;
    t.pointsOntime = json.points_ontime ?? 100;
    t.pointsLate24 = json.points_late24 ?? 50;
    t.pointsAfter24 = json.points_after24 ?? 0;
    t.submissionStatus = strOrNull(json.submission_status);
    t.teamTotal = intOrNull(json.team_total ?? json.teacher_total);
    t.teamSubmitted = intOrNull(json.team_submitted ?? json.teacher_submitted);
    t.canEdit = json.can_edit === true;
    t.teamScope = strOrNull(json.team_scope);
    return t;
  }

  get isSubmitted(): boolean {
    return this.submissionStatus === 'submitted' || this.myReport != null;
  }

  /// When the task is due: [endDate] at [dueTime] ('5:00 PM'), or the end of
  /// [endDate] when no time is set. Mirrors task_deadline in the backend
  /// (date_utils.py) so the dashboard and My Tasks agree on "overdue".
  get deadline(): Date | null {
    const end = this.endDate;
    if (end == null || end.length === 0) return null;
    const d = tryParseDate(end.length >= 10 ? end.substring(0, 10) : end);
    if (d == null) return null;
    const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec((this.dueTime ?? '').trim());
    if (m == null) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, parseInt(m[2], 10));
  }

  /// Unsubmitted and past its deadline.
  get isOverdue(): boolean {
    const dl = this.deadline;
    return !this.isSubmitted && dl != null && dl.getTime() < Date.now();
  }
}

export interface TaskTemplate {
  id: number;
  title: string;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  dueTime: string | null;
  pointsEarly: number;
  pointsOntime: number;
  pointsLate24: number;
  pointsAfter24: number;
  createdByName: string | null;
}

export const taskTemplateFromJson = (json: Json): TaskTemplate => ({
  id: json.id as number,
  title: str(json.title),
  instructions: strOrNull(json.instructions),
  startDate: strOrNull(json.start_date),
  endDate: strOrNull(json.end_date),
  dueTime: strOrNull(json.due_time),
  pointsEarly: json.points_early ?? 100,
  pointsOntime: json.points_ontime ?? 100,
  pointsLate24: json.points_late24 ?? 50,
  pointsAfter24: json.points_after24 ?? 0,
  createdByName: strOrNull(json.created_by_name),
});

export interface DashboardData {
  pending: number;
  submitted: number;
  missing: number;
  totalTasks: number;
  taskManagerTasks: Task[];
  myTasks: Task[];
  events: Json[];
  eventsTotal: number;
  deadlineDates: Date[]; // days with open task deadlines
}

export function dashboardDataFromJson(json: Json): DashboardData {
  let tmTasks: Task[] = [];
  try { tmTasks = objList(json.task_manager_tasks, Task.fromJson); } catch {}

  let myTasks: Task[] = [];
  try { myTasks = objList(json.my_tasks, Task.fromJson); } catch {}

  const deadlineDates: Date[] = [];
  for (const d of (json.deadline_dates ?? []) as unknown[]) {
    const parsed = tryParseDate(String(d));
    if (parsed != null) deadlineDates.push(parsed);
  }

  return {
    pending: json.pending ?? 0,
    submitted: json.submitted ?? 0,
    missing: json.missing ?? 0,
    totalTasks: json.total_tasks ?? 0,
    taskManagerTasks: tmTasks,
    myTasks,
    events: [...((json.events ?? []) as Json[])],
    eventsTotal: json.events_total ?? 0,
    deadlineDates,
  };
}

// ── Appraisal Models ──────────────────────────────────────────────────────────

export interface SpecialTaskEvaluation {
  completionScore: number;
  timelinessScore: number;
  initiativeScore: number;
  coordinationScore: number;
  weightedAverage: number | null;
  remarks: string | null;
}

const specialTaskEvaluationFromJson = (json: Json): SpecialTaskEvaluation => ({
  completionScore: json.completion_quality_score ?? 0,
  timelinessScore: json.timeliness_score ?? 0,
  initiativeScore: json.initiative_score ?? 0,
  coordinationScore: json.coordination_score ?? 0,
  weightedAverage: typeof json.weighted_average === 'number' ? json.weighted_average : null,
  remarks: strOrNull(json.remarks),
});

export class SpecialTask {
  id = 0;
  title = '';
  description: string | null = null;
  assigneeId: number | null = null;
  assigneeName: string | null = null;
  assigneeRole: string | null = null;
  assigneeDepartment: string | null = null;
  assignerName: string | null = null;
  dueDate: string | null = null;
  submittedDate: string | null = null;
  status = 'pending';
  evaluation: SpecialTaskEvaluation | null = null;

  static fromJson(json: Json): SpecialTask {
    const t = new SpecialTask();
    const assignee = (json.assignee ?? null) as Json | null;
    const assigner = (json.assigner ?? null) as Json | null;
    const evalJson = (json.evaluation ?? null) as Json | null;
    t.id = json.id ?? 0;
    t.title = str(json.title);
    t.description = strOrNull(json.description);
    t.assigneeId = intOrNull(assignee?.id);
    t.assigneeName = strOrNull(assignee?.full_name);
    t.assigneeRole = strOrNull(assignee?.role);
    t.assigneeDepartment = strOrNull(assignee?.grade_level);
    t.assignerName = strOrNull(assigner?.full_name);
    t.dueDate = strOrNull(json.due_date);
    t.submittedDate = strOrNull(json.created_at);
    t.status = str(json.status, 'pending');
    t.evaluation = evalJson != null ? specialTaskEvaluationFromJson(evalJson) : null;
    return t;
  }

  get scoreOutOf100(): number {
    const ev = this.evaluation;
    if (ev == null || ev.weightedAverage == null) return 0;
    return Math.round(ev.weightedAverage * 20);
  }
}

export class EventEvaluation {
  id = 0;
  evaluatorName = '';
  evaluatorRole: string | null = null;
  planningScore = 0;
  objectivesScore = 0;
  personnelScore = 0;
  timeMgmtScore = 0;
  engagementScore = 0;
  resourceScore = 0;
  feedbackComments: string | null = null;
  dateSubmitted: string | null = null;

  static fromJson(json: Json): EventEvaluation {
    const e = new EventEvaluation();
    e.id = json.id ?? 0;
    e.evaluatorName = str(json.evaluator_name);
    e.evaluatorRole = strOrNull(json.evaluator_role);
    e.planningScore = json.planning_score ?? 0;
    e.objectivesScore = json.objectives_score ?? 0;
    e.personnelScore = json.personnel_score ?? 0;
    e.timeMgmtScore = json.time_mgmt_score ?? 0;
    e.engagementScore = json.engagement_score ?? 0;
    e.resourceScore = json.resource_score ?? 0;
    e.feedbackComments = strOrNull(json.feedback_comments);
    e.dateSubmitted = strOrNull(json.date_submitted);
    return e;
  }

  get average(): number {
    return (
      (this.planningScore + this.objectivesScore + this.personnelScore +
        this.timeMgmtScore + this.engagementScore + this.resourceScore) / 6.0
    );
  }
}

export class EventForAppraisal {
  id = 0;
  title = '';
  description: string | null = null;
  targetDate: string | null = null;
  venue: string | null = null;
  status = 'pending_approval';
  organizerName: string | null = null;
  department: string | null = null;
  expectedAttendees: number | null = null;
  evaluations: EventEvaluation[] = [];
  /// Evaluator breakdown: {total, by_role, by_sex, by_age_group} (counts).
  demographics: Json = {};

  static fromJson(json: Json): EventForAppraisal {
    const e = new EventForAppraisal();
    const organizer = (json.organizer ?? null) as Json | null;
    e.id = json.id ?? 0;
    e.title = str(json.title);
    e.description = strOrNull(json.description);
    e.targetDate = strOrNull(json.target_date);
    e.venue = strOrNull(json.venue);
    e.status = str(json.status, 'pending_approval');
    e.organizerName = strOrNull(organizer?.full_name);
    e.department = strOrNull(json.department);
    e.expectedAttendees = intOrNull(json.expected_attendees);
    e.evaluations = objList(json.evaluations, EventEvaluation.fromJson);
    e.demographics = { ...((json.demographics ?? {}) as Json) };
    return e;
  }

  get avgRating(): number {
    if (this.evaluations.length === 0) return 0;
    return this.evaluations.map((e) => e.average).reduce((a, b) => a + b) / this.evaluations.length;
  }

  // Evidency Rate: 0-5 average mapped to 0-100% for display, matching Lok's UI.
  get evidencyRate(): number {
    return (this.avgRating / 5.0) * 100.0;
  }

  get shortDate(): string {
    return this.targetDate?.split('T')[0] ?? '—';
  }
}

// ── School calendar ───────────────────────────────────────────────────────────

/// A term (e.g. "1st Quarter") inside a school year.
export interface SchoolTerm {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string; // current | upcoming | archived
}

const schoolTermFromJson = (j: Json): SchoolTerm => ({
  id: j.id ?? 0,
  name: str(j.name),
  startDate: str(j.start_date),
  endDate: str(j.end_date),
  status: str(j.status, 'upcoming'),
});

/// A school year set by the principal; records dated in years that have ended
/// are archived.
export interface SchoolYear {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string; // current | upcoming | archived
  isDefault: boolean; // what "current" resolves to
  terms: SchoolTerm[];
}

export const schoolYearFromJson = (j: Json): SchoolYear => ({
  id: j.id ?? 0,
  name: str(j.name),
  startDate: str(j.start_date),
  endDate: str(j.end_date),
  status: str(j.status, 'upcoming'),
  isDefault: j.is_selected_default === true,
  terms: objList(j.terms, schoolTermFromJson),
});

/// Which school year (and optionally term) a list is showing.
export interface SchoolYearFilter {
  schoolYear: string; // 'current' | 'all' | '<id>'
  termId: number | null;
}

export const currentSchoolYear: SchoolYearFilter = { schoolYear: 'current', termId: null };

export function schoolYearFilterQuery(f: SchoolYearFilter): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.schoolYear !== 'current') q.school_year = f.schoolYear;
  if (f.termId != null) q.term_id = `${f.termId}`;
  return q;
}

export const sameSchoolYearFilter = (a: SchoolYearFilter, b: SchoolYearFilter): boolean =>
  a.schoolYear === b.schoolYear && a.termId === b.termId;

// ── Appraisal badges ──────────────────────────────────────────────────────────

export interface AppraisalBadge {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: string | null; // bronze | silver | gold
  earned: boolean;
  progress: number;
  target: number;
}

export const appraisalBadgeFromJson = (j: Json): AppraisalBadge => ({
  code: str(j.code),
  name: str(j.name),
  description: str(j.description),
  icon: str(j.icon),
  tier: strOrNull(j.tier),
  earned: j.earned === true,
  progress: Math.trunc(num(j.progress)),
  target: Math.trunc(num(j.target, 1)),
});
