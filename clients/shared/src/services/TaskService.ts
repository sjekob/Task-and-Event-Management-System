import { ApiClient, FilePart } from './ApiClient';
import {
  AssigneeSuggestion, CalendarTaskProposal, calendarProposalFromJson, Json, PageResult, Report, ScannedTask, SchoolYearFilter, Task, TaskCategory, TaskDraft, TaskTemplate, User,
} from '../models';

/** What posting calendar tasks did: how many people submit to each adviser / dean / registrar, and to the poster. */
export interface CalendarPostResult { posted: number; assigned: number; byReviewer: Record<string, number>; toPoster: number }

export interface SuggestionQuery {
  targetRole?: string | null;
  title?: string;
  instructions?: string;
  taskCategory?: TaskCategory;
  startDate?: string | null;
  endDate?: string | null;
  dueTime?: string | null;
}

export interface ReportDraft {
  reportTitle: string;
  reportDescription?: string;
  reportType?: string;
  reportLinkUrl?: string;
}

/** Tasks, assignment, reports, comments and templates. */
export class TaskService {
  constructor(private readonly api: ApiClient) {}

  async list(opts: { search?: string; scope?: string; filter?: SchoolYearFilter } = {}): Promise<Task[]> {
    const data = await this.api.get<Json[]>('/api/tasks', {
      query: {
        search: opts.search || undefined,
        scope: opts.scope && opts.scope !== 'mine' ? opts.scope : undefined,
        ...(opts.filter ?? SchoolYearFilter.current).query,
      },
      fallback: 'Failed to load tasks',
    });
    return data.map(Task.fromJson);
  }

  /** One page of the tasks the caller manages (infinite scroll). */
  async page(opts: { search?: string; scope?: string; category?: TaskCategory; limit?: number; offset?: number; filter?: SchoolYearFilter } = {}): Promise<PageResult<Task>> {
    const data = await this.api.get<Json>('/api/tasks', {
      query: {
        limit: opts.limit ?? 30,
        offset: opts.offset ?? 0,
        search: opts.search || undefined,
        scope: opts.scope && opts.scope !== 'mine' ? opts.scope : undefined,
        category: opts.category,
        ...(opts.filter?.query ?? {}),
      },
      fallback: 'Failed to load tasks',
    });
    return PageResult.fromJson(data, Task.fromJson);
  }

  /** One page of the tasks assigned to the caller. */
  async assignedPage(opts: { category?: TaskCategory; limit?: number; offset?: number; filter?: SchoolYearFilter } = {}): Promise<PageResult<Task>> {
    const data = await this.api.get<Json>('/api/tasks', {
      query: {
        assigned: 1,
        limit: opts.limit ?? 30,
        offset: opts.offset ?? 0,
        category: opts.category,
        ...(opts.filter ?? SchoolYearFilter.current).query,
      },
      fallback: 'Failed to load assigned tasks',
    });
    return PageResult.fromJson(data, Task.fromJson);
  }

  async get(id: number): Promise<Task> {
    return Task.fromJson(await this.api.get(`/api/tasks/${id}`, { fallback: 'Task not found' }));
  }

  create(body: TaskDraft): Promise<Json> {
    return this.api.post('/api/tasks', { body, fallback: 'Failed to create task' });
  }

