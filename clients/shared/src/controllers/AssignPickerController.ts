import { BaseController } from './BaseController';
import { AssigneeSuggestion, CertificationInfo, User } from '../models';

export interface AssignPickerState {
  selected: Set<number>;
  search: string;
  loading: boolean;
  /** Suggestion per user id, in ranked order. Empty → plain list. */
  ranked: Map<number, AssigneeSuggestion>;
  busy: boolean;
  error: string | null;
}

export interface AssignPickerOptions {
  users: User[];
  selected: Iterable<number>;
  loadSuggestions?: () => Promise<AssigneeSuggestion[]>;
  /** False when the task has no title/instructions yet, so skills can't be matched. */
  hasTaskText?: boolean;
  /** When set, the dialog assigns straight away (existing task). */
  onConfirm?: (ids: Set<number>) => Promise<void>;
}

/**
 * Personnel picker used when assigning a task. With suggestions, people are
 * ranked by a fit score out of 100 (competency 60 + workload 30 + life
 * context 10), each row explains why, heavily loaded people are flagged
 * "High burden", and selecting one of them shows a warning.
 */
export class AssignPickerController extends BaseController<AssignPickerState> {
  constructor(readonly options: AssignPickerOptions) {
    super({ selected: new Set(options.selected), search: '', loading: false, ranked: new Map(), busy: false, error: null });
    void this.loadSuggestions();
  }

  get hasSuggestions() { return !!this.options.loadSuggestions; }
  get hasTaskText() { return this.options.hasTaskText ?? true; }

  private async loadSuggestions() {
    if (!this.options.loadSuggestions) return;
    this.setState({ loading: true });
    try {
      const list = await this.options.loadSuggestions();
      this.setState({ ranked: new Map(list.map((s) => [s.user.id, s])) });
    } catch {
      /* suggestions are an aid only */
    } finally {
      this.setState({ loading: false });
    }
  }

  setSearch(search: string) { this.setState({ search }); }

  toggle(id: number) {
    this.setState((s) => {
      const selected = new Set(s.selected);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      return { selected };
    });
  }

  /** Users in ranked order (suggested first), then anyone the ranking skipped. */
  get ordered(): User[] {
    const { ranked } = this.state;
    const users = this.options.users;
    if (!ranked.size) return users;
    const byId = new Map(users.map((u) => [u.id, u]));
    return [...[...ranked.keys()].filter((id) => byId.has(id)).map((id) => byId.get(id)!), ...users.filter((u) => !ranked.has(u.id))];
  }

  get filtered(): User[] {
    const q = this.state.search.trim().toLowerCase();
    if (!q) return this.ordered;
    return this.ordered.filter((u) => {
      const s = this.state.ranked.get(u.id);
      return u.fullName.toLowerCase().includes(q)
        || (s?.user.skills.some((k) => k.toLowerCase().includes(q)) ?? false)
        || (s?.user.certifications.some((k) => k.toLowerCase().includes(q)) ?? false);
    });
  }

  get hasMatches() { return [...this.state.ranked.values()].some((s) => s.isMatch); }

  /** Select everyone whose profile matches, skipping high-burden people; else the top-ranked one. */
  autoSelect() {
    const all = [...this.state.ranked.values()];
    if (!all.length) return;
    const ok = all.filter((s) => !s.isHighBurden);
    const matches = ok.filter((s) => s.isMatch).map((s) => s.user.id);
    const ids = matches.length ? matches : [ok.length ? ok[0].user.id : all[0].user.id];
    this.setState((s) => ({ selected: new Set([...s.selected, ...ids]) }));
  }

  /** Selected people who already carry a high burden. */
  get burdenedSelection(): AssigneeSuggestion[] {
    return [...this.state.selected].map((id) => this.state.ranked.get(id)).filter((s): s is AssigneeSuggestion => !!s?.isHighBurden);
  }

  /** Assign straight away (existing task). Returns true on success. */
  async confirm(): Promise<boolean> {
    if (!this.options.onConfirm) return true;
    this.setState({ busy: true, error: null });
    try {
      await this.options.onConfirm(this.state.selected);
      this.setState({ busy: false });
      return true;
    } catch (e) {
      this.setState({ busy: false, error: BaseController.messageOf(e) });
      return false;
    }
  }

