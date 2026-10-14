// Shapes of the TaskNet API's JSON (snake_case, exactly as the backend sends
// them). Optional fields are ones some endpoints leave out.

export type Role = 'admin' | 'principal' | 'coordinator' | 'dean' | 'teacher' | 'registrar';

export const ROLES: Role[] = ['admin', 'principal', 'coordinator', 'dean', 'teacher', 'registrar'];

/** Server-decided capabilities of a session (see backend auth.py). */
export type Permission =
  | 'create_tasks' | 'assign_tasks' | 'review_submissions' | 'receive_tasks'
  | 'manage_personnel' | 'view_personnel' | 'deactivate_personnel'
  | 'review_certificates' | 'view_audit' | 'manage_events' | 'approve_events'
  | 'manage_school_years' | 'manage_templates' | 'view_appraisal'
  | 'evaluate_appraisal' | 'view_all_appraisals' | 'view_all_tasks' | 'moderate';

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  has_more: boolean;
}

// ── People ────────────────────────────────────────────────────────────────────

export interface UserSubject {
  subject: string;
  grade_level?: string | null;
  grade_level_id?: number | null;
}

export interface Education {
  highest_attainment?: string | null;
  undergraduate_degree?: string | null;
  specialization?: string | null;
  postgraduate_focus?: string | null;
}

export interface SkillInfo {
  name: string;
  category?: string | null;
}

export interface CertificationInfo {
  name: string;
  category?: string | null;
  issuer?: string | null;
  issuer_acronym?: string | null;
  /** verified | submitted (awaiting review) */
  credibility?: string;
  /** high | medium | low — automated checks on the uploaded file */
  authenticity?: string | null;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  role: Role;
  avatar_url?: string | null;
  grade_level_id?: number | null;
  grade_level?: string | null;
  email?: string | null;
  phone_number?: string | null;
  number_of_children?: number;
  has_elderly_or_infant_care?: boolean | number;
  overtime_opt_in?: boolean | number;
  skills?: string[];
  certifications?: string[];
  skill_details?: SkillInfo[];
  certification_details?: CertificationInfo[];
  education?: Education | null;
  date_of_appointment?: string | null;
  birthdate?: string | null;
  address?: string | null;
  is_active?: number | boolean;
  subjects?: UserSubject[];
  coordinator_type?: string | null;
  also_teaching?: boolean;
  dean_grade_level_id?: number | null;
  dean_grade_level?: string | null;
  department_id?: number | null;
  department?: string | null;
  created_at?: string | null;
  // Present on assigned_users rows of a task.
  submitted?: boolean | number;
  assigned_by?: number | null;
  target_role?: string | null;
}

/** The signed-in user (login / GET /api/auth/me). */
export interface SessionUser extends User {
  available_roles: Role[];
  permissions: Permission[];
  assignable_roles: Role[];
}

export type LoginResult =
  | { token: string; user: SessionUser }
  | { needs_role_selection: true; available_roles: Role[]; full_name: string };

