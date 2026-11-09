import { EventForAppraisal, Json, SpecialTask } from '../models';

// Pure calculations behind the appraisal tabs (shared by web and mobile views).
// ── Timing points ────────────────────────────────────────────────────────────
export type TimingMode = 'all' | 'personnel' | 'task';

export class TimingPoints {
  static points(s: Json) { return Number(s.timing_points ?? 0) || 0; }
  static onTime(s: Json) { return s.timing_status === 'On Time'; }

  static statusTone(status: string | null | undefined): 'green' | 'orange' | 'red' {
    return status === 'On Time' ? 'green' : status === 'Late within 24 hours' ? 'orange' : 'red';
  }

  static complianceTone(pct: number): 'green' | 'orange' | 'red' {
    return pct >= 80 ? 'green' : pct >= 50 ? 'orange' : 'red';
  }

  static filter(list: Json[], mode: TimingMode, selected: string | null): Json[] {
    if (mode === 'personnel' && selected) return list.filter((s) => String(s.personnel_name) === selected);
    if (mode === 'task' && selected) return list.filter((s) => String(s.task_name) === selected);
    return list;
  }

  static summary(list: Json[]) {
    const total = list.length;
    const points = list.reduce((a, s) => a + TimingPoints.points(s), 0);
    const onTime = list.filter(TimingPoints.onTime).length;
    return { total, points, compliance: total ? (onTime / total) * 100 : 0 };
  }

  static groups(list: Json[], byTask: boolean): { key: string; subs: Json[]; pct: number; avgPts: number; dept: string | null }[] {
    const map = new Map<string, Json[]>();
    for (const s of list) {
      const k = String(byTask ? s.task_name : s.personnel_name);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.keys()].sort().map((key) => {
      const subs = map.get(key)!;
      const onTime = subs.filter(TimingPoints.onTime).length;
      return {
        key, subs,
        pct: subs.length ? (onTime / subs.length) * 100 : 0,
        avgPts: subs.length ? subs.reduce((a, s) => a + TimingPoints.points(s), 0) / subs.length : 0,
        dept: (subs[0].personnel_department as string | null) ?? null,
      };
    });
  }

  static options(list: Json[], mode: TimingMode): string[] {
    const key = mode === 'task' ? 'task_name' : 'personnel_name';
    return [...new Set(list.map((s) => String(s[key])))].sort();
  }

  static fmt(raw: unknown): string {
    if (raw === null || raw === undefined) return '—';
    const s = String(raw);
    return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
  }
}

// ── Special tasks ────────────────────────────────────────────────────────────
export class SpecialTaskStats {
  static filter(tasks: SpecialTask[], dept: string | null, role: string | null, person: string | null) {
    return tasks.filter((t) => (!dept || t.assigneeDepartment === dept)
      && (!role || (t.assigneeRole ?? '').toLowerCase() === role.toLowerCase())
      && (!person || t.assigneeName === person));
  }

  static options(tasks: SpecialTask[], key: 'assigneeDepartment' | 'assigneeRole' | 'assigneeName'): string[] {
    return [...new Set(tasks.map((t) => t[key] ?? '').filter(Boolean))].sort();
  }

  static cards(tasks: SpecialTask[]) {
    const evaluated = tasks.filter((t) => t.status === 'evaluated').length;
    const flagged = tasks.filter((t) => t.status === 'flagged').length;
    const departments = new Set(tasks.map((t) => t.assigneeDepartment ?? '').filter(Boolean)).size;
    const scored = tasks.filter((t) => t.evaluation?.weightedAverage != null);
    const avg = scored.length ? scored.reduce((a, t) => a + t.scoreOutOf100, 0) / scored.length : 0;
    return { evaluated, flagged, departments, avg };
  }

  static scoreTone(score: number, flagged: boolean): 'red' | 'yellow' | 'green' {
    return flagged || score < 50 ? 'red' : score < 75 ? 'yellow' : 'green';
  }

  /** "3/14/2026" */
  static fmtDate(raw: string | null | undefined): string {
    if (!raw) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.split(' ')[0]);
    return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : raw;
  }

  /** ST001 for a special task, TS001 for a committee top-score credit. */
  static code(t: SpecialTask) { return `${t.isAutoCredit ? 'TS' : 'ST'}${String(t.id).padStart(3, '0')}`; }
}

export const STATUS_CHIPS: Record<string, { label: string; color: string; icon?: boolean }> = {
  evaluated: { label: 'Evaluated', color: '#22c55e', icon: true },
  flagged: { label: 'Flagged', color: '#ef4444' },
  not_submitted: { label: 'Not Submitted', color: '#ef4444' },
  pending: { label: 'Pending', color: '#f59e0b' },
  pending_approval: { label: 'Pending Approval', color: '#f59e0b' },
  awaiting_ratings: { label: 'Awaiting Ratings', color: '#f59e0b' },
  approved: { label: 'Approved', color: '#3b82f6' },
  draft: { label: 'Draft', color: '#9e9e9e' },
  disabled: { label: 'Disabled', color: '#ef4444' },
  completed: { label: 'Completed', color: '#22c55e', icon: true },
  ongoing: { label: 'Ongoing', color: '#3b82f6' },
};

export function statusChip(status: string) {
  return STATUS_CHIPS[status.toLowerCase()] ?? { label: status, color: '#9e9e9e' };
}

// ── Events ───────────────────────────────────────────────────────────────────
export const EVENT_RATING_CRITERIA: { key: string; label: string }[] = [
  { key: 'planning_score', label: 'Planning & Preparation' },
  { key: 'objectives_score', label: 'Achievement of Objectives' },
  { key: 'personnel_score', label: 'Personnel Management' },
  { key: 'time_mgmt_score', label: 'Time Management' },
  { key: 'engagement_score', label: 'Audience Engagement' },
  { key: 'resource_score', label: 'Resource Management' },
];

