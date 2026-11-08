import { ApiClient } from './ApiClient';
import { DepedEntry, Json } from '../models';

/** The DepEd school-calendar reference layer (server: routes/deped_calendar.py). */
export class DepedCalendarService {
  constructor(private readonly api: ApiClient) {}

  /** Entries overlapping [start, end] (ISO dates), or all of them. */
  async list(start?: string, end?: string): Promise<DepedEntry[]> {
    const rows = await this.api.get<Json[]>('/api/deped-calendar', { query: { start, end }, fallback: 'Could not load the DepEd calendar' });
    return rows.map(DepedEntry.fromJson);
  }

  /** Principal/admin. Creates when [id] is null. */
  async save(id: number | null, body: Json): Promise<DepedEntry> {
    const d = id === null
      ? await this.api.post('/api/deped-calendar', { body, ok: [201, 200], fallback: 'Could not save the DepEd calendar entry' })
      : await this.api.put(`/api/deped-calendar/${id}`, { body, fallback: 'Could not save the DepEd calendar entry' });
    return DepedEntry.fromJson(d);
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/api/deped-calendar/${id}`, { fallback: 'Could not remove the DepEd calendar entry' });
  }

  /** One mandatory compliance task for every active faculty member in [roles]. Returns how many got it. */
  async generateTasks(id: number, body: { title: string; instructions?: string | null; due_date?: string | null; due_time?: string | null; roles: string[] }): Promise<number> {
    const d: Json = await this.api.post(`/api/deped-calendar/${id}/generate-tasks`, { body, ok: [201, 200], fallback: 'Could not generate the tasks' });
    return Number(d?.assigned ?? 0) || 0;
  }
}
