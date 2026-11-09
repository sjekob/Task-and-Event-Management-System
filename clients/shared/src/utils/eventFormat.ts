import { Json } from '../models';
import { Format } from './format';

/**
 * Human-readable text for the JSON-encoded event proposal fields. Each
 * formatter falls back to the raw string if it can't be parsed.
 */
export interface EventDetails {
  facts: { key: string; label: string; value: string }[];
  focal: { name: string; role: string; contact: string };
  participants: { category: string; male: number; female: number; total: number }[];
  totals: { male: number; female: number; total: number } | null;
  rationale: string;
  objectives: string[];
  outputs: string[];
  phases: { stage: string; activities: string[] }[];
  schedule: { day: string; items: { time: string; activity: string; speaker: string }[] }[];
  executives: { name: string; role: string }[];
  groups: { title: string; members: { name: string; role: string }[] }[];
  monitoring: string;
  indicators: string[];
  signatories: { role: string; name: string; title: string }[];
}

export class EventFormat {
  private static parse(raw: string): any {
    return JSON.parse(raw);
  }

  private static stripBullet(s: string): string {
    return s.trim().replace(/^[•\-*·●○]\s*/, '');
  }

  static participants(raw: string): string {
    try {
      const data = EventFormat.parse(raw) as Json;
      const lines: string[] = [];
      for (const m of (data.rows ?? []) as Json[]) {
        const cat = String(m.category ?? '').trim();
        if (cat) lines.push(`${cat}: ${m.male ?? 0}M / ${m.female ?? 0}F  (total ${m.total ?? 0})`);
      }
      const t = data.totals as Json | undefined;
      if (t) lines.push(`Total: ${t.male ?? 0}M / ${t.female ?? 0}F  (${t.total ?? 0})`);
      return lines.length ? lines.join('\n') : raw;
    } catch {
      return raw;
    }
  }

  static outputs(raw: string): string {
    try {
      const t = raw.trim();
      const list: unknown[] = t.startsWith('[') ? EventFormat.parse(t) : raw.split('\n');
      const items = list.map((e) => EventFormat.stripBullet(String(e))).filter(Boolean).map((s) => `• ${s}`);
      return items.length ? items.join('\n') : raw;
    } catch {
      return raw;
    }
  }

  static methodology(raw: string): string {
    try {
      const out: string[] = [];
      for (const m of EventFormat.parse(raw) as Json[]) {
        const stage = String(m.stage ?? '').trim();
        const acts = String(m.activities ?? '').trim();
        if (stage) out.push(stage);
        for (const l of acts.split('\n').filter((x) => x.trim())) out.push(`   • ${l.trim()}`);
      }
      return out.length ? out.join('\n') : raw;
    } catch {
      return raw;
    }
  }

  static committee(raw: string): string {
    try {
      const out = (EventFormat.parse(raw) as Json[])
        .map((m) => {
          const name = String(m.name ?? '').trim();
          const pos = String(m.position ?? m.designation ?? '').trim();
          return `• ${name}${pos ? ` — ${pos}` : ''}`;
        })
        .filter((s) => s.trim() !== '•');
      return out.length ? out.join('\n') : raw;
    } catch {
      return raw;
    }
  }

  static twg(raw: string): string {
    try {
      const out: string[] = [];
      for (const m of EventFormat.parse(raw) as Json[]) {
        const title = String(m.title ?? '').trim();
        if (title) out.push(title);
        for (const mm of (m.members ?? []) as Json[]) {
          const name = String(mm.name ?? '').trim();
          const desig = String(mm.designation ?? '').trim();
          out.push(`   • ${name}${desig ? ` — ${desig}` : ''}`);
        }
      }
      return out.length ? out.join('\n') : raw;
    } catch {
      return raw;
    }
  }

  static activityMatrix(raw: string): string {
    try {
      const out = (EventFormat.parse(raw) as Json[])
        .map((m) => `• ${[m.day, m.time, m.event, m.speaker].map((e) => String(e ?? '').trim()).filter(Boolean).join(' · ')}`)
        .filter((s) => s.trim() !== '•');
      return out.length ? out.join('\n') : raw;
    } catch {
      return raw;
    }
  }

