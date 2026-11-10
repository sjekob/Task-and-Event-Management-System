import { ApiClient, FilePart } from './ApiClient';
import { EventForAppraisal, Json, PerformanceSummary, SchoolYearFilter, SpecialTask } from '../models';

export class AppraisalService {
  constructor(private readonly api: ApiClient) {}

  async specialTasks(filter = SchoolYearFilter.current): Promise<SpecialTask[]> {
    const rows = await this.api.get<Json[]>('/api/appraisal/special-tasks', { query: filter.query, fallback: 'Failed to load special tasks' });
    return rows.map(SpecialTask.fromJson);
  }

  async evaluateSpecialTask(taskId: number, scores: Json): Promise<SpecialTask> {
    return SpecialTask.fromJson(
      await this.api.post(`/api/appraisal/special-tasks/${taskId}/evaluate`, { body: scores, fallback: 'Failed to evaluate task' }),
    );
  }

  /** Rows for the Annual Faculty Performance Summary export (aggregated by the server). */
  async performanceSummary(filter = SchoolYearFilter.current): Promise<PerformanceSummary> {
    return PerformanceSummary.fromJson(await this.api.get('/api/appraisal/performance-summary', { query: filter.query, fallback: 'Failed to generate the performance summary' }));
  }

  reportSubmissions(filter = SchoolYearFilter.current): Promise<Json[]> {
    return this.api.get('/api/appraisal/report-submissions', { query: filter.query, fallback: 'Failed to load report submissions' });
  }

  async events(filter = SchoolYearFilter.current): Promise<EventForAppraisal[]> {
    const rows = await this.api.get<Json[]>('/api/appraisal/events', { query: filter.query, fallback: 'Failed to load events' });
    return rows.map(EventForAppraisal.fromJson);
  }

  /** Records a paper evaluation form: its ratings and details, with a photo or scan of it. */
  async submitPaperEvaluation(eventId: number, fields: Record<string, string>, image: FilePart): Promise<EventForAppraisal> {
    return EventForAppraisal.fromJson(await this.api.upload(`/api/appraisal/events/${eventId}/paper-evaluation`, image, {
      field: 'image', fields, ok: [201, 200], timeoutMs: 120000, fallback: 'Failed to record the paper evaluation',
    }));
  }

  async evaluateEvent(eventId: number, body: Json): Promise<EventForAppraisal> {
    return EventForAppraisal.fromJson(
      await this.api.post(`/api/appraisal/events/${eventId}/evaluate`, { body, ok: [201, 200], fallback: 'Failed to submit evaluation' }),
    );
  }

  // ── Public evaluation (QR code, no login) ──
  /** [guest]: a guest's evaluation of one session (open once that email has timed out of it). */
  publicEvent(eventId: string, guest?: { session: number; email: string }): Promise<Json> {
    return this.api.get(`/api/appraisal/public/events/${eventId}`, { query: guest, anonymous: true, fallback: 'Event not found.' });
  }

  async submitPublicEvaluation(eventId: string, body: Json): Promise<void> {
    await this.api.post(`/api/appraisal/public/events/${eventId}/evaluate`, {
      body, anonymous: true, ok: [201, 200], fallback: 'Failed to submit evaluation.',
    });
  }
}
