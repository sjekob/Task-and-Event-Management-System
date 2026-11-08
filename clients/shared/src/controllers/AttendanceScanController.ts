import { BaseController } from './BaseController';
import { Services } from '../services';
import { ATTENDANCE_LABELS, AttendanceAction, AttendanceActivity, AttendanceScanResult, GuestActivity, GuestInfo } from '../models';
import { distanceMeters, insidePerimeter } from '../utils/geo';
import { GuestStore } from '../utils/guestStore';

export type ScanStep = 'loading' | 'guest-form' | 'locating' | 'submitting' | 'done' | 'error' | 'outside' | 'no-location';
export type LocationProblem = 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export interface Fix { latitude: number; longitude: number; accuracy: number | null }

/** The device's position, or why it couldn't be had. [precise]: a pinned venue needs a fresh, precise fix. */
export type Locate = (precise: boolean) => Promise<{ fix: Fix } | { problem: LocationProblem }>;

export interface ScanState {
  step: ScanStep;
  message: string;
  info: AttendanceActivity | GuestActivity | null;
  fix: Fix | null;
  problem: LocationProblem | null;
  /** Guests: their details and Data Privacy consent. */
  guest: GuestInfo;
  consent: boolean;
  formError: string | null;
}

export const LOCATION_HELP: Record<LocationProblem, { title: string; steps: string[] }> = {
  denied: {
    title: 'Location access is blocked',
    steps: [
      'Allow location for this site or app (the lock or settings icon next to the address bar, or the phone\'s app settings).',
      'On a phone, also check that the browser itself may use location (Settings → Apps → your browser → Permissions).',
      'Then tap Try again.',
    ],
  },
  unavailable: { title: "Your location couldn't be found", steps: ["Turn on your phone's Location/GPS.", 'Step outside or near a window if you are deep inside a building.', 'Then tap Try again.'] },
  timeout: { title: 'Finding your location took too long', steps: ['Make sure Location/GPS is on and you have signal.', 'Wait a few seconds, then tap Try again.'] },
  unsupported: { title: "This browser can't share your location", steps: ['Open the QR link in Chrome or Safari instead.'] },
};

const EMPTY_GUEST: GuestInfo = { name: '', email: '', role: 'student', sex: '', age_group: '', affiliation: '' };
const VALID_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Landing page of an attendance QR (Time In or Time Out for one Activity
 * Matrix row). Signed-in personnel scan as themselves; anyone else (students,
 * parents, external stakeholders) fills a short guest form first. The server
 * accepts a scan only inside its time window and, when the venue is pinned,
 * only from inside its perimeter. A successful Time Out goes to the evaluation.
 */
export class AttendanceScanController extends BaseController<ScanState> {
  private started = false;

  constructor(
    private readonly services: Services,
    readonly eventId: number,
    readonly index: number,
    readonly action: string,
    readonly code: string,
    /** No TaskNet session: scan as a guest. */
    readonly isGuest = false,
  ) {
    const stored = isGuest ? GuestStore.load() : null;
    super({
      step: 'loading', message: '', info: null, fix: null, problem: null,
      guest: stored?.guest ?? EMPTY_GUEST, consent: !!stored?.consentEvents.includes(eventId), formError: null,
    });
  }

  get valid(): boolean { return (this.action === 'time_in' || this.action === 'time_out') && !!this.code; }
  get isTimeIn(): boolean { return !this.state.info?.record?.time_in_at; }
  /** One QR per activity (old printed Time Out QRs behave the same): Time In, then the evaluation. */
  get label(): string { return this.state.info?.record?.time_in_at ? ATTENDANCE_LABELS.time_out : ATTENDANCE_LABELS.time_in; }
  get window(): string | null { return this.state.info?.windows?.time_in?.label ?? null; }
  /** When the evaluation (= Time Out) is accepted. */
  get evaluationWindow(): string | null { return this.state.info?.windows?.time_out?.label ?? null; }
  /** Where a successful Time Out continues: the attendee's evaluation of this activity. */
  get evaluatePath(): string {
    return this.isGuest ? `/eval/${this.eventId}?session=${this.index}` : `/attendance/${this.eventId}/${this.index}/evaluate`;
  }
  get pin() { return this.state.info?.venue_location ?? null; }
  /** Metres from the pinned venue, once located. */
  get distance(): number | null {
    const p = this.pin;
    const f = this.state.fix;
    return p && f ? distanceMeters(f.latitude, f.longitude, p.latitude, p.longitude) : null;
  }
  get guestOptions() { return (this.state.info as GuestActivity | null)?.guest_options ?? null; }

