import { DEFAULT_VENUE_RADIUS, Json } from '../models';
import { hasFormatting, plainToRich, richToPlain, sanitizeRich } from '../utils/richText';

// Event proposal form data: row types, defaults, parsing, validation and payload.
export const STEP_TITLES = ['Proposal Brief', 'Rationale & Objectives', 'Methodology', 'Activity Matrix', 'Budget', 'Monitoring & Evaluation'];

export const NATURES = ['Curricular', 'Co-curricular', 'Extra-curricular'];

export interface PhaseRow { stage: string; activities: string }

export interface MatrixRow { day: string; time: string; event: string; speaker: string }

export interface MaterialRow { item: string; qty: string; cost: string; total: string }

export interface SnackRow { item: string; pax: string; cost: string; total: string }

export interface ExecRow { name: string; position: string }

/**
 * [userId] links the member to an account. Ticked [automate]: a special task
 * for the member when the event is approved. Not ticked: no task, and a linked
 * member is credited the top score instead.
 */
export interface MemberRow { name: string; designation: string; tor: string; output: string; userId: number | null; automate: boolean }

export type MemberText = 'name' | 'designation' | 'tor' | 'output';

export interface TwgGroup { title: string; members: MemberRow[] }

export interface Signatory { role: string; name: string; title: string }

/** What the proposal reader found when the form was filled from a file; saved with the proposal. */
export interface SavedReading {
  files: string[];
  /** docx | pdf-text | ocr */
  method: string;
  sections: { label: string; found: boolean; fields: string[] }[];
  warnings: string[];
  /** Extra notes from filling the form (e.g. participant groups combined). */
  notes: string[];
  read_at: string;
}

export interface ProposalDraft {
  title: string; targetDate: string; venue: string; budget: string; fund: string;
  /** Venue pin for attendance geofencing; null = not pinned (checked by time only). */
  venuePin: { lat: number; lng: number } | null;
  /** Perimeter radius around the pin, metres. */
  venueRadius: number;
  /** Set when the form was filled from an uploaded proposal. */
  reading: SavedReading | null;
  focalName: string; focalRole: string; focalCp: string; nature: string;
  pCat1: string; pCat2: string; tMale: number; tFemale: number; jMale: number; jFemale: number;
  outputs: string[];
  rationale: string; objectives: string;
  phases: PhaseRow[];
  matrix: MatrixRow[];
  materials: MaterialRow[]; snacks: SnackRow[]; exec: ExecRow[]; twg: TwgGroup[];
  monitoring: string; indicators: string[]; signatories: Signatory[];
}

/** Fields edited as rich text: the draft holds HTML, the API gets plain text plus `comments.rich`. */
export const RICH_FIELDS = ['title', 'venue', 'focalRole', 'rationale', 'objectives', 'monitoring'] as const;
export type RichField = typeof RICH_FIELDS[number];

/** Stored formatting when it still matches the stored plain text (else the plain text as HTML). */
function richOr(stored: unknown, plain: string): string {
  return typeof stored === 'string' && richToPlain(stored) === plain.trim() ? sanitizeRich(stored) : plainToRich(plain);
}

export type RowListKey = 'phases' | 'matrix' | 'materials' | 'snacks' | 'exec';

export const EMPTY_PHASE = (): PhaseRow => ({ stage: '', activities: '' });

export const EMPTY_MATRIX = (): MatrixRow => ({ day: '', time: '', event: '', speaker: '' });

export const EMPTY_MAT = (): MaterialRow => ({ item: '', qty: '', cost: '', total: '' });

export const EMPTY_SNACK = (): SnackRow => ({ item: '', pax: '', cost: '', total: '' });

export const EMPTY_EXEC = (): ExecRow => ({ name: '', position: '' });

export const EMPTY_MEMBER = (): MemberRow => ({ name: '', designation: '', tor: '', output: '', userId: null, automate: false });

export const NEW_ROW: Record<RowListKey, () => any> = { phases: EMPTY_PHASE, matrix: EMPTY_MATRIX, materials: EMPTY_MAT, snacks: EMPTY_SNACK, exec: EMPTY_EXEC };

export function parseJson(v: unknown): any {
  try { return v === null || v === undefined ? null : JSON.parse(String(v)); } catch { return null; }
}

