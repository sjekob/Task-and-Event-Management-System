// Submission status and points shared by the task screens on web and mobile.
import type { Report, Task, User } from '../types';
import { parseIsoDate, parseTimestamp, taskDeadline } from './dates';
import type { Tone } from './assign';
import { flag } from './session';

/** Points a submitted report earns, and why (early / on time / late). */
export function reportPoints(task: Task, report: Report): { points: number; reason: string } {
  const due = parseIsoDate(task.end_date);
  const submitted = parseTimestamp(report.report_date, false);
  let points = 0;
  if (due && submitted) {
    const hours = (submitted.getTime() - due.getTime()) / 3_600_000;
    points = hours <= -24 ? task.points_early ?? 100
      : hours <= 0 ? task.points_ontime ?? 100
        : hours <= 24 ? task.points_late24 ?? 50
          : task.points_after24 ?? 0;
  }
  return { points, reason: points >= 100 ? 'On time' : points >= 50 ? 'Late (within 24h)' : 'Late (after 24h)' };
}

/**
 * One assignee's status for reviewers: their report (if visible) decides
 * Completed / Pending review / Marked missing; otherwise Submitted (log only),
 * Missing (past deadline) or Not submitted.
 */
export function assigneeStatus(u: User, report: Report | undefined, pastDue: boolean): { label: string; tone: Tone } {
  if (report) {
    if (report.report_status === 'Completed') return { label: 'Completed', tone: 'green' };
    if (report.report_status === 'Missing') return { label: 'Marked missing', tone: 'red' };
    return { label: 'Pending review', tone: 'blue' };
  }
  if (flag(u.submitted)) return { label: 'Submitted', tone: 'green' };
  return pastDue ? { label: 'Missing', tone: 'red' } : { label: 'Not submitted', tone: 'amber' };
}

/**
 * The people a reviewer tracks: everyone, or (team_scope 'mine') only those
 * the viewer assigned, with submitted / missing counts.
 */
export function teamProgress(task: Task, viewerId: number) {
  const all = task.assigned_users ?? [];
  const mineOnly = task.team_scope === 'mine';
  const team = mineOnly ? all.filter((u) => u.assigned_by === viewerId) : all;
  const dl = taskDeadline(task);
  const pastDue = !!dl && dl < new Date();
  const submitted = team.filter((u) => flag(u.submitted)).length;
  const missing = pastDue ? team.length - submitted : 0;
  return { team, mineOnly, total: team.length, submitted, missing, pastDue, everyone: all.length };
}
