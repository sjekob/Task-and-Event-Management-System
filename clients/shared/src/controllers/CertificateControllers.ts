import { BaseController } from './BaseController';
import { Services, FilePart } from '../services';
import { CertificateCheck, CertificateFile, CertificateSet, CertificationCatalogItem } from '../models';

export const CERT_MAX_BYTES = 10 * 1024 * 1024;
export const CERT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

/**
 * A person's certifications with their credibility. The owner uploads
 * certificates (canUpload); the principal/registrar verifies or rejects them
 * (canReview). userId null means the signed-in person.
 */
export class CertificatesController extends BaseController<{ set: CertificateSet | null; error: string | null; uploading: boolean }> {
  constructor(
    private readonly services: Services,
    readonly userId: number | null,
    readonly canUpload: boolean,
    readonly canReview: boolean,
    private readonly onChanged?: () => void,
  ) {
    super({ set: null, error: null, uploading: false });
    void this.load();
  }

  async load() {
    try {
      this.setState({ set: await this.services.certificates.list(this.userId), error: null });
    } catch (e) {
      this.setState({ error: BaseController.messageOf(e) });
    }
  }

  changed() {
    void this.load();
    this.onChanged?.();
  }

  /** Uploads and reads a certificate; returns the analysis to show. Throws a readable error. */
  async upload(file: FilePart & { size?: number }): Promise<CertificateFile> {
    if ((file.size ?? file.blob?.size ?? 0) > CERT_MAX_BYTES) throw new Error('The file is larger than 10 MB.');
    this.setState({ uploading: true });
    try {
      return await this.services.certificates.analyze(file);
    } finally {
      this.setState({ uploading: false });
      this.changed();
    }
  }

  async remove(c: CertificateFile) {
    await this.services.certificates.remove(c.id!);
    this.changed();
  }

  get intro(): string {
    return this.canUpload
      ? 'Upload a PDF or photo of each certificate. It is read and checked automatically, then verified by the principal or registrar. Verified certificates count most when you are suggested for tasks.'
      : 'Certificates count toward task suggestions by how credible they are.';
  }

  get emptyText(): string {
    return this.canUpload ? 'No certificates yet. Upload one to be suggested for matching tasks.' : 'No certificates on file.';
  }

  actionLabel(c: CertificateFile): string {
    return this.canReview && c.status === 'submitted' ? 'Review' : 'Details';
  }

  static displayTitle(c: CertificateFile): string {
    return c.title ?? c.detectedTitle ?? c.originalName ?? 'Unidentified certificate';
  }

  static subtitle(c: CertificateFile): string {
    return [c.issuerLabel, c.category].filter(Boolean).join(' · ');
  }

  static isDuplicate(c: CertificateFile): boolean {
    return c.checks.some((k) => k.key === 'duplicate' && k.status === 'fail');
  }

  /** Banner shown above the facts. */
  static authenticityBanner(c: CertificateFile): { tone: 'green' | 'amber' | 'red'; icon: 'copy' | 'ok' | 'shield' | 'maybe'; title: string; text: string } {
    if (CertificatesController.isDuplicate(c)) {
      return { tone: 'red', icon: 'copy', title: "Already on someone else's profile", text: "This exact file was uploaded by another person, so it can't be added." };
    }
    switch (c.authenticity) {
      case 'high': return { tone: 'green', icon: 'ok', title: 'Looks authentic', text: 'The certificate passed the automated checks. The principal or registrar still verifies it.' };
      case 'medium': return { tone: 'amber', icon: 'shield', title: 'Partly confirmed', text: "Some details couldn't be confirmed automatically. Review the checks below." };
      default: return { tone: 'red', icon: 'maybe', title: 'Doubtful', text: 'Several checks failed. It will count little until the principal or registrar verifies it.' };
    }
  }

  static checkTone(k: CertificateCheck): 'green' | 'amber' | 'red' | 'gray' {
    return k.status === 'pass' ? 'green' : k.status === 'warn' ? 'amber' : k.status === 'fail' ? 'red' : 'gray';
  }
}

