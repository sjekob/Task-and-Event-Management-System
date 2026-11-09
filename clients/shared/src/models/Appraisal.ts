import { Json, JsonReader as R } from './json';

/** IPCRF rating labels for a 1-5 rating (Quality, Efficiency, Timeliness). */
export const IPCRF_LABELS: Record<number, string> = { 5: 'Outstanding', 4: 'Very Satisfactory', 3: 'Satisfactory', 2: 'Unsatisfactory', 1: 'Poor' };

/** DepEd RPMS rating band for a 1-5 score. */
export function ipcrfRating(score: number): string {
  if (score >= 4.5) return 'Outstanding';
  if (score >= 3.5) return 'Very Satisfactory';
  if (score >= 2.5) return 'Satisfactory';
  return 'Unsatisfactory';
}

/** A means of verification: the assignee's submitted file or link. */
export interface Mov { id: string; type: 'file' | 'link'; name: string; url: string }

export class SpecialTaskEvaluation {
  constructor(
    readonly completionScore: number,
    readonly timelinessScore: number,
    readonly initiativeScore: number,
    readonly coordinationScore: number,
    readonly weightedAverage: number | null,
    readonly remarks: string | null,
  ) {}

  static fromJson(j: Json): SpecialTaskEvaluation {
    return new SpecialTaskEvaluation(
      R.num(j.completion_quality_score),
      R.num(j.timeliness_score),
      R.num(j.initiative_score),
      R.num(j.coordination_score),
      R.optNum(j.weighted_average),
      R.optStr(j.remarks),
    );
  }
}

export class SpecialTask {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly description: string | null,
    readonly assigneeId: number | null,
    readonly assigneeName: string | null,
    readonly assigneeRole: string | null,
    readonly assigneeDepartment: string | null,
    readonly assignerName: string | null,
    readonly dueDate: string | null,
    readonly submittedDate: string | null,
    readonly status: string,
    readonly evaluation: SpecialTaskEvaluation | null,
    readonly raw: Json,
    /** The assignee's actual submission (never the task creator's reference attachments). */
    readonly movs: Mov[] = [],
  ) {}

  static fromJson(j: Json): SpecialTask {
    const assignee = R.obj(j.assignee);
    const assigner = R.obj(j.assigner);
    const ev = R.obj(j.evaluation);
    return new SpecialTask(
      R.num(j.id),
      R.str(j.title),
      R.optStr(j.description),
      R.optNum(assignee?.id),
      R.optStr(assignee?.full_name),
      R.optStr(assignee?.role),
      R.optStr(assignee?.grade_level),
      R.optStr(assigner?.full_name),
      R.optStr(j.due_date),
      R.optStr(j.submitted_at),
      R.str(j.status, 'pending'),
      ev ? SpecialTaskEvaluation.fromJson(ev) : null,
      j,
      R.list(j.movs, (m: Json) => ({ id: R.str(m.id), type: m.attachment_type === 'link' ? 'link' as const : 'file' as const, name: R.str(m.name) || R.str(m.url), url: R.str(m.url) })),
    );
  }

  /** A top-score credit for committee work that wasn't automated (not a real task; nothing to evaluate). */
  get isAutoCredit(): boolean { return this.raw.auto_credit === true; }

  get scoreOutOf100(): number {
    const avg = this.evaluation?.weightedAverage;
    return avg == null ? 0 : Math.round(avg * 20);
  }

  get isEvaluated() { return this.evaluation !== null; }
}

export class EventEvaluation {
  constructor(
    readonly id: number,
    readonly evaluatorName: string,
    readonly evaluatorRole: string | null,
    readonly planningScore: number,
    readonly objectivesScore: number,
    readonly personnelScore: number,
    readonly timeMgmtScore: number,
    readonly engagementScore: number,
    readonly resourceScore: number,
    readonly feedbackComments: string | null,
    readonly dateSubmitted: string | null,
    readonly raw: Json,
  ) {}

  static fromJson(j: Json): EventEvaluation {
    return new EventEvaluation(
      R.num(j.id),
      R.str(j.evaluator_name),
      R.optStr(j.evaluator_role),
      R.num(j.planning_score),
      R.num(j.objectives_score),
      R.num(j.personnel_score),
      R.num(j.time_mgmt_score),
      R.num(j.engagement_score),
      R.num(j.resource_score),
      R.optStr(j.feedback_comments),
      R.optStr(j.date_submitted),
      j,
    );
  }

  get average(): number {
    return (
      (this.planningScore + this.objectivesScore + this.personnelScore +
        this.timeMgmtScore + this.engagementScore + this.resourceScore) / 6
    );
  }

