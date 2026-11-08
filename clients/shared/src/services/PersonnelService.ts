import { ApiClient, FilePart } from './ApiClient';
import { Json, PageResult, Section, User } from '../models';

export interface CatalogEntry { id: number; name: string; category: string | null; issuer?: string | null }
export interface GradeLevelMeta { id: number; name: string }
export interface SubjectMeta { id: number; name: string }

/** Personnel records (registrar / principal / admin) and the signed-in person's own profile. */
export class PersonnelService {
  constructor(private readonly api: ApiClient) {}

  async page(opts: { search?: string; limit?: number; offset?: number } = {}): Promise<PageResult<User>> {
    const data = await this.api.get<Json>('/api/personnel', {
      query: { search: opts.search ?? '', limit: opts.limit ?? 30, offset: opts.offset ?? 0 },
      fallback: 'Failed to load personnel',
    });
    return PageResult.fromJson(data, User.fromJson);
  }

  async get(id: number): Promise<User> {
    return User.fromJson(await this.api.get(`/api/personnel/${id}`, { fallback: 'User not found' }));
  }

  async create(body: Json): Promise<User> {
    return User.fromJson(await this.api.post('/api/personnel', { body, ok: [201, 200], fallback: 'Failed to create personnel' }));
  }

  async update(id: number, body: Json): Promise<User> {
    return User.fromJson(await this.api.put(`/api/personnel/${id}`, { body, fallback: 'Failed to update personnel' }));
  }

  async updateSubjects(id: number, subjects: { subject_id?: number; subject?: string; grade_level_id?: number | null; section_ids?: number[] }[]): Promise<void> {
    await this.api.put(`/api/personnel/${id}/subjects`, { body: { subjects }, fallback: 'Failed to update subjects' });
  }

  /** Makes the person the adviser of [sectionId], or of no section (null). */
  async setAdvisory(id: number, sectionId: number | null): Promise<void> {
    await this.api.put(`/api/personnel/${id}/advisory`, { body: { section_id: sectionId }, fallback: 'Failed to update the advisory class' });
  }

  // ── Sections ──
  async sections(): Promise<Section[]> {
    const rows = await this.api.get('/api/personnel/sections', { fallback: 'Failed to load sections' });
    return Array.isArray(rows) ? rows.map(Section.fromJson) : [];
  }

  async saveSection(id: number | null, name: string, gradeLevelId: number): Promise<Section> {
    const body = { name, grade_level_id: gradeLevelId };
    return Section.fromJson(id === null
      ? await this.api.post('/api/personnel/sections', { body, fallback: 'Failed to add the section' })
      : await this.api.put(`/api/personnel/sections/${id}`, { body, fallback: 'Failed to update the section' }));
  }

  async deleteSection(id: number): Promise<void> {
    await this.api.delete(`/api/personnel/sections/${id}`, { fallback: 'Failed to remove the section' });
  }

  async toggleStatus(id: number): Promise<void> {
    await this.api.patch(`/api/personnel/${id}/status`, { fallback: 'Failed to update status' });
  }

  // ── Catalogs ──
  async gradeLevels(): Promise<GradeLevelMeta[]> {
    const rows = await this.safe<Json[]>('/api/personnel/meta/grade-levels');
    return rows.map((r) => ({ id: Number(r.id), name: String(r.grade_name ?? r.name ?? r.grade_level ?? '') }));
  }

  async subjects(): Promise<SubjectMeta[]> {
    const rows = await this.safe<Json[]>('/api/personnel/meta/subjects');
    return rows.map((r) => ({ id: Number(r.id), name: String(r.subject_name ?? r.name ?? r.subject ?? '') }));
  }

  async skillCatalog(): Promise<CatalogEntry[]> {
    const rows = await this.safe<Json[]>('/api/personnel/meta/skills');
    return rows.map((r) => ({ id: Number(r.id), name: String(r.skill_name ?? ''), category: r.category_name ?? null }));
  }

  async certificationCatalog(): Promise<CatalogEntry[]> {
    const rows = await this.safe<Json[]>('/api/personnel/meta/certifications');
    return rows.map((r) => ({
      id: Number(r.id), name: String(r.cert_name ?? ''), category: r.category_name ?? null, issuer: r.acronym ?? r.issuer_name ?? null,
    }));
  }

  /** DepEd dropdown options: {highest_attainment, undergraduate_degree, specialization}. */
  async educationOptions(): Promise<Record<string, string[]>> {
    const m = await this.safe<Json>('/api/personnel/meta/education-options', {});
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(m)) out[k] = Array.isArray(v) ? v.map(String) : [];
    return out;
  }

  /** Subject names (GET /api/subjects). */
  subjectNames(): Promise<string[]> {
    return this.safe<string[]>('/api/subjects');
  }

  async gradeLevelNames(): Promise<Json[]> {
    return this.safe<Json[]>('/api/grade-levels');
  }

  async users(): Promise<User[]> {
    const data = await this.api.get<Json[]>('/api/users', { fallback: 'Failed to load users' });
    return data.map(User.fromJson);
  }

  // ── Own profile ──
  async myProfile(): Promise<User> {
    return User.fromJson(await this.api.get('/api/users/me/profile', { fallback: 'Failed to load profile' }));
  }

  async updateMyProfile(body: Json): Promise<void> {
    await this.api.put('/api/users/me/profile', { body, fallback: 'Failed to update profile' });
  }

  /** Upload the signed-in person's profile photo; returns its path. */
  async uploadAvatar(file: FilePart): Promise<string> {
    const d = await this.api.upload('/api/users/me/avatar', file, { fallback: 'Could not upload the photo' });
    return d.avatar_url;
  }

  async removeAvatar(): Promise<void> {
    await this.api.delete('/api/users/me/avatar', { fallback: 'Could not remove the photo' });
  }

  /** Server path of the kept full photo behind the avatar (null if none). */
  async avatarSource(): Promise<string | null> {
    const d = await this.api.get('/api/users/me/avatar', { fallback: 'Could not load the photo' });
    return d?.source_url ?? null;
  }

  /** Re-crop the avatar: fractions of the full photo (see PhotoCrop). */
  async setAvatarPosition(left: number, top: number, size: number): Promise<void> {
    await this.api.put('/api/users/me/avatar/position', { body: { left, top, size }, fallback: 'Could not save the position' });
  }

  private async safe<T>(path: string, empty: any = []): Promise<T> {
    try {
      return (await this.api.get<T>(path)) ?? empty;
    } catch {
      return empty;
    }
  }
}