/** A proposal's form fields from a stored event (or the defaults for a new one). */
export function draftFromEvent(e: Json | null): ProposalDraft {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const P = parseJson;
  let pCat1 = 'Teachers/Speakers';
  let pCat2 = 'Aspiring journalists';
  let tMale = 0, tFemale = 0, jMale = 0, jFemale = 0;
  const p = P(e?.participants);
  if (p && typeof p === 'object') {
    if (Array.isArray(p.rows) && p.rows.length >= 2) {
      pCat1 = s(p.rows[0].category ?? pCat1); tMale = Number(p.rows[0].male ?? 0) || 0; tFemale = Number(p.rows[0].female ?? 0) || 0;
      pCat2 = s(p.rows[1].category ?? pCat2); jMale = Number(p.rows[1].male ?? 0) || 0; jFemale = Number(p.rows[1].female ?? 0) || 0;
    } else {
      tMale = Number(p.teachers?.male ?? 0) || 0; tFemale = Number(p.teachers?.female ?? 0) || 0;
      jMale = Number(p.journalists?.male ?? 0) || 0; jFemale = Number(p.journalists?.female ?? 0) || 0;
    }
  }
  const outs = P(e?.expected_outputs);
  let outputs: string[] = Array.isArray(outs) ? outs.map(String) : ['', ''];
  if (!outputs.length) outputs = ['', ''];

  let objectives = s(e?.objectives);
  const objJson = P(e?.objectives);
  if (Array.isArray(objJson)) objectives = objJson.map(String).filter((x) => x.trim()).join('\n');

  const ph = P(e?.phase1);
  const phases: PhaseRow[] = Array.isArray(ph) && ph.length
    ? ph.map((r: Json) => ({ stage: s(r.stage), activities: s(r.activities) }))
    : [
      { stage: 'Pre-Implementation Stage', activities: s(e?.phase1 ?? 'Planning\nRecruitment of participants') },
      { stage: 'Implementation', activities: s(e?.phase2 ?? 'Training-workshop sessions') },
      { stage: 'Post-Implementation', activities: s(e?.phase3 ?? 'Selection of school paper staff\nEvaluation of the activity') },
    ];
  const list = <T>(key: string, map: (r: Json) => T, empty: () => T, n: number): T[] => {
    const d = P(e?.[key]);
    return Array.isArray(d) && d.length ? d.map(map) : Array.from({ length: n }, empty);
  };
  const twgRaw = P(e?.twg_groups);
  const twg: TwgGroup[] = Array.isArray(twgRaw) && twgRaw.length
    ? twgRaw.map((g: Json) => {
      const members = Array.isArray(g.members) ? g.members.map((m: Json) => ({
        name: s(m.name), designation: s(m.designation), tor: s(m.tor), output: s(m.output),
        userId: typeof m.user_id === 'number' ? m.user_id : null, automate: m.automate_special_task === true,
      })) : [];
      return { title: s(g.title), members: members.length ? members : [EMPTY_MEMBER()] };
    })
    : [{ title: 'Supervising Committee', members: [EMPTY_MEMBER()] }, { title: 'Program Implementation Committee', members: [EMPTY_MEMBER()] }];
  const ind = P(e?.indicators);
  const indicators = Array.isArray(ind) && ind.length ? ind.map((d: Json) => s(d.label)) : [''];
  const signatories: Signatory[] = [
    { role: 'Noted', name: '', title: 'School Principal' },
    { role: 'Endorsed', name: '', title: 'Public Schools District Supervisor' },
    { role: 'Recommending Approval', name: '', title: 'Assistant Schools Division Superintendent' },
    { role: 'Approved', name: '', title: 'Schools Division Superintendent' },
  ];
  const com = P(e?.comments);
  if (com && Array.isArray(com.signatories)) {
    com.signatories.slice(0, signatories.length).forEach((x: Json, i: number) => {
      signatories[i].name = s(x.name);
      signatories[i].title = s(x.title ?? signatories[i].title);
    });
  }
  const rich = com && typeof com.rich === 'object' && com.rich ? com.rich : {};
  const lat = typeof e?.venue_latitude === 'number' ? e.venue_latitude : null;
  const lng = typeof e?.venue_longitude === 'number' ? e.venue_longitude : null;
  const read = P(e?.proposal_reading);
  const richOuts: unknown[] = Array.isArray(rich.outputs) ? rich.outputs : [];
  return {
    title: richOr(rich.title, s(e?.title)), targetDate: s(e?.target_date), venue: richOr(rich.venue, s(e?.venue)), budget: s(e?.proposed_budget), fund: s(e?.fund_source),
    venuePin: lat !== null && lng !== null ? { lat, lng } : null,
    venueRadius: typeof e?.venue_radius_m === 'number' ? e.venue_radius_m : DEFAULT_VENUE_RADIUS,
    reading: read && typeof read === 'object' && Array.isArray(read.sections) ? {
      files: Array.isArray(read.files) ? read.files.map(String) : [], method: s(read.method), sections: read.sections,
      warnings: Array.isArray(read.warnings) ? read.warnings.map(String) : [], notes: Array.isArray(read.notes) ? read.notes.map(String) : [],
      read_at: s(read.read_at),
    } : null,
    focalName: s(e?.focal_name), focalRole: richOr(rich.focalRole, s(e?.focal_role)), focalCp: s(e?.focal_contact), nature: s(e?.nature) || 'Co-curricular',
    pCat1, pCat2, tMale, tFemale, jMale, jFemale, outputs: outputs.map((o, i) => richOr(richOuts[i], o)),
    rationale: richOr(rich.rationale, s(e?.rationale)), objectives: richOr(rich.objectives, objectives), phases,
    matrix: list('activity_matrix', (r) => ({ day: s(r.day), time: s(r.time), event: s(r.event), speaker: s(r.speaker) }), EMPTY_MATRIX, 3),
    materials: list('training_materials', (r) => ({ item: s(r.item), qty: s(r.qty), cost: s(r.cost), total: s(r.total) }), EMPTY_MAT, 2),
    snacks: list('snacks', (r) => ({ item: s(r.item), pax: s(r.pax), cost: s(r.cost), total: s(r.total) }), EMPTY_SNACK, 1),
    exec: list('exec_committee', (r) => ({ name: s(r.name), position: s(r.position) }), EMPTY_EXEC, 2),
    twg, monitoring: richOr(rich.monitoring, s(e?.monitoring_criteria)), indicators, signatories,
  };
}

