import { BaseController } from './BaseController';
import { Services } from '../services';
import { FilePart } from '../services/ApiClient';
import { EventForAppraisal, ipcrfRating, SpecialTask } from '../models';
import { EVENT_RATING_CRITERIA } from './appraisalStats';

// Rating special tasks and events.
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

// ── Paper evaluations ────────────────────────────────────────────────────────

type PaperState = {
  image: FilePart | null;
  name: string; role: string; sex: string; ageGroup: string; affiliation: string;
  /** Rating per criterion (json key, e.g. planning_score), 1-5; 0 = not chosen yet. */
  scores: Record<string, number>;
  comments: string;
  submitting: boolean;
  error: string | null;
};

/**
 * Records an evaluation that an attendee filled in on paper: a photo or scan
 * of the form as proof, who filled it in, the six 1-5 ratings and remarks.
 * (Ported from Lok's appraisal update.)
 */
export class PaperEvaluationController extends BaseController<PaperState> {
  constructor(private readonly services: Services, readonly event: EventForAppraisal) {
    super({
      image: null, name: '', role: 'student', sex: '', ageGroup: '', affiliation: '',
      scores: Object.fromEntries(EVENT_RATING_CRITERIA.map((c) => [c.key, 0])), comments: '', submitting: false, error: null,
    });
  }

  set(patch: Partial<Pick<PaperState, 'name' | 'role' | 'sex' | 'ageGroup' | 'affiliation' | 'comments'>>) { this.setState({ ...patch, error: null }); }
  setImage(image: FilePart | null) { this.setState({ image, error: null }); }
  rate(key: string, v: number) { this.setState((s) => ({ scores: { ...s.scores, [key]: v }, error: null })); }

  /** What's still missing (empty when it can be saved). */
  get missing(): string[] {
    const s = this.state;
    const out: string[] = [];
    if (!s.image) out.push('a photo or scan of the form');
    const unrated = EVENT_RATING_CRITERIA.filter((c) => !(s.scores[c.key] >= 1));
    if (unrated.length) out.push(unrated.length === EVENT_RATING_CRITERIA.length ? 'the ratings' : `${unrated.length} more rating${unrated.length === 1 ? '' : 's'}`);
    return out;
  }

  /** Saves it; returns the event with its evaluations, or null (error in state). */
  async submit(): Promise<EventForAppraisal | null> {
    const s = this.state;
    if (this.missing.length) { this.setState({ error: `Add ${this.missing.join(' and ')}.` }); return null; }
    this.setState({ submitting: true, error: null });
    try {
      return await this.services.appraisal.submitPaperEvaluation(this.event.id, {
        ...Object.fromEntries(Object.entries(s.scores).map(([k, v]) => [k, String(v)])),
        evaluator_name: s.name.trim(), evaluator_role: s.role, evaluator_sex: s.sex, evaluator_age_group: s.ageGroup,
        evaluator_affiliation: s.affiliation.trim(), feedback_comments: s.comments.trim(),
      }, s.image!);
    } catch (e) {
      this.setState({ error: BaseController.messageOf(e, 'Could not record the paper evaluation') });
      return null;
    } finally {
      this.setState({ submitting: false });
    }
  }
}
