import { Json, JsonReader as R } from './json';

export type EventStatus = 'draft' | 'pending_approval' | 'approved' | 'disabled'
  /** sent back by the approver; the proponent revises and resubmits */
  | 'rejected' | 'revisions_requested'
  /** set by the server once an approved event's last session has ended */
  | 'completed' | string;

/** One approver decision on a proposal (newest first on GET /api/events/{id}). */
export interface EventReview {
  id: number;
  decision: 'approved' | 'rejected' | 'revisions_requested';
  comment: string | null;
  createdAt: string;
  reviewerName: string | null;
}

/** A pinned venue: attendance scans are accepted within [radius] metres of it. */
export interface VenuePin { lat: number; lng: number; radius: number }

/** Attendance perimeter around a pinned venue (metres). */
export const DEFAULT_VENUE_RADIUS = 100;
export const VENUE_RADIUS_RANGE = { min: 10, max: 5000 } as const;

/**
 * An event / activity proposal. The proposal body (rationale, objectives,
 * committees, budget, activity matrix, ...) is a large free-form document, so
 * the raw JSON is kept and exposed through typed accessors for the parts the
 * app reads directly.
 */
export class EventItem {
  constructor(readonly raw: Json) {}

  static fromJson(j: Json): EventItem {
    return new EventItem(j);
  }

  get id(): number { return R.num(this.raw.id); }
  get title(): string { return R.str(this.raw.title); }
  get status(): EventStatus { return R.str(this.raw.status, 'pending_approval'); }
  get targetDate(): string | null { return R.optStr(this.raw.target_date ?? this.raw.event_date); }
  get venue(): string | null { return R.optStr(this.raw.venue); }
  get category(): string | null { return R.optStr(this.raw.category); }
  get description(): string | null { return R.optStr(this.raw.description ?? this.raw.rationale); }
  get creatorName(): string | null { return R.optStr(this.raw.creator_name); }
  get createdBy(): number | null { return R.optNum(this.raw.created_by); }
  get participants(): string | null { return R.optStr(this.raw.participants); }
  get isApproved() { return this.status === 'approved'; }
  get isCompleted() { return this.status === 'completed'; }
  /** Approved, still to come or done: on the calendar and in the active lists. */
  get isLive() { return this.isApproved || this.isCompleted; }
  /** Rejected or revisions requested: back with the proponent. */
  get isReturned() { return this.status === 'rejected' || this.status === 'revisions_requested'; }
  /** Off the calendar and the active lists. */
  get isInactive() { return this.isDisabled || this.isDraft || this.isReturned; }

  get venuePin(): VenuePin | null {
    const lat = R.optNum(this.raw.venue_latitude);
    const lng = R.optNum(this.raw.venue_longitude);
    return lat === null || lng === null ? null : { lat, lng, radius: R.optNum(this.raw.venue_radius_m) ?? DEFAULT_VENUE_RADIUS };
  }

  /** Review decisions, newest first (single-event fetch only). */
  get reviews(): EventReview[] {
    return R.list(this.raw.reviews, (r: Json) => ({
      id: R.num(r.id), decision: R.str(r.decision) as EventReview['decision'], comment: R.optStr(r.comment),
      createdAt: R.str(r.created_at), reviewerName: R.optStr(r.reviewer_name),
    }));
  }

  /** The approver's comment behind the current returned status. */
  get latestReturn(): EventReview | null {
    if (!this.isReturned) return null;
    const all = this.reviews;
    return all.find((r) => r.decision === this.status) ?? all[0] ?? null;
  }
  get isPending() { return this.status === 'pending_approval'; }
  get isDisabled() { return this.status === 'disabled'; }
  get isDraft() { return this.status === 'draft'; }

  get statusLabel(): string {
    switch (this.status) {
      case 'approved': return 'Approved';
      case 'pending_approval': return 'Pending approval';
      case 'disabled': return 'Disabled';
      case 'draft': return 'Draft';
      case 'rejected': return 'Rejected';
      case 'revisions_requested': return 'Revisions requested';
      case 'completed': return 'Completed';
      default: return this.status.replace(/_/g, ' ');
    }
  }

  /** Status colour for pills and badges. */
  get statusColor(): string {
    switch (this.status) {
      case 'approved': return '#48bb78';
      case 'disabled': case 'rejected': return '#e53e3e';
      case 'revisions_requested': return '#dd6b20';
      case 'draft': case 'completed': return '#718096';
      default: return '#ed8936';
    }
  }

  /** Parsed target date (see DateText.parseEventDate), null when unclear. */
  get date(): Date | null {
    return parseEventDate(this.targetDate);
  }
}

/**
 * Parses an event's free-text date: ISO "2026-10-20", "October 20, 2026",
 * "Oct. 23, 24 & 28, 2024" (first date). Null when it can't be parsed, so
 * callers must not fall back to "today".
 */
export function parseEventDate(raw: string | null | undefined): Date | null {
  if (!raw || !raw.trim()) return null;
  const t = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const md = /([A-Za-z]{3,9})\.?\s+(\d{1,2})/.exec(t);
  const ym = /(19|20)\d{2}/.exec(t);
  if (md && ym) {
    const mon = months[md[1].toLowerCase().slice(0, 3)];
    const day = Number(md[2]);
    if (mon !== undefined && day) return new Date(Number(ym[0]), mon, day);
  }
  return null;
}

/** Result of GET /api/events/date-check. */
export interface DateCheck {
  available: boolean;
  past?: boolean;
  message?: string;
  conflicts?: Json[];
  /** Non-blocking: the date overlaps a mandatory DepEd calendar entry. */
  deped_warning?: string | null;
  deped_conflicts?: Json[];
}

export class AppNotification {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly message: string,
    /** task | event | comment | general */
    readonly type: string,
    /** Id of the task / event it is about. */
    readonly refId: number | null,
    readonly isRead: boolean,
    readonly createdAt: string,
    readonly raw: Json,
  ) {}

  static fromJson(j: Json): AppNotification {
    return new AppNotification(
      R.num(j.id),
      R.str(j.title),
      R.str(j.message ?? j.body),
      R.str(j.type, 'general'),
      R.optNum(j.ref_id),
      R.bool(j.is_read),
      R.str(j.created_at),
      j,
    );
  }
}
