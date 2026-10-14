// Human-readable formatters for the JSON-encoded event proposal fields, for
// places that show them as plain text (e.g. the Activity feed). Each falls
// back to the raw string if it can't be parsed.
import type { ActivityRow, DepedEntry } from '../types';
import { addDays, formatRange, isoDate, parseEventDate, parseIsoDate, sameDay } from './dates';

/** Parses a JSON-encoded field, or returns `fallback`. */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function activityRows(raw: string | null | undefined): ActivityRow[] {
  const rows = parseJson<unknown>(raw, []);
  return Array.isArray(rows) ? (rows as ActivityRow[]) : [];
}

export interface ParticipantRow { category: string; male: number | string; female: number | string; total: number | string }
export interface Participants { rows: ParticipantRow[]; totals?: { male: number | string; female: number | string; total: number | string } }

/** True when a stored field has real content (not blank, "[]" or "{}"). */
export function hasContent(raw: unknown): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;
  if (s.startsWith('[') || s.startsWith('{')) {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : true;
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Participants as {rows, totals}. Accepts the proposal form's shape and the
 * older {"teachers": {"male": 5, "female": 20}, ...} map; null otherwise.
 */
export function parseParticipants(raw: unknown): Participants | null {
  const data = typeof raw === 'string' ? parseJson<unknown>(raw, null) : raw;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.rows)) return d as unknown as Participants;
  const rows: ParticipantRow[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (!v || typeof v !== 'object') return null;
    const m = Number((v as Record<string, unknown>).male) || 0;
    const f = Number((v as Record<string, unknown>).female) || 0;
    rows.push({ category: k[0].toUpperCase() + k.slice(1).replace(/_/g, ' '), male: m, female: f, total: m + f });
  }
  if (!rows.length) return null;
  const sum = (key: 'male' | 'female') => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  return { rows, totals: { male: sum('male'), female: sum('female'), total: sum('male') + sum('female') } };
}

export function formatParticipants(raw: string): string {
  const data = parseParticipants(raw);
  if (!data) return raw;
  const lines = data.rows
    .filter((r) => String(r.category ?? '').trim())
    .map((r) => `${r.category}: ${r.male ?? 0}M / ${r.female ?? 0}F  (total ${r.total ?? 0})`);
  if (data.totals) lines.push(`Total: ${data.totals.male ?? 0}M / ${data.totals.female ?? 0}F  (${data.totals.total ?? 0})`);
  return lines.length ? lines.join('\n') : raw;
}

const stripBullet = (s: string) => s.trim().replace(/^[•\-*·●○]\s*/, '');

/** A list field stored as a JSON array or newline-separated text → items. */
export function listItems(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const t = raw.trim();
  let list: unknown[] = t.split('\n');
  if (t.startsWith('[')) {
    const parsed = parseJson<unknown>(t, null);
    if (Array.isArray(parsed)) list = parsed;
  }
  return list.map((e) => stripBullet(String(e))).filter(Boolean);
}

export function formatOutputs(raw: string): string {
  const items = listItems(raw);
  return items.length ? items.map((s) => `• ${s}`).join('\n') : raw;
}

export function formatMethodology(raw: string): string {
  const list = parseJson<{ stage?: string; activities?: string }[] | null>(raw, null);
  if (!Array.isArray(list)) return raw;
  const out: string[] = [];
  for (const m of list) {
    const stage = (m.stage ?? '').trim();
    if (stage) out.push(stage);
    for (const l of (m.activities ?? '').split('\n').map((x) => x.trim()).filter(Boolean)) out.push(`   • ${l}`);
  }
  return out.length ? out.join('\n') : raw;
}

export function formatCommittee(raw: string): string {
  const list = parseJson<{ name?: string; position?: string; designation?: string }[] | null>(raw, null);
  if (!Array.isArray(list)) return raw;
  const out = list.map((m) => {
    const name = (m.name ?? '').trim();
    const pos = (m.position ?? m.designation ?? '').trim();
    return `• ${name}${pos ? ` — ${pos}` : ''}`;
  }).filter((s) => s.trim() !== '•');
  return out.length ? out.join('\n') : raw;
}

