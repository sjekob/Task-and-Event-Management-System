import { Json, JsonReader as R } from './json';

import { User } from './User';

/**
 * An assignable person ranked for a task by POST /api/users/assignable/suggestions.
 * Fit score parts: competency (certificates and skills) 0-70, workload (assigned tasks) 0-30.
 */
export class AssigneeSuggestion {
  constructor(
    readonly user: User,
    readonly score: number,
    readonly isMatch: boolean,
    readonly reasons: string[],
    readonly loadFactors: string[],
    readonly matchedSkills: string[],
    readonly matchedCertifications: string[],
    readonly relatedCertifications: string[],
    readonly openTasks: number,
    readonly fitCompetency: number,
    readonly fitWorkload: number,
    /** low | moderate | high: how loaded the person already is. */
    readonly burden: string,
  ) {}

  static fromJson(j: Json): AssigneeSuggestion {
    const fit = R.obj(j.fit) ?? {};
    return new AssigneeSuggestion(
      User.fromJson(j),
      R.num(j.score),
      j.is_match === true,
      R.strList(j.reasons),
      R.strList(j.load_factors),
      R.strList(j.matched_skills),
      R.strList(j.matched_certifications),
      R.strList(j.related_certifications),
      R.num(j.open_tasks),
      R.num(fit.competency),
      R.num(fit.workload),
      R.str(j.burden, 'low'),
    );
  }

  get isHighBurden() { return this.burden === 'high'; }
}
