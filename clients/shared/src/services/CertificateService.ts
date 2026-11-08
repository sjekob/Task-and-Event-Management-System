import { ApiClient, FilePart } from './ApiClient';
import { CertificateFile, CertificateSet, CertificationCatalogItem, Json } from '../models';

/** Certificate uploads: the server reads the file, checks it, and the registrar reviews it. */
export class CertificateService {
  constructor(private readonly api: ApiClient) {}

  async catalog(): Promise<CertificationCatalogItem[]> {
    const rows = await this.api.get<Json[]>('/api/certificates/catalog', { fallback: 'Failed to load certifications' });
    return rows.map(CertificationCatalogItem.fromJson);
  }

  /** [userId] null: the signed-in person's own certificates. */
  async list(userId?: number | null): Promise<CertificateSet> {
    const path = userId == null ? 'mine' : `user/${userId}`;
    return CertificateSet.fromJson(await this.api.get(`/api/certificates/${path}`, { fallback: 'Failed to load certificates' }));
  }

  /** Upload a certificate PDF/photo; the server reads and checks it. */
  async analyze(file: FilePart): Promise<CertificateFile> {
    const d = await this.api.upload('/api/certificates/analyze', file, {
      timeoutMs: 90000,
      ok: [201, 200],
      fallback: 'Could not read the certificate',
    });
    return CertificateFile.fromJson(d);
  }

  async confirm(id: number, certificationId: number): Promise<CertificateFile> {
    return CertificateFile.fromJson(
      await this.api.post(`/api/certificates/${id}/confirm`, { body: { certification_id: certificationId }, fallback: 'Could not add the certificate' }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/api/certificates/${id}`, { fallback: 'Could not remove the certificate' });
  }

  async review(id: number, status: 'verified' | 'rejected' | 'submitted', note?: string): Promise<CertificateFile> {
    return CertificateFile.fromJson(
      await this.api.patch(`/api/certificates/${id}/review`, {
        body: { status, ...(note ? { note } : {}) },
        fallback: 'Could not save the review',
      }),
    );
  }

  /** The certificate file itself (needs the token, so it can't be a plain link). */
  file(id: number): Promise<Blob> {
    return this.api.blob(`/api/certificates/${id}/file`, 'Could not open the certificate');
  }

  /** Authenticated URL parts, for platforms that download with headers (mobile). */
  async fileRequest(id: number): Promise<{ url: string; headers: Record<string, string> }> {
    const t = await this.api.getToken();
    return { url: this.api.url(`/api/certificates/${id}/file`), headers: t ? { Authorization: `Bearer ${t}` } : {} };
  }
}
