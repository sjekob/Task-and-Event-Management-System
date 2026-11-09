import { BaseController } from './BaseController';
import { SessionController } from './SessionController';
import { Services } from '../services';
import { FilePart } from '../services/ApiClient';
import { ProposalReading } from '../services/EventService';
import { Json, VENUE_RADIUS_RANGE, parseEventDate } from '../models';
import { Format } from '../utils/format';
import { richToPlain } from '../utils/richText';
import { draftFromReading, orderProposalFiles, readingSummary } from './proposalReading';
import { DEFAULT_DUE_DAYS, EMPTY_MEMBER, MemberRow, MemberText, NEW_ROW, ProposalDraft, RowListKey, STEP_TITLES, draftFromEvent, draftTotals, firstEmptyField, draftToPayload } from './proposalDraft';

export interface ProposalFormState {
  step: number;
  d: ProposalDraft;
  submitting: boolean;
  /** Day keys already taken by a pending/approved event. */
  takenDays: Set<string>;
  dateIssue: string | null;
  /** Non-blocking: the date overlaps a mandatory DepEd calendar entry. */
  dateWarning: string | null;
  checkingDate: boolean;
  /** Accounts a TWG member can be linked to (for a special task or the top score). */
  people: { id: number; name: string }[];
  /** Showing the "Upload your event proposal" area (new proposals start there). */
  uploading: boolean;
  /** "Reading proposal.docx…" while the server reads a file. */
  reading: string | null;
}

/**
 * The 6-step event proposal form (create or edit). Unsubmitted work is saved
 * as a draft when the form closes, and on logout / token expiry.
 */
export class ProposalFormController extends BaseController<ProposalFormState> {
  /** Saved or submitted already, so no duplicate draft on exit. */
  private persisted = false;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly autosave = () => this.autoSaveDraft();
  /** The form as opened, to tell whether reading a file would overwrite typed work. */
  private readonly initial: string;
  /** The uploaded proposal (one Word or PDF file), kept to submit it as is. */
  private sourceFile: FilePart | null = null;
  /** The event this form created (a draft saved earlier), so later saves update it. */
  private createdId: number | null = null;

  constructor(private readonly services: Services, private readonly session: SessionController, readonly existing: Json | null) {
    super({
      step: 0, d: draftFromEvent(existing), submitting: false, takenDays: new Set(), dateIssue: null, dateWarning: null, checkingDate: false,
      people: [], uploading: existing === null, reading: null,
    });
    this.initial = JSON.stringify(this.state.d);
    session.registerDraftAutosave(this.autosave);
    void this.loadTakenDays();
    void this.loadPeople();
  }

  get isEditing() { return this.existing !== null; }
  get existingId(): number | null { return this.existing ? Number(this.existing.id) : null; }

  /** Approved/disabled proposals aren't silently demoted back to draft. */
  get canSaveAsDraft() {
    const st = this.existing?.status as string | undefined;
    return !st || st === 'draft' || st === 'pending_approval' || this.isReturned;
  }

  /** Sent back by the approver: saving keeps it returned, submitting resubmits it. */
  get isReturned() {
    const st = this.existing?.status;
    return st === 'rejected' || st === 'revisions_requested';
  }

  // ── Filling from a proposal file ──
  showUpload(uploading: boolean) { this.setState({ uploading }); }
  get isDirty() { return JSON.stringify(this.state.d) !== this.initial; }
  get readingSummary() { return readingSummary(this.state.d); }

  /** Reads the chosen file(s); returns the reading to apply, or an error message. */
  async readFiles(files: FilePart[]): Promise<{ reading: ProposalReading; files: string[] } | string> {
    const ordered = orderProposalFiles(files);
    if (typeof ordered === 'string') return ordered;
    this.setState({ reading: ordered.length > 1 ? `Reading ${ordered.length} page photos…` : `Reading ${ordered[0].name}…` });
    try {
      const reading = await this.services.events.readProposal(ordered);
      // One Word or PDF file can also be submitted as is (photos are read only).
      this.sourceFile = ordered.length === 1 && /\.(pdf|docx?)$/i.test(ordered[0].name) ? ordered[0] : null;
      return { reading, files: ordered.map((f) => f.name) };
    } catch (e) {
      return BaseController.messageOf(e, 'Could not read the proposal file');
    } finally {
      this.setState({ reading: null });
    }
  }

