import { BaseController } from './BaseController';
import { TaskFormController } from './TaskFormController';
import { Services } from '../services';
import { FilePart } from '../services/ApiClient';
import { ScannedItem } from '../models';

export interface TaskScanState {
  scanning: boolean;
  /** A schedule was found: its dated rows wait for the user to choose. */
  items: ScannedItem[] | null;
  fileName: string;
  /** Rows ticked in the schedule picker (indexes into [items]). */
  checked: Set<number>;
}

/**
 * "Scan a file" on the task / template form: the server reads a PDF, Word
 * file, text file or photo and returns the fields it found. A single task
 * fills the form; a schedule (several dated rows) lets the user pick rows —
 * one fills a task, or each becomes its own template.
 */
export class TaskScanController extends BaseController<TaskScanState> {
  constructor(private readonly services: Services, private readonly form: TaskFormController) {
    super({ scanning: false, items: null, fileName: '', checked: new Set() });
  }

  get isTemplateForm(): boolean { return this.form.isTemplate; }

  /** Returns the message to show (and whether it is an error). */
  async scan(file: FilePart): Promise<{ message: string; error: boolean } | null> {
    this.setState({ scanning: true });
    try {
      const found = await this.services.tasks.scanTaskFile(file);
      if (found.items.length) {
        // Templates may take every row; a task takes one, so start with none ticked.
        this.setState({ items: found.items, fileName: file.name, checked: new Set(this.form.isTemplate ? found.items.map((_, i) => i) : []) });
        return null;
      }
      const filled: string[] = [];
      if (found.title) { this.form.setTitle(found.title); filled.push('title'); }
      if (found.instructions) { this.form.setInstructions(found.instructions); filled.push('instructions'); }
      if (found.startDate) { this.form.setStartDate(found.startDate); filled.push('start date'); }
      if (found.endDate) { this.form.setEndDate(found.endDate); filled.push('due date'); }
      if (found.dueTime) { this.form.setDueTime(found.dueTime); filled.push('due time'); }
      return filled.length
        ? { message: `Filled from ${file.name}: ${filled.join(', ')}. Please review before saving.`, error: false }
        : { message: 'Nothing that looks like a task was found in that file.', error: true };
    } catch (e) {
      return { message: BaseController.messageOf(e, 'Could not read that file'), error: true };
    } finally {
      this.setState({ scanning: false });
    }
  }

  toggle(i: number) {
    this.setState((s) => {
      // A task takes a single row; templates take any number.
      const checked = this.form.isTemplate ? new Set(s.checked) : new Set<number>();
      if (s.checked.has(i)) checked.delete(i); else checked.add(i);
      return { checked };
    });
  }

  toggleAll() {
    this.setState((s) => ({ checked: s.checked.size === (s.items?.length ?? 0) ? new Set() : new Set((s.items ?? []).map((_, i) => i)) }));
  }

  close() { this.setState({ items: null, checked: new Set() }); }

  /**
   * Applies the chosen rows: fills the task form with one, or creates one
   * template per row. Returns the confirmation and how many templates were made.
   */
  async apply(): Promise<{ message: string; error: boolean; templatesMade: number }> {
    const { items, checked, fileName } = this.state;
    const chosen = (items ?? []).filter((_, i) => checked.has(i));
    this.close();
    if (!this.form.isTemplate) {
      const item = chosen[0];
      if (!item) return { message: 'No row chosen.', error: true, templatesMade: 0 };
      this.form.setTitle(item.title);
      this.form.setStartDate(item.startDate);
      this.form.setEndDate(item.endDate);
      return { message: `Filled from ${fileName}. Please review before saving.`, error: false, templatesMade: 0 };
    }
    let made = 0;
    try {
      for (const item of chosen) {
        await this.services.tasks.createTemplate({
          title: item.title, instructions: `Scanned from ${fileName}.`,
          ...(item.startDate ? { start_date: item.startDate } : {}),
          ...(item.endDate ? { end_date: item.endDate } : {}),
        });
        made++;
      }
    } catch (e) {
      return { message: `Stopped after ${made} of ${chosen.length}: ${BaseController.messageOf(e)}`, error: true, templatesMade: made };
    }
    return { message: `${made} template${made === 1 ? '' : 's'} created from ${fileName}.`, error: false, templatesMade: made };
  }

  static dates(item: ScannedItem): string {
    if (!item.startDate && !item.endDate) return '';
    return item.startDate && item.endDate && item.startDate !== item.endDate ? `${item.startDate} → ${item.endDate}` : (item.endDate ?? item.startDate)!;
  }
}
