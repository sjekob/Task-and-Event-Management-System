import { Json, JsonReader as R } from './json';

/** A certification held by a person, with its category and accrediting body. */
export class CertificationInfo {
  constructor(
    readonly name: string,
    readonly category: string | null = null,
    readonly issuer: string | null = null,
    readonly issuerAcronym: string | null = null,
    /** verified | submitted (awaiting review). */
    readonly credibility: string = 'submitted',
    /** Result of the automated checks on the uploaded file: high | medium | low. */
    readonly authenticity: string | null = null,
  ) {}

  static fromJson(j: Json): CertificationInfo {
    return new CertificationInfo(
      R.str(j.name),
      R.optStr(j.category),
      R.optStr(j.issuer),
      R.optStr(j.issuer_acronym),
      R.str(j.credibility, 'submitted'),
      R.optStr(j.authenticity),
    );
  }

  /** Short issuer label, e.g. "PRC" or "Philippine Red Cross". */
  get issuerLabel(): string | null {
    return this.issuerAcronym ?? this.issuer;
  }
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

/** One automated check run on an uploaded certificate. */
export class CertificateCheck {
  constructor(
    readonly key: string,
    readonly label: string,
    readonly status: CheckStatus,
    readonly detail: string,
  ) {}

  static fromJson(j: Json): CertificateCheck {
    return new CertificateCheck(R.str(j.key), R.str(j.label), R.str(j.status, 'info') as CheckStatus, R.str(j.detail));
  }
}

/**
 * An uploaded certificate (PDF/photo), what was read from it and its review
 * state. Self-declared certifications (listed without a file) have no id.
 */
export class CertificateFile {
  constructor(
    readonly id: number | null,
    readonly certificationId: number | null,
    readonly title: string | null,
    readonly detectedTitle: string | null,
    readonly issuer: string | null,
    readonly issuerAcronym: string | null,
    readonly category: string | null,
    readonly description: string,
    readonly originalName: string | null,
    readonly mime: string | null,
    /** high | medium | low */
    readonly authenticity: string | null,
    /** pending | submitted | verified | rejected */
    readonly status: string,
    readonly checks: CertificateCheck[],
    readonly reviewNote: string | null,
    readonly reviewedByName: string | null,
    readonly certificateNo: string | null,
    readonly dateIssued: string | null,
    readonly expiryDate: string | null,
  ) {}

  static fromJson(j: Json): CertificateFile {
    return new CertificateFile(
      R.optNum(j.id),
      R.optNum(j.certification_id),
      R.optStr(j.title),
      R.optStr(j.detected_title),
      R.optStr(j.issuer),
      R.optStr(j.issuer_acronym),
      R.optStr(j.category),
      R.str(j.description),
      R.optStr(j.original_name),
      R.optStr(j.mime),
      R.optStr(j.authenticity),
      R.str(j.status, 'pending'),
      R.list(j.checks, CertificateCheck.fromJson),
      R.optStr(j.review_note),
      R.optStr(j.reviewed_by_name),
      R.optStr(j.certificate_no),
      R.optStr(j.date_issued),
      R.optStr(j.expiry_date),
    );
  }

  get issuerLabel(): string | null {
    return this.issuer ?? this.issuerAcronym;
  }

  get isImage(): boolean {
    return (this.mime ?? '').startsWith('image/');
  }
}

/** A person's certificates, and uploads still waiting for the owner to confirm. */
export class CertificateSet {
  constructor(readonly certificates: CertificateFile[] = [], readonly pending: CertificateFile[] = []) {}

  static fromJson(j: Json): CertificateSet {
    return new CertificateSet(R.list(j.certificates, CertificateFile.fromJson), R.list(j.pending, CertificateFile.fromJson));
  }

  get isEmpty() {
    return this.certificates.length === 0 && this.pending.length === 0;
  }
}

/** A catalog certification that an upload can be identified as. */
export class CertificationCatalogItem {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly category: string | null,
    readonly issuer: string | null,
    readonly description: string,
  ) {}

  static fromJson(j: Json): CertificationCatalogItem {
    return new CertificationCatalogItem(
      R.num(j.id),
      R.str(j.cert_name),
      R.optStr(j.category_name),
      R.optStr(j.issuer_name ?? j.acronym),
      R.str(j.description),
    );
  }
}
