import { BaseController } from './BaseController';
import { Services } from '../services';
import { SchoolYear } from '../models';
import { Format } from '../utils/format';

/**
 * Principal/admin page for when each school year and its terms start and end.
 * Records dated in an ended school year are archived.
 */
export class SchoolYearsController extends BaseController<{ years: SchoolYear[]; loading: boolean; error: string | null }> {
  constructor(private readonly services: Services) {
    super({ years: [], loading: true, error: null });
  }

  async load() {
    this.setState({ loading: true, error: null });
    try {
      this.setState({ years: await this.services.schoolYears.list(), loading: false });
    } catch (e) {
      this.setState({ loading: false, error: BaseController.messageOf(e) });
    }
  }

  async remove(y: SchoolYear) {
    await this.services.schoolYears.remove(y.id);
    await this.load();
  }

  static statusStyle(status: string): { label: string; tone: 'green' | 'amber' | 'blue' } {
    if (status === 'current') return { label: 'Current', tone: 'green' };
    if (status === 'archived') return { label: 'Archived', tone: 'amber' };
    return { label: 'Upcoming', tone: 'blue' };
  }

  static range(start: string, end: string) {
    return `${Format.date(start, start)} – ${Format.date(end, end)}`;
  }
}

export interface TermDraft { name: string; start: string; end: string }

export interface SchoolYearFormState {
  name: string;
  start: string;
  end: string;
  terms: TermDraft[];
  saving: boolean;
  error: string | null;
}

/** Add / edit a school year and its terms. */
export class SchoolYearFormController extends BaseController<SchoolYearFormState> {
  static readonly TERM_NAMES = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];

  constructor(private readonly services: Services, readonly existing: SchoolYear | null) {
    super({
      name: existing?.name ?? '',
      start: existing?.startDate.slice(0, 10) ?? '',
      end: existing?.endDate.slice(0, 10) ?? '',
      terms: existing?.terms.map((t) => ({ name: t.name, start: t.startDate.slice(0, 10), end: t.endDate.slice(0, 10) })) ?? [],
      saving: false, error: null,
    });
  }

  get title() { return this.existing ? `Edit S.Y. ${this.existing.name}` : 'Add school year'; }
  get submitLabel() { return this.existing ? 'Save changes' : 'Add school year'; }

  set(patch: Partial<Pick<SchoolYearFormState, 'name' | 'start' | 'end'>>) { this.setState({ ...patch, error: null }); }

  setTerm(i: number, patch: Partial<TermDraft>) {
    this.setState((s) => ({ terms: s.terms.map((t, j) => (j === i ? { ...t, ...patch } : t)), error: null }));
  }

  /** New term named "Nth Quarter", starting the day after the previous one ends. */
  addTerm() {
    const { terms, start } = this.state;
    const prevEnd = terms.length ? Format.parseDate(terms[terms.length - 1].end) : null;
    const next = prevEnd ? Format.isoDate(new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1)) : terms.length ? '' : start;
    const name = terms.length < SchoolYearFormController.TERM_NAMES.length ? SchoolYearFormController.TERM_NAMES[terms.length] : `Term ${terms.length + 1}`;
    this.setState({ terms: [...terms, { name, start: next, end: '' }] });
  }

  removeTerm(i: number) { this.setState((s) => ({ terms: s.terms.filter((_, j) => j !== i) })); }

  async save(): Promise<boolean> {
    const s = this.state;
    if (!s.name.trim() || !s.start || !s.end) {
      this.setState({ error: 'Enter the school year name and both dates.' });
      return false;
    }
    if (s.terms.some((t) => !t.name.trim() || !t.start || !t.end)) {
      this.setState({ error: 'Give every term a name, a start date and an end date.' });
      return false;
    }
    this.setState({ saving: true, error: null });
    try {
      await this.services.schoolYears.save({
        name: s.name.trim(), start_date: s.start, end_date: s.end,
        terms: s.terms.map((t) => ({ name: t.name.trim(), start_date: t.start, end_date: t.end })),
      }, this.existing?.id);
      return true;
    } catch (e) {
      this.setState({ saving: false, error: BaseController.messageOf(e) });
      return false;
    }
  }
}