  /** Starts once (StrictMode-safe). Resolves true when the evaluation should open next. */
  async start(locate: Locate): Promise<boolean> {
    if (this.started) return false;
    this.started = true;
    if (!this.valid) {
      this.setState({ step: 'error', message: 'This attendance QR code is incomplete. Please scan it again.' });
      return false;
    }
    if (this.isGuest) {
      await this.loadForGuest();
      return false;
    }
    return this.runPersonnel(locate);
  }

  /** Try again after an error / outside / no location. */
  retry(locate: Locate): Promise<boolean> {
    if (!this.isGuest) return this.runPersonnel(locate);
    if (this.state.info) return this.submitGuest(locate);
    return this.loadForGuest().then(() => false);
  }

  editGuest() { this.setState({ step: 'guest-form' }); }
  setGuest(patch: Partial<GuestInfo>) { this.setState((s) => ({ guest: { ...s.guest, ...patch }, formError: null })); }
  setConsent(consent: boolean) { this.setState({ consent, formError: null }); }

  private async runPersonnel(locate: Locate): Promise<boolean> {
    try {
      this.setState({ step: 'loading' });
      const info = this.state.info ?? await this.services.events.attendanceActivity(this.eventId, this.index);
      this.setState({ info });
      return await this.scan(info, locate, (pos) => this.services.events.scanAttendance(this.eventId, {
        activity_index: this.index, action: this.action as AttendanceAction, code: this.code, ...pos,
      }));
    } catch (e) {
      this.setState({ step: 'error', message: BaseController.messageOf(e, 'Could not record your attendance') });
      return false;
    }
  }

  private async loadForGuest() {
    try {
      this.setState({ step: 'loading' });
      const email = GuestStore.load()?.guest.email || undefined;
      const info = await this.services.events.guestActivity(this.eventId, this.index, { action: this.action, code: this.code, email });
      this.setState({ info, step: 'guest-form' });
    } catch (e) {
      this.setState({ step: 'error', message: BaseController.messageOf(e, 'Could not load this activity') });
    }
  }

  /** Validates the guest form, then scans. Resolves true when the evaluation should open next. */
  async submitGuest(locate: Locate): Promise<boolean> {
    const s = this.state;
    const g: GuestInfo = { ...s.guest, name: s.guest.name.trim(), email: s.guest.email.trim().toLowerCase(), affiliation: s.guest.affiliation?.trim() || null };
    const problem = g.name.length < 2 ? 'Please enter your full name.'
      : !VALID_EMAIL.test(g.email) ? 'Please enter a valid email address.'
        : !g.sex || !g.age_group ? 'Please choose your sex and age group.'
          : !s.consent ? 'Please tick the Data Privacy box to continue.' : null;
    if (problem) { this.setState({ formError: problem }); return false; }
    GuestStore.save(g, this.eventId);
    try {
      // The guest's own record (by email) decides "already timed out" for this session.
      const info = await this.services.events.guestActivity(this.eventId, this.index, { action: this.action, code: this.code, email: g.email });
      this.setState({ info });
      return await this.scan(info, locate, (pos) => this.services.events.guestScan(this.eventId, {
        activity_index: this.index, action: this.action as AttendanceAction, code: this.code, guest: g, consent: true, ...pos,
      }));
    } catch (e) {
      this.setState({ step: 'error', message: BaseController.messageOf(e, 'Could not record your attendance') });
      return false;
    }
  }

  /** Location → perimeter → scan, for personnel and guests alike. */
  private async scan(info: AttendanceActivity, locate: Locate,
    send: (pos: { latitude: number | null; longitude: number | null; accuracy: number | null }) => Promise<AttendanceScanResult>): Promise<boolean> {
    const pin = info.venue_location ?? null;
    // Already timed in: this scan only opens the evaluation (the Time Out), from anywhere.
    const alreadyOut = !!info.record?.time_in_at;
    this.setState({ step: 'locating' });
    const got = await locate(!!pin);
    const fix = 'fix' in got ? got.fix : null;
    this.setState({ fix });
    if (pin && !alreadyOut) {
      if (!fix) {
        this.setState({ step: 'no-location', problem: 'problem' in got ? got.problem : 'unavailable' });
        return false;
      }
      const d = distanceMeters(fix.latitude, fix.longitude, pin.latitude, pin.longitude);
      if (!insidePerimeter(d, pin.radius_m, fix.accuracy, info.gps_tolerance_max_m)) {
        this.setState({ step: 'outside' });
        return false;
      }
    }
    this.setState({ step: 'submitting' });
    const res = await send({ latitude: fix?.latitude ?? null, longitude: fix?.longitude ?? null, accuracy: fix?.accuracy ?? null });
    this.setState({ step: 'done', message: res.message || 'Time In recorded.' });
    return res.redirect_to_evaluation;
  }
}
