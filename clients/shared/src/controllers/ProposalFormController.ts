import { BaseController } from './BaseController';
import { SessionController } from './SessionController';
import { Services } from '../services';
import { FilePart } from '../services/ApiClient';
import { ProposalReading } from '../services/EventService';
import { Json, VENUE_RADIUS_RANGE, parseEventDate } from '../models';
import { Format } from '../utils/format';
import { richToPlain } from '../utils/richText';
import { draftFromReading, orderProposalFiles, readingSummary } from './proposalReading';
import { EMPTY_MEMBER, MemberRow, MemberText, NEW_ROW, ProposalDraft, RowListKey, STEP_TITLES, draftFromEvent, draftTotals, firstEmptyField, draftToPayload } from './proposalDraft';

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
      return { reading: await this.services.events.readProposal(ordered), files: ordered.map((f) => f.name) };
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
  linkMember(g: number, i: number, userId: number | null) {
    const m = this.state.d.twg[g].members[i];
    const person = this.state.people.find((p) => p.id === userId);
    this.updateMember(g, i, { userId, name: m.name.trim() || !person ? m.name : person.name, automate: userId === null ? false : m.automate });
  }

  setMemberAutomate(g: number, i: number, automate: boolean) { this.updateMember(g, i, { automate }); }

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
  private async save(status: 'draft' | 'pending_approval') {
    const payload = { ...draftToPayload(this.state.d), status };
    if (this.isEditing) await this.services.events.update(this.existingId!, payload);
    else await this.services.events.create(payload);
    this.persisted = true;
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
