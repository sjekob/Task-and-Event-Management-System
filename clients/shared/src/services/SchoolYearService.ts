import { ApiClient } from './ApiClient';
import { Json, SchoolYear } from '../models';

export class SchoolYearService {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<SchoolYear[]> {
    const rows = await this.api.get<Json[]>('/api/school-years', { fallback: 'Failed to load school years' });
    return rows.map(SchoolYear.fromJson);
  }

  async save(body: Json, id?: number | null): Promise<void> {
    if (id != null) await this.api.put(`/api/school-years/${id}`, { body, fallback: 'Could not save the school year' });
    else await this.api.post('/api/school-years', { body, fallback: 'Could not save the school year' });
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/api/school-years/${id}`, { fallback: 'Could not delete the school year' });
  }
}
