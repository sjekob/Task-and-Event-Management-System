import { BaseController } from './BaseController';
import { Services, GradeLevelMeta } from '../services';
import { Section, User } from '../models';
import { Format } from '../utils/format';

const EMPTY_ROW: SubjectRow = { gradeLevelId: null, subject: null, sectionIds: [] };

export const ASSIGNABLE_ROLES = ['principal', 'coordinator', 'dean', 'registrar', 'teacher'];

/** Coordinator delegation choices, grouped by category. */
export const COORDINATOR_TYPE_GROUPS: Record<string, string[]> = {
  'Subject & Curriculum': [
    'Filipino Coordinator', 'English Coordinator', 'Araling Panlipunan (Social Studies) Coordinator', 'Science Coordinator',
    'Mathematics Coordinator', 'EPP (Edukasyong Pantahanan at Pangkabuhayan) Coordinator',
    'MAPEH (Music, Arts, Physical Education, and Health) Coordinator',
  ],
  'Program & Special Project': [
    'SSES Coordinator', 'SBFP Coordinator', 'Brigada Eskwela Coordinator', 'Disaster Risk Reduction and Management (DRRM) Coordinator',
    'Feeding Program Coordinator', 'Gulayan sa Paaralan Coordinator', 'School Health Focal Person',
    'Youth for Environment in Schools Organization (YES-O) Coordinator',
  ],
  'Student & Extracurricular': [
    'Supreme Elementary Learner Government (SELG) Adviser', 'Girl Scout Coordinator', 'Twinkler Coordinator', 'Star Scout Coordinator',
    'Boy Scout Coordinator', 'KAB Scout Coordinator', 'Kid Scout Coordinator', 'School Paper Adviser',
  ],
  'Administrative & Support': [
    'Property Custodian', 'Library Coordinator', 'School Testing Coordinator',
    'ICT (Information and Communications Technology) Coordinator', 'LIS (Learner Info System) Coordinator',
    'School Information Coordinator', 'School Assessment Coordinator', 'Gender and Development (GAD) Coordinator',
    'External Partnership Focal Person',
  ],
};

/** A subject the person teaches, at a grade level, in some of that grade's sections. */
export interface SubjectRow { gradeLevelId: number | null; subject: string | null; sectionIds: number[] }

export interface EditRoleState {
  role: string;
  deanGradeLevelId: number | null;
  coordinatorType: string | null;
  /** "Is this teacher a class adviser?" and of which section. */
  isAdviser: boolean;
  advisorySectionId: number | null;
  sections: Section[];
  appointment: string;
  gradeLevels: GradeLevelMeta[];
  subjects: string[];
  rows: SubjectRow[];
  metaLoaded: boolean;
  /** Why the grade-level / subject lists couldn't be loaded (then the dialog offers Retry). */
  metaError: string | null;
  saving: boolean;
  error: string | null;
}

/** Edit role & assignment (principal/admin). Personal info stays owner-only. */
export class EditRoleController extends BaseController<EditRoleState> {
  constructor(private readonly services: Services, readonly user: User) {
    super({
      role: user.role,
      deanGradeLevelId: user.deanGradeLevelId ?? user.gradeLevelId,
      coordinatorType: user.coordinatorType,
      isAdviser: user.advisorySection !== null,
      advisorySectionId: user.advisorySection?.id ?? null,
      sections: [],
      appointment: user.dateOfAppointment ?? '',
      gradeLevels: [], subjects: [], rows: [], metaLoaded: false, metaError: null, saving: false, error: null,
    });
    void this.loadMeta();
  }

  /** Loads the grade levels, subjects and sections; on failure says so (no silently empty lists). */
  async loadMeta() {
    this.setState({ metaError: null, metaLoaded: false });
    let gradeLevels: GradeLevelMeta[], subjects: { name: string }[], sections: Section[];
    try {
      [gradeLevels, subjects, sections] = await Promise.all([
        this.services.personnel.gradeLevels(), this.services.personnel.subjects(), this.services.personnel.sections().catch(() => [] as Section[]),
      ]);
      if (!gradeLevels.length || !subjects.length) throw new Error('empty');
    } catch {
      this.setState({ metaError: "Couldn't load the grade levels and subjects. Check the connection and try again.", metaLoaded: true });
      return;
    }
    const rows = this.user.subjects.map((s) => ({
      gradeLevelId: gradeLevels.find((g) => g.name === s.gradeLevel)?.id ?? null,
      subject: s.subject,
      sectionIds: s.sections.map((x) => x.id),
    }));
    this.setState({ gradeLevels, subjects: subjects.map((s) => s.name), sections, rows: rows.length ? rows : [EMPTY_ROW], metaLoaded: true });
  }