  /** Fills the form from a reading (ask first when [isDirty]: it replaces what was typed). */
  applyReading(r: { reading: ProposalReading; files: string[] }) {
    this.setState((s) => ({ d: draftFromReading(r.reading, r.files, s.d), step: 0, uploading: false }));
    if (this.state.d.targetDate.trim()) this.scheduleDateCheck();
  }

  // ── Venue pin (attendance geofence) ──
  setVenuePin(venuePin: { lat: number; lng: number } | null) { this.patch({ venuePin }); }
  setVenueRadius(radius: number) {
    this.patch({ venueRadius: Math.round(Math.max(VENUE_RADIUS_RANGE.min, Math.min(VENUE_RADIUS_RANGE.max, radius || VENUE_RADIUS_RANGE.min))) });
  }

  // ── Editing ──
  private patch(p: Partial<ProposalDraft>) { this.setState((s) => ({ d: { ...s.d, ...p } })); }

  set<K extends keyof ProposalDraft>(key: K, value: ProposalDraft[K]) {
    const titleCased: (keyof ProposalDraft)[] = ['focalName'];
    this.patch({ [key]: titleCased.includes(key) && typeof value === 'string' ? Format.titleCase(value) : value } as Partial<ProposalDraft>);
  }

  setCount(key: 'tMale' | 'tFemale' | 'jMale' | 'jFemale', v: string) {
    this.patch({ [key]: Number(v.replace(/\D/g, '')) || 0 } as Partial<ProposalDraft>);
  }

  get totals() { return draftTotals(this.state.d); }

  setOutput(i: number, v: string) { this.patch({ outputs: this.state.d.outputs.map((o, j) => (j === i ? v : o)) }); }
  addOutput() { this.patch({ outputs: [...this.state.d.outputs, ''] }); }

  setRow(list: RowListKey, i: number, key: string, value: string) {
    const v = key === 'name' ? Format.titleCase(value) : value;
    this.patch({ [list]: (this.state.d[list] as any[]).map((r, j) => (j === i ? { ...r, [key]: v } : r)) } as Partial<ProposalDraft>);
  }

  addRow(list: RowListKey) { this.patch({ [list]: [...(this.state.d[list] as any[]), NEW_ROW[list]()] } as Partial<ProposalDraft>); }
  removeRow(list: RowListKey, i: number) { this.patch({ [list]: (this.state.d[list] as any[]).filter((_, j) => j !== i) } as Partial<ProposalDraft>); }

  setTwgTitle(g: number, title: string) { this.patch({ twg: this.state.d.twg.map((x, j) => (j === g ? { ...x, title } : x)) }); }
  addTwgGroup() { this.patch({ twg: [...this.state.d.twg, { title: 'New Committee', members: [EMPTY_MEMBER()] }] }); }
  removeTwgGroup(g: number) { if (this.state.d.twg.length > 1) this.patch({ twg: this.state.d.twg.filter((_, j) => j !== g) }); }

  setMember(g: number, i: number, key: MemberText, value: string) {
    const v = key === 'name' ? Format.titleCase(value) : value;
    this.patch({ twg: this.state.d.twg.map((x, j) => (j === g ? { ...x, members: x.members.map((m, k) => (k === i ? { ...m, [key]: v } : m)) } : x)) });
  }

  private updateMember(g: number, i: number, patch: Partial<MemberRow>) {
    this.patch({ twg: this.state.d.twg.map((x, j) => (j === g ? { ...x, members: x.members.map((m, k) => (k === i ? { ...m, ...patch } : m)) } : x)) });
  }

  /** Links a member to an account (its name fills an empty Name). Unlinking also turns automation off. */
  /**
   * Staff ranked for committee member [i] of group [g]: who fits their Terms of
   * Reference, output and designation (and isn't overloaded), with the person
   * named in the proposal first.
   */
  suggestMembers(g: number, i: number) {
    const d = this.state.d;
    const m = d.twg[g]?.members[i];
    return this.services.events.committeeSuggestions({
      name: m?.name ?? '', designation: m?.designation ?? '', tor: m?.tor ?? '', output: m?.output ?? '',
      committee: d.twg[g]?.title ?? '', eventTitle: richToPlain(d.title),
    });
  }

