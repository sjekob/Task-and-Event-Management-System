import { BaseController } from './BaseController';
import { Services } from '../services';
import { ATTENDANCE_LABELS, AttendanceAction, AttendanceQrActivity, AttendanceQrCodes, attendanceLink } from '../models';

export interface AttendanceQrState { loading: boolean; error: string | null; data: AttendanceQrCodes | null }

/**
 * One attendance QR per Activity Matrix row of an approved event. Scanning it
 * is the Time In; scanning it again after the activity opens the evaluation,
 * which is the Time Out. Each QR opens the web scan page; its code is signed.
 */
export class AttendanceQrController extends BaseController<AttendanceQrState> {
  constructor(private readonly services: Services, readonly eventId: number, private readonly webOrigin: string) {
    super({ loading: true, error: null, data: null });
  }

  async load() {
    this.setState({ loading: true, error: null });
    try {
      this.setState({ data: await this.services.events.attendanceQrCodes(this.eventId), loading: false });
    } catch (e) {
      this.setState({ error: BaseController.messageOf(e), loading: false });
    }
  }

  link(a: AttendanceQrActivity, action: AttendanceAction = 'time_in'): string {
    return attendanceLink(this.webOrigin, this.eventId, a.index, action, action === 'time_in' ? a.time_in_code : a.time_out_code);
  }

  static title(a: AttendanceQrActivity): string {
    return a.event?.trim() || `Activity ${a.index + 1}`;
  }

  static when(a: AttendanceQrActivity): string {
    return [a.day, a.time].filter((x) => x && x.trim()).join(' · ');
  }

  static readonly LABEL = `${ATTENDANCE_LABELS.time_in} · Evaluation`;
  static readonly HOW = 'Attendees scan the QR to Time In during the first 2 hours of the event. From 2 hours before it ends, they scan it again or open the evaluation: submitting the evaluation is their Time Out, accepted until midnight.';
}