  set(patch: Partial<Pick<EditRoleState, 'role' | 'deanGradeLevelId' | 'coordinatorType' | 'appointment' | 'isAdviser' | 'advisorySectionId'>>) {
    this.setState(patch);
  }

  /** Principals don't advise a class; every other role may also teach. */
  get canAdvise() { return this.state.role !== 'principal'; }

  /** Sections to advise: "Grade 1 - Rizal", noting one another teacher already advises. */
  get advisoryOptions(): { value: number; label: string }[] {
    return this.state.sections.map((x) => ({
      value: x.id,
      label: x.adviserId && x.adviserId !== this.user.id ? `${x.label} (advised by ${x.adviserName})` : x.label,
    }));
  }

  /** The sections of a row's grade level (all of them when no grade is chosen). */
  sectionsFor(row: SubjectRow): Section[] {
    return this.state.sections.filter((x) => row.gradeLevelId === null || x.gradeLevelId === row.gradeLevelId);
  }

  setRow(i: number, patch: Partial<SubjectRow>) {
    this.setState((s) => ({
      rows: s.rows.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        // A new grade level keeps only that grade's sections.
        if (patch.gradeLevelId !== undefined) next.sectionIds = next.sectionIds.filter((id) => this.sectionsFor(next).some((x) => x.id === id));
        return next;
      }),
    }));
  }

  toggleSection(i: number, sectionId: number) {
    const r = this.state.rows[i];
    if (!r) return;
    this.setRow(i, { sectionIds: r.sectionIds.includes(sectionId) ? r.sectionIds.filter((x) => x !== sectionId) : [...r.sectionIds, sectionId] });
  }

  addRow() { this.setState((s) => ({ rows: [...s.rows, EMPTY_ROW] })); }

  removeRow(i: number) {
    if (this.state.rows.length > 1) this.setState((s) => ({ rows: s.rows.filter((_, j) => j !== i) }));
  }

  async submit(): Promise<boolean> {
    const s = this.state;
    if (s.appointment && (!Format.isIsoDate(s.appointment) || Format.isFuture(s.appointment))) {
      this.setState({ error: 'Date of appointment must be a real date, not in the future.' });
      return false;
    }
    if (this.canAdvise && s.isAdviser && s.advisorySectionId === null) {
      this.setState({ error: 'Choose the section this teacher advises, or turn off "Class adviser".' });
      return false;
    }
    const teaches = s.rows.some((r) => r.subject) || (this.canAdvise && s.isAdviser);
    this.setState({ saving: true, error: null });
    try {
      await this.services.personnel.update(this.user.id, {
        role: s.role,
        ...(s.appointment ? { date_of_appointment: s.appointment } : {}),
        ...(s.role === 'dean' && s.deanGradeLevelId !== null ? { dean_grade_level_id: s.deanGradeLevelId } : {}),
        ...(s.role === 'coordinator' && s.coordinatorType ? { coordinator_type: s.coordinatorType } : {}),
        // Deans, coordinators and registrars who teach a subject or advise a class also hold the teacher identity.
        ...(['dean', 'coordinator', 'registrar'].includes(s.role) ? { also_teaching: teaches } : {}),
      });
      await this.services.personnel.updateSubjects(
        this.user.id,
        s.rows.filter((r) => r.subject).map((r) => ({ grade_level_id: r.gradeLevelId, subject: r.subject!, section_ids: r.sectionIds })),
      );
      const advisory = this.canAdvise && s.isAdviser ? s.advisorySectionId : null;
      if (advisory !== (this.user.advisorySection?.id ?? null)) await this.services.personnel.setAdvisory(this.user.id, advisory);
      return true;
    } catch (e) {
      this.setState({ error: BaseController.messageOf(e) });
      return false;
    } finally {
      this.setState({ saving: false });
    }
  }
}
