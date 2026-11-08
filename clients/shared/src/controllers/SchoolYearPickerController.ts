import { BaseController } from './BaseController';
import { Services } from '../services';
import { SchoolYear, SchoolYearFilter } from '../models';

export interface SchoolYearOption {
  key: string;
  filter: SchoolYearFilter;
  label: string;
  /** "Current", "Archived", "Upcoming", "Now" */
  note: string | null;
  indent: boolean;
}

/**
 * Chooses which school year (optionally a term) a list shows. Lists default to
 * the current year; ended years are archived and viewable here. Shows nothing
 * until the principal has set up at least one school year.
 */
export class SchoolYearPickerController extends BaseController<{ years: SchoolYear[] }> {
  private static cache: SchoolYear[] | null = null;

  constructor(private readonly services: Services, private readonly includeTerms = false) {
    super({ years: SchoolYearPickerController.cache ?? [] });
    void this.load();
  }

  private async load() {
    try {
      const years = await this.services.schoolYears.list();
      SchoolYearPickerController.cache = years;
      this.setState({ years });
    } catch {
      /* the picker is optional */
    }
  }

  static keyOf(f: SchoolYearFilter): string {
    return `${f.schoolYear}|${f.termId ?? ''}`;
  }

  options(): SchoolYearOption[] {
    const years = this.state.years;
    if (!years.length) return [];
    const current = years.find((y) => y.isDefault) ?? null;
    const out: SchoolYearOption[] = [];
    const add = (filter: SchoolYearFilter, label: string, note: string | null = null, indent = false) => {
      const key = SchoolYearPickerController.keyOf(filter);
      if (!out.some((o) => o.key === key)) out.push({ key, filter, label, note, indent });
    };
    add(SchoolYearFilter.current, current ? `S.Y. ${current.name}` : 'Current school year', current ? 'Current' : null);
    for (const y of years) {
      if (y.id !== current?.id) {
        add(new SchoolYearFilter(String(y.id)), `S.Y. ${y.name}`, y.status === 'archived' ? 'Archived' : y.status === 'upcoming' ? 'Upcoming' : null);
      }
      if (this.includeTerms) {
        for (const t of y.terms) {
          add(new SchoolYearFilter(String(y.id), t.id), `${t.name} · ${y.name}`, t.status === 'current' ? 'Now' : null, true);
        }
      }
    }
    add(new SchoolYearFilter('all'), 'All school years');
    return out;
  }

  /** The option for [value], falling back to the current year. */
  selected(value: SchoolYearFilter): SchoolYearOption | null {
    const opts = this.options();
    return opts.find((o) => o.key === SchoolYearPickerController.keyOf(value)) ?? opts[0] ?? null;
  }
}
