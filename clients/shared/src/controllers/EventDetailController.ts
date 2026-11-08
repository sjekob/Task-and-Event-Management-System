import { BaseController } from './BaseController';
import { Services } from '../services';
import { approvalMessage } from '../services/EventService';
import { AttendanceList, EventItem, EventReview, User } from '../models';

export type SendBack = 'rejected' | 'revisions_requested';

export interface EventDetailState {
  event: EventItem | null;
  loading: boolean;
  error: string | null;
  /** Who scanned the attendance QR codes (proponent / approver, once approved). */
  attendance: AttendanceList | null;
  attendanceError: string | null;
}

/** How each review decision is shown. */
export const REVIEW_DECISION: Record<EventReview['decision'], { label: string; tone: 'green' | 'orange' | 'red' }> = {
  approved: { label: 'Approved', tone: 'green' },
  revisions_requested: { label: 'Revisions requested', tone: 'orange' },
  rejected: { label: 'Rejected', tone: 'red' },
};

/** The Reject / Request revisions dialog's wording. */
export const SEND_BACK: Record<SendBack, { title: string; label: string; hint: string; placeholder: string; confirm: string }> = {
  rejected: {
    title: 'Reject proposal', label: 'Reason for rejecting', confirm: 'Reject proposal',
    hint: 'The proposal goes back to the proponent as rejected. They can still revise it and submit it again.',
    placeholder: 'e.g. The date overlaps the Quarter 2 examinations, and the budget has no source of fund.',
  },
  revisions_requested: {
    title: 'Request revisions', label: 'What should be revised?', confirm: 'Request revisions',
    hint: 'The proposal goes back to the proponent to revise and resubmit.',
    placeholder: 'e.g. Add the speakers to the Activity Matrix and itemize the snacks budget.',
  },
};

/**
 * One event's page: the full proposal (with its review history), what the
 * signed-in person may do with it, and its attendance list. Reloaded every
 * 30 seconds while open (see useLiveRefresh), so approvals and scans show up.
 */
export class EventDetailController extends BaseController<EventDetailState> {
  constructor(private readonly services: Services, private readonly user: User | null, readonly eventId: number, initial: EventItem | null = null) {
    super({ event: initial, loading: !initial, error: null, attendance: null, attendanceError: null });
  }

  async load() {
    const event = await this.services.events.get(this.eventId);
    if (!event) {
      if (!this.state.event) this.setState({ loading: false, error: 'This event is no longer available.' });
      return;
    }
    this.setState({ event, loading: false, error: null });
    if (this.actions.attendanceList) {
      try {
        this.setState({ attendance: await this.services.events.attendanceList(this.eventId), attendanceError: null });
      } catch (e) {
        this.setState({ attendanceError: BaseController.messageOf(e) });
      }
    }
  }

  private get canApprove() { return this.user?.can('approve_events') ?? false; }
  private get canManage() { return this.user?.can('manage_events') ?? false; }
  private get isOwner() { return !!this.state.event && this.state.event.createdBy === this.user?.id; }

  /** What the signed-in person may do; the server enforces each of these too. */
  get actions() {
    const e = this.state.event;
    const pending = !!e?.isPending;
    return {
      approve: this.canApprove && pending,
      sendBack: this.canApprove && pending,
      /** Oversight-only accounts (they approve but don't propose) may disable a pending proposal. */
      disable: this.canApprove && !this.canManage && pending,
      edit: !!e && this.canManage && this.isOwner && (pending || e.isDraft || e.isReturned),
      /** Attendance QR codes: once approved, for the proponent or an approver. */
      qr: !!e?.isApproved && (this.canApprove || this.isOwner),
      attendanceList: !!e?.isLive && (this.canApprove || this.isOwner),
    };
  }

  async approve(): Promise<string> {
    const msg = approvalMessage(await this.services.events.approve(this.eventId));
    await this.load();
    return msg;
  }

  async sendBack(decision: SendBack, comment: string): Promise<string> {
    const msg = await this.services.events.sendBack(this.eventId, decision, comment);
    await this.load();
    return msg;
  }

  async disable() {
    await this.services.events.disable(this.eventId);
    await this.load();
  }

  /** Attendees of one session, and how many scans came from guests. */
  get attendanceSummary(): { total: number; guests: number } {
    const a = this.state.attendance?.attendees ?? [];
    return { total: a.length, guests: a.filter((x) => x.is_guest).length };
  }

  /** "1:42 PM" from a school-local "YYYY-MM-DD HH:MM:SS" (scan times are stored in school time). */
  static clock(raw: string | null): string {
    const m = raw ? /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(raw) : null;
    if (!m) return '—';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  /** A review's time, shown in local time (server timestamps are UTC). */
  static when(raw: string): string {
    const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  /** "Open in OpenStreetMap" for a pinned venue. */
  static mapLink(lat: number, lng: number): string {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  }
}
