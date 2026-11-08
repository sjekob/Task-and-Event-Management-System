import { Json } from '../models';

/** Read-only, parsed view of a proposal's JSON fields (event detail page). */
export class ProposalView {
  constructor(readonly raw: Json) {}

  private static parse(v: unknown): any {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    try { return JSON.parse(String(v)); } catch { return undefined; }
  }

  static has(v: unknown): boolean {
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  /** "₱3,120.00" from "3120" / "P3,120.00". */
  static money(v: unknown): string {
    const s = String(v ?? '').trim();
    const n = Number(s.replace(/,/g, '').replace(/[₱P]/g, '').trim());
    if (!s || Number.isNaN(n)) return s;
    const [whole, cents] = n.toFixed(2).split('.');
    return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
  }

  get facts() {
    const r = this.raw;
    return [
      { label: 'Nature', value: String(r.nature ?? ''), icon: 'category' as const },
      { label: 'Venue', value: String(r.venue ?? ''), icon: 'place' as const },
      { label: 'Proposed budget', value: ProposalView.money(r.proposed_budget), icon: 'wallet' as const },
      { label: 'Fund source', value: String(r.fund_source ?? ''), icon: 'savings' as const },
    ];
  }

  get focal() {
    const r = this.raw;
    return ProposalView.has(r.focal_name)
      ? [{ label: 'Name', value: String(r.focal_name ?? '') }, { label: 'Role', value: String(r.focal_role ?? '') }, { label: 'Contact', value: String(r.focal_contact ?? '') }].filter((f) => f.value.trim())
      : null;
  }

  /** Participant rows with totals, or a raw string when it isn't JSON. */
  get participants(): { rows: Json[]; totals: Json | null } | string | null {
    if (!ProposalView.has(this.raw.participants)) return null;
    const d = ProposalView.parse(this.raw.participants);
    if (!d || typeof d !== 'object') return String(this.raw.participants);
    const rows = Array.isArray(d.rows) ? d.rows : [];
    return rows.length ? { rows, totals: d.totals ?? null } : null;
  }

  get outputs(): string[] {
    const raw = String(this.raw.expected_outputs ?? '').trim();
    if (!raw) return [];
    let items: string[] = [];
    if (raw.startsWith('[')) {
      const d = ProposalView.parse(raw);
      items = Array.isArray(d) ? d.map(String) : [raw];
    } else items = raw.split('\n');
    return items.map((s) => s.trim().replace(/^[•\-*·●○]\s*/, '')).filter(Boolean);
  }

  get objectives(): string[] {
    return String(this.raw.objectives ?? '').split('\n').map((l) => l.trim().replace(/^[•\-*·●○]\s*/, '')).filter(Boolean);
  }

  /** Methodology steps (JSON phase1), or legacy plain-text phases. */
  get methodology(): { steps: { stage: string; activities: string[] }[]; legacy: { label: string; text: string }[] } {
    const d = ProposalView.parse(this.raw.phase1);
    if (Array.isArray(d)) {
      return {
        steps: d.map((m: Json) => ({
          stage: String(m.stage ?? '').trim(),
          activities: String(m.activities ?? '').split('\n').map((l) => l.trim()).filter(Boolean),
        })).filter((s) => s.stage || s.activities.length),
        legacy: [],
      };
    }
    const legacy = [['Phase 1', this.raw.phase1], ['Phase 2', this.raw.phase2], ['Phase 3', this.raw.phase3]]
      .filter(([, v]) => ProposalView.has(v)).map(([l, v]) => ({ label: String(l), text: String(v) }));
    return { steps: [], legacy };
  }

  private rows(key: string): Json[] | null {
    const d = ProposalView.parse(this.raw[key]);
    return Array.isArray(d) && d.length ? d : null;
  }

  get activityMatrix() { return this.rows('activity_matrix'); }
  get materials() { return this.rows('training_materials'); }
  get snacks() { return this.rows('snacks'); }
  get execCommittee() { return this.rows('exec_committee'); }

  get twg(): { title: string; members: Json[] }[] | null {
    const d = ProposalView.parse(this.raw.twg_groups);
    if (Array.isArray(d)) return d.map((g: Json) => ({ title: String(g.title ?? ''), members: Array.isArray(g.members) ? g.members : [] }));
    if (d && typeof d === 'object') return Object.entries(d).map(([k, v]) => ({ title: k.replace(/_/g, ' '), members: Array.isArray(v) ? v : [] }));
    return null;
  }

  get indicators(): string[] {
    const d = ProposalView.parse(this.raw.indicators);
    return Array.isArray(d) ? d.map((x: Json) => String(x?.label ?? '').trim()).filter(Boolean) : [];
  }

  get signatories(): { role: string; name: string; title: string }[] | string | null {
    if (!ProposalView.has(this.raw.comments)) return null;
    const d = ProposalView.parse(this.raw.comments);
    const list = d && !Array.isArray(d) ? d.signatories : d;
    if (!Array.isArray(list)) return String(this.raw.comments);
    return list.map((s: Json) => ({ role: String(s.role ?? '').trim(), name: String(s.name ?? '').trim(), title: String(s.title ?? '').trim() }))
      .filter((s) => s.role || s.name || s.title);
  }

  /** Which numbered sections have content. */
  get sections() {
    const r = this.raw;
    const h = ProposalView.has;
    return {
      rationale: h(r.rationale),
      objectives: h(r.objectives),
      methodology: h(r.phase1) || h(r.phase2) || h(r.phase3),
      matrix: h(r.activity_matrix),
      budget: h(r.training_materials) || h(r.snacks),
      committees: h(r.exec_committee) || h(r.twg_groups),
      monitoring: h(r.monitoring_criteria) || h(r.indicators),
      signatories: h(r.comments),
    };
  }
}