  static indicators(raw: string): string {
    const list = EventFormat.indicatorList(raw);
    return list.length ? list.map((l) => `• ${l}`).join('\n') : raw;
  }

  static signatories(raw: string): string {
    const list = EventFormat.signatoryList(raw);
    return list.length ? list.map((x) => `${x.role}: ${x.name}${x.title ? `, ${x.title}` : ''}`).join('\n') : '';
  }

  static indicatorList(raw: unknown): string[] {
    try {
      const v = typeof raw === 'string' ? (raw.trim().startsWith('[') ? EventFormat.parse(raw) : raw.split('\n')) : raw;
      return (Array.isArray(v) ? v : [])
        .map((x) => EventFormat.stripBullet(String(typeof x === 'object' && x ? (x as Json).label ?? '' : x ?? '')))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  static signatoryList(raw: unknown): { role: string; name: string; title: string }[] {
    try {
      const v = typeof raw === 'string' ? EventFormat.parse(raw) : raw;
      return ((v as Json)?.signatories ?? [])
        .map((x: Json) => ({ role: String(x.role ?? '').trim(), name: String(x.name ?? '').trim(), title: String(x.title ?? '').trim() }))
        .filter((x: { name: string }) => x.name);
    } catch {
      return [];
    }
  }

  private static json(raw: unknown, fallback: any): any {
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  private static lines(raw: unknown): string[] {
    const t = String(raw ?? '').trim();
    if (!t) return [];
    const parsed = t.startsWith('[') ? EventFormat.json(t, null) : null;
    const list: unknown[] = Array.isArray(parsed) ? parsed : t.split('\n');
    return list.map((x) => EventFormat.stripBullet(String(x))).filter(Boolean);
  }

  /** The proposal as structured data, for a designed detail view. */
  static details(e: Json): EventDetails {
    const h = EventFormat.has;
    const str = (v: unknown) => String(v ?? '').trim();
    const part = EventFormat.json(e.participants, {});
    const rows = Array.isArray(part?.rows) ? part.rows : [];
    const participants = rows.map((r: Json) => ({ category: str(r.category), male: Number(r.male ?? 0), female: Number(r.female ?? 0),
      total: Number(r.total ?? Number(r.male ?? 0) + Number(r.female ?? 0)) })).filter((r: { category: string }) => r.category);
    const totals = part?.totals ? { male: Number(part.totals.male ?? 0), female: Number(part.totals.female ?? 0), total: Number(part.totals.total ?? 0) } : null;
    const phaseList = EventFormat.json(e.phase1, null);
    const phases = Array.isArray(phaseList)
      ? phaseList.map((p: Json) => ({ stage: str(p.stage), activities: EventFormat.lines(p.activities) })).filter((p: { stage: string; activities: string[] }) => p.stage || p.activities.length)
      : [['Pre-Activity', e.phase1], ['During the Activity', e.phase2], ['Post-Activity', e.phase3]]
        .filter(([, v]) => h(v)).map(([t, v]) => ({ stage: String(t), activities: EventFormat.lines(v) }));
    const schedule: { day: string; items: { time: string; activity: string; speaker: string }[] }[] = [];
    for (const r of (EventFormat.json(e.activity_matrix, []) as Json[]) || []) {
      const day = str(r.day);
      const item = { time: str(r.time), activity: str(r.event), speaker: str(r.speaker) };
      if (!item.time && !item.activity && !item.speaker) continue;
      const g = schedule.find((x) => x.day === day);
      if (g) g.items.push(item); else schedule.push({ day, items: [item] });
    }
    const executives = ((EventFormat.json(e.exec_committee, []) as Json[]) || [])
      .map((m) => ({ name: str(m.name), role: str(m.position ?? m.designation) })).filter((m) => m.name);
    const groups = ((EventFormat.json(e.twg_groups, []) as Json[]) || []).map((g) => ({
      title: str(g.title),
      members: ((g.members ?? []) as Json[]).map((m) => ({ name: str(m.name), role: str(m.designation) })).filter((m) => m.name),
    })).filter((g) => g.title || g.members.length);
    const date = (v: unknown) => (h(v) ? Format.date(String(v), String(v)) : '');
    return {
      facts: [
        { key: 'nature', label: 'Nature', value: str(e.nature) },
        { key: 'date', label: 'Target Date', value: date(e.target_date) },
        { key: 'venue', label: 'Venue', value: str(e.venue) },
        { key: 'fund', label: 'Fund Source', value: str(e.fund_source) },
        { key: 'budget', label: 'Proposed Budget', value: h(e.proposed_budget) ? EventFormat.peso(e.proposed_budget) : '' },
      ].filter((f) => f.value),
      focal: { name: str(e.focal_name), role: str(e.focal_role), contact: str(e.focal_contact) },
      participants, totals,
      rationale: str(e.rationale),
      objectives: EventFormat.lines(e.objectives),
      outputs: EventFormat.lines(e.expected_outputs),
      phases, schedule, executives, groups,
      monitoring: str(e.monitoring_criteria),
      indicators: EventFormat.indicatorList(e.indicators),
      signatories: EventFormat.signatoryList(e.comments),
    };
  }

  /** "PHP 15,000.00", "P15000" or "15000" → "₱15,000.00" style, without doubling the currency. */
  static peso(v: unknown): string {
    const t = String(v ?? '').trim().replace(/^(₱|PHP|Php|php|P)\s*/, '');
    return `₱${t}`;
  }

  static has(v: unknown): boolean {
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  /** The read-only sections of an event, in display order (Activity feed detail). */
  static sections(e: Json): { info: { label: string; value: string }[]; blocks: { title: string; text: string; phases?: { title: string; text: string }[] }[]; focal: { label: string; value: string }[] } {
    const h = EventFormat.has;
    const date = (v: unknown) => (h(v) ? Format.date(String(v), String(v)) : '');
    const info = [
      { label: 'Nature', value: String(e.nature ?? '') },
      { label: 'Target Date', value: date(e.target_date) },
      { label: 'Venue', value: String(e.venue ?? '') },
      { label: 'Fund Source', value: String(e.fund_source ?? '') },
      { label: 'Proposed Budget', value: h(e.proposed_budget) ? EventFormat.peso(e.proposed_budget) : '' },
    ].filter((i) => i.value.trim());
    const focal = [
      { label: 'Name', value: String(e.focal_name ?? '') },
      { label: 'Role', value: String(e.focal_role ?? '') },
      { label: 'Contact', value: String(e.focal_contact ?? '') },
    ].filter((i) => i.value.trim());
    const blocks: { title: string; text: string; phases?: { title: string; text: string }[] }[] = [];
    const add = (title: string, v: unknown, fmt: (s: string) => string = (s) => s) => { if (h(v)) blocks.push({ title, text: fmt(String(v)) }); };
    add('Participants', e.participants, EventFormat.participants);
    add('Rationale', e.rationale);
    add('Objectives', e.objectives);
    add('Expected Outputs', e.expected_outputs, EventFormat.outputs);
    const phases = [
      ['Phase 1 – Pre-Activity', e.phase1], ['Phase 2 – During Activity', e.phase2], ['Phase 3 – Post-Activity', e.phase3],
    ].filter(([, v]) => h(v)).map(([t, v]) => ({ title: String(t), text: EventFormat.methodology(String(v)) }));
    if (phases.length) blocks.push({ title: 'Implementation Phases', text: '', phases });
    add('Activity Matrix', e.activity_matrix, EventFormat.activityMatrix);
    add('Executive Committee', e.exec_committee, EventFormat.committee);
    add('TWG Groups', e.twg_groups, EventFormat.twg);
    add('Monitoring Criteria', e.monitoring_criteria);
    add('Indicators', e.indicators, EventFormat.indicators);
    const sigs = EventFormat.signatories(String(e.comments ?? ''));
    if (sigs) blocks.push({ title: 'Signatories', text: sigs });
    return { info, blocks, focal };
  }
}
