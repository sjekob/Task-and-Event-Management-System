// Event attendance: QR Time In / Time Out per Activity Matrix row (server: routes/attendance.py).

export type AttendanceAction = 'time_in' | 'time_out';

export interface AttendanceWindow { opens: string; closes: string; label: string }

export interface AttendanceRecord {
  time_in_at: string | null;
  time_out_at: string | null;
  evaluated_at: string | null;
  special_task_id: number | null;
}

/** A pinned venue: scans are accepted only within radius_m metres of it. */
export interface VenueLocation { latitude: number; longitude: number; radius_m: number }

/** What a scan landing page shows: the activity, its windows and the caller's record. */
export interface AttendanceActivity {
  event_id: number;
  event_title: string;
  venue: string | null;
  /** Set when the venue is pinned: scans must come from inside this perimeter. */
  venue_location?: VenueLocation | null;
  /** How much of the device's GPS accuracy the server allows for (m). */
  gps_tolerance_max_m?: number;
  activity_index: number;
  activity: { day?: string | null; time?: string | null; event?: string | null; speaker?: string | null };
  windows: Record<AttendanceAction, AttendanceWindow> | null;
  record: AttendanceRecord | null;
  /** Why the evaluation (which is the Time Out) can't be submitted now; null when it can. */
  evaluation_lock?: string | null;
}

/** The public (no-login) landing info for a guest, with the form's choices. */
export interface GuestActivity extends AttendanceActivity {
  guest_options: { role: string[]; sex: string[]; age_group: string[] };
}

/** Who a guest (no TaskNet account) is; remembered on the device between Time In and Time Out. */
export interface GuestInfo { name: string; email: string; role: string; sex: string; age_group: string; affiliation: string | null }

/** Everyone who scanned an event's attendance QR codes, per session (proponent / approver). */
export interface AttendanceList {
  event_id: number;
  title: string;
  sessions: { index: number; event: string; time?: string | null; day?: string | null }[];
  attendees: {
    id: number; activity_index: number; activity: string; is_guest: boolean;
    name: string | null; role: string | null; email: string | null; affiliation: string | null;
    time_in_at: string | null; time_out_at: string | null; evaluated_at: string | null;
    time_in_distance_m: number | null; time_out_distance_m: number | null;
  }[];
}

export interface AttendanceQrActivity {
  index: number;
  day: string | null;
  time: string | null;
  event: string | null;
  speaker: string | null;
  /** False when the row's day/time can't be parsed (its scans would always be refused). */
  schedule_readable: boolean;
  time_in_code: string;
  time_out_code: string;
}

export interface AttendanceQrCodes {
  event_id: number; title: string; venue: string | null; venue_location?: VenueLocation | null; activities: AttendanceQrActivity[];
}

export interface AttendanceScanResult {
  success: boolean;
  action: AttendanceAction;
  timestamp: string;
  message: string;
  redirect_to_evaluation: boolean;
  /** Metres from the pinned venue (null when it isn't pinned). */
  distance_m?: number | null;
  record: AttendanceRecord | null;
}

export const ATTENDANCE_LABELS: Record<AttendanceAction, string> = { time_in: 'Time In', time_out: 'Time Out' };

/** The URL a printed attendance QR opens (the web app's scan landing page). */
export function attendanceLink(webOrigin: string, eventId: number, index: number, action: AttendanceAction, code: string): string {
  return `${webOrigin.replace(/\/+$/, '')}/attendance/${eventId}/${index}/scan?action=${action}&code=${encodeURIComponent(code)}`;
}
