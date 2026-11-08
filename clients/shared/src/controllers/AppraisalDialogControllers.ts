import { BaseController } from './BaseController';
import { Services } from '../services';
import { AppraisalBadge, BadgeLeader, EventForAppraisal, ipcrfRating, SchoolYearFilter, SpecialTask } from '../models';
import { EVENT_RATING_CRITERIA } from './appraisalStats';

// Rating special tasks and events, and loading badges.
type EvalFields = { step: 1 | 2; quality: number; efficiency: number; timeliness: number; remarks: string };

/**
 * Two-step special-task rating (IPCRF style): the task and its MOVs, then
 * Quality / Efficiency / Timeliness on a 1-5 scale and remarks. The final
 * score is their average (the server computes and stores it).
 */
export class EvaluateSpecialTaskController extends BaseController<EvalFields & { submitting: boolean }> {
  constructor(private readonly services: Services, readonly task: SpecialTask) {
    super({ step: 1, quality: 0, efficiency: 0, timeliness: 0, remarks: '', submitting: false });
  }

  set(patch: Partial<EvalFields>) { this.setState(patch); }

  get allRated() { return !!(this.state.quality && this.state.efficiency && this.state.timeliness); }

  /** Final IPCRF score (1-5) as shown before submitting, e.g. "4.33 / 5.00 (Very Satisfactory)". */
  get finalScoreText(): string {
    if (!this.allRated) return '— / 5.00';
    const s = this.state;
    const score = (s.quality + s.efficiency + s.timeliness) / 3;
    return `${score.toFixed(2)} / 5.00 (${ipcrfRating(score)})`;
  }

  /** Returns the updated task, or throws a readable error. */
  async submit(): Promise<SpecialTask> {
    const s = this.state;
    if (!this.allRated) throw new Error('Please rate Quality, Efficiency and Timeliness.');
    this.setState({ submitting: true });
    try {
      return await this.services.appraisal.evaluateSpecialTask(this.task.id, {
        completion_quality_score: s.quality,
        initiative_score: s.efficiency,
        timeliness_score: s.timeliness,
        coordination_score: 0,
        remarks: s.remarks.trim(),
      });
    } finally {
      this.setState({ submitting: false });
    }
  }
}

/** Rate an event on six criteria (1-5 stars). */
export class EventRatingController extends BaseController<{ scores: Record<string, number>; comments: string; submitting: boolean }> {
  constructor(private readonly services: Services, readonly event: EventForAppraisal) {
    super({ scores: Object.fromEntries(EVENT_RATING_CRITERIA.map((c) => [c.key, 0])), comments: '', submitting: false });
  }

  rate(key: string, v: number) { this.setState((s) => ({ scores: { ...s.scores, [key]: v } })); }
  setComments(comments: string) { this.setState({ comments }); }

  get average() { return Object.values(this.state.scores).reduce((a, b) => a + b, 0) / EVENT_RATING_CRITERIA.length; }
  get started() { return (this.state.scores.planning_score ?? 0) > 0; }

  async submit(): Promise<EventForAppraisal> {
    this.setState({ submitting: true });
    try {
      return await this.services.appraisal.evaluateEvent(this.event.id, {
        evaluator_name: 'Evaluator', evaluator_role: 'Coordinator', ...this.state.scores, feedback_comments: this.state.comments.trim(),
      });
    } finally {
      this.setState({ submitting: false });
    }
  }
}

// ── Badges ───────────────────────────────────────────────────────────────────
export class BadgesController extends BaseController<{ mine: AppraisalBadge[]; board: BadgeLeader[]; loading: boolean; error: string | null }> {
  constructor(private readonly services: Services, private readonly showOwn: boolean, private readonly showBoard: boolean, private filter: SchoolYearFilter) {
    super({ mine: [], board: [], loading: true, error: null });
  }

  async load(filter = this.filter) {
    this.filter = filter;
    this.setState({ loading: true, error: null });
    try {
      const [mine, board] = await Promise.all([
        this.showOwn ? this.services.appraisal.badges({ filter }) : Promise.resolve([]),
        this.showBoard ? this.services.appraisal.leaderboard(filter) : Promise.resolve([]),
      ]);
      this.setState({ mine, board, loading: false });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e) });
    }
  }

  personBadges(id: number) { return this.services.appraisal.badges({ userId: id, filter: this.filter }); }

  /** Earned first, then closest to earning. */
  static sorted(badges: AppraisalBadge[]) {
    return [...badges].sort((a, b) => (a.earned !== b.earned ? (a.earned ? -1 : 1) : b.fraction - a.fraction));
  }

  static color(b: AppraisalBadge): string {
    if (!b.earned) return '#cbd5e1';
    return b.tier === 'gold' ? '#d97706' : b.tier === 'silver' ? '#64748b' : b.tier === 'bronze' ? '#b45309' : '#2563eb';
  }
}
