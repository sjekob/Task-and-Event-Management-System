import { Json } from '../models';
import { Format } from './format';

/**
 * Human-readable text for the JSON-encoded event proposal fields. Each
 * formatter falls back to the raw string if it can't be parsed.
 */
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
      { label: 'Proposed Budget', value: h(e.proposed_budget) ? `₱${e.proposed_budget}` : '' },
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
    add('Indicators', e.indicators);
    add('Comments / Notes', e.comments);
    return { info, blocks, focal };
  }
}
