import { Json } from '../models/models';

/// Human-readable formatters for the JSON-encoded event proposal fields, for
/// places that display them as plain text (e.g. the Activity feed detail).
/// Each falls back to the raw string if it can't be parsed.

const text = (v: unknown): string => (v ?? '').toString().trim();

export function formatParticipants(raw: string): string {
  try {
    const data = JSON.parse(raw) as Json;
    const rows = (data.rows as Json[] | null) ?? [];
    const lines: string[] = [];
    for (const m of rows) {
      const cat = text(m.category);
      if (cat.length === 0) continue;
      lines.push(`${cat}: ${m.male ?? 0}M / ${m.female ?? 0}F  (total ${m.total ?? 0})`);
    }
    const t = data.totals as Json | null | undefined;
    if (t != null) {
      lines.push(`Total: ${t.male ?? 0}M / ${t.female ?? 0}F  (${t.total ?? 0})`);
    }
    return lines.length === 0 ? raw : lines.join('\n');
  } catch {
    return raw;
  }
}

const stripBullet = (s: string): string => s.trim().replace(/^[•\-*·●○]\s*/, '');

export function formatOutputs(raw: string): string {
  try {
    const t = raw.trim();
    const list: unknown[] = t.startsWith('[') ? (JSON.parse(t) as unknown[]) : raw.split('\n');
    const items = list
      .map((e) => stripBullet(String(e)))
      .filter((s) => s.length > 0)
      .map((s) => `• ${s}`);
    return items.length === 0 ? raw : items.join('\n');
  } catch {
    return raw;
  }
}

export function formatMethodology(raw: string): string {
  try {
    const list = JSON.parse(raw) as Json[];
    const out: string[] = [];
    for (const m of list) {
      const stage = text(m.stage);
      const acts = text(m.activities);
      if (stage.length > 0) out.push(stage);
      for (const l of acts.split('\n').filter((line) => line.trim().length > 0)) {
        out.push(`   • ${l.trim()}`);
      }
    }
    return out.length === 0 ? raw : out.join('\n');
  } catch {
    return raw;
  }
}

export function formatCommittee(raw: string): string {
  try {
    const list = JSON.parse(raw) as Json[];
    const out = list
      .map((m) => {
        const name = text(m.name);
        const pos = text(m.position ?? m.designation);
        return `• ${name}${pos.length > 0 ? ` — ${pos}` : ''}`;
      })
      .filter((s) => s.trim() !== '•');
    return out.length === 0 ? raw : out.join('\n');
  } catch {
    return raw;
  }
}

export function formatTwg(raw: string): string {
  try {
    const list = JSON.parse(raw) as Json[];
    const out: string[] = [];
    for (const m of list) {
      const title = text(m.title);
      if (title.length > 0) out.push(title);
      for (const mm of (m.members as Json[] | null) ?? []) {
        const name = text(mm.name);
        const desig = text(mm.designation);
        out.push(`   • ${name}${desig.length > 0 ? ` — ${desig}` : ''}`);
      }
    }
    return out.length === 0 ? raw : out.join('\n');
  } catch {
    return raw;
  }
}

export function formatActivityMatrix(raw: string): string {
  try {
    const list = JSON.parse(raw) as Json[];
    const out = list
      .map((m) => {
        const parts = [m.day, m.time, m.event, m.speaker].map(text).filter((s) => s.length > 0);
        return `• ${parts.join(' · ')}`;
      })
      .filter((s) => s.trim() !== '•');
    return out.length === 0 ? raw : out.join('\n');
  } catch {
    return raw;
  }
}
