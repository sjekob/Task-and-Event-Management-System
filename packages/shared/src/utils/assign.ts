// Assignee-suggestion helpers shared by the web and mobile pickers.
import type { AssigneeSuggestion, CertificationInfo } from '../types';

export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'gray';

export const fitScore = (s: AssigneeSuggestion) =>
  Math.round((s.fit?.competency ?? 0) + (s.fit?.workload ?? 0) + (s.fit?.life_context ?? 0));

export const fitTone = (score: number): Tone => (score >= 60 ? 'green' : score >= 35 ? 'blue' : 'gray');

export const isHighBurden = (s: AssigneeSuggestion) => s.burden === 'high';

/** "Competency 40/60  ·  Workload 25/30  ·  Life context 8/10" */
export function fitBreakdown(s: AssigneeSuggestion): string {
  const part = (label: string, v: number | undefined, max: number) => `${label} ${Math.round(v ?? 0)}/${max}`;
  return [part('Competency', s.fit?.competency, 60), part('Workload', s.fit?.workload, 30),
    part('Life context', s.fit?.life_context, 10)].join('  ·  ');
}

/** "Skilled in: ..." → "skilled in: ..." but leaves acronyms ("BEEd", "NC II") alone. */
const lowerFirst = (r: string) => (r.length > 1 && r[1] === r[1].toLowerCase() ? r[0].toLowerCase() + r.slice(1) : r);

/** One plain sentence: why they fit, then what weighs against them. */
export function whySentence(s: AssigneeSuggestion): string {
  // Certifications are shown as chips, so drop the reasons that repeat them.
  const reasons = s.reasons.filter((r) => !r.startsWith('Certified (') && !r.startsWith('Related certification'));
  const fit = reasons.length ? `Fits because of ${reasons.map(lowerFirst).join('; ')}.` : 'Nothing in their profile matches this task.';
  const against = s.load_factors.length ? ` Weighing against: ${s.load_factors.join(', ')}.` : ' No current workload.';
  return fit + against;
}

/**
 * Certifications worth showing for this task: matching ones, then related
 * ones, then others that are verified or awaiting review (max 4).
 */
export function certsFor(s: AssigneeSuggestion): { cert: CertificationInfo; matched: boolean }[] {
  const all = (s.certification_details ?? []).filter((c) => c.credibility !== 'rejected');
  const fits = (c: CertificationInfo) =>
    s.matched_certifications.includes(c.name) || s.related_certifications.includes(c.name);
  return [
    ...all.filter((c) => s.matched_certifications.includes(c.name)),
    ...all.filter((c) => s.related_certifications.includes(c.name)),
    ...all.filter((c) => !fits(c)),
  ].slice(0, 4).map((cert) => ({ cert, matched: fits(cert) }));
}

/**
 * Everyone whose profile matches, skipping high-burden people; if that leaves
 * nobody, the top-ranked person without a high burden.
 */
export function autoSelect(ranked: AssigneeSuggestion[]): number[] {
  const ok = ranked.filter((s) => !isHighBurden(s));
  const matches = ok.filter((s) => s.is_match).map((s) => s.id);
  if (matches.length) return matches;
  return ok.length ? [ok[0].id] : ranked.length ? [ranked[0].id] : [];
}

export function suggestionSummary(opts: { loading: boolean; hasTaskText: boolean; ranked: AssigneeSuggestion[] }) {
  if (opts.loading) return 'Finding the best fit for this task...';
  const hasMatches = opts.ranked.some((s) => s.is_match);
  const offHours = opts.ranked[0]?.off_hours ?? [];
  return [
    !opts.hasTaskText
      ? 'Add a title or instructions first so skills and certifications can be matched. For now people are ranked by workload only.'
      : hasMatches
        ? 'Best fit first: fit score = competency (60) + workload (30) + life context (10).'
        : "No one's skills or certifications match the words in this task; ranked by workload and life context.",
    offHours.length
      ? `This task is ${offHours.join(', ')}, so people with children or family care lose life-context points unless they opted in.`
      : '',
  ].filter(Boolean).join(' ');
}

/** How a certification's credibility is shown (label, hover text, tone). */
export function describeCredibility(credibility: string | undefined, authenticity?: string | null):
  { label: string; hint: string; tone: Tone; kind: 'verified' | 'pending' | 'doubtful' | 'rejected' | 'unconfirmed' } {
  switch (credibility) {
    case 'verified':
      return { label: 'Verified', hint: 'Certificate checked and verified by the principal/registrar', tone: 'green', kind: 'verified' };
    case 'submitted': {
      const strength = authenticity === 'high' ? 'passed the automated checks'
        : authenticity === 'medium' ? 'passed some automated checks' : 'failed some automated checks';
      const low = authenticity !== 'high' && authenticity !== 'medium';
      return {
        label: low ? 'Pending · doubtful' : 'Pending review',
        hint: `Certificate uploaded and ${strength}; not yet verified`,
        tone: low ? 'amber' : 'blue', kind: low ? 'doubtful' : 'pending',
      };
    }
    case 'rejected':
      return { label: 'Rejected', hint: 'The certificate was rejected on review', tone: 'red', kind: 'rejected' };
    default:
      return { label: 'Not added yet', hint: 'Uploaded but not yet confirmed by its owner', tone: 'gray', kind: 'unconfirmed' };
  }
}

export const TONES: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: '#15803D', bg: '#DCFCE7' },
  blue: { fg: '#2563EB', bg: '#DBEAFE' },
  amber: { fg: '#B45309', bg: '#FEF3C7' },
  red: { fg: '#EF4444', bg: '#FEE2E2' },
  gray: { fg: '#6B7280', bg: '#F3F4F6' },
};
