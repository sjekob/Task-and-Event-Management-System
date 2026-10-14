import { clearToken, http, request, resolveUrl, saveToken } from './client';
import type {
  AppNotification, AppraisalBadge, AssigneeSuggestion, AuditEntry, AttendanceActivity, AttendanceQrCodes,
  AttendanceScanResult,
  CertificateFile, CertificateSet, CertificationCatalogItem, CertificationMeta, Comment,
  DashboardData, DateCheck, DepedEntry, Department, EducationOptions, EventForAppraisal,
  EventInput, EventRecord, GradeLevel, LeaderboardEntry, LoginResult, Page, Report,
  ReportStatus, Role, SchoolYear, SchoolYearFilter, SessionUser, SkillMeta, SpecialTask,
  SubjectMeta, Task, TaskCategory, TaskInput, TaskTemplate, User,
} from '../types';

/** A file to upload: a browser Blob/File, or a React Native {uri, name, type}. */
export type UploadFile = Blob | { uri: string; name: string; type: string };

function fileForm(file: UploadFile, filename: string): FormData {
  const form = new FormData();
  if (typeof Blob !== 'undefined' && file instanceof Blob) form.append('file', file, filename);
  else form.append('file', file as unknown as Blob); // React Native file object
  return form;
}

const yearQuery = (f?: SchoolYearFilter) => ({
  school_year: f && f.schoolYear !== 'current' ? f.schoolYear : undefined,
  term_id: f?.termId ?? undefined,
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  async login(username: string, password: string, role?: Role): Promise<LoginResult> {
    const data = await http.post<LoginResult>(
      '/api/auth/login', { username, password, ...(role ? { role } : {}) },
      { anonymous: true, fallback: 'Invalid username or password', timeoutMs: 10_000 });
    if ('token' in data) await saveToken(data.token);
    return data;
  },
  me: () => http.get<SessionUser>('/api/auth/me', { timeoutMs: 10_000 }),
  logout: clearToken,
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export interface TaskPageQuery {
  search?: string;
  /** 'mine' (default) or 'all' */
  scope?: string;
  category?: TaskCategory;
  /** tasks assigned to me (My Tasks) instead of tasks I manage */
  assigned?: boolean;
  limit?: number;
  offset?: number;
  filter?: SchoolYearFilter;
}

export const tasks = {
  page: (q: TaskPageQuery = {}) => http.get<Page<Task>>('/api/tasks', {
    query: {
      assigned: q.assigned ? 1 : undefined,
      search: q.search, scope: q.scope && q.scope !== 'mine' ? q.scope : undefined,
      category: q.category, limit: q.limit ?? 30, offset: q.offset ?? 0, ...yearQuery(q.filter),
    },
  }),
  list: (q: { search?: string; scope?: string; filter?: SchoolYearFilter } = {}) =>
    http.get<Task[]>('/api/tasks', {
      query: { search: q.search, scope: q.scope && q.scope !== 'mine' ? q.scope : undefined, ...yearQuery(q.filter) },
    }),
  get: (id: number) => http.get<Task>(`/api/tasks/${id}`, { fallback: 'Task not found' }),
  create: (body: TaskInput) => http.post<{ id: number }>('/api/tasks', body, { fallback: 'Failed to create task' }),
  update: (id: number, body: Partial<TaskInput>) =>
    http.put(`/api/tasks/${id}`, body, { fallback: 'Failed to update task' }),
  remove: (id: number) => http.delete(`/api/tasks/${id}`, { fallback: 'Failed to delete task' }),

  /** Returns the ids that were skipped (hierarchy rules / already assigned). */
  async assign(id: number, userIds: number[], targetRole?: string | null) {
    const res = await http.post<{ added?: number[]; skipped?: number[] }>(
      `/api/tasks/${id}/assign`,
      { user_ids: userIds, ...(targetRole ? { target_role: targetRole } : {}) },
      { fallback: 'Failed to assign users' });
    return res?.skipped ?? [];
  },
  unassign: (id: number, userId: number) =>
    http.delete(`/api/tasks/${id}/assign/${userId}`, { fallback: 'Failed to unassign user' }),

  submitReport: (taskId: number, body: {
    report_title: string; report_description?: string; report_type?: string; report_link_url?: string;
  }) => http.post<{ report_id: number; receiver_id: number | null }>(`/api/tasks/${taskId}/reports`, body,
    { fallback: 'Failed to submit report' }),
  uploadReportFile: (taskId: number, file: UploadFile, filename: string) =>
    http.upload(`/api/tasks/${taskId}/reports/upload`, fileForm(file, filename), { fallback: 'File upload failed' }),

  addComment: (taskId: number, content: string, type: 'public' | 'private', reportId?: number) =>
    http.post<Comment>(`/api/tasks/${taskId}/comments`,
      { content, comment_type: type, ...(reportId ? { report_id: reportId } : {}) },
      { fallback: 'Failed to add comment' }),
  editComment: (commentId: number, content: string) =>
    http.put(`/api/comments/${commentId}`, { content }, { fallback: 'Failed to edit comment' }),
  deleteComment: (commentId: number) =>
    http.delete(`/api/comments/${commentId}`, { fallback: 'Failed to delete comment' }),

  /** Uploads a task attachment; returns its absolute URL and display name. */
  async uploadAttachment(file: UploadFile, filename: string) {
    const res = await http.upload<{ url: string; name?: string }>(
      '/api/upload', fileForm(file, filename), { fallback: 'File upload failed' });
    return { url: resolveUrl(res.url), name: res.name ?? filename };
  },

  taskTypes: () => http.get<{ id: number; task_type: string }[]>('/api/task-types'),
};

export const reports = {
  list: (q: { taskId?: number; status?: ReportStatus } = {}) =>
    http.get<Report[]>('/api/reports', { query: { task_id: q.taskId, status: q.status } }),
  setStatus: (reportId: number, status: ReportStatus) =>
    http.put(`/api/reports/${reportId}/status`, { report_status: status }, { fallback: 'Failed to update report status' }),
  /** Unsubmit */
  remove: (reportId: number) => http.delete(`/api/reports/${reportId}`, { fallback: 'Failed to unsubmit report' }),
  taskLog: (taskId?: number) => http.get<Record<string, unknown>[]>('/api/task-log', { query: { task_id: taskId } }),
  submissionLog: () => http.get<Record<string, unknown>[]>('/api/submission-log'),
};

export const templates = {
  list: () => http.get<TaskTemplate[]>('/api/templates'),
  create: (body: Omit<TaskTemplate, 'id' | 'created_by_name'>) =>
    http.post('/api/templates', body, { fallback: 'Failed to create template' }),
  remove: (id: number) => http.delete(`/api/templates/${id}`),
};

// ── People ────────────────────────────────────────────────────────────────────

export interface SuggestionQuery {
  targetRole?: string | null;
  title?: string;
  subject?: string;
  instructions?: string;
  taskCategory?: TaskCategory;
  startDate?: string | null;
  endDate?: string | null;
  dueTime?: string | null;
}

export const users = {
  list: () => http.get<User[]>('/api/users'),
  assignable: (targetRole?: string | null) =>
    http.get<User[]>('/api/users/assignable', { query: { target_role: targetRole } }),
  /** Assignable personnel ranked for a task (best match first). */
  suggestions: (q: SuggestionQuery) => http.post<AssigneeSuggestion[]>('/api/users/assignable/suggestions', {
    target_role: q.targetRole ?? '', title: q.title ?? '', subject: q.subject ?? '',
    instructions: q.instructions ?? '', task_category: q.taskCategory ?? 'common',
    ...(q.startDate ? { start_date: q.startDate } : {}),
    ...(q.endDate ? { end_date: q.endDate } : {}),
    ...(q.dueTime ? { due_time: q.dueTime } : {}),
  }),
  myProfile: () => http.get<User>('/api/users/me/profile'),
  updateMyProfile: (body: Record<string, unknown>) =>
    http.put<User>('/api/users/me/profile', body, { fallback: 'Failed to update profile' }),
  gradeLevels: () => http.get<GradeLevel[]>('/api/grade-levels'),
  subjects: () => http.get<string[]>('/api/subjects'),
};

export const personnel = {
  list: (search = '') => http.get<User[]>('/api/personnel', { query: { search } }),
  page: (q: { search?: string; limit?: number; offset?: number } = {}) =>
    http.get<Page<User>>('/api/personnel', { query: { search: q.search ?? '', limit: q.limit ?? 30, offset: q.offset ?? 0 } }),
  get: (id: number) => http.get<User>(`/api/personnel/${id}`, { fallback: 'User not found' }),
  create: (body: Record<string, unknown>) => http.post<User>('/api/personnel', body, { fallback: 'Failed to create' }),
  update: (id: number, body: Record<string, unknown>) =>
    http.put<User>(`/api/personnel/${id}`, body, { fallback: 'Failed to update' }),
  updateSubjects: (id: number, subjects: { subject: string; grade_level_id?: number | null }[]) =>
    http.put(`/api/personnel/${id}/subjects`, { subjects }, { fallback: 'Failed to update subjects' }),
  toggleStatus: (id: number) => http.patch(`/api/personnel/${id}/status`, undefined, { fallback: 'Failed to update status' }),
  gradeLevels: () => http.get<GradeLevel[]>('/api/personnel/meta/grade-levels'),
  subjects: () => http.get<SubjectMeta[]>('/api/personnel/meta/subjects'),
  skills: () => http.get<SkillMeta[]>('/api/personnel/meta/skills'),
  certifications: () => http.get<CertificationMeta[]>('/api/personnel/meta/certifications'),
  educationOptions: () => http.get<EducationOptions>('/api/personnel/meta/education-options'),
  departments: () => http.get<Department[]>('/api/personnel/meta/departments'),
  createDepartment: (name: string) =>
    http.post<Department>('/api/personnel/departments', { department_name: name }),
};

export const certificates = {
  catalog: () => http.get<CertificationCatalogItem[]>('/api/certificates/catalog'),
  /** userId omitted: the signed-in person's own certificates. */
  list: (userId?: number) =>
    http.get<CertificateSet>(`/api/certificates/${userId == null ? 'mine' : `user/${userId}`}`,
      { fallback: 'Failed to load certificates' }),
  /** Upload a certificate PDF/photo; the server reads and checks it. */
  analyze: (file: UploadFile, filename: string) =>
    http.upload<CertificateFile>('/api/certificates/analyze', fileForm(file, filename),
      { fallback: 'Could not read the certificate', timeoutMs: 90_000 }),
  confirm: (id: number, certificationId: number) =>
    http.post<CertificateFile>(`/api/certificates/${id}/confirm`, { certification_id: certificationId },
      { fallback: 'Could not add the certificate' }),
  remove: (id: number) => http.delete(`/api/certificates/${id}`, { fallback: 'Could not remove the certificate' }),
  review: (id: number, status: 'verified' | 'rejected', note?: string) =>
    http.patch<CertificateFile>(`/api/certificates/${id}/review`,
      { status, ...(note ? { note } : {}) }, { fallback: 'Could not save the review' }),
  /** The file itself (needs the token, so it can't be a plain link). */
  file: (id: number) => request<Response>('GET', `/api/certificates/${id}/file`,
    { raw: true, fallback: 'Could not open the certificate' }),
};

// ── Dashboard, notifications, audit ───────────────────────────────────────────

export const dashboard = {
  get: () => http.get<DashboardData>('/api/dashboard', { fallback: 'Failed to load dashboard' }),
};

export const notifications = {
  list: () => http.get<AppNotification[]>('/api/notifications'),
  unreadCount: async () => (await http.get<{ count: number }>('/api/notifications/unread-count')).count,
  markRead: (id: number) => http.post(`/api/notifications/${id}/read`),
  markAllRead: () => http.post('/api/notifications/read-all'),
  remove: (id: number) => http.delete(`/api/notifications/${id}`),
};

export interface AuditQuery {
  entityType?: string;
  entityId?: number;
  actorId?: number;
  action?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export const audit = {
  list: (q: AuditQuery = {}) => http.get<{ items: AuditEntry[]; total: number }>('/api/audit', {
    query: {
      entity_type: q.entityType, entity_id: q.entityId, actor_id: q.actorId, action: q.action,
      q: q.q, date_from: q.dateFrom, date_to: q.dateTo, limit: q.limit ?? 50, offset: q.offset ?? 0,
    },
    fallback: 'Failed to load the audit log',
  }),
};

// ── Appraisal ─────────────────────────────────────────────────────────────────

export const appraisal = {
  specialTasks: (filter?: SchoolYearFilter) =>
    http.get<SpecialTask[]>('/api/appraisal/special-tasks', { query: yearQuery(filter) }),
  createSpecialTask: (body: { title: string; description?: string; due_date?: string; assignee_id?: number }) =>
    http.post<SpecialTask>('/api/appraisal/special-tasks', body),
  evaluateSpecialTask: (taskId: number, scores: {
    completion_quality_score: number; timeliness_score: number; initiative_score: number;
    coordination_score: number; remarks?: string;
  }) => http.post<SpecialTask>(`/api/appraisal/special-tasks/${taskId}/evaluate`, scores,
    { fallback: 'Failed to evaluate task' }),
  reportSubmissions: (filter?: SchoolYearFilter) =>
    http.get<Record<string, unknown>[]>('/api/appraisal/report-submissions', { query: yearQuery(filter) }),
  events: (filter?: SchoolYearFilter) =>
    http.get<EventForAppraisal[]>('/api/appraisal/events', { query: yearQuery(filter) }),
  evaluateEvent: (eventId: number, body: Record<string, unknown>) =>
    http.post<EventForAppraisal>(`/api/appraisal/events/${eventId}/evaluate`, body,
      { fallback: 'Failed to submit evaluation' }),
  badges: async (q: { userId?: number; filter?: SchoolYearFilter } = {}) =>
    (await http.get<{ badges: AppraisalBadge[] }>('/api/appraisal/badges',
      { query: { user_id: q.userId, ...yearQuery(q.filter) }, fallback: 'Failed to load badges' })).badges,
  leaderboard: (filter?: SchoolYearFilter) =>
    http.get<LeaderboardEntry[]>('/api/appraisal/badges/leaderboard',
      { query: yearQuery(filter), fallback: 'Failed to load badges' }),

  // Public QR evaluation (no login).
  publicEvent: (eventId: string | number) =>
    http.get<Record<string, unknown>>(`/api/appraisal/public/events/${eventId}`,
      { anonymous: true, fallback: 'Event not found.' }),
  submitPublicEvaluation: (eventId: string | number, body: Record<string, unknown>) =>
    http.post(`/api/appraisal/public/events/${eventId}/evaluate`, body,
      { anonymous: true, fallback: 'Failed to submit evaluation.' }),
};

// ── School years ──────────────────────────────────────────────────────────────

export interface SchoolYearInput {
  name: string;
  start_date: string;
  end_date: string;
  terms: { name: string; start_date: string; end_date: string }[];
}

export const schoolYears = {
  list: () => http.get<SchoolYear[]>('/api/school-years', { fallback: 'Failed to load school years' }),
  save: (body: SchoolYearInput, id?: number) => id
    ? http.put(`/api/school-years/${id}`, body, { fallback: 'Could not save the school year' })
    : http.post('/api/school-years', body, { fallback: 'Could not save the school year' }),
  remove: (id: number) => http.delete(`/api/school-years/${id}`, { fallback: 'Could not delete the school year' }),
};

// ── Events ────────────────────────────────────────────────────────────────────

export interface ApproveResult {
  special_tasks_created?: number;
  special_tasks_skipped?: string[];
  [k: string]: unknown;
}

export const events = {
  /** Current school year by default; schoolYear may be an id or 'all'. */
  list: (schoolYear?: string) => http.get<EventRecord[]>('/api/events',
    { query: { school_year: schoolYear }, fallback: 'Failed to load events' }),
  get: (id: number) => http.get<EventRecord>(`/api/events/${id}`),
  create: (body: EventInput) => http.post<EventRecord>('/api/events', body, { fallback: 'Could not save the event' }),
  update: (id: number, body: EventInput) =>
    http.put<EventRecord>(`/api/events/${id}`, body, { fallback: 'Could not save the event' }),
  remove: (id: number) => http.delete(`/api/events/${id}`, { fallback: 'Failed to delete event' }),
  approve: (id: number) => http.patch<ApproveResult>(`/api/events/${id}/approve`, undefined,
    { fallback: 'Failed to approve event' }),
  disable: (id: number) => http.patch(`/api/events/${id}/disable`, undefined, { fallback: 'Failed to disable event' }),
  enable: (id: number) => http.patch(`/api/events/${id}/enable`, undefined, { fallback: 'Failed to enable event' }),
  checkDate: (targetDate: string, excludeId?: number) => http.get<DateCheck>('/api/events/date-check',
    { query: { target_date: targetDate, exclude_id: excludeId }, fallback: 'Failed to check the date' }),

  // Attendance (QR Time In / Time Out)
  attendanceQrCodes: (eventId: number) => http.get<AttendanceQrCodes>(
    `/api/events/${eventId}/attendance/qr-codes`, { fallback: 'Could not load the attendance QR codes' }),
  attendanceActivity: (eventId: number, index: number) => http.get<AttendanceActivity>(
    `/api/events/${eventId}/attendance/activities/${index}`, { fallback: 'Could not load this activity' }),
  scanAttendance: (eventId: number, body: {
    activity_index: number; action: string; code: string; latitude?: number | null; longitude?: number | null;
  }) => http.post<AttendanceScanResult>(`/api/events/${eventId}/attendance/scan`, body,
    { fallback: 'Could not record your attendance' }),
  evaluateActivity: (eventId: number, index: number, body: Record<string, unknown>) =>
    http.post<{ message: string; special_task?: Record<string, unknown> | null }>(`/api/events/${eventId}/attendance/activities/${index}/evaluate`, body,
      { fallback: 'Failed to submit evaluation.' }),
};

export const depedCalendar = {
  list: (range: { start?: string; end?: string } = {}) =>
    http.get<DepedEntry[]>('/api/deped-calendar', { query: range, fallback: 'Could not load the DepEd calendar' }),
  save: (id: number | null, body: Partial<DepedEntry>) => id == null
    ? http.post('/api/deped-calendar', body, { fallback: 'Could not save the DepEd calendar entry' })
    : http.put(`/api/deped-calendar/${id}`, body, { fallback: 'Could not save the DepEd calendar entry' }),
  remove: (id: number) => http.delete(`/api/deped-calendar/${id}`, { fallback: 'Could not remove the DepEd calendar entry' }),
  /** One compliance task from an entry, assigned to every active member of `roles`. */
  generateTasks: (id: number, body: { title: string; instructions?: string; due_date?: string; due_time?: string; roles: string[] }) =>
    http.post<{ task_id: number; assigned: number; roles: string[] }>(
      `/api/deped-calendar/${id}/generate-tasks`, body, { fallback: 'Could not generate the tasks' }),
};