/** Participant counts per row and overall. */
export function draftTotals(d: ProposalDraft) {
  return { t: d.tMale + d.tFemale, j: d.jMale + d.jFemale, male: d.tMale + d.jMale, female: d.tFemale + d.jFemale, all: d.tMale + d.tFemale + d.jMale + d.jFemale };
}

/** The step and message of the first unanswered required field, or null. */
export function firstEmptyField(d: ProposalDraft, dateIssue: string | null): [number, string] | null {
  const e = (v: string) => !richToPlain(v).trim();
  if (e(d.title)) return [0, 'Please enter the event title.'];
  if (e(d.targetDate)) return [0, 'Please enter the target date.'];
  if (dateIssue) return [0, dateIssue];
  if (e(d.venue)) return [0, 'Please enter the proposed venue.'];
  if (e(d.pCat1)) return [0, 'Please name the first target participant category.'];
  if (e(d.pCat2)) return [0, 'Please name the second target participant category.'];
  for (let i = 0; i < d.outputs.length; i++) if (e(d.outputs[i])) return [0, `Please fill in expected output #${i + 1}.`];
  if (e(d.budget)) return [0, 'Please enter the proposed budget.'];
  if (e(d.fund)) return [0, 'Please enter the source of fund.'];
  if (e(d.focalName)) return [0, "Please enter the focal person's name."];
  if (e(d.focalRole)) return [0, "Please enter the focal person's designation."];
  if (e(d.focalCp)) return [0, "Please enter the focal person's contact number."];
  if (e(d.rationale)) return [1, 'Please provide the rationale.'];
  if (e(d.objectives)) return [1, 'Please provide the objectives.'];
  for (let i = 0; i < d.phases.length; i++) {
    if (e(d.phases[i].stage)) return [2, `Please fill in the stage for Phase ${i + 1}.`];
    if (e(d.phases[i].activities)) return [2, `Please fill in the activities for Phase ${i + 1}.`];
  }
  for (let i = 0; i < d.matrix.length; i++) {
    for (const k of ['day', 'time', 'event', 'speaker'] as const) if (e(d.matrix[i][k])) return [3, `Please fill in the ${k} for activity matrix row ${i + 1}.`];
  }
  for (let i = 0; i < d.materials.length; i++) {
    for (const [k, l] of [['item', 'item'], ['qty', 'quantity'], ['cost', 'cost'], ['total', 'total']] as const) {
      if (e(d.materials[i][k])) return [4, `Please fill in the ${l} for training material row ${i + 1}.`];
    }
  }
  for (let i = 0; i < d.snacks.length; i++) {
    for (const k of ['item', 'pax', 'cost', 'total'] as const) if (e(d.snacks[i][k])) return [4, `Please fill in the ${k} for snack row ${i + 1}.`];
  }
  for (let i = 0; i < d.exec.length; i++) {
    if (e(d.exec[i].name)) return [4, `Please fill in the name for executive committee member ${i + 1}.`];
    if (e(d.exec[i].position)) return [4, `Please fill in the position for executive committee member ${i + 1}.`];
  }
  for (let g = 0; g < d.twg.length; g++) {
    const t = d.twg[g];
    if (e(t.title)) return [4, `Please name TWG group ${g + 1}.`];
    for (let j = 0; j < t.members.length; j++) {
      for (const [k, l] of [['name', 'name'], ['designation', 'designation'], ['tor', 'terms of reference'], ['output', 'output']] as const) {
        if (e(t.members[j][k])) return [4, `Please fill in the ${l} for ${t.title} member ${j + 1}.`];
      }
    }
  }
  if (e(d.monitoring)) return [5, 'Please provide the monitoring instructions / evaluation criteria.'];
  for (let i = 0; i < d.indicators.length; i++) if (e(d.indicators[i])) return [5, `Please fill in indicator #${i + 1}.`];
  return null;
}