  update(id: number, body: Partial<TaskDraft>): Promise<Json> {
    return this.api.put(`/api/tasks/${id}`, { body, fallback: 'Failed to update task' });
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/api/tasks/${id}`, { fallback: 'Failed to delete task' });
  }

  // ── Assignment ──
  /** Returns how many were skipped (not allowed by the hierarchy / already assigned). */
  async assign(taskId: number, userIds: number[], targetRole?: string | null): Promise<number> {
    const data = await this.api.post(`/api/tasks/${taskId}/assign`, {
      body: { user_ids: userIds, ...(targetRole ? { target_role: targetRole } : {}) },
      fallback: 'Failed to assign users',
    });
    return Array.isArray(data?.skipped) ? data.skipped.length : 0;
  }

  async unassign(taskId: number, userId: number): Promise<void> {
    await this.api.delete(`/api/tasks/${taskId}/assign/${userId}`, { fallback: 'Failed to unassign user' });
  }

  async assignableUsers(targetRole?: string | null): Promise<User[]> {
    const data = await this.api.get<Json[]>('/api/users/assignable', {
      query: { target_role: targetRole ?? undefined },
      fallback: 'Failed to load assignable users',
    });
    return data.map(User.fromJson);
  }

  /** Assignable personnel ranked for a task by competency, workload and life context. */
  async suggestions(q: SuggestionQuery): Promise<AssigneeSuggestion[]> {
    const data = await this.api.post<Json[]>('/api/users/assignable/suggestions', {
      body: {
        target_role: q.targetRole ?? '',
        title: q.title ?? '',
        subject: '',
        instructions: q.instructions ?? '',
        task_category: q.taskCategory ?? 'common',
        ...(q.startDate ? { start_date: q.startDate } : {}),
        ...(q.endDate ? { end_date: q.endDate } : {}),
        ...(q.dueTime ? { due_time: q.dueTime } : {}),
      },
      fallback: 'Failed to load suggestions',
    });
    return data.map(AssigneeSuggestion.fromJson);
  }

  // ── Reports ──
  submitReport(taskId: number, r: ReportDraft): Promise<Json> {
    return this.api.post(`/api/tasks/${taskId}/reports`, {
      body: {
        report_title: r.reportTitle,
        ...(r.reportDescription ? { report_description: r.reportDescription } : {}),
        ...(r.reportType ? { report_type: r.reportType } : {}),
        ...(r.reportLinkUrl ? { report_link_url: r.reportLinkUrl } : {}),
      },
      fallback: 'Failed to submit report',
    });
  }

  async uploadReportFile(taskId: number, file: FilePart): Promise<void> {
    await this.api.upload(`/api/tasks/${taskId}/reports/upload`, file, { fallback: 'File upload failed' });
  }

  async reports(opts: { taskId?: number; status?: string } = {}): Promise<Report[]> {
    const data = await this.api.get<Json[]>('/api/reports', {
      query: { task_id: opts.taskId, status: opts.status },
      fallback: 'Failed to load reports',
    });
    return data.map(Report.fromJson);
  }

  async setReportStatus(reportId: number, status: string): Promise<void> {
    await this.api.put(`/api/reports/${reportId}/status`, { body: { report_status: status }, fallback: 'Failed to update report status' });
  }

  async deleteReport(reportId: number): Promise<void> {
    await this.api.delete(`/api/reports/${reportId}`, { fallback: 'Failed to unsubmit report' });
  }

  /** Uploads an attachment; returns its absolute url and name. */
  async uploadAttachment(file: FilePart): Promise<{ url: string; name: string }> {
    const data = await this.api.upload('/api/upload', file, { fallback: 'File upload failed' });
    return { url: this.api.mediaUrl(data.url) ?? data.url, name: data.name ?? file.name };
  }

  // ── Logs ──
  taskLog(taskId?: number): Promise<Json[]> {
    return this.api.get('/api/task-log', { query: { task_id: taskId }, fallback: 'Failed to load task log' });
  }

  submissionLog(): Promise<Json[]> {
    return this.api.get('/api/submission-log', { fallback: 'Failed to load submission log' });
  }

  // ── Comments ──
  async addComment(taskId: number, content: string, type: 'public' | 'private', reportId?: number | null): Promise<void> {
    await this.api.post(`/api/tasks/${taskId}/comments`, {
      body: { content, comment_type: type, ...(reportId ? { report_id: reportId } : {}) },
      fallback: 'Failed to add comment',
    });
  }

  async editComment(commentId: number, content: string): Promise<void> {
    await this.api.put(`/api/comments/${commentId}`, { body: { content }, fallback: 'Failed to edit comment' });
  }

  async deleteComment(commentId: number): Promise<void> {
    await this.api.delete(`/api/comments/${commentId}`, { fallback: 'Failed to delete comment' });
  }

  // ── Templates ──
  async templates(): Promise<TaskTemplate[]> {
    try {
      const data = await this.api.get<Json[]>('/api/templates');
      return data.map(TaskTemplate.fromJson);
    } catch {
      return [];
    }
  }

  async createTemplate(body: Json): Promise<void> {
    await this.api.post('/api/templates', { body, fallback: 'Failed to create template' });
  }

  /** Reads a PDF / Word / text file or photo and returns the task fields found (nothing is stored). */
  async scanTaskFile(file: FilePart): Promise<ScannedTask> {
    return ScannedTask.fromJson(await this.api.upload('/api/templates/scan', file, { fallback: 'Could not read that file' }));
  }

  /** Principal/admin: read a school calendar and propose the tasks it implies (nothing is created). */
  async scanSchoolCalendar(file: FilePart): Promise<CalendarTaskProposal[]> {
    const d: Json = await this.api.upload('/api/tasks/scan-calendar', file, { fallback: 'The calendar could not be read' });
    return Array.isArray(d?.tasks) ? d.tasks.map(calendarProposalFromJson) : [];
  }

  /** Posts the reviewed calendar tasks; the server assigns each along its route. */
  async postCalendarTasks(fileName: string, rows: CalendarTaskProposal[]): Promise<CalendarPostResult> {
    const body = {
      file_name: fileName,
      rows: rows.map((r) => ({ title: r.title.trim(), start_date: r.startDate, end_date: r.endDate, instructions: r.instructions, route: r.route })),
    };
    const d: Json = await this.api.post('/api/tasks/from-calendar', { body, fallback: 'The calendar tasks could not be posted' });
    return { posted: Number(d?.posted ?? 0), assigned: Number(d?.assigned ?? 0), byReviewer: (d?.by_reviewer ?? {}) as Record<string, number>, toPoster: Number(d?.to_poster ?? 0) };
  }

  async deleteTemplate(id: number): Promise<void> {
    await this.api.delete(`/api/templates/${id}`, { fallback: 'Failed to delete template' });
  }
}