  /**
   * Links member [i] of group [g] to a TaskNet account and writes that person's
   * name in the Name column (as recorded in TaskNet). Unlinking keeps the name.
   * [name] is the account's name when the caller already has it (e.g. a suggestion).
   */
  linkMember(g: number, i: number, userId: number | null, name?: string) {
    const m = this.state.d.twg[g].members[i];
    const linked = userId === null ? null : name ?? this.state.people.find((p) => p.id === userId)?.name ?? null;
    this.updateMember(g, i, { userId, name: linked ?? m.name, automate: userId === null ? false : m.automate });
  }

  setMemberAutomate(g: number, i: number, automate: boolean) { this.updateMember(g, i, { automate }); }
  /** Days after the event the member's special task is due (0-365). */
  setMemberDueDays(g: number, i: number, days: number) {
    this.updateMember(g, i, { dueDays: Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 0), 365) : DEFAULT_DUE_DAYS });
  }
  /** Tick or untick every member who can get a task (linked to an account and with an Output). */
  setAllAutomate(automate: boolean) {
    this.patch({ twg: this.state.d.twg.map((g) => ({ ...g, members: g.members.map((m) => (
      ProposalFormController.canAutomate(m) ? { ...m, automate } : m)) })) });
  }
  /** A special task needs an account to assign it to and an Output to title it. */
  static canAutomate(m: MemberRow): boolean { return m.userId !== null && m.output.trim() !== ''; }

  private async loadPeople() {
    try {
      const users = await this.services.personnel.users();
      this.setState({ people: users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.fullName || u.username })).sort((a, b) => a.name.localeCompare(b.name)) });
    } catch { /* linking is optional */ }
  }

  addMember(g: number) { this.patch({ twg: this.state.d.twg.map((x, j) => (j === g ? { ...x, members: [...x.members, EMPTY_MEMBER()] } : x)) }); }
  removeMember(g: number, i: number) { this.patch({ twg: this.state.d.twg.map((x, j) => (j === g ? { ...x, members: x.members.filter((_, k) => k !== i) } : x)) }); }

  setIndicator(i: number, v: string) { this.patch({ indicators: this.state.d.indicators.map((x, j) => (j === i ? v : x)) }); }
  addIndicator() { this.patch({ indicators: [...this.state.d.indicators, ''] }); }
  removeIndicator(i: number) { if (this.state.d.indicators.length > 1) this.patch({ indicators: this.state.d.indicators.filter((_, j) => j !== i) }); }

  setSignatory(i: number, key: 'name' | 'title', v: string) {
    this.patch({ signatories: this.state.d.signatories.map((x, j) => (j === i ? { ...x, [key]: key === 'name' ? Format.titleCase(v) : v } : x)) });
  }

  goTo(step: number) { this.setState({ step: Math.max(0, Math.min(STEP_TITLES.length - 1, step)) }); }
  get isLastStep() { return this.state.step === STEP_TITLES.length - 1; }

  // ── Target date ──
  /** Stored month-in-words ("October 1, 2026") so viewing shows it directly. */
  setTargetDate(iso: string) {
    const d = Format.parseDate(iso);
    this.patch({ targetDate: d ? Format.longDate(d) : '' });
    this.scheduleDateCheck();
  }

  get targetDateIso(): string {
    const d = parseEventDate(this.state.d.targetDate);
    return d ? Format.isoDate(d) : '';
  }

  isDayTaken(iso: string) { return this.state.takenDays.has(iso); }

  private async loadTakenDays() {
    try {
      const events = await this.services.events.list('all');
      const mine = this.existingId;
      const days = new Set<string>();
      for (const e of events) {
        if (e.id === mine || (e.status !== 'approved' && e.status !== 'pending_approval')) continue;
        const d = e.date;
        if (d) days.add(Format.isoDate(d));
      }
      this.setState({ takenDays: days });
    } catch { /* the server check still guards submission */ }
    if (this.state.d.targetDate.trim()) void this.checkDate();
  }

  private scheduleDateCheck() {
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => void this.checkDate(), 250);
  }

  /** Server-side conflict check; the message shows under the field and blocks submission. */
  async checkDate() {
    const text = this.state.d.targetDate.trim();
    if (!text) return;
    this.setState({ checkingDate: true });
    try {
      const r = await this.services.events.checkDate(text, this.existingId);
      if (this.state.d.targetDate.trim() === text) this.setState({ dateIssue: r.available ? null : r.message ?? 'That date is not available.', dateWarning: r.deped_warning ?? null });
    } catch { /* keep last verdict */ } finally {
      this.setState({ checkingDate: false });
    }
  }

  // ── Saving ──
  private async save(status: 'draft' | 'pending_approval', extra: Json = {}): Promise<number> {
    const payload = { ...draftToPayload(this.state.d), status, ...extra };
    const id = this.existingId ?? this.createdId;
    if (id !== null) await this.services.events.update(id, payload);
    else this.createdId = Number((await this.services.events.create(payload)).id);
    this.persisted = true;
    return (id ?? this.createdId)!;
  }

  // ── Submitting the original file as is ──
  // The proponent may skip reviewing the form read from their file and submit
  // the file itself; the approver reads it. TaskNet still needs what the file
  // can't give it: the date and hours (attendance), the venue pin (geofence)
  // and which committee members get an automated special task.

  /** Whether the read file can be submitted as is (one Word or PDF file). */
  get canSubmitAsFile() { return this.sourceFile !== null && !!this.state.d.reading; }
  get sourceFileName() { return this.sourceFile?.name ?? ''; }

  /** What's still needed before submitting the file as is (empty when ready). */
  get asFileIssues(): string[] {
    const d = this.state.d;
    const out: string[] = [];
    if (!richToPlain(d.title).trim()) out.push('the event title');
    if (!d.targetDate.trim()) out.push('the date');
    else if (this.state.dateIssue) out.push(`a valid date (${this.state.dateIssue.replace(/\.$/, '')})`);
    if (!d.startTime || !d.endTime) out.push('the start and end time');
    else if (d.endTime <= d.startTime) out.push('an end time after the start time');
    if (!d.venuePin) out.push('the venue pinned on the map');
    return out;
  }

  /** Submits the proposal with the original file attached, marked as submitted as the file. */
  async submitAsFile(): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
    const issues = this.asFileIssues;
    if (issues.length) return { ok: false, message: `Add ${issues.join(', ')} first.` };
    if (!this.sourceFile) return { ok: false, message: 'Upload the proposal file again.' };
    this.setState({ submitting: true });
    try {
      const id = await this.save('pending_approval', { submitted_as_file: true });
      await this.services.events.uploadProposalFile(id, this.sourceFile);
      return { ok: true, message: 'Event proposal submitted for approval, with your original file.' };
    } catch (e) {
      return { ok: false, message: BaseController.messageOf(e, 'Failed to submit. Check server connection.') };
    } finally {
      this.setState({ submitting: false });
    }
  }

  /**
   * Submit (or save as draft). Returns {ok: true, message} or {ok: false,
   * step, message} pointing at the first missing field.
   */
  async submit(asDraft = false): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
    if (!asDraft) {
      const issue = firstEmptyField(this.state.d, this.state.dateIssue);
      if (issue) {
        this.goTo(issue[0]);
        return { ok: false, message: issue[1] };
      }
    }
    this.setState({ submitting: true });
    try {
      await this.save(asDraft ? 'draft' : 'pending_approval');
      const message = asDraft ? (this.isReturned ? 'Changes saved. Resubmit when the revisions are done.' : 'Saved as draft.')
        : this.isReturned ? 'Proposal resubmitted for approval!' : this.isEditing ? 'Event updated successfully!' : 'Event proposal submitted for approval!';
      return { ok: true, message };
    } catch (e) {
      return { ok: false, message: BaseController.messageOf(e, 'Failed to submit. Check server connection.') };
    } finally {
      this.setState({ submitting: false });
    }
  }

  /** "Discard changes" when leaving: don't keep the unsaved work as a draft. */
  discard() { this.persisted = true; }

  /** On logout / token expiry: persist meaningful, still-draftable work once. */
  private async autoSaveDraft() {
    if (this.persisted || !this.canSaveAsDraft || !richToPlain(this.state.d.title).trim()) return;
    this.persisted = true;
    try { await this.save('draft'); } catch { this.persisted = false; }
  }

  /** Leaving the form: save unsubmitted work as a draft (fire and forget). */
  override dispose() {
    if (!this.persisted && this.canSaveAsDraft && richToPlain(this.state.d.title).trim()) {
      this.persisted = true;
      void this.save('draft').catch(() => undefined);
    }
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.session.unregisterDraftAutosave(this.autosave);
    super.dispose();
  }
}
