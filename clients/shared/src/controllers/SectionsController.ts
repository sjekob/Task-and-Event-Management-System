import { BaseController } from './BaseController';
import { GradeLevelMeta, Services } from '../services';
import { Section } from '../models';

export interface SectionsState {
  loading: boolean;
  sections: Section[];
  gradeLevels: GradeLevelMeta[];
  /** The section being added (id null) or renamed; null when the form is closed. */
  editing: { id: number | null; name: string; gradeLevelId: number | null } | null;
  saving: boolean;
  error: string | null;
}

/**
 * Personnel → Sections (principal/admin): the school's classes, each with its
 * adviser and subject teachers. Advisers and teaching loads are set per person
 * in Edit Role; this is where the sections themselves are added and renamed.
 */
export class SectionsController extends BaseController<SectionsState> {
  constructor(private readonly services: Services) {
    super({ loading: true, sections: [], gradeLevels: [], editing: null, saving: false, error: null });
  }

  async load() {
    try {
      const [sections, gradeLevels] = await Promise.all([this.services.personnel.sections(), this.services.personnel.gradeLevels()]);
      this.setState({ sections, gradeLevels, loading: false, error: null });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e, 'Failed to load sections') });
    }
  }

  /** The sections grouped by grade level, in grade order. */
  get byGrade(): { grade: string; sections: Section[] }[] {
    const out: { grade: string; sections: Section[] }[] = [];
    for (const x of this.state.sections) {
      const last = out[out.length - 1];
      if (last && last.grade === x.gradeLevel) last.sections.push(x);
      else out.push({ grade: x.gradeLevel, sections: [x] });
    }
    return out;
  }

  startAdd() { this.setState({ editing: { id: null, name: '', gradeLevelId: this.state.gradeLevels[0]?.id ?? null }, error: null }); }
  startEdit(x: Section) { this.setState({ editing: { id: x.id, name: x.name, gradeLevelId: x.gradeLevelId }, error: null }); }
  setEditing(patch: Partial<NonNullable<SectionsState['editing']>>) {
    if (this.state.editing) this.setState({ editing: { ...this.state.editing, ...patch } });
  }
  cancel() { this.setState({ editing: null, error: null }); }

  get canSave() { const e = this.state.editing; return !!e && e.name.trim().length > 0 && e.gradeLevelId !== null && !this.state.saving; }

  async save(): Promise<boolean> {
    const e = this.state.editing;
    if (!e || e.gradeLevelId === null) return false;
    this.setState({ saving: true, error: null });
    try {
      await this.services.personnel.saveSection(e.id, e.name.trim(), e.gradeLevelId);
      this.setState({ editing: null });
      await this.load();
      return true;
    } catch (err) {
      this.setState({ error: BaseController.messageOf(err) });
      return false;
    } finally {
      this.setState({ saving: false });
    }
  }

  async remove(x: Section) {
    await this.services.personnel.deleteSection(x.id);
    await this.load();
  }

  /** "Adviser: Mark P. Fuentes · 3 subject teachers". */
  static summary(x: Section): string {
    const n = new Set(x.teachers.map((t) => t.userId)).size;
    return `${x.adviserName ? `Adviser: ${x.adviserName}` : 'No adviser yet'} · ${n} subject teacher${n === 1 ? '' : 's'}`;
  }
}