  /** Recorded from a paper form by staff, with a photo or scan of it ([imageUrl]). */
  get isPaper() { return this.raw.is_paper === 1 || this.raw.is_paper === true; }
  get imageUrl(): string | null { return R.optStr(this.raw.image_url); }
  get evaluatorSex(): string | null { return R.optStr(this.raw.evaluator_sex); }
  get evaluatorAgeGroup(): string | null { return R.optStr(this.raw.evaluator_age_group); }
  get evaluatorAffiliation(): string | null { return R.optStr(this.raw.evaluator_affiliation); }
}

/** Who filled in an evaluation (same lists as the public form and the server). */
export const EVALUATOR_ROLES = ['student', 'parent', 'external stakeholder', 'visitor', 'teacher', 'coordinator', 'dean', 'registrar', 'principal'];
export const EVALUATOR_SEXES = ['Male', 'Female', 'Prefer not to say'];
export const EVALUATOR_AGE_GROUPS = ['17 and below', '18-24', '25-34', '35-44', '45-54', '55 and above'];
/** The 1-5 rating scale of the evaluation form. */
export const RATING_LABELS: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };

export const EVENT_CRITERIA: { key: keyof EventEvaluation & string; json: string; label: string }[] = [
  { key: 'planningScore', json: 'planning_score', label: 'Planning & Preparation' },
  { key: 'objectivesScore', json: 'objectives_score', label: 'Achievement of Objectives' },
  { key: 'personnelScore', json: 'personnel_score', label: 'Personnel / Facilitators' },
  { key: 'timeMgmtScore', json: 'time_mgmt_score', label: 'Time Management' },
  { key: 'engagementScore', json: 'engagement_score', label: 'Participant Engagement' },
  { key: 'resourceScore', json: 'resource_score', label: 'Use of Resources' },
];

export class EventForAppraisal {
  constructor(
    readonly id: number,
    readonly title: string,
    readonly description: string | null,
    readonly targetDate: string | null,
    readonly venue: string | null,
    readonly status: string,
    readonly organizerName: string | null,
    readonly department: string | null,
    readonly expectedAttendees: number | null,
    readonly evaluations: EventEvaluation[],
    /** Evaluator breakdown: {total, by_role, by_sex, by_age_group} (counts). */
    readonly demographics: Json,
  ) {}

  static fromJson(j: Json): EventForAppraisal {
    return new EventForAppraisal(
      R.num(j.id),
      R.str(j.title),
      R.optStr(j.description),
      R.optStr(j.target_date),
      R.optStr(j.venue),
      R.str(j.status, 'pending_approval'),
      R.optStr(R.obj(j.organizer)?.full_name),
      R.optStr(j.department),
      R.optNum(j.expected_attendees),
      R.list(j.evaluations, EventEvaluation.fromJson),
      R.obj(j.demographics) ?? {},
    );
  }

  get avgRating(): number {
    if (!this.evaluations.length) return 0;
    return this.evaluations.reduce((s, e) => s + e.average, 0) / this.evaluations.length;
  }

  /** 0-5 average mapped to 0-100%. */
  get evidencyRate(): number {
    return (this.avgRating / 5) * 100;
  }

  /** Average of each rubric criterion across the evaluations (the results' aggregate summary). */
  get criterionAverages(): { label: string; avg: number }[] {
    const n = this.evaluations.length;
    return EVENT_CRITERIA.map((c) => ({
      label: c.label,
      avg: n ? this.evaluations.reduce((s, e) => s + Number(e[c.key]), 0) / n : 0,
    }));
  }

  get paperCount() { return this.evaluations.filter((e) => e.isPaper).length; }

  get shortDate(): string {
    return this.targetDate?.split('T')[0] ?? '—';
  }
}

export class AppraisalBadge {
  constructor(
    readonly code: string,
    readonly name: string,
    readonly description: string,
    readonly icon: string,
    /** bronze | silver | gold */
    readonly tier: string | null,
    readonly earned: boolean,
    readonly progress: number,
    readonly target: number,
  ) {}

  static fromJson(j: Json): AppraisalBadge {
    return new AppraisalBadge(
      R.str(j.code),
      R.str(j.name),
      R.str(j.description),
      R.str(j.icon),
      R.optStr(j.tier),
      j.earned === true,
      R.num(j.progress),
      R.num(j.target, 1),
    );
  }

  get fraction(): number {
    return this.target > 0 ? Math.min(1, this.progress / this.target) : 0;
  }
}

/** One row of the badge leaderboard. */
export class BadgeLeader {
  constructor(
    readonly id: number,
    readonly fullName: string,
    readonly role: string,
    readonly gradeLevel: string | null,
    readonly earnedCount: number,
    readonly badges: AppraisalBadge[],
    readonly avatarUrl: string | null,
  ) {}

  static fromJson(j: Json): BadgeLeader {
    return new BadgeLeader(
      R.num(j.id),
      R.str(j.full_name),
      R.str(j.role),
      R.optStr(j.grade_level),
      R.num(j.earned_count),
      R.list(j.badges, AppraisalBadge.fromJson),
      R.optStr(j.avatar_url),
    );
  }
}
