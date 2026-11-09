import { Json, parseEventDate } from '../models';
import { ProposalReading } from '../services/EventService';
import { plainToRich, richToPlain } from '../utils/richText';
import { DEFAULT_DUE_DAYS, MemberRow, NATURES, ProposalDraft, SavedReading, TwgGroup } from './proposalDraft';

// Filling the proposal form from an uploaded file (server: proposal_reader.py).

/** The form step each section the reader reports lives on (Working Committee is in Budget). */
export const READING_STEP: Record<string, number> = {
  'Proposal Brief': 0, 'Rationale & Objectives': 1, Methodology: 2, 'Activity Matrix': 3,
  Budget: 4, 'Working Committee': 4, 'Monitoring & Evaluation': 5,
};

export const READING_METHOD: Record<string, string> = {
  docx: 'Word document', 'pdf-text': 'PDF', ocr: 'photo / scanned copy (OCR)',
};

/** Files a proposal can be read from. */
export const PROPOSAL_FILE_TYPES = '.docx,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp';
const IMAGE = /\.(png|jpe?g|webp)$/i;

/**
 * The files to send, in order, or why they can't be read together: one Word or
 * PDF file, or several photos (one per page) read in file-name order.
 */
export function orderProposalFiles<F extends { name: string }>(files: F[]): F[] | string {
  if (!files.length) return 'Choose a file.';
  if (files.length > 1 && files.some((f) => !IMAGE.test(f.name))) return 'Upload one Word or PDF file, or several photos (one per page), not a mix.';
  return files.length > 1 ? [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : files;
}

/**
 * [base] filled from what the reader found. Anything it missed keeps the
 * current value so the proponent fills it in. Committee members all start
 * unticked: the proponent chooses which tasks to automate.
 */
export function draftFromReading(r: ProposalReading, files: string[], base: ProposalDraft): ProposalDraft {
  const x: Json = r.form ?? {};
  const notes: string[] = [];
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const pick = (v: unknown, d: string) => str(v) || d;
  const rich = (v: unknown, d: string) => (str(v) ? plainToRich(str(v)) : d);
  const rows = <T>(v: unknown, map: (j: Json) => T, d: T[]): T[] => (Array.isArray(v) && v.length ? v.map(map) : d);

  // The form has two participant rows: keep the first, fold the rest into the second.
  let { pCat1, pCat2, tMale, tFemale, jMale, jFemale } = base;
  const pax: Json[] = Array.isArray(x.participants) ? x.participants : [];
  if (pax.length) {
    pCat1 = str(pax[0].category) || pCat1; tMale = Number(pax[0].male) || 0; tFemale = Number(pax[0].female) || 0;
    const rest = pax.slice(1);
    if (rest.length) {
      pCat2 = rest.map((p) => str(p.category)).filter(Boolean).join(' / ') || pCat2;
      jMale = rest.reduce((a, p) => a + (Number(p.male) || 0), 0);
      jFemale = rest.reduce((a, p) => a + (Number(p.female) || 0), 0);
    }
    if (pax.length > 2) notes.push(`The proposal lists ${pax.length} participant groups; groups 2–${pax.length} were combined into the second row.`);
  }

  const twg: TwgGroup[] = (Array.isArray(x.twg) ? x.twg : [])
    .filter((g: Json) => Array.isArray(g.members) && g.members.length)
    .map((g: Json) => ({
      title: str(g.title),
      members: g.members.map((m: Json): MemberRow => ({
        name: str(m.name), designation: str(m.designation), tor: str(m.tor), output: str(m.output),
        userId: typeof m.user_id === 'number' ? m.user_id : null, automate: false, dueDays: DEFAULT_DUE_DAYS,
      })),
    }));

  const signatories = base.signatories.map((sg) => {
    const hit = (Array.isArray(x.signatories) ? x.signatories : []).find((g: Json) => str(g.role).toLowerCase() === sg.role.toLowerCase());
    return hit ? { ...sg, name: str(hit.name), title: str(hit.title) || sg.title } : sg;
  });
  const outputs = (Array.isArray(x.outputs) ? x.outputs : []).map(str).filter(Boolean);
  const indicators = (Array.isArray(x.indicators) ? x.indicators : []).map(str).filter(Boolean);
  const reading: SavedReading = {
    files, method: r.method, sections: r.sections, warnings: r.warnings, notes, read_at: new Date().toISOString(),
  };
  return {
    ...base,
    title: rich(x.title, base.title),
    nature: NATURES.includes(str(x.nature)) ? str(x.nature) : base.nature,
    targetDate: pick(x.targetDate, base.targetDate),
    startTime: pick(x.startTime, base.startTime), endTime: pick(x.endTime, base.endTime),
    venue: rich(x.venue, base.venue),
    budget: pick(x.budget, base.budget), fund: pick(x.fundSource, base.fund),
    focalName: pick(x.focalName, base.focalName), focalRole: rich(x.focalRole, base.focalRole), focalCp: pick(x.focalContact, base.focalCp),
    pCat1, pCat2, tMale, tFemale, jMale, jFemale,
    outputs: outputs.length ? outputs.map(plainToRich) : base.outputs,
    rationale: rich(x.rationale, base.rationale), objectives: rich(x.objectives, base.objectives),
    methodologyIntro: pick(x.methodologyIntro, base.methodologyIntro),
    phases: rows(x.phases, (p) => ({ stage: str(p.stage), activities: str(p.activities) }), base.phases),
    matrix: rows(x.matrix, (m) => ({ day: str(m.day), time: str(m.time), event: str(m.event), speaker: str(m.speaker) }), base.matrix),
    materials: rows(x.materials, (m) => ({ item: str(m.item), qty: str(m.qty), cost: str(m.cost), total: str(m.total) }), base.materials),
    snacks: rows(x.snacks, (m) => ({ item: str(m.item), pax: str(m.pax), cost: str(m.cost), total: str(m.total) }), base.snacks),
    exec: rows(x.exec, (m) => ({ name: str(m.name), position: str(m.position) }), base.exec),
    twg: twg.length ? twg : base.twg,
    monitoring: rich(x.monitoring, base.monitoring),
    indicators: indicators.length ? indicators : base.indicators,
    signatories,
    reading,
  };
}

/** What happens to a committee member when the event is approved. */
export function memberResult(m: MemberRow): { label: string; tone: 'blue' | 'green' | 'red' } {
  return m.automate ? { label: 'Special task', tone: 'blue' } : m.userId !== null ? { label: 'Top score', tone: 'green' } : { label: 'Needs account', tone: 'red' };
}

export interface ReadingSummary {
  found: number;
  total: number;
  fileLabel: string;
  methodLabel: string;
  /** Sections not in the file, with the step to fill each in. */
  missing: { label: string; step: number }[];
  /** Things to check, worked out from the form as it is now (warnings about fixed things drop off). */
  toCheck: { text: string; action?: 'link' | 'date' }[];
  members: { automated: number; credited: number; uncredited: number; total: number };
}

/** The "Read from …" panel's contents for [d] (which has a reading). */
export function readingSummary(d: ProposalDraft): ReadingSummary | null {
  const r = d.reading;
  if (!r) return null;
  const named = d.twg.flatMap((g) => g.members).filter((m) => richToPlain(m.name).trim());
  const unlinked = named.filter((m) => m.userId === null).length;
  const target = parseEventDate(d.targetDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stale = /didn't match a TaskNet account|has already passed/i;
  return {
    found: r.sections.filter((s) => s.found).length,
    total: r.sections.length,
    fileLabel: r.files.length > 1 ? `${r.files.length} page photos` : r.files[0] ?? 'the proposal file',
    methodLabel: READING_METHOD[r.method] ?? 'file',
    missing: r.sections.filter((s) => !s.found).map((s) => ({ label: s.label, step: READING_STEP[s.label] ?? 0 })),
    toCheck: [
      ...(unlinked ? [{ text: `${unlinked} committee member${unlinked === 1 ? ' has' : 's have'} no linked TaskNet account`, action: 'link' as const }] : []),
      ...(target && target < today ? [{ text: `The target date, ${d.targetDate}, has already passed`, action: 'date' as const }] : []),
      ...r.warnings.filter((w) => !stale.test(w)).map((text) => ({ text })),
      ...r.notes.map((text) => ({ text })),
    ],
    members: {
      automated: named.filter((m) => m.automate).length,
      credited: named.filter((m) => !m.automate && m.userId !== null).length,
      uncredited: named.filter((m) => !m.automate && m.userId === null).length,
      total: named.length,
    },
  };
}