export interface AssigneeSuggestion extends User {
  score: number;
  is_match: boolean;
  reasons: string[];
  load_factors: string[];
  matched_skills: string[];
  matched_certifications: string[];
  related_certifications: string[];
  open_tasks: number;
  upcoming_events: number;
  /** competency 0-60, workload 0-30, life_context 0-10 */
  fit?: { competency: number; workload: number; life_context: number };
  /** low | moderate | high */
  burden: string;
  off_hours: string[];
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskCategory = 'common' | 'special';
export type ReportStatus = 'Completed' | 'Pending' | 'Missing';

export interface Report {
  id: number;
  task_id: number;
  personnel_id: number;
  report_title: string;
  report_description?: string | null;
  report_type?: string | null;
  report_link_url?: string | null;
  report_file_path?: string | null;
  report_filename?: string | null;
  report_date: string;
  report_status: ReportStatus;
  full_name?: string | null;
  avatar_url?: string | null;
  grade_level?: string | null;
  task_title?: string | null;
}

export interface Comment {
  id: number;
  user_id: number;
  full_name: string;
  content: string;
  comment_type: 'public' | 'private';
  created_at: string;
  report_id?: number | null;
  role?: string | null;
}

export interface Attachment {
  id?: number;
  attachment_type: 'file' | 'link' | 'gdrive' | 'youtube';
  name: string;
  url: string;
}

export interface Task {
  id: number;
  title: string;
  subject?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  due_time?: string | null;
  instructions?: string | null;
  status: 'active' | 'disabled';
  task_category: TaskCategory;
  task_type_id?: number | null;
  task_type?: string | null;
  submission_count?: number;
  assigned_users?: User[];
  public_comments?: Comment[];
  private_comments?: Comment[];
  my_report?: Report | null;
  points_early?: number;
  points_ontime?: number;
  points_late24?: number;
  points_after24?: number;
  submission_status?: string | null;
  team_total?: number | null;
  team_submitted?: number | null;
  reports?: Report[];
  attachments?: Attachment[];
  can_edit?: boolean;
  /** 'all' assignees or 'mine' (people the viewer assigned) */
  team_scope?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at?: string | null;
  source_event_id?: number | null;
  source_deped_id?: number | null;
}

export interface TaskInput {
  title: string;
  subject?: string | null;
  task_category?: TaskCategory;
  task_type_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  due_time?: string | null;
  instructions?: string | null;
  points_early?: number;
  points_ontime?: number;
  points_late24?: number;
  points_after24?: number;
  assigned_user_ids?: number[];
  target_role?: string | null;
  attachments?: Attachment[];
  status?: 'active' | 'disabled';
}

export interface TaskTemplate {
  id: number;
  title: string;
  instructions?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  due_time?: string | null;
  points_early: number;
  points_ontime: number;
  points_late24: number;
  points_after24: number;
  created_by_name?: string | null;
}

export interface DashboardData {
  pending: number;
  submitted: number;
  missing: number;
  total_tasks: number;
  task_manager_tasks: Task[];
  my_tasks: Task[];
  events: EventRecord[];
  events_total: number;
  /** YYYY-MM-DD days with open task deadlines */
  deadline_dates: string[];
}

// ── Events ────────────────────────────────────────────────────────────────────

export type EventStatus = 'pending_approval' | 'approved' | 'disabled' | 'draft';

/** One Activity Matrix row (events.activity_matrix is a JSON array of these). */
export interface ActivityRow {
  day?: string;
  time?: string;
  event?: string;
  speaker?: string;
  special_task_title?: string | null;
  [extra: string]: unknown;
}

/**
 * An event proposal. Structured sections (participants, objectives, matrix,
 * committees …) are stored as JSON-encoded strings; see utils/eventFormat.
 */
export interface EventRecord {
  id: number;
  title: string;
  nature?: string | null;
  target_date?: string | null;
  venue?: string | null;
  proposed_budget?: string | null;
  fund_source?: string | null;
  focal_name?: string | null;
  focal_role?: string | null;
  focal_contact?: string | null;
  expected_outputs?: string | null;
  participants?: string | null;
  rationale?: string | null;
  objectives?: string | null;
  phase1?: string | null;
  phase2?: string | null;
  phase3?: string | null;
  activity_matrix?: string | null;
  training_materials?: string | null;
  snacks?: string | null;
  exec_committee?: string | null;
  twg_groups?: string | null;
  monitoring_criteria?: string | null;
  indicators?: string | null;
  comments?: string | null;
  status: EventStatus;
  created_by?: number | null;
  created_at?: string | null;
  creator_name?: string | null;
  creator_role?: string | null;
  department?: string | null;
  expected_attendees?: number | null;
}

export type EventInput = Partial<Omit<EventRecord, 'id' | 'created_by' | 'created_at' |
  'creator_name' | 'creator_role'>> & { title: string };

export interface DateCheck {
  date: string | null;
  available: boolean;
  past: boolean;
  message: string | null;
  conflicts: { id: number; title: string; target_date: string; venue?: string; status: string }[];
  deped_conflicts: DepedEntry[];
  deped_warning: string | null;
}

export interface DepedEntry {
  id: number;
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  category: DepedCategory;
  is_mandatory: boolean;
}

export const DEPED_CATEGORIES = [
  'Mandatory Examination', 'Quarter Compliance', 'Holiday', 'Administrative Period',
] as const;
export type DepedCategory = (typeof DEPED_CATEGORIES)[number];

export interface AttendanceWindow { opens: string; closes: string; label: string }

export interface AttendanceRecord {
  time_in_at?: string | null;
  time_out_at?: string | null;
  evaluated_at?: string | null;
  special_task_id?: number | null;
}

/** GET /api/events/{id}/attendance/activities/{index} */
export interface AttendanceActivity {
  event_id: number;
  event_title: string;
  venue?: string | null;
  activity_index: number;
  activity: { day?: string; time?: string; event?: string; speaker?: string };
  has_special_task: boolean;
  special_task_title?: string | null;
  /** null when the row's day/time can't be read */
  windows: { time_in: AttendanceWindow; time_out: AttendanceWindow } | null;
  record: AttendanceRecord | null;
}

export interface AttendanceScanResult {
  success: boolean;
  action: 'time_in' | 'time_out';
  timestamp: string;
  message: string;
  redirect_to_evaluation: boolean;
  record: AttendanceRecord | null;
}

/** GET /api/events/{id}/attendance/qr-codes */
export interface AttendanceQrCodes {
  event_id: number;
  title: string;
  venue?: string | null;
  activities: {
    index: number; day?: string; time?: string; event?: string; speaker?: string;
    special_task_title?: string | null; schedule_readable: boolean;
    time_in_code: string; time_out_code: string;
  }[];
}

/** GET /api/appraisal/public/events/{id} (QR evaluation, no login) */
export interface PublicEvent {
  id: number;
  title: string;
  venue?: string | null;
  target_date?: string | null;
  organizer_name?: string | null;
  monitoring_criteria?: string | null;
  /** the proposal's observation indicators */
  indicators: string[];
  demographic_options?: { evaluator_role?: string[]; sex?: string[]; age_group?: string[] };
  is_open: boolean;
  lock_reason?: string | null;
}

// ── Appraisal ─────────────────────────────────────────────────────────────────

export interface SpecialTaskEvaluation {
  completion_quality_score: number;
  timeliness_score: number;
  initiative_score: number;
  coordination_score: number;
  weighted_average?: number | null;
  remarks?: string | null;
}

export interface SpecialTask {
  id: number;
  title: string;
  description?: string | null;
  assignee?: { id: number; full_name: string; role?: string; grade_level?: string | null } | null;
  assigner?: { id: number; full_name: string } | null;
  due_date?: string | null;
  created_at?: string | null;
  status: string;
  evaluation?: SpecialTaskEvaluation | null;
}

export interface EventEvaluation {
  id: number;
  evaluator_name: string;
  evaluator_role?: string | null;
  planning_score: number;
  objectives_score: number;
  personnel_score: number;
  time_mgmt_score: number;
  engagement_score: number;
  resource_score: number;
  feedback_comments?: string | null;
  date_submitted?: string | null;
}

export interface EventForAppraisal {
  id: number;
  title: string;
  description?: string | null;
  target_date?: string | null;
  venue?: string | null;
  status: string;
  organizer?: { id?: number; full_name?: string } | null;
  department?: string | null;
  expected_attendees?: number | null;
  evaluations: EventEvaluation[];
  /** {total, by_role, by_sex, by_age_group} */
  demographics?: Record<string, unknown>;
}

/** GET /api/appraisal/report-submissions (timing points, computed server-side) */
export interface ReportSubmission {
  id: number;
  report_id: number;
  task_id: number;
  task_name: string;
  personnel_name: string;
  personnel_department?: string | null;
  deadline?: string | null;
  submitted_at?: string | null;
  timing_status: string;
  timing_points: number;
  content_quality_score?: number | null;
  format_compliance_score?: number | null;
  completeness_score?: number | null;
}

export interface AppraisalBadge {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier?: 'bronze' | 'silver' | 'gold' | null;
  earned: boolean;
  progress: number;
  target: number;
}

export interface LeaderboardEntry {
  id: number;
  full_name: string;
  role: string;
  grade_level?: string | null;
  earned_count: number;
  badges: AppraisalBadge[];
}

// ── School calendar ───────────────────────────────────────────────────────────

export type PeriodStatus = 'current' | 'upcoming' | 'archived';

export interface SchoolTerm {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
}

export interface SchoolYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  /** What "current" resolves to. */
  is_selected_default?: boolean;
  terms: SchoolTerm[];
}

