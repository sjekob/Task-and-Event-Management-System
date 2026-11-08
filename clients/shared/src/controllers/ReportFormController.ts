import { BaseController } from './BaseController';
import { Services, FilePart } from '../services';

export interface ReportFormState {
  showOptions: boolean;
  type: 'file' | 'link' | null;
  link: string;
  file: FilePart | null;
  submitting: boolean;
}

/** The assignee's "Files & Links" submission. */
export class ReportFormController extends BaseController<ReportFormState> {
  constructor(private readonly services: Services, private readonly taskId: number) {
    super({ showOptions: false, type: null, link: '', file: null, submitting: false });
  }

  get hasContent() { return this.state.file !== null || this.state.link.trim() !== ''; }

  toggleOptions() {
    this.setState((s) => ({ showOptions: !s.showOptions, type: s.showOptions ? null : s.type }));
  }

  choose(type: 'file' | 'link') { this.setState({ type, showOptions: false }); }
  setLink(link: string) { this.setState({ link }); }
  setFile(file: FilePart) { this.setState({ file, showOptions: false }); }
  /** Removes the added file or link. */
  clear() { this.setState({ type: null, link: '', file: null, showOptions: false }); }

  /** Submits; throws with a readable message. */
  async submit(): Promise<void> {
    const s = this.state;
    if (!this.hasContent) return;
    this.setState({ submitting: true });
    try {
      const title = s.type === 'link' ? s.link.trim() : s.file?.name ?? 'File submission';
      await this.services.tasks.submitReport(this.taskId, {
        reportTitle: title,
        reportType: s.type ?? undefined,
        reportLinkUrl: s.type === 'link' ? s.link.trim() : undefined,
      });
      if (s.type === 'file' && s.file) {
        // The file is the MOV evaluators review, so a failed upload must be reported.
        try {
          await this.services.tasks.uploadReportFile(this.taskId, s.file);
        } catch (e) {
          throw new Error(`Your report was saved, but the file didn't upload (${BaseController.messageOf(e)}). Unsubmit it and try again.`);
        }
      }
      this.setState({ type: null, link: '', file: null });
    } finally {
      this.setState({ submitting: false });
    }
  }
}
