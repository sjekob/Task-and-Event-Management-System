import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AuditEntry, auditEntryFromJson } from '../models/audit';
import {
  AppraisalBadge,
  AssigneeSuggestion,
  CertificateFile,
  CertificateSet,
  CertificationCatalogItem,
  DashboardData,
  EventForAppraisal,
  Json,
  PageResult,
  Report,
  SchoolYear,
  SchoolYearFilter,
  SpecialTask,
  Task,
  TaskTemplate,
  User,
  appraisalBadgeFromJson,
  certificationCatalogItemFromJson,
  currentSchoolYear,
  dashboardDataFromJson,
  pageResultFromJson,
  reportFromJson,
  schoolYearFilterQuery,
  schoolYearFromJson,
  taskTemplateFromJson,
} from '../models/models';

/// A file chosen with the document picker, ready to upload. On web [file] is
/// the browser File; on native the upload reads from [uri].
/// A task proposed from a scanned school calendar. `kind` is 'task',
/// 'suggested' (implied by the calendar, e.g. submitting grades after an
/// exam), 'holiday', 'marker' (term starts/ends, breaks) or 'other'.
export interface CalendarTaskProposal {
  title: string;
  startDate: string;
  endDate: string;
  kind: string;
  selected: boolean;
  instructions: string;
  /// The date has already passed (listed, but not pre-selected).
  past: boolean;
}

/// One dated row of a scanned schedule ("Dec 3-4, 2026 — Term 2 Examination").
export interface ScannedItem {
  title: string;
  startDate: string | null;
  endDate: string | null;
}

export interface PickedFile {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  file?: Blob | null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/// Token-bucket limiter: smooths request bursts so a runaway loop or rapid
/// double-submits can't flood the backend. Excess requests are *delayed*, not
/// failed, so normal use is unaffected.
class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(private readonly ratePerSec = 10, private readonly capacity = 20) {
    this.tokens = capacity;
  }

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = (now - this.last) / 1000;
      this.last = now;
      this.tokens = Math.min(Math.max(this.tokens + elapsed * this.ratePerSec, 0), this.capacity);
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.ratePerSec) * 1000);
      await sleep(waitMs);
    }
  }
}

export interface ApiResponse {
  statusCode: number;
  body: string;
}

const bucket = new TokenBucket();