/** The event payload sent to the API. */
export function draftToPayload(d: ProposalDraft): Json {
  const t = draftTotals(d);
  const plain = (v: string) => richToPlain(v);
  // Formatting travels separately so titles stay plain text everywhere else.
  const rich: Json = {};
  for (const k of RICH_FIELDS) if (hasFormatting(d[k])) rich[k] = sanitizeRich(d[k]);
  if (d.outputs.some(hasFormatting)) rich.outputs = d.outputs.map((o) => sanitizeRich(o));
  return {
    title: plain(d.title), nature: d.nature, target_date: d.targetDate, venue: plain(d.venue), proposed_budget: d.budget, fund_source: d.fund,
    venue_latitude: d.venuePin?.lat ?? null, venue_longitude: d.venuePin?.lng ?? null,
    venue_radius_m: d.venuePin ? Math.round(d.venueRadius) : null,
    proposal_reading: d.reading ? JSON.stringify(d.reading) : null,
    focal_name: d.focalName, focal_role: plain(d.focalRole), focal_contact: d.focalCp,
    expected_outputs: JSON.stringify(d.outputs.map(plain)),
    participants: JSON.stringify({
      rows: [
        { category: d.pCat1, male: d.tMale, female: d.tFemale, total: t.t },
        { category: d.pCat2, male: d.jMale, female: d.jFemale, total: t.j },
      ],
      totals: { male: t.male, female: t.female, total: t.all },
    }),
    rationale: plain(d.rationale), objectives: plain(d.objectives),
    phase1: JSON.stringify(d.phases), phase2: '', phase3: '',
    activity_matrix: JSON.stringify(d.matrix),
    training_materials: JSON.stringify(d.materials),
    snacks: JSON.stringify(d.snacks),
    exec_committee: JSON.stringify(d.exec),
    twg_groups: JSON.stringify(d.twg.map((g) => ({
      title: g.title,
      members: g.members.map(({ userId, automate, ...m }) => ({ ...m, user_id: userId, automate_special_task: automate })),
    }))),
    monitoring_criteria: plain(d.monitoring),
    indicators: JSON.stringify(d.indicators.map((label) => ({ label }))),
    comments: JSON.stringify(Object.keys(rich).length ? { signatories: d.signatories, rich } : { signatories: d.signatories }),
  };
}
