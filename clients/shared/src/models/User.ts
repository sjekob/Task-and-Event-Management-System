import { Json, JsonReader as R } from './json';
import { CertificationInfo } from './Certificate';
import { AdvisorySection, advisoryFromJson } from './Section';

export type Role = 'admin' | 'principal' | 'coordinator' | 'dean' | 'registrar' | 'teacher';

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  principal: 'Principal',
  coordinator: 'Coordinator',
  dean: 'Dean',
  registrar: 'Registrar',
  teacher: 'Teacher',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export class UserSubject {
  constructor(
    readonly subject: string,
    readonly gradeLevel: string | null = null,
    /** The sections this subject is taught in. */
    readonly sections: { id: number; name: string }[] = [],
  ) {}

  static fromJson(j: Json): UserSubject {
    return new UserSubject(R.str(j.subject), R.optStr(j.grade_level), R.list(j.sections, (s: Json) => ({ id: R.num(s.id), name: R.str(s.name) })));
  }
}

/** DepEd-aligned educational background (EDUCATION_BACKGROUND). */
export class Education {
  constructor(
    readonly highestAttainment: string | null = null,
    readonly undergraduateDegree: string | null = null,
    readonly specialization: string | null = null,
    readonly postgraduateFocus: string | null = null,
  ) {}

  static fromJson(j: Json | null | undefined): Education {
    return new Education(
      R.optStr(j?.highest_attainment),
      R.optStr(j?.undergraduate_degree),
      R.optStr(j?.specialization),
      R.optStr(j?.postgraduate_focus),
    );
  }

  /** Empty string clears a field server-side. */
  toJson(): Json {
    return {
      highest_attainment: this.highestAttainment ?? '',
      undergraduate_degree: this.undergraduateDegree ?? '',
      specialization: this.specialization ?? '',
      postgraduate_focus: this.postgraduateFocus ?? '',
    };
  }

  get isEmpty(): boolean {
    return !this.highestAttainment && !this.undergraduateDegree && !this.specialization && !this.postgraduateFocus;
  }

  /** Postgraduate focus only applies from "With Master's Units" upward. */
  static allowsPostgraduate(attainment: string | null | undefined): boolean {
    if (!attainment) return false;
    const a = attainment.toLowerCase();
    return a.includes('master') || a.includes('doctor') || a.includes('phd') || a.includes('ed.d');
  }
}

/** A skill held by a person, with its taxonomy category. */
export class SkillInfo {
  constructor(readonly name: string, readonly category: string | null = null) {}

  static fromJson(j: Json): SkillInfo {
    return new SkillInfo(R.str(j.name), R.optStr(j.category));
  }
}

export class User {
  id = 0;
  username = '';
  fullName = '';
  firstName: string | null = null;
  middleName: string | null = null;
  lastName: string | null = null;
  suffix: string | null = null;
  role = 'teacher';
  avatarUrl: string | null = null;
  gradeLevelId: number | null = null;
  gradeLevel: string | null = null;
  email: string | null = null;
  phoneNumber: string | null = null;
  /** Life-context guardrails for task suggestions (owner-editable). */
  skills: string[] = [];
  certifications: string[] = [];
  skillDetails: SkillInfo[] = [];
  certificationDetails: CertificationInfo[] = [];
  education = new Education();
  /** What this session may do, decided by the backend (login / /api/auth/me). */
  permissions = new Set<string>();
  /** Roles this session may assign tasks to ("Assign as"). */
  assignableRoles: string[] = [];
  /** Required personal details not filled in yet (the first-sign-in form asks for them). */
  missingProfile: string[] = [];
  /** Whether the caller may (de)activate this account (personnel list; decided by the backend). */
  canToggleStatus = false;
  dateOfAppointment: string | null = null;
  birthdate: string | null = null;
  address: string | null = null;
  isActive = true;
  subjects: UserSubject[] = [];
  coordinatorType: string | null = null;
  alsoTeaching = false;
  /** The class this person advises, if any. */
  advisorySection: AdvisorySection | null = null;
  deanGradeLevelId: number | null = null;
  deanGradeLevel: string | null = null;

  static fromJson(j: Json): User {
    const u = new User();
    u.id = R.num(j.id);
    u.username = R.str(j.username);
    u.fullName = R.str(j.full_name);
    u.firstName = R.optStr(j.first_name);
    u.middleName = R.optStr(j.middle_name);
    u.lastName = R.optStr(j.last_name);
    u.suffix = R.optStr(j.suffix);
    u.role = R.str(j.role, 'teacher');
    u.avatarUrl = R.optStr(j.avatar_url);
    u.gradeLevelId = R.optNum(j.grade_level_id);
    u.gradeLevel = R.optStr(j.grade_level);
    u.email = R.optStr(j.email);
    u.phoneNumber = R.optStr(j.phone_number);
    u.skills = R.strList(j.skills);
    u.certifications = R.strList(j.certifications);
    u.skillDetails = R.list(j.skill_details, SkillInfo.fromJson);
    u.certificationDetails = R.list(j.certification_details, CertificationInfo.fromJson);
    u.education = Education.fromJson(R.obj(j.education));
    u.permissions = new Set(R.strList(j.permissions));
    u.assignableRoles = R.strList(j.assignable_roles);
    u.missingProfile = R.strList(j.missing_profile);
    u.canToggleStatus = R.bool(j.can_toggle_status);
    u.dateOfAppointment = R.optStr(j.date_of_appointment);
    u.birthdate = R.optStr(j.birthdate);
    u.address = R.optStr(j.address);
    u.isActive = (j.is_active ?? 1) === 1 || j.is_active === true;
    u.subjects = R.list(j.subjects, UserSubject.fromJson);
    u.coordinatorType = R.optStr(j.coordinator_type);
    u.alsoTeaching = j.also_teaching === true;
    u.advisorySection = advisoryFromJson(j.advisory_section);
    u.deanGradeLevelId = R.optNum(j.dean_grade_level_id);
    u.deanGradeLevel = R.optStr(j.dean_grade_level);
    return u;
  }

  get isAdmin() { return this.role === 'admin'; }
  get isPrincipal() { return this.role === 'principal'; }
  get isCoordinator() { return this.role === 'coordinator'; }
  get isDean() { return this.role === 'dean'; }
  get isTeacher() { return this.role === 'teacher'; }
  get isRegistrar() { return this.role === 'registrar'; }

  /** Whether the backend granted this session [permission]. The server enforces it anyway. */
  can(permission: string): boolean {
    return this.permissions.has(permission);
  }

  get isManager() { return this.can('create_tasks'); }
  get canReviewSubmissions() { return this.can('review_submissions'); }
  get canAssign() { return this.can('assign_tasks'); }

  get initials(): string {
    return this.fullName ? this.fullName.charAt(0).toUpperCase() : 'U';
  }

  get roleLabel(): string {
    return roleLabel(this.role);
  }

  /** Grade shown in lists: dean's grade, else subject grades, else the advisory grade. */
  get displayGrade(): string {
    if (this.deanGradeLevel) return this.deanGradeLevel;
    const grades = [...new Set(this.subjects.map((s) => s.gradeLevel).filter((g): g is string => !!g))];
    if (grades.length) return grades.join(', ');
    return this.gradeLevel ?? '—';
  }

  get subjectNames(): string {
    const names = [...new Set(this.subjects.map((s) => s.subject).filter(Boolean))];
    return names.length ? names.join(', ') : '—';
  }
}