/** The analysis of a freshly uploaded certificate; the owner confirms or discards it. */
export class CertificateResultController extends BaseController<{
  catalog: CertificationCatalogItem[]; selectedId: number | null; busy: boolean; error: string | null;
}> {
  constructor(private readonly services: Services, readonly cert: CertificateFile) {
    super({ catalog: [], selectedId: cert.certificationId, busy: false, error: null });
    services.certificates.catalog().then((catalog) => this.setState({ catalog })).catch(() => undefined);
  }

  get duplicate() { return CertificatesController.isDuplicate(this.cert); }
  get selected() { return this.state.catalog.find((x) => x.id === this.state.selectedId) ?? null; }

  select(id: number | null) { this.setState({ selectedId: id }); }

  get facts(): { label: string; value: string }[] {
    const sel = this.selected;
    const c = this.cert;
    const desc = sel ? sel.description : c.description;
    const category = sel?.category ?? c.category;
    return [
      { label: 'Title', value: sel?.name ?? c.title ?? 'Not identified — choose it below' },
      { label: 'Issued by', value: sel?.issuer ?? c.issuerLabel ?? 'Issuer not recognized' },
      { label: 'What it is', value: desc || '—' },
      ...(category ? [{ label: 'Category', value: category }] : []),
    ];
  }

  get canAdd() { return !this.state.busy && !this.duplicate && this.state.selectedId !== null; }

  async add(): Promise<boolean> {
    if (this.state.selectedId === null) return false;
    this.setState({ busy: true, error: null });
    try {
      await this.services.certificates.confirm(this.cert.id!, this.state.selectedId);
      return true;
    } catch (e) {
      this.setState({ busy: false, error: BaseController.messageOf(e) });
      return false;
    }
  }

  async discard() {
    this.setState({ busy: true });
    try { await this.services.certificates.remove(this.cert.id!); } catch { /* already gone */ }
  }
}

/** A certificate on someone's profile; the principal/registrar verifies or rejects it. */
export class CertificateReviewController extends BaseController<{ note: string; busy: boolean; opening: boolean; error: string | null }> {
  constructor(private readonly services: Services, readonly cert: CertificateFile, readonly canReview: boolean) {
    super({ note: '', busy: false, opening: false, error: null });
  }

  setNote(note: string) { this.setState({ note }); }

  get reviewed() { return this.cert.status === 'verified' || this.cert.status === 'rejected'; }

  get facts(): { label: string; value: string }[] {
    const c = this.cert;
    const out = [
      { label: 'Issued by', value: c.issuerLabel ?? 'Issuer not recognized' },
      { label: 'What it is', value: c.description || '—' },
    ];
    if (c.category) out.push({ label: 'Category', value: c.category });
    if (c.certificateNo) out.push({ label: 'Certificate no.', value: c.certificateNo });
    if (c.dateIssued) out.push({ label: 'Date issued', value: c.dateIssued });
    if (c.expiryDate) out.push({ label: 'Valid until', value: c.expiryDate });
    if (this.reviewed) {
      out.push({
        label: c.status === 'verified' ? 'Verified by' : 'Rejected by',
        value: [c.reviewedByName ?? '—', ...(c.reviewNote ? [`“${c.reviewNote}”`] : [])].join(' — '),
      });
    }
    return out;
  }

  /** The certificate file (needs the token). */
  async file(): Promise<Blob> {
    this.setState({ opening: true, error: null });
    try {
      return await this.services.certificates.file(this.cert.id!);
    } catch (e) {
      this.setState({ error: BaseController.messageOf(e) });
      throw e;
    } finally {
      this.setState({ opening: false });
    }
  }

  async decide(status: 'verified' | 'rejected'): Promise<boolean> {
    if (status === 'rejected' && !this.state.note.trim()) {
      this.setState({ error: 'Give a reason so the owner knows what to fix.' });
      return false;
    }
    this.setState({ busy: true, error: null });
    try {
      await this.services.certificates.review(this.cert.id!, status, this.state.note.trim());
      return true;
    } catch (e) {
      this.setState({ busy: false, error: BaseController.messageOf(e) });
      return false;
    }
  }
}