/** Which school year (and optionally term) a list shows. */
export interface SchoolYearFilter {
  /** 'current' | 'all' | '<id>' */
  schoolYear: string;
  termId?: number | null;
}

export const CURRENT_YEAR: SchoolYearFilter = { schoolYear: 'current' };

// ── Certificates ──────────────────────────────────────────────────────────────

export interface CertificateCheck {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
}

export interface CertificateFile {
  id?: number | null;
  certification_id?: number | null;
  title?: string | null;
  detected_title?: string | null;
  issuer?: string | null;
  issuer_acronym?: string | null;
  category?: string | null;
  description?: string;
  original_name?: string | null;
  mime?: string | null;
  authenticity?: 'high' | 'medium' | 'low' | null;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  checks: CertificateCheck[];
  review_note?: string | null;
  reviewed_by_name?: string | null;
  certificate_no?: string | null;
  date_issued?: string | null;
  expiry_date?: string | null;
}

export interface CertificateSet {
  certificates: CertificateFile[];
  pending: CertificateFile[];
}

export interface CertificationCatalogItem {
  id: number;
  cert_name: string;
  category_name?: string | null;
  issuer_name?: string | null;
  acronym?: string | null;
  description?: string;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: number;
  user_id: number;
  type: 'task' | 'event' | 'comment' | 'general';
  title: string;
  body?: string | null;
  ref_id?: number | null;
  is_read: number;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  /** UTC, "YYYY-MM-DDTHH:MM:SSZ" */
  created_at: string;
  actor_name?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_label?: string | null;
  summary: string;
  /** field → [before, after] */
  changes: Record<string, [unknown, unknown]>;
  ip_address?: string | null;
}

export interface GradeLevel { id: number; grade_level: string }
export interface Department { id: number; department_name: string }
export interface SubjectMeta { id: number; subject_name: string }
export interface SkillMeta { id: number; skill_name: string; category_name?: string | null }
export interface CertificationMeta {
  id: number; cert_name: string; category_name?: string | null;
  issuer_name?: string | null; acronym?: string | null;
}
export type EducationOptions = Record<string, string[]>;
