import { ApiClient, FilePart } from './ApiClient';
import {
  AssigneeSuggestion, AttendanceAction, AttendanceActivity, AttendanceList, AttendanceQrCodes, AttendanceScanResult, DateCheck, EventItem,
  GuestActivity, GuestInfo, Json,
} from '../models';

/** What a committee member's role is about, for ranking who fits it. */
export interface CommitteeRoleQuery { name: string; designation: string; tor: string; output: string; committee: string; eventTitle: string }

/** A staff member ranked for a committee role; [nameMatch]: their name is the one written in the proposal. */
export interface CommitteeSuggestion { s: AssigneeSuggestion; nameMatch: boolean }

/**
 * What approving an event did: special tasks made for the committee members
 * flagged for automation, top scores credited to the others, and who had no
 * matching account.
 */
export interface ApproveResult { created: number; credited: number; missed: string[] }

/** The toast after approving. */
export function approvalMessage(r: ApproveResult): string {
  return [
    'Event approved.',
    r.created > 0 ? `${r.created} committee special task${r.created === 1 ? '' : 's'} assigned.` : '',
    r.credited > 0 ? `${r.credited} committee member${r.credited === 1 ? '' : 's'} credited the top score.` : '',
    r.missed.length ? `No matching TaskNet account (nothing assigned or credited): ${r.missed.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
}

/** What the proposal reader found in an uploaded file (see controllers/proposalReading.ts). */
export interface ProposalReading {
  form: Json;
  /** docx | pdf-text | ocr */
  method: string;
  sections: { label: string; found: boolean; fields: string[] }[];
  warnings: string[];
}

export interface GeocodeResult { name: string; latitude: number; longitude: number }

type ScanPosition = { latitude: number | null; longitude: number | null; accuracy: number | null };

export class EventService {
  constructor(private readonly api: ApiClient) {}

  /** Current school year by default; [schoolYear] may be an id or 'all'. */
  async list(schoolYear?: string | null): Promise<EventItem[]> {
    const rows = await this.api.get<Json[]>('/api/events', { query: { school_year: schoolYear ?? undefined }, fallback: 'Failed to load events' });
    return rows.map(EventItem.fromJson);
  }

  async get(id: number): Promise<EventItem | null> {
    try {
      return EventItem.fromJson(await this.api.get(`/api/events/${id}`));
    } catch {
      return null;
    }
  }

  /** Throws with the server's reason (e.g. a date conflict) when rejected. */
  async create(payload: Json): Promise<EventItem> {
    return EventItem.fromJson(await this.api.post('/api/events', { body: payload, ok: [201, 200], fallback: 'Could not save the event' }));
  }

  /** Attaches the proponent's original proposal file (Word or PDF) to the event. */
  uploadProposalFile(id: number, file: FilePart): Promise<{ url: string; name: string }> {
    return this.api.upload(`/api/events/${id}/proposal-file`, file, { timeoutMs: 120000, fallback: 'Could not attach the proposal file' });
  }

  async update(id: number, payload: Json): Promise<EventItem | null> {
    const d = await this.api.put(`/api/events/${id}`, { body: payload, fallback: 'Could not save the event' });
    return d && typeof d === 'object' ? EventItem.fromJson(d) : null;
  }

  /** Whether [targetDate] is free for an event proposal. [excludeId] skips the event being edited. */
  checkDate(targetDate: string, excludeId?: number | null): Promise<DateCheck> {
    return this.api.get('/api/events/date-check', {
      query: { target_date: targetDate, exclude_id: excludeId ?? undefined },
      fallback: 'Failed to check the date',
    });
  }

  async approve(id: number): Promise<ApproveResult> {
    const d: Json = await this.api.patch(`/api/events/${id}/approve`, { fallback: 'Failed to approve event' }) ?? {};
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    return {
      created: Number(d.special_tasks_created ?? 0) || 0,
      credited: Number(d.top_scores_credited ?? 0) || 0,
      missed: [...list(d.special_tasks_skipped), ...list(d.top_scores_skipped)],
    };
  }

  /** Approver: send a pending proposal back as rejected, or ask for revisions (comment required). Returns the server's message. */
  async sendBack(id: number, decision: 'rejected' | 'revisions_requested', comment: string): Promise<string> {
    const path = decision === 'rejected' ? 'reject' : 'request-revisions';
    const d: Json = await this.api.patch(`/api/events/${id}/${path}`, { body: { comment }, fallback: 'Failed to send the proposal back' });
    return String(d?.message ?? (decision === 'rejected' ? 'Event rejected.' : 'Revisions requested.'));
  }

  /** Reads a proposal file (one Word/PDF, or page photos in order) into the form's fields. Saves nothing. */
  /** Staff ranked for one committee member's role (same fit score as task assignment). */
  async committeeSuggestions(q: CommitteeRoleQuery): Promise<CommitteeSuggestion[]> {
    const data = await this.api.post<Json[]>('/api/events/committee/suggestions', {
      body: { name: q.name, designation: q.designation, tor: q.tor, output: q.output, committee: q.committee, event_title: q.eventTitle },
      background: true, fallback: 'Could not load suggestions',
    });
    return (data ?? []).map((j) => ({ s: AssigneeSuggestion.fromJson(j), nameMatch: j.name_match === true }));
  }

  readProposal(files: FilePart[]): Promise<ProposalReading> {
    return this.api.uploadMany('/api/events/read-proposal', files, { field: 'files', timeoutMs: 180000, fallback: 'Could not read the proposal file' });
  }

  /** Places matching a venue name or address (OpenStreetMap, through the server). */
  geocode(q: string): Promise<GeocodeResult[]> {
    return this.api.get('/api/events/geocode', { query: { q }, fallback: 'Could not search the map' });
  }
  async disable(id: number) { await this.api.patch(`/api/events/${id}/disable`, { fallback: 'Failed to disable event' }); }
  async enable(id: number) { await this.api.patch(`/api/events/${id}/enable`, { fallback: 'Failed to enable event' }); }
  async remove(id: number) { await this.api.delete(`/api/events/${id}`, { fallback: 'Failed to delete event' }); }

  // ── Attendance (QR Time In / Time Out per Activity Matrix row) ──

  /** Proponent / principal only, once the event is approved. */
  attendanceQrCodes(id: number): Promise<AttendanceQrCodes> {
    return this.api.get(`/api/events/${id}/attendance/qr-codes`, { fallback: 'Could not load the attendance QR codes' });
  }

  attendanceActivity(id: number, index: number): Promise<AttendanceActivity> {
    return this.api.get(`/api/events/${id}/attendance/activities/${index}`, { fallback: 'Could not load this activity' });
  }

  /** Accepted only inside the action's time window and, when the venue is pinned, inside its perimeter. */
  scanAttendance(id: number, body: { activity_index: number; action: AttendanceAction; code: string } & ScanPosition): Promise<AttendanceScanResult> {
    return this.api.post(`/api/events/${id}/attendance/scan`, { body, fallback: 'Could not record your attendance' });
  }

  /** Public (no login): a guest's scan landing info; needs the QR's signed code. */
  guestActivity(id: number, index: number, q: { action: string; code: string; email?: string }): Promise<GuestActivity> {
    return this.api.get(`/api/events/${id}/attendance/guest/activities/${index}`, { query: q, anonymous: true, fallback: 'Could not load this activity' });
  }

  /** Public (no login): Time In / Time Out for a guest, with Data Privacy consent. */
  guestScan(id: number, body: { activity_index: number; action: AttendanceAction; code: string; guest: GuestInfo; consent: boolean } & ScanPosition): Promise<AttendanceScanResult> {
    return this.api.post(`/api/events/${id}/attendance/guest-scan`, { body, anonymous: true, fallback: 'Could not record your attendance' });
  }

  /** Proponent / approver: who scanned, guests included. */
  attendanceList(id: number): Promise<AttendanceList> {
    return this.api.get(`/api/events/${id}/attendance`, { fallback: 'Could not load the attendance list' });
  }

  /** After Time Out. Returns the automatically completed special task, when the activity has one. */
  async evaluateActivity(id: number, index: number, body: Json): Promise<Json | null> {
    const d: Json = await this.api.post(`/api/events/${id}/attendance/activities/${index}/evaluate`, { body, ok: [201, 200], fallback: 'Could not submit the evaluation' });
    return d?.special_task ?? null;
  }
}
