// Appraisal figures shared by the web and mobile appraisal screens.
import type { EventEvaluation, EventForAppraisal, SpecialTask } from '../types';

/** Special-task weighted average (0-5) as a score out of 100. */
export const scoreOutOf100 = (t: SpecialTask) =>
  t.evaluation?.weighted_average != null ? Math.round(t.evaluation.weighted_average * 20) : 0;

export const evaluationAverage = (e: EventEvaluation) =>
  (e.planning_score + e.objectives_score + e.personnel_score + e.time_mgmt_score + e.engagement_score + e.resource_score) / 6;

/** Average 0-5 rating across an event's evaluations. */
export const eventAverage = (e: EventForAppraisal) =>
  e.evaluations.length ? e.evaluations.reduce((s, x) => s + evaluationAverage(x), 0) / e.evaluations.length : 0;

/** "Evidency rate": the 0-5 average as a percentage. */
export const evidencyRate = (e: EventForAppraisal) => (eventAverage(e) / 5) * 100;

/** Green ≥ 80, amber 50-79, red < 50 (compliance and evidency). */
export const rateColor = (pct: number) => (pct >= 80 ? '#16A34A' : pct >= 50 ? '#EA580C' : '#EF4444');

/** Estimated special-task score from the three rubric ratings (1-5). */
export const estimatedTaskScore = (completion: number, timeliness: number, initiative: number) =>
  Math.round((completion * 40 + timeliness * 30 + initiative * 30) / 5);

/** Event appraisal status for display: completed once rated, awaiting once approved. */
export const eventAppraisalStatus = (e: EventForAppraisal) =>
  e.evaluations.length ? 'completed' : e.status === 'approved' ? 'awaiting_ratings' : e.status;

export const APPRAISAL_STATUS: Record<string, [string, string]> = {
  evaluated: ['Evaluated', '#22C55E'],
  flagged: ['Flagged', '#EF4444'],
  not_submitted: ['Not Submitted', '#EF4444'],
  pending: ['Pending', '#F59E0B'],
  pending_approval: ['Pending Approval', '#F59E0B'],
  awaiting_ratings: ['Awaiting Ratings', '#F59E0B'],
  approved: ['Approved', '#3B82F6'],
  draft: ['Draft', '#9CA3AF'],
  disabled: ['Disabled', '#EF4444'],
  completed: ['Completed', '#22C55E'],
  ongoing: ['Ongoing', '#3B82F6'],
};

export const BADGE_TIER_COLORS: Record<string, string> = { gold: '#D97706', silver: '#64748B', bronze: '#B45309' };
