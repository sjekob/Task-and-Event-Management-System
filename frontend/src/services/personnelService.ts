import { Json, PageResult, User, pageResultFromJson } from '../models/models';
import { ApiService } from './apiService';

export class PersonnelService {
  static async list(search = ''): Promise<User[]> {
    const res = await ApiService.call('GET', `/api/personnel?search=${encodeURIComponent(search)}`);
    if (res.statusCode === 200) return (JSON.parse(res.body) as Json[]).map(User.fromJson);
    throw new Error('Failed to load personnel');
  }

  /// One page of personnel (infinite scroll).
  static async listPage(opts: { search?: string; limit?: number; offset?: number } = {}): Promise<PageResult<User>> {
    const { search = '', limit = 30, offset = 0 } = opts;
    const res = await ApiService.call(
      'GET',
      `/api/personnel?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`,
    );
    if (res.statusCode === 200) return pageResultFromJson(JSON.parse(res.body) as Json, User.fromJson);
    throw new Error('Failed to load personnel');
  }

  static async create(data: Json): Promise<User> {
    const res = await ApiService.call('POST', '/api/personnel', data);
    if (res.statusCode === 201) return User.fromJson(JSON.parse(res.body));
    throw new Error((JSON.parse(res.body) as Json).detail ?? 'Failed to create');
  }

  static async update(id: number, data: Json): Promise<User> {
    const res = await ApiService.call('PUT', `/api/personnel/${id}`, data);
    if (res.statusCode === 200) return User.fromJson(JSON.parse(res.body));
    throw new Error((JSON.parse(res.body) as Json).detail ?? 'Failed to update');
  }

  static async updateSubjects(id: number, subjects: Json[]): Promise<void> {
    const res = await ApiService.call('PUT', `/api/personnel/${id}/subjects`, { subjects });
    if (res.statusCode !== 200) {
      throw new Error((JSON.parse(res.body) as Json).detail ?? 'Failed to update subjects');
    }
  }

  static async toggleStatus(id: number): Promise<void> {
    const res = await ApiService.call('PATCH', `/api/personnel/${id}/status`);
    if (res.statusCode !== 200) throw new Error('Failed to update status');
  }

  private static async meta(path: string): Promise<Json[]> {
    const res = await ApiService.call('GET', path);
    if (res.statusCode === 200) return JSON.parse(res.body) as Json[];
    return [];
  }

  static gradeLevelsMeta = (): Promise<Json[]> => this.meta('/api/personnel/meta/grade-levels');

  static subjectsMeta = (): Promise<Json[]> => this.meta('/api/personnel/meta/subjects');

  /// Skill catalog: [{id, skill_name, category_name}].
  static skillsMeta = (): Promise<Json[]> => this.meta('/api/personnel/meta/skills');

  /// Certification catalog: [{id, cert_name, category_name, issuer_name, acronym}].
  static certificationsMeta = (): Promise<Json[]> => this.meta('/api/personnel/meta/certifications');

  /// DepEd dropdown options: {highest_attainment, undergraduate_degree, specialization}.
  static async educationOptions(): Promise<Record<string, string[]>> {
    const res = await ApiService.call('GET', '/api/personnel/meta/education-options');
    if (res.statusCode === 200) {
      const m = JSON.parse(res.body) as Record<string, unknown[]>;
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(m)) out[k] = v.map((e) => String(e));
      return out;
    }
    return {};
  }

  static departmentsMeta = (): Promise<Json[]> => this.meta('/api/personnel/meta/departments');

  static async createDepartment(name: string): Promise<Json | null> {
    const res = await ApiService.call('POST', '/api/personnel/departments', { department_name: name });
    if (res.statusCode === 201) return JSON.parse(res.body) as Json;
    return null;
  }
}