  isTop(id: number): boolean {
    const s = this.state.ranked.get(id);
    return !!s && s.isMatch && this.state.ranked.keys().next().value === id;
  }

  // ── Row text ──
  static fitScore(s: AssigneeSuggestion) {
    return Math.round(s.fitCompetency + s.fitWorkload);
  }

  static fitTone(s: AssigneeSuggestion): 'green' | 'blue' | 'gray' {
    const score = AssignPickerController.fitScore(s);
    return score >= 60 ? 'green' : score >= 35 ? 'blue' : 'gray';
  }

  static fitParts(s: AssigneeSuggestion): string {
    return [`Certificates & skills ${Math.round(s.fitCompetency)}/70`, `Workload ${Math.round(s.fitWorkload)}/30`].join('  ·  ');
  }

  /** Certifications are shown as chips, so drop reasons that repeat them. */
  static reasons(s: AssigneeSuggestion): string[] {
    return s.reasons.filter((r) => !r.startsWith('Certified (') && !r.startsWith('Related certification'));
  }

  /** One plain sentence: why they fit, then what weighs against them. */
  static whySentence(s: AssigneeSuggestion): string {
    const lowerFirst = (r: string) => (r.length > 1 && r[1] === r[1].toLowerCase() ? r[0].toLowerCase() + r.slice(1) : r);
    const reasons = AssignPickerController.reasons(s);
    const fit = reasons.length ? `Fits because of ${reasons.map(lowerFirst).join('; ')}.` : 'Nothing in their profile matches this task.';
    const against = s.loadFactors.length ? ` Weighing against: ${s.loadFactors.join(', ')}.` : ' No current workload.';
    return fit + against;
  }

  /** Certifications worth showing: matching, then related, then others (max 4). */
  static certsFor(s: AssigneeSuggestion): { cert: CertificationInfo; matched: boolean }[] {
    const all = s.user.certificationDetails.filter((c) => c.credibility !== 'rejected');
    const fits = (c: CertificationInfo) => s.matchedCertifications.includes(c.name) || s.relatedCertifications.includes(c.name);
    const matched = all.filter((c) => s.matchedCertifications.includes(c.name));
    const related = all.filter((c) => s.relatedCertifications.includes(c.name) && !matched.includes(c));
    const others = all.filter((c) => !fits(c));
    return [...matched, ...related, ...others].slice(0, 4).map((cert) => ({ cert, matched: fits(cert) }));
  }

  suggestionText(): string {
    if (this.state.loading) return 'Finding the best fit for this task...';
    const parts = [
      !this.hasTaskText
        ? 'Add a title or instructions first so skills and certifications can be matched. For now people are ranked by workload only.'
        : this.hasMatches
          ? 'Best fit first: fit score = certificates and skills (70) + workload from assigned tasks (30).'
          : "No one's skills or certifications match the words in this task; ranked by workload.",
    ];
    return parts.join(' ');
  }
}

/** Label, hint and tone for a certification's credibility. */
export function describeCredibility(credibility: string, authenticity: string | null | undefined) {
  switch (credibility) {
    case 'verified':
      return { label: 'Verified', hint: 'Certificate checked and verified by the principal/registrar', tone: 'green' as const, icon: 'verified' as const };
    case 'submitted': {
      const strength = authenticity === 'high' ? 'passed the automated checks' : authenticity === 'medium' ? 'passed some automated checks' : 'failed some automated checks';
      const low = authenticity !== 'high' && authenticity !== 'medium';
      return {
        label: low ? 'Pending · doubtful' : 'Pending review',
        hint: `Certificate uploaded and ${strength}; not yet verified`,
        tone: low ? ('amber' as const) : ('blue' as const),
        icon: low ? ('doubtful' as const) : ('pending' as const),
      };
    }
    case 'rejected':
      return { label: 'Rejected', hint: 'The certificate was rejected on review', tone: 'red' as const, icon: 'rejected' as const };
    default:
      return { label: 'Not added yet', hint: 'Uploaded but not yet confirmed by its owner', tone: 'gray' as const, icon: 'more' as const };
  }
}