export class EventAppraisal {
  static effectiveStatus(e: EventForAppraisal): string {
    if (e.evaluations.length) return 'completed';
    if (e.status === 'approved') return 'awaiting_ratings';
    return e.status;
  }

  static rateTone(pct: number): 'green' | 'orange' | 'red' {
    return pct >= 80 ? 'green' : pct >= 50 ? 'orange' : 'red';
  }

  static cards(events: EventForAppraisal[]) {
    const pending = events.filter((e) => e.status === 'pending_approval').length;
    const rated = events.filter((e) => e.evaluations.length);
    const avg = rated.length ? rated.reduce((a, e) => a + e.evidencyRate, 0) / rated.length : null;
    return { total: events.length, pending, rated: rated.length, avg };
  }

  static responses(e: EventForAppraisal) {
    return e.expectedAttendees != null ? `${e.evaluations.length} / ${e.expectedAttendees}` : `${e.evaluations.length}`;
  }

  static organizerLine(e: EventForAppraisal) {
    return [e.organizerName?.trim() ? `Organizer: ${e.organizerName.trim()}` : '', e.department?.trim() ?? ''].filter(Boolean).join(' · ');
  }

  /** Link to the public evaluation page for [origin] (web origin or configured site URL). */
  static evalUrl(origin: string, e: EventForAppraisal) {
    return `${origin.replace(/\/+$/, '')}/eval/${e.id}`;
  }

  static demographics(e: EventForAppraisal): { total: number; groups: { title: string; rows: { label: string; count: number; pct: number; unspecified: boolean }[] }[] } {
    const d = e.demographics ?? {};
    const total = Number(d.total ?? 0) || 0;
    const group = (title: string, key: string) => ({
      title,
      rows: Object.entries((d[key] ?? {}) as Record<string, number>).map(([k, v]) => ({
        label: k ? k.charAt(0).toUpperCase() + k.slice(1) : '—',
        count: Number(v) || 0,
        pct: total ? Math.round(((Number(v) || 0) * 100) / total) : 0,
        unspecified: k === 'Not specified',
      })),
    });
    return { total, groups: [group('By role', 'by_role'), group('By sex', 'by_sex'), group('By age group', 'by_age_group')] };
  }
}

// ── Analytics ────────────────────────────────────────────────────────────────
export class AppraisalAnalytics {
  static readonly MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];

  static compute(tasks: SpecialTask[], events: EventForAppraisal[]) {
    const evaluated = tasks.filter((t) => t.evaluation?.weightedAverage != null);
    const ratedEvents = events.filter((e) => e.evaluations.length > 0);
    // Every score on one 0-100 scale: rated special tasks, and each organizer's
    // event evidency rate (Lok's combined performance).
    const scored = [
      ...evaluated.map((t) => ({ score: t.scoreOutOf100, person: t.assigneeName, dept: t.assigneeDepartment })),
      ...ratedEvents.map((e) => ({ score: e.evidencyRate, person: e.organizerName, dept: e.department })),
    ];
    const overallAvg = scored.length ? scored.reduce((a, x) => a + x.score, 0) / scored.length : 0;
    const named = (v: string | null | undefined) => (v ?? '').trim() && v !== '—' ? v!.trim() : null;
    const uniquePersonnel = new Set(scored.map((x) => named(x.person)).filter(Boolean)).size;
    const eventEvalCount = events.reduce((a, e) => a + e.evaluations.length, 0);
    const avgBy = (key: (x: (typeof scored)[number]) => string | null) => {
      const m = new Map<string, { scores: number[]; dept: string | null }>();
      for (const x of scored) {
        const k = key(x);
        if (!k) continue;
        const cur = m.get(k) ?? { scores: [], dept: named(x.dept) };
        cur.scores.push(x.score);
        m.set(k, cur);
      }
      return [...m.entries()].map(([name, v]) => ({ name, dept: v.dept, avg: v.scores.reduce((a, b) => a + b, 0) / v.scores.length, count: v.scores.length }))
        .sort((a, b) => b.avg - a.avg);
    };
    const people = avgBy((x) => named(x.person));
    const monthly = AppraisalAnalytics.MONTHS.map((m) => ({ month: m, scores: [] as number[] }));
    const idx: Record<number, number> = { 9: 0, 10: 1, 11: 2, 12: 3, 1: 4, 2: 5, 3: 6, 4: 7 };
    for (const t of evaluated) {
      const mm = /^(\d{4})-(\d{2})/.exec((t.submittedDate ?? '').split(' ')[0]);
      if (!mm) continue;
      const i = idx[Number(mm[2])];
      if (i !== undefined) monthly[i].scores.push(t.scoreOutOf100);
    }
    return {
      overallAvg, uniquePersonnel, evaluatedCount: evaluated.length, eventEvalCount,
      /** Per department (special tasks and events), best first. */
      departments: avgBy((x) => named(x.dept)),
      /** Per person (special tasks they did, events they organized), best first: the Individual view. */
      individuals: people,
      performers: people.slice(0, 5),
      monthly: monthly.map((m) => ({ month: m.month, avg: m.scores.length ? Math.floor(m.scores.reduce((a, b) => a + b, 0) / m.scores.length) : 0 })),
    };
  }

  static deptTone(avg: number): 'green' | 'blue' | 'red' { return avg >= 80 ? 'green' : avg >= 60 ? 'blue' : 'red'; }
  static performerTone(avg: number): 'green' | 'blue' | 'text' { return avg >= 90 ? 'green' : avg >= 75 ? 'blue' : 'text'; }
  static rankColor(rank: number) { return rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : '#cd7f32'; }
}