/// Every request (incl. multipart) is throttled through the shared token bucket.
async function send(url: string, init: RequestInit = {}): Promise<Response> {
  await bucket.acquire();
  return fetch(url, init);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const TOKEN_KEY = 'tasknet_token';

export class ApiService {
  // Reads EXPO_PUBLIC_API_BASE set at build/run time (needed when serving to
  // other devices, e.g. EXPO_PUBLIC_API_BASE=http://192.168.8.34:8000).
  // Falls back to localhost for normal local development.
  static readonly baseUrl: string = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000';

  private static _token: string | null = null;

  static async token(): Promise<string | null> {
    this._token ??= await AsyncStorage.getItem(TOKEN_KEY);
    return this._token;
  }

  private static async headers(): Promise<Record<string, string>> {
    const t = await this.token();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (t != null) h.Authorization = `Bearer ${t}`;
    return h;
  }

  static async saveToken(t: string): Promise<void> {
    this._token = t;
    await AsyncStorage.setItem(TOKEN_KEY, t);
  }

  static async clearToken(): Promise<void> {
    this._token = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
  }

  private static async request(
    method: string,
    path: string,
    opts: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<ApiResponse> {
    const res = await send(`${this.baseUrl}${path}`, {
      method,
      headers: opts.headers ?? (await this.headers()),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { statusCode: res.status, body: await res.text() };
  }

  /// A raw authenticated JSON request, for the feature services.
  static call(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    return this.request(method, path, { body });
  }

  private static get = (path: string, headers?: Record<string, string>) =>
    this.request('GET', path, { headers });
  private static post = (path: string, body?: unknown, headers?: Record<string, string>) =>
    this.request('POST', path, { body, headers });
  private static put = (path: string, body?: unknown) => this.request('PUT', path, { body });
  private static patch = (path: string, body?: unknown) => this.request('PATCH', path, { body });
  private static del = (path: string) => this.request('DELETE', path);

  private static async multipart(path: string, file: PickedFile): Promise<Response> {
    const t = await this.token();
    const form = new FormData();
    if (Platform.OS === 'web' && file.file != null) {
      form.append('file', file.file, file.name);
    } else {
      form.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
    }
    return send(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: t != null ? { Authorization: `Bearer ${t}` } : undefined,
      body: form,
    });
  }

  private static detail(res: ApiResponse, fallback: string): string {
    return this.errorDetail(res.body, fallback, true);
  }

  private static errorDetail(body: string, fallback: string, requireNonEmpty = false): string {
    try {
      const d = JSON.parse(body);
      if (d && typeof d === 'object' && typeof d.detail === 'string') {
        if (!requireNonEmpty || d.detail.length > 0) return d.detail;
      }
    } catch {}
    return fallback;
  }

  // ── Auth ──
  static async login(username: string, password: string, role?: string | null): Promise<Json> {
    const body: Json = { username, password };
    if (role != null) body.role = role;
    const res = await withTimeout(
      this.post('/api/auth/login', body, { 'Content-Type': 'application/json' }),
      10000,
      'Cannot reach server. Check your network.',
    );
    if (res.statusCode === 200) {
      const data = JSON.parse(res.body) as Json;
      // Multi-role account: credentials OK but the caller must pick an identity.
      if (data.needs_role_selection === true) return data;
      await this.saveToken(data.token);
      return data;
    }
    throw new Error('Invalid username or password');
  }

  static async getMe(): Promise<User> {
    const res = await withTimeout(this.get('/api/auth/me'), 10000, 'Timeout');
    if (res.statusCode === 200) return User.fromJson(JSON.parse(res.body));
    throw new Error('Not authenticated');
  }

  // ── Tasks ──
  static async getTasks(
    opts: { search?: string; scope?: string; filter?: SchoolYearFilter } = {},
  ): Promise<Task[]> {
    const { search = '', scope = 'mine', filter = currentSchoolYear } = opts;
    const params: string[] = [];
    if (search.length > 0) params.push(`search=${encodeURIComponent(search)}`);
    if (scope !== 'mine') params.push(`scope=${scope}`);
    for (const [k, v] of Object.entries(schoolYearFilterQuery(filter))) params.push(`${k}=${v}`);
    const res = await this.get(`/api/tasks${params.length === 0 ? '' : `?${params.join('&')}`}`);
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(Task.fromJson);
    throw new Error('Failed to load tasks');
  }

  // ── Paginated task lists (infinite scroll) ──────────────────────────────────
  static async getTasksPage(
    opts: { search?: string; scope?: string; category?: string | null; limit?: number; offset?: number } = {},
  ): Promise<PageResult<Task>> {
    const { search = '', scope = 'mine', category = null, limit = 30, offset = 0 } = opts;
    const params: string[] = [`limit=${limit}`, `offset=${offset}`];
    if (search.length > 0) params.push(`search=${encodeURIComponent(search)}`);
    if (scope !== 'mine') params.push(`scope=${scope}`);
    if (category != null) params.push(`category=${category}`);
    const res = await this.get(`/api/tasks?${params.join('&')}`);
    if (res.statusCode === 200) return pageResultFromJson(JSON.parse(res.body) as Json, Task.fromJson);
    throw new Error('Failed to load tasks');
  }

  static async getAssignedTasksPage(
    opts: { category?: string | null; limit?: number; offset?: number; filter?: SchoolYearFilter } = {},
  ): Promise<PageResult<Task>> {
    const { category = null, limit = 30, offset = 0, filter = currentSchoolYear } = opts;
    const params: string[] = ['assigned=1', `limit=${limit}`, `offset=${offset}`];
    if (category != null) params.push(`category=${category}`);
    for (const [k, v] of Object.entries(schoolYearFilterQuery(filter))) params.push(`${k}=${v}`);
    const res = await this.get(`/api/tasks?${params.join('&')}`);
    if (res.statusCode === 200) return pageResultFromJson(JSON.parse(res.body) as Json, Task.fromJson);
    throw new Error('Failed to load assigned tasks');
  }

  static async getAssignedTasks(): Promise<Task[]> {
    const res = await this.get('/api/tasks?assigned=1');
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(Task.fromJson);
    throw new Error('Failed to load assigned tasks');
  }

  static async getTask(id: number): Promise<Task> {
    const res = await this.get(`/api/tasks/${id}`);
    if (res.statusCode === 200) return Task.fromJson(JSON.parse(res.body));
    throw new Error('Task not found');
  }

  static async createTask(body: Json): Promise<void> {
    const res = await this.post('/api/tasks', body);
    if (res.statusCode !== 200) throw new Error('Failed to create task');
  }

  static async updateTask(id: number, body: Json): Promise<void> {
    const res = await this.put(`/api/tasks/${id}`, body);
    if (res.statusCode !== 200) throw new Error('Failed to update task');
  }

  static async deleteTask(id: number): Promise<void> {
    const res = await this.del(`/api/tasks/${id}`);
    if (res.statusCode !== 200) throw new Error('Failed to delete task');
  }

  // ── Report submission (teacher, registrar, dean all use this) ──
  static async submitReport(
    taskId: number,
    report: {
      reportTitle: string;
      reportDescription?: string | null;
      reportType?: string | null;
      reportLinkUrl?: string | null;
    },
  ): Promise<Json> {
    const body: Json = { report_title: report.reportTitle };
    if (report.reportDescription != null) body.report_description = report.reportDescription;
    if (report.reportType != null) body.report_type = report.reportType;
    if (report.reportLinkUrl != null) body.report_link_url = report.reportLinkUrl;
    const res = await this.post(`/api/tasks/${taskId}/reports`, body);
    if (res.statusCode === 200) return JSON.parse(res.body);
    const err = JSON.parse(res.body);
    throw new Error(err.detail ?? 'Failed to submit report');
  }

  // ── Task assignment ──
  /// Assigns [userIds] as [targetRole] (the identity they receive the task as).
  /// Returns how many were skipped (not allowed by the hierarchy / already assigned).
  static async assignTask(taskId: number, userIds: number[], targetRole?: string | null): Promise<number> {
    const body: Json = { user_ids: userIds };
    if (targetRole != null) body.target_role = targetRole;
    const res = await this.post(`/api/tasks/${taskId}/assign`, body);
    if (res.statusCode !== 200) throw new Error(this.detail(res, 'Failed to assign users'));
    return ((JSON.parse(res.body) as Json).skipped ?? []).length;
  }

  static async unassignTask(taskId: number, userId: number): Promise<void> {
    const res = await this.del(`/api/tasks/${taskId}/assign/${userId}`);
    if (res.statusCode !== 200) throw new Error('Failed to unassign user');
  }

  static async getAssignableUsers(targetRole?: string | null): Promise<User[]> {
    const qs = targetRole != null ? `?target_role=${targetRole}` : '';
    const res = await this.get(`/api/users/assignable${qs}`);
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(User.fromJson);
    throw new Error('Failed to load assignable users');
  }

  /// Assignable personnel ranked for a task by skills, certifications,
  /// number of children and current workload (best match first).
  static async getAssigneeSuggestions(
    opts: {
      targetRole?: string | null;
      title?: string;
      subject?: string;
      instructions?: string;
      taskCategory?: string;
      startDate?: string | null;
      endDate?: string | null;
      dueTime?: string | null;
    } = {},
  ): Promise<AssigneeSuggestion[]> {
    const body: Json = {
      target_role: opts.targetRole ?? '',
      title: opts.title ?? '',
      subject: opts.subject ?? '',
      instructions: opts.instructions ?? '',
      task_category: opts.taskCategory ?? 'common',
    };
    if (opts.startDate != null) body.start_date = opts.startDate;
    if (opts.endDate != null) body.end_date = opts.endDate;
    if (opts.dueTime != null) body.due_time = opts.dueTime;
    const res = await this.post('/api/users/assignable/suggestions', body);
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(AssigneeSuggestion.fromJson);
    throw new Error('Failed to load suggestions');
  }

  // ── Reports ──
  static async getReports(opts: { taskId?: number | null; status?: string | null } = {}): Promise<Report[]> {
    const params: Record<string, string> = {};
    if (opts.taskId != null) params.task_id = `${opts.taskId}`;
    if (opts.status != null) params.status = opts.status;
    const qs = Object.keys(params).length > 0 ? `?${query(params)}` : '';
    const res = await this.get(`/api/reports${qs}`);
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(reportFromJson);
    throw new Error('Failed to load reports');
  }

  static async updateReportStatus(reportId: number, status: string): Promise<void> {
    const res = await this.put(`/api/reports/${reportId}/status`, { report_status: status });
    if (res.statusCode !== 200) throw new Error('Failed to update report status');
  }

  // ── Task Log ──
  static async getTaskLog(taskId?: number | null): Promise<Json[]> {
    const res = await this.get(`/api/task-log${taskId != null ? `?task_id=${taskId}` : ''}`);
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    throw new Error('Failed to load task log');
  }

  // ── Submission Log ──
  static async getSubmissionLog(): Promise<Json[]> {
    const res = await this.get('/api/submission-log');
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    throw new Error('Failed to load submission log');
  }

  // ── Comments ──
  static async addComment(taskId: number, content: string, type: string, reportId?: number | null): Promise<void> {
    const body: Json = { content, comment_type: type };
    if (reportId != null) body.report_id = reportId;
    const res = await this.post(`/api/tasks/${taskId}/comments`, body);
    if (res.statusCode !== 200) throw new Error('Failed to add comment');
  }

  static async editComment(commentId: number, content: string): Promise<void> {
    const res = await this.put(`/api/comments/${commentId}`, { content });
    if (res.statusCode !== 200) throw new Error('Failed to edit comment');
  }

  static async uploadAttachmentFile(file: PickedFile): Promise<{ url: string; name: string }> {
    const res = await this.multipart('/api/upload', file);
    const body = await res.text();
    if (res.status !== 200) throw new Error('File upload failed');
    const json = JSON.parse(body) as Json;
    return {
      url: `${this.baseUrl}${json.url}`,
      name: (json.name as string | null) ?? file.name,
    };
  }

  // ── Audit trail (principal/admin) ──
  static async getAuditLog(
    opts: {
      entityType?: string | null;
      entityId?: number | null;
      action?: string | null;
      query?: string | null;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: AuditEntry[]; total: number }> {
    const params: Record<string, string> = {};
    if (opts.entityType != null) params.entity_type = opts.entityType;
    if (opts.entityId != null) params.entity_id = `${opts.entityId}`;
    if (opts.action != null) params.action = opts.action;
    if (opts.query != null && opts.query.length > 0) params.q = opts.query;
    params.limit = `${opts.limit ?? 50}`;
    params.offset = `${opts.offset ?? 0}`;
    const res = await this.get(`/api/audit?${query(params)}`);
    if (res.statusCode !== 200) {
      throw new Error(this.errorDetail(res.body, 'Failed to load the audit log'));
    }
    const d = JSON.parse(res.body) as Json;
    return {
      items: (d.items as Json[]).map(auditEntryFromJson),
      total: Math.trunc(d.total as number),
    };
  }

  // ── Certificates ──
  static async getCertificationCatalog(): Promise<CertificationCatalogItem[]> {
    const res = await this.get('/api/certificates/catalog');
    if (res.statusCode !== 200) throw new Error('Failed to load certifications');
    return (JSON.parse(res.body) as Json[]).map(certificationCatalogItemFromJson);
  }

  /// [userId] null: the signed-in person's own certificates.
  static async getCertificates(userId?: number | null): Promise<CertificateSet> {
    const path = userId == null ? 'mine' : `user/${userId}`;
    const res = await this.get(`/api/certificates/${path}`);
    if (res.statusCode !== 200) {
      throw new Error(this.errorDetail(res.body, 'Failed to load certificates'));
    }
    return CertificateSet.fromJson(JSON.parse(res.body) as Json);
  }

  /// Upload a certificate PDF/photo; the server reads and checks it.
  static async analyzeCertificate(file: PickedFile): Promise<CertificateFile> {
    const res = await withTimeout(
      this.multipart('/api/certificates/analyze', file),
      90000,
      'Reading the certificate took too long. Try a smaller file.',
    );
    const body = await res.text();
    if (res.status !== 201) {
      throw new Error(this.errorDetail(body, 'Could not read the certificate'));
    }
    return CertificateFile.fromJson(JSON.parse(body) as Json);
  }

  static async confirmCertificate(id: number, certificationId: number): Promise<CertificateFile> {
    const res = await this.post(`/api/certificates/${id}/confirm`, { certification_id: certificationId });
    if (res.statusCode !== 200) {
      throw new Error(this.errorDetail(res.body, 'Could not add the certificate'));
    }
    return CertificateFile.fromJson(JSON.parse(res.body) as Json);
  }

  static async deleteCertificate(id: number): Promise<void> {
    const res = await this.del(`/api/certificates/${id}`);
    if (res.statusCode !== 200) {
      throw new Error(this.errorDetail(res.body, 'Could not remove the certificate'));
    }
  }

  static async reviewCertificate(id: number, status: string, note?: string | null): Promise<CertificateFile> {
    const body: Json = { status };
    if (note != null && note.length > 0) body.note = note;
    const res = await this.patch(`/api/certificates/${id}/review`, body);
    if (res.statusCode !== 200) {
      throw new Error(this.errorDetail(res.body, 'Could not save the review'));
    }
    return CertificateFile.fromJson(JSON.parse(res.body) as Json);
  }

  /// The certificate file itself (needs the token, so it can't be a plain link).
  static async getCertificateBytes(id: number): Promise<Blob> {
    const res = await send(`${this.baseUrl}/api/certificates/${id}/file`, { headers: await this.headers() });
    if (res.status !== 200) {
      throw new Error(this.errorDetail(await res.text(), 'Could not open the certificate'));
    }
    return res.blob();
  }

  static async uploadReportFile(taskId: number, file: PickedFile): Promise<void> {
    const res = await this.multipart(`/api/tasks/${taskId}/reports/upload`, file);
    if (res.status !== 200) throw new Error('File upload failed');
  }

  static async deleteReport(reportId: number): Promise<void> {
    const res = await this.del(`/api/reports/${reportId}`);
    if (res.statusCode !== 200) throw new Error('Failed to unsubmit report');
  }

  static async deleteComment(commentId: number): Promise<void> {
    const res = await this.del(`/api/comments/${commentId}`);
    if (res.statusCode !== 200) throw new Error('Failed to delete comment');
  }

  // ── Templates ──
  static async createTemplate(data: Json): Promise<void> {
    const res = await this.post('/api/templates', data);
    if (res.statusCode !== 200) {
      const err = JSON.parse(res.body);
      throw new Error(err.detail ?? 'Failed to create template');
    }
  }

  /// Reads a document (PDF, Word, text or photo) that describes a task and
  /// returns the fields found in it, to pre-fill the task/template form.
  /// `items` is filled when the file is a schedule: one entry per dated row.
  static async scanTaskFile(file: PickedFile): Promise<{
    title: string | null;
    instructions: string | null;
    startDate: string | null;
    endDate: string | null;
    dueTime: string | null;
    items: ScannedItem[];
  }> {
    const res = await this.multipart('/api/templates/scan', file);
    const body = await res.text();
    if (res.status !== 200) throw new Error(this.errorDetail(body, 'The file could not be read'));
    const json = JSON.parse(body) as Json;
    return {
      title: (json.title as string | null) ?? null,
      instructions: (json.instructions as string | null) ?? null,
      startDate: (json.start_date as string | null) ?? null,
      endDate: (json.end_date as string | null) ?? null,
      dueTime: (json.due_time as string | null) ?? null,
      items: Array.isArray(json.items)
        ? (json.items as Json[]).map((i) => ({
            title: String(i.title ?? ''),
            startDate: (i.start_date as string | null) ?? null,
            endDate: (i.end_date as string | null) ?? null,
          }))
        : [],
    };
  }

  /// Principal/admin: read a school calendar and propose the tasks it implies.
  static async scanSchoolCalendar(file: PickedFile): Promise<CalendarTaskProposal[]> {
    const res = await this.multipart('/api/tasks/scan-calendar', file);
    const body = await res.text();
    if (res.status !== 200) throw new Error(this.errorDetail(body, 'The calendar could not be read'));
    const json = JSON.parse(body) as Json;
    return ((json.tasks as Json[] | null) ?? []).map((t) => ({
      title: String(t.title ?? ''),
      startDate: String(t.start_date),
      endDate: String(t.end_date),
      kind: String(t.kind ?? 'other'),
      selected: t.selected === true,
      instructions: String(t.instructions ?? ''),
      past: t.past === true,
    }));
  }

  static async getTemplates(): Promise<TaskTemplate[]> {
    const res = await this.get('/api/templates');
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(taskTemplateFromJson);
    return [];
  }

  static async deleteTemplate(templateId: number): Promise<void> {
    await this.del(`/api/templates/${templateId}`);
  }

  // ── Dashboard ──
  static async getDashboard(): Promise<DashboardData> {
    const res = await this.get('/api/dashboard');
    if (res.statusCode === 200) return dashboardDataFromJson(JSON.parse(res.body));
    throw new Error('Failed to load dashboard');
  }

  // ── Users ──
  static async getUsers(): Promise<User[]> {
    const res = await this.get('/api/users');
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(User.fromJson);
    throw new Error('Failed to load users');
  }

  // ── Grade Levels ──
  static async getGradeLevels(): Promise<Json[]> {
    const res = await this.get('/api/grade-levels');
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    return [];
  }

  // ── Profile ──
  static async getMyProfile(): Promise<User> {
    const res = await this.get('/api/users/me/profile');
    if (res.statusCode === 200) return User.fromJson(JSON.parse(res.body));
    throw new Error('Failed to load profile');
  }

  static async updateMyProfile(body: Json): Promise<void> {
    const res = await this.put('/api/users/me/profile', body);
    if (res.statusCode !== 200) throw new Error('Failed to update profile');
  }

  // ── Subjects ──
  static async getSubjects(): Promise<string[]> {
    const res = await this.get('/api/subjects');
    if (res.statusCode === 200) return (JSON.parse(res.body) as unknown[]).map(String);
    return [];
  }

  // ── Personnel Management ──────────────────────────────────────────────────

  static async getPersonnel(search = ''): Promise<User[]> {
    const qs = search.length > 0 ? `?search=${encodeURIComponent(search)}` : '';
    const res = await this.get(`/api/personnel${qs}`);
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(User.fromJson);
    throw new Error('Failed to load personnel');
  }

  static async getPersonnelById(id: number): Promise<User> {
    const res = await this.get(`/api/personnel/${id}`);
    if (res.statusCode === 200) return User.fromJson(JSON.parse(res.body));
    throw new Error('User not found');
  }

  static async createPersonnel(data: Json): Promise<User> {
    const res = await this.post('/api/personnel', data);
    if (res.statusCode === 201) return User.fromJson(JSON.parse(res.body));
    throw new Error(JSON.parse(res.body).detail ?? 'Failed to create personnel');
  }

  static async updatePersonnel(id: number, data: Json): Promise<User> {
    const res = await this.put(`/api/personnel/${id}`, data);
    if (res.statusCode === 200) return User.fromJson(JSON.parse(res.body));
    throw new Error(JSON.parse(res.body).detail ?? 'Failed to update personnel');
  }

  static async togglePersonnelStatus(id: number): Promise<void> {
    const res = await this.patch(`/api/personnel/${id}/status`);
    if (res.statusCode !== 200) throw new Error('Failed to update status');
  }

  static async getGradeLevelsMeta(): Promise<Json[]> {
    const res = await this.get('/api/personnel/meta/grade-levels');
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    return [];
  }

  static async getSubjectsMeta(): Promise<Json[]> {
    const res = await this.get('/api/personnel/meta/subjects');
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    return [];
  }

  static async updatePersonnelSubjects(id: number, subjects: Json[]): Promise<void> {
    const res = await this.put(`/api/personnel/${id}/subjects`, { subjects });
    if (res.statusCode !== 200) {
      throw new Error(JSON.parse(res.body).detail ?? 'Failed to update subjects');
    }
  }

  // ── Appraisal Management ──────────────────────────────────────────────────

  private static withFilter(path: string, f: SchoolYearFilter, extra: Record<string, string> = {}): string {
    const params = { ...schoolYearFilterQuery(f), ...extra };
    return Object.keys(params).length === 0 ? path : `${path}?${query(params)}`;
  }

  static async getSpecialTasks(filter: SchoolYearFilter = currentSchoolYear): Promise<SpecialTask[]> {
    const res = await this.get(this.withFilter('/api/appraisal/special-tasks', filter));
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(SpecialTask.fromJson);
    throw new Error('Failed to load special tasks');
  }

  static async evaluateSpecialTask(taskId: number, scores: Json): Promise<SpecialTask> {
    const res = await this.post(`/api/appraisal/special-tasks/${taskId}/evaluate`, scores);
    if (res.statusCode === 200) return SpecialTask.fromJson(JSON.parse(res.body));
    throw new Error('Failed to evaluate task');
  }

  static async getReportSubmissions(filter: SchoolYearFilter = currentSchoolYear): Promise<Json[]> {
    const res = await this.get(this.withFilter('/api/appraisal/report-submissions', filter));
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map((e) => ({ ...e }));
    throw new Error('Failed to load report submissions');
  }

  static async getEventsForAppraisal(filter: SchoolYearFilter = currentSchoolYear): Promise<EventForAppraisal[]> {
    const res = await this.get(this.withFilter('/api/appraisal/events', filter));
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(EventForAppraisal.fromJson);
    throw new Error('Failed to load events');
  }

  static async evaluateEvent(eventId: number, evalData: Json): Promise<EventForAppraisal> {
    const res = await this.post(`/api/appraisal/events/${eventId}/evaluate`, evalData);
    if (res.statusCode === 201) return EventForAppraisal.fromJson(JSON.parse(res.body));
    throw new Error(this.detail(res, 'Failed to submit evaluation'));
  }

  // ── Badges ──
  static async getBadges(
    opts: { userId?: number | null; filter?: SchoolYearFilter } = {},
  ): Promise<AppraisalBadge[]> {
    const extra: Record<string, string> = {};
    if (opts.userId != null) extra.user_id = `${opts.userId}`;
    const res = await this.get(this.withFilter('/api/appraisal/badges', opts.filter ?? currentSchoolYear, extra));
    if (res.statusCode === 200) {
      return ((JSON.parse(res.body) as Json).badges as Json[]).map(appraisalBadgeFromJson);
    }
    throw new Error(this.detail(res, 'Failed to load badges'));
  }

  /// [{id, full_name, role, grade_level, earned_count, badges: [...]}]
  static async getBadgeLeaderboard(filter: SchoolYearFilter = currentSchoolYear): Promise<Json[]> {
    const res = await this.get(this.withFilter('/api/appraisal/badges/leaderboard', filter));
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map((e) => ({ ...e }));
    throw new Error(this.detail(res, 'Failed to load badges'));
  }

  // ── School years ──
  static async getSchoolYears(): Promise<SchoolYear[]> {
    const res = await this.get('/api/school-years');
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(schoolYearFromJson);
    throw new Error('Failed to load school years');
  }

  static async saveSchoolYear(body: Json, id?: number | null): Promise<void> {
    const path = `/api/school-years${id != null ? `/${id}` : ''}`;
    const res = id != null ? await this.put(path, body) : await this.post(path, body);
    if (res.statusCode >= 400) throw new Error(this.detail(res, 'Could not save the school year'));
  }

  static async deleteSchoolYear(id: number): Promise<void> {
    const res = await this.del(`/api/school-years/${id}`);
    if (res.statusCode >= 400) throw new Error(this.detail(res, 'Could not delete the school year'));
  }

  // ── Public Event Evaluation (reached by scanning the event's QR code;
  // no login required, all gating/validation happens server-side) ──────────

  static async getPublicEvent(eventId: string): Promise<Json> {
    const res = await this.get(`/api/appraisal/public/events/${eventId}`, { 'Content-Type': 'application/json' });
    if (res.statusCode === 200) return JSON.parse(res.body) as Json;
    throw new Error(JSON.parse(res.body).detail ?? 'Event not found.');
  }

  static async submitPublicEvaluation(eventId: string, evalData: Json): Promise<void> {
    const res = await this.post(`/api/appraisal/public/events/${eventId}/evaluate`, evalData, {
      'Content-Type': 'application/json',
    });
    if (res.statusCode === 201) return;
    throw new Error(JSON.parse(res.body).detail ?? 'Failed to submit evaluation.');
  }

  // ── Event Management ──────────────────────────────────────────────────────

  /// Events of the current school year by default; [schoolYear] may be a
  /// school-year id or 'all' (archived years are excluded unless asked for).
  static async getEvents(schoolYear?: string | null): Promise<Json[]> {
    const res = await this.get(`/api/events${schoolYear != null ? `?school_year=${schoolYear}` : ''}`);
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    throw new Error('Failed to load events');
  }

  static async getEvent(id: number): Promise<Json | null> {
    const res = await this.get(`/api/events/${id}`);
    if (res.statusCode === 200) return JSON.parse(res.body) as Json;
    return null;
  }

  /// Throws with the server's reason (e.g. a date conflict) when rejected.
  static async createEvent(payload: Json): Promise<Json | null> {
    const res = await this.post('/api/events', payload);
    if (res.statusCode === 201) return JSON.parse(res.body) as Json;
    throw new Error(this.detail(res, 'Could not save the event'));
  }

  /// Whether [targetDate] is free for an event proposal: {available, past,
  /// message, conflicts}. [excludeId] skips the event being edited.
  static async checkEventDate(targetDate: string, excludeId?: number | null): Promise<Json> {
    const q: Record<string, string> = { target_date: targetDate };
    if (excludeId != null) q.exclude_id = `${excludeId}`;
    const res = await this.get(`/api/events/date-check?${query(q)}`);
    if (res.statusCode === 200) return JSON.parse(res.body) as Json;
    throw new Error('Failed to check the date');
  }

  static async updateEvent(id: number, payload: Json): Promise<Json | null> {
    const res = await this.put(`/api/events/${id}`, payload);
    if (res.statusCode >= 400) throw new Error(this.detail(res, 'Could not save the event'));
    if (res.statusCode === 200) return JSON.parse(res.body) as Json;
    return null;
  }

  /// Approving also gives each committee member of the event a special task;
  /// the result says how many were created and which names matched no account.
  static async approveEvent(id: number): Promise<{ created: number; unmatched: string[] }> {
    const res = await this.patch(`/api/events/${id}/approve`);
    if (res.statusCode !== 200) throw new Error('Failed to approve event');
    const d = JSON.parse(res.body) as Json;
    return {
      created: Array.isArray(d.special_tasks_created) ? d.special_tasks_created.length : 0,
      unmatched: Array.isArray(d.unmatched_members) ? d.unmatched_members.map((n: unknown) => String(n)) : [],
    };
  }

  static async disableEvent(id: number): Promise<void> {
    const res = await this.patch(`/api/events/${id}/disable`);
    if (res.statusCode !== 200) throw new Error('Failed to disable event');
  }

  static async enableEvent(id: number): Promise<void> {
    const res = await this.patch(`/api/events/${id}/enable`);
    if (res.statusCode !== 200) throw new Error('Failed to enable event');
  }

  static async deleteEvent(id: number): Promise<void> {
    const res = await this.del(`/api/events/${id}`);
    if (res.statusCode !== 200) throw new Error('Failed to delete event');
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  static async getNotifications(): Promise<Json[]> {
    const res = await this.get('/api/notifications');
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    throw new Error('Failed to load notifications');
  }

  static async getUnreadNotificationCount(): Promise<number> {
    const res = await this.get('/api/notifications/unread-count');
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json).count as number;
    return 0;
  }

  static async markNotificationRead(id: number): Promise<void> {
    await this.post(`/api/notifications/${id}/read`);
  }

  static async markAllNotificationsRead(): Promise<void> {
    await this.post('/api/notifications/read-all');
  }

  static async deleteNotification(id: number): Promise<void> {
    await this.del(`/api/notifications/${id}`);
  }
}

/// The message of a thrown error, as the UI shows it.
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/// A thrown error formatted as "Exception: <message>",
/// for the messages that showed the raw error.
export function exceptionText(e: unknown): string {
  return e instanceof Error ? `Exception: ${e.message}` : String(e);
}
