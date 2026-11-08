import { BaseController } from './BaseController';
import { Services } from '../services';
import { AttendanceActivity, Json } from '../models';
import { Format } from '../utils/format';
import { GuestStore } from '../utils/guestStore';

export type EvalView = 'loading' | 'locked' | 'error' | 'form' | 'submitted';

export const EVALUATOR_ROLES = ['student', 'parent', 'external stakeholder', 'visitor', 'teacher', 'coordinator', 'dean', 'registrar', 'principal'];
const SEX_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const AGE_GROUPS = ['17 and below', '18-24', '25-34', '35-44', '45-54', '55 and above'];

export interface PublicEvalState {
  view: EvalView;
  message: string;
  event: Json | null;
  name: string;
  email: string;
  role: string;
  sex: string | null;
  ageGroup: string | null;
  affiliation: string;
  comments: string;
  /** Indicator label → Evident (true) / Not evident (false) / unmarked (null). */
  marks: (boolean | null)[];
  submitting: boolean;
  /** Attendee mode: the activity being evaluated. */
  activity: AttendanceActivity | null;
}

/**
 * Reached by scanning an event's QR code, no login. A DepEd observation tool:
 * the indicators come from the event's proposal; each is marked Evident / Not
 * Evident. The backend decides whether the form is open and computes the score.
 *
 * With an [activityIndex] it is a signed-in attendee's evaluation of one
 * Activity Matrix row after Time Out. With a [session] it is a guest's
 * evaluation of that session after their Time Out: their saved details are
 * filled in, and submitting completes their attendance.
 */
export class PublicEvaluationController extends BaseController<PublicEvalState> {
  constructor(private readonly services: Services, readonly eventId: string, readonly activityIndex: number | null = null,
    readonly session: number | null = null) {
    const g = session !== null ? GuestStore.load()?.guest : null;
    super({
      view: 'loading', message: '', event: null, name: g?.name ?? '', email: g?.email ?? '', role: g?.role || 'student',
      sex: g?.sex || null, ageGroup: g?.age_group || null, affiliation: g?.affiliation ?? '',
      comments: '', marks: [], submitting: false, activity: null,
    });
  }

  get isAttendee(): boolean { return this.activityIndex !== null; }
  /** A guest's evaluation of one session, after their Time Out. */
  get isGuestSession(): boolean { return this.session !== null; }

  async load() {
    this.setState({ view: 'loading' });
    try {
      // A guest's session evaluation opens by their attendance, not the event date.
      const email = this.session !== null ? GuestStore.load()?.guest.email : undefined;
      const event = await this.services.appraisal.publicEvent(this.eventId, this.session !== null && email ? { session: this.session, email } : undefined);
      const indicators: string[] = Array.isArray(event.indicators) ? event.indicators.map(String) : [];
      let lock: string | null = event.is_open === true ? null : String(event.lock_reason ?? 'This event is not open for evaluation yet.');
      let activity: AttendanceActivity | null = null;
      if (this.activityIndex !== null) {
        // Attendance, not the public date gate, decides whether an attendee may evaluate.
        activity = await this.services.events.attendanceActivity(Number(this.eventId), this.activityIndex);
        // The evaluation is the Time Out: open from the activity's end until midnight.
        lock = activity.evaluation_lock ?? null;
      }
      this.setState(lock === null
        ? { event, activity, marks: indicators.map(() => null), view: 'form' }
        : { event, activity, view: 'locked', message: lock });
    } catch (e) {
      this.setState({ view: 'error', message: BaseController.messageOf(e) });
    }
  }

  get indicators(): string[] {
    const ind = this.state.event?.indicators;
    return Array.isArray(ind) ? ind.map(String) : [];
  }

  options(key: 'sex' | 'age_group'): string[] {
    const o = this.state.event?.demographic_options?.[key];
    return Array.isArray(o) ? o.map(String) : key === 'sex' ? SEX_OPTIONS : AGE_GROUPS;
  }

  get details(): string {
    const e = this.state.event ?? {};
    return [
      e.target_date ? `Date: ${e.target_date}` : '',
      e.organizer_name ? `Organizer: ${e.organizer_name}` : '',
      e.venue ? `Venue: ${e.venue}` : '',
    ].filter(Boolean).join('  ·  ');
  }

  set(patch: Partial<Pick<PublicEvalState, 'email' | 'role' | 'sex' | 'ageGroup' | 'affiliation' | 'comments'>>) { this.setState(patch); }
  setName(name: string) { this.setState({ name: Format.titleCase(name) }); }

  mark(i: number, evident: boolean) {
    this.setState((s) => ({ marks: s.marks.map((m, j) => (j === i ? evident : m)) }));
  }

  /** Submits; returns an error message, or null on success. */
  async submit(): Promise<string | null> {
    const s = this.state;
    if (!this.isAttendee && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email.trim())) return 'Please enter a valid email address.';
    if (!s.sex || !s.ageGroup) return 'Please select your sex and age group.';
    if (s.marks.some((m) => m === null)) return 'Please mark every indicator as Evident or Not Evident.';
    this.setState({ submitting: true });
    try {
      const common = {
        sex: s.sex,
        age_group: s.ageGroup,
        affiliation: s.affiliation.trim() || null,
        indicators: this.indicators.map((label, i) => ({ label, evident: s.marks[i] })),
        comments: s.comments.trim() || null,
      };
      if (this.activityIndex !== null) {
        await this.services.events.evaluateActivity(Number(this.eventId), this.activityIndex, common);
      } else {
        await this.services.appraisal.submitPublicEvaluation(this.eventId, {
          ...common, evaluator_name: s.name.trim() || null, evaluator_email: s.email.trim(), evaluator_role: s.role,
          ...(this.session !== null ? { activity_index: this.session } : {}),
        });
        const stored = this.session !== null ? GuestStore.load()?.guest : null;
        if (stored) {
          GuestStore.save({ ...stored, name: s.name.trim() || stored.name, email: s.email.trim().toLowerCase(), role: s.role,
            sex: s.sex, age_group: s.ageGroup, affiliation: s.affiliation.trim() || null });
        }
      }
      this.setState({ view: 'submitted', submitting: false });
      return null;
    } catch (e) {
      this.setState({ submitting: false });
      return BaseController.messageOf(e);
    }
  }
}