export function formatTwg(raw: string): string {
  const list = parseJson<{ title?: string; members?: { name?: string; designation?: string }[] }[] | null>(raw, null);
  if (!Array.isArray(list)) return raw;
  const out: string[] = [];
  for (const g of list) {
    const title = (g.title ?? '').trim();
    if (title) out.push(title);
    for (const mm of g.members ?? []) {
      const desig = (mm.designation ?? '').trim();
      out.push(`   • ${(mm.name ?? '').trim()}${desig ? ` — ${desig}` : ''}`);
    }
  }
  return out.length ? out.join('\n') : raw;
}

export function formatActivityMatrix(raw: string): string {
  const list = parseJson<ActivityRow[] | null>(raw, null);
  if (!Array.isArray(list)) return raw;
  const out = list.map((m) => `• ${[m.day, m.time, m.event, m.speaker]
    .map((e) => (e ?? '').toString().trim()).filter(Boolean).join(' · ')}`)
    .filter((s) => s.trim() !== '•');
  return out.length ? out.join('\n') : raw;
}

// ── DepEd calendar ────────────────────────────────────────────────────────────

/** Distinct colour for DepEd baseline dates on every calendar. */
export const DEPED_COLOR = '#7C3AED';
export const DEPED_BG = '#EDE9FE';

export function depedRangeLabel(e: DepedEntry): string {
  const s = parseIsoDate(e.start_date);
  const end = parseIsoDate(e.end_date) ?? s;
  return s && end ? formatRange(s, end) : e.start_date;
}

/** "YYYY-MM-DD" → entries covering that day. */
export function depedByDay(entries: DepedEntry[]): Map<string, DepedEntry[]> {
  const map = new Map<string, DepedEntry[]>();
  for (const e of entries) {
    const start = parseIsoDate(e.start_date);
    const end = parseIsoDate(e.end_date) ?? start;
    if (!start || !end) continue;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const k = isoDate(d);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
  }
  return map;
}

// ── Activity-matrix times ("4:00-5:00 PM") ───────────────────────────────────

const CLOCK = /^(\d{1,2})(?:[:.](\d{2}))?\s*(?:([ap])\.?\s*m\.?)?$/i;

/** "4:00-5:00 PM" → [start, end] minutes since midnight (mirrors the backend parser). */
export function parseTimeRange(text: string | null | undefined): [number, number] | null {
  if (!text?.trim()) return null;
  const parts = text.trim().split(/\s*(?:-|–|—|\bto\b)\s*/i);
  if (parts.length !== 2) return null;
  const a = CLOCK.exec(parts[0].trim());
  const b = CLOCK.exec(parts[1].trim());
  if (!a || !b) return null;
  const to24 = (h: number, mer?: string) => (mer ? (h % 12) + (mer === 'p' ? 12 : 0) : h);
  const merA = a[3]?.toLowerCase();
  const merB = b[3]?.toLowerCase() ?? merA;
  const ma = +(a[2] ?? 0);
  const mb = +(b[2] ?? 0);
  let start = to24(+a[1], merA ?? merB) * 60 + ma;
  const end = to24(+b[1], merB) * 60 + mb;
  if (!merA && merB && start > end) start = to24(+a[1], merB === 'p' ? 'a' : 'p') * 60 + ma;
  return start < end && end <= 24 * 60 ? [start, end] : null;
}

/** Earliest start to latest end across an event's activities on `date`. */
export function eventTimesOn(activityMatrix: string | null | undefined, date: Date): [number, number] | null {
  let start: number | null = null;
  let end: number | null = null;
  for (const r of activityRows(activityMatrix)) {
    const rowDay = parseEventDate(typeof r.day === 'string' ? r.day : null);
    if (rowDay && !sameDay(rowDay, date)) continue;
    const span = parseTimeRange(typeof r.time === 'string' ? r.time : null);
    if (!span) continue;
    start = start == null || span[0] < start ? span[0] : start;
    end = end == null || span[1] > end ? span[1] : end;
  }
  return start == null ? null : [start, end!];
}

/** 965 → "16:05" */
export const minutesToHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** "₱15,000.00" from "15000" / "15,000.00"; other text is returned as-is. */
export function formatMoney(v: unknown): string {
  const s = String(v ?? '').trim();
  const n = Number(s.replace(/[,₱]/g, '').trim());
  if (!s || Number.isNaN(n)) return s;
  return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
