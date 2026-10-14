// The event proposal form as plain data, shared by the web and mobile forms:
// load from an event, validate, and turn back into the API payload.
import type { EventInput, EventRecord } from '../types';
import { MONTHS_LONG } from '../utils/dates';
import { parseJson } from '../utils/eventFormat';

export const PROPOSAL_STEPS = [
  'Proposal Brief', 'Rationale & Objectives', 'Methodology', 'Activity Matrix', 'Budget', 'Monitoring & Evaluation',
] as const;

export const NATURES = ['Curricular', 'Co-curricular', 'Extra-curricular'] as const;

export interface PaxRow { category: string; male: number; female: number }
export interface PhaseRow { stage: string; activities: string }
export interface MatrixRow { day: string; time: string; event: string; speaker: string }
export interface MaterialRow { item: string; qty: string; cost: string; total: string }
export interface SnackRow { item: string; pax: string; cost: string; total: string }
export interface ExecRow { name: string; position: string }
export interface TwgMember {
  name: string; designation: string; tor: string; output: string;
  /** create a special task for this member when the event is approved */
  automate: boolean;
  userId: number | null;
  userName: string | null;
}
export interface TwgGroup { title: string; members: TwgMember[] }
export interface Signatory { role: string; name: string; title: string }

export interface ProposalForm {
  title: string;
  nature: string;
  /** "October 1, 2026" — month in words, as the calendar parses it */
  targetDate: string;
  venue: string;
  budget: string;
  fundSource: string;
  focalName: string;
  focalRole: string;
  focalContact: string;
  participants: [PaxRow, PaxRow];
  outputs: string[];
  rationale: string;
  objectives: string;
  phases: PhaseRow[];
  matrix: MatrixRow[];
  materials: MaterialRow[];
  snacks: SnackRow[];
  exec: ExecRow[];
  twg: TwgGroup[];
  monitoring: string;
  indicators: string[];
  signatories: Signatory[];
}

export const emptyPhase = (): PhaseRow => ({ stage: '', activities: '' });
export const emptyMatrixRow = (): MatrixRow => ({ day: '', time: '', event: '', speaker: '' });
export const emptyMaterial = (): MaterialRow => ({ item: '', qty: '', cost: '', total: '' });
export const emptySnack = (): SnackRow => ({ item: '', pax: '', cost: '', total: '' });
export const emptyExec = (): ExecRow => ({ name: '', position: '' });
export const emptyMember = (): TwgMember => ({
  name: '', designation: '', tor: '', output: '', automate: false, userId: null, userName: null,
});

/** "October 1, 2026" */
export const longDate = (d: Date) => `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

function rows<T>(raw: string | null | undefined, map: (r: Row) => T): T[] {
  const list = parseJson<unknown>(raw, null);
  return Array.isArray(list) ? (list as Row[]).map(map) : [];
}

/** Form state for a new proposal (no event) or for editing one. */
export function proposalFromEvent(e?: EventRecord | null): ProposalForm {
  let participants: [PaxRow, PaxRow] = [
    { category: 'Teachers/Speakers', male: 0, female: 0 },
    { category: 'Aspiring journalists', male: 0, female: 0 },
  ];
  const p = parseJson<Record<string, unknown> | null>(e?.participants, null);
  if (p && typeof p === 'object') {
    const pr = p.rows as Row[] | undefined;
    if (Array.isArray(pr) && pr.length >= 2) {
      participants = [
        { category: str(pr[0].category) || participants[0].category, male: num(pr[0].male), female: num(pr[0].female) },
        { category: str(pr[1].category) || participants[1].category, male: num(pr[1].male), female: num(pr[1].female) },
      ];
    } else {
      const t = (p.teachers ?? {}) as Row;
      const j = (p.journalists ?? p.students ?? {}) as Row;
      participants[0] = { ...participants[0], male: num(t.male), female: num(t.female) };
      participants[1] = { ...participants[1], male: num(j.male), female: num(j.female) };
    }
  }

  let outputs = parseJson<unknown>(e?.expected_outputs, null);
  if (!Array.isArray(outputs)) outputs = ['', ''];
  if (!(outputs as unknown[]).length) outputs = ['', ''];

  // Objectives: older proposals stored a JSON array.
  let objectives = e?.objectives ?? '';
  const objList = parseJson<unknown>(objectives, null);
  if (Array.isArray(objList)) objectives = objList.map(str).filter((s) => s.trim()).join('\n');

  let phases = rows(e?.phase1, (r) => ({ stage: str(r.stage), activities: str(r.activities) }));
  if (!phases.length) {
    phases = [
      { stage: 'Pre-Implementation Stage', activities: e?.phase1 || 'Planning\nRecruitment of participants' },
      { stage: 'Implementation', activities: e?.phase2 || 'Training-workshop sessions' },
      { stage: 'Post-Implementation', activities: e?.phase3 || 'Selection of school paper staff\nEvaluation of the activity' },
    ];
  }

  const matrix = rows(e?.activity_matrix, (r) => ({ day: str(r.day), time: str(r.time), event: str(r.event), speaker: str(r.speaker) }));
  const materials = rows(e?.training_materials, (r) => ({ item: str(r.item), qty: str(r.qty), cost: str(r.cost), total: str(r.total) }));
  const snacks = rows(e?.snacks, (r) => ({ item: str(r.item), pax: str(r.pax), cost: str(r.cost), total: str(r.total) }));
  const exec = rows(e?.exec_committee, (r) => ({ name: str(r.name), position: str(r.position ?? r.designation) }));
  const twg = rows(e?.twg_groups, (g) => {
    const members = Array.isArray(g.members) ? (g.members as Row[]).map((m) => {
      const automate = m.automate_special_task === true;
      return {
        name: str(m.name), designation: str(m.designation), tor: str(m.tor), output: str(m.output),
        automate, userId: typeof m.user_id === 'number' ? m.user_id : null, userName: automate ? str(m.name) : null,
      };
    }) : [];
    return { title: str(g.title), members: members.length ? members : [emptyMember()] };
  });
  const indicators = rows(e?.indicators, (r) => str(r.label));

  const signatories: Signatory[] = [
    { role: 'Noted', name: '', title: 'School Principal' },
    { role: 'Endorsed', name: '', title: 'Public Schools District Supervisor' },
    { role: 'Recommending Approval', name: '', title: 'Assistant Schools Division Superintendent' },
    { role: 'Approved', name: '', title: 'Schools Division Superintendent' },
  ];
  const sig = parseJson<{ signatories?: Row[] } | null>(e?.comments, null);
  if (sig && !Array.isArray(sig) && Array.isArray(sig.signatories)) {
    sig.signatories.slice(0, signatories.length).forEach((s, i) => {
      signatories[i].name = str(s.name);
      signatories[i].title = str(s.title) || signatories[i].title;
    });
  }

  return {
    title: e?.title ?? '',
    nature: e?.nature || 'Co-curricular',
    targetDate: e?.target_date ?? '',
    venue: e?.venue ?? '',
    budget: e?.proposed_budget ?? '',
    fundSource: e?.fund_source ?? '',
    focalName: e?.focal_name ?? '',
    focalRole: e?.focal_role ?? '',
    focalContact: e?.focal_contact ?? '',
    participants,
    outputs: (outputs as unknown[]).map(str),
    rationale: e?.rationale ?? '',
    objectives,
    phases,
    matrix: matrix.length ? matrix : [emptyMatrixRow(), emptyMatrixRow(), emptyMatrixRow()],
    materials: materials.length ? materials : [emptyMaterial(), emptyMaterial()],
    snacks: snacks.length ? snacks : [emptySnack()],
    exec: exec.length ? exec : [emptyExec(), emptyExec()],
    twg: twg.length ? twg : [
      { title: 'Supervising Committee', members: [emptyMember()] },
      { title: 'Program Implementation Committee', members: [emptyMember()] },
    ],
    monitoring: e?.monitoring_criteria ?? '',
    indicators: indicators.length ? indicators : [''],
    signatories,
  };
}

/** The API payload (status is added by the caller). */
export function proposalPayload(f: ProposalForm): EventInput {
  const [a, b] = f.participants;
  return {
    title: f.title,
    nature: f.nature,
    target_date: f.targetDate,
    venue: f.venue,
    proposed_budget: f.budget,
    fund_source: f.fundSource,
    focal_name: f.focalName,
    focal_role: f.focalRole,
    focal_contact: f.focalContact,
    expected_outputs: JSON.stringify(f.outputs),
    participants: JSON.stringify({
      rows: [
        { category: a.category, male: a.male, female: a.female, total: a.male + a.female },
        { category: b.category, male: b.male, female: b.female, total: b.male + b.female },
      ],
      totals: { male: a.male + b.male, female: a.female + b.female, total: a.male + a.female + b.male + b.female },
    }),
    rationale: f.rationale,
    objectives: f.objectives,
    phase1: JSON.stringify(f.phases),
    phase2: '',
    phase3: '',
    activity_matrix: JSON.stringify(f.matrix),
    training_materials: JSON.stringify(f.materials),
    snacks: JSON.stringify(f.snacks),
    exec_committee: JSON.stringify(f.exec),
    twg_groups: JSON.stringify(f.twg.map((g) => ({
      title: g.title,
      members: g.members.map((m) => ({
        name: m.name, designation: m.designation, tor: m.tor, output: m.output,
        automate_special_task: m.automate, ...(m.automate ? { user_id: m.userId } : {}),
      })),
    }))),
    monitoring_criteria: f.monitoring,
    indicators: JSON.stringify(f.indicators.map((label) => ({ label }))),
    comments: JSON.stringify({ signatories: f.signatories }),
  };
}

/**
 * The first unanswered required field as [step index, message], or null when
 * the proposal is complete. `dateIssue` is the server's verdict on the date.
 */
export function firstProposalIssue(f: ProposalForm, dateIssue?: string | null): [number, string] | null {
  const blank = (s: string) => !s.trim();
  if (blank(f.title)) return [0, 'Please enter the event title.'];
  if (blank(f.targetDate)) return [0, 'Please enter the target date.'];
  if (dateIssue) return [0, dateIssue];
  if (blank(f.venue)) return [0, 'Please enter the proposed venue.'];
  if (blank(f.participants[0].category)) return [0, 'Please name the first target participant category.'];
  if (blank(f.participants[1].category)) return [0, 'Please name the second target participant category.'];
  const out = f.outputs.findIndex(blank);
  if (out >= 0) return [0, `Please fill in expected output #${out + 1}.`];
  if (blank(f.budget)) return [0, 'Please enter the proposed budget.'];
  if (blank(f.fundSource)) return [0, 'Please enter the source of fund.'];
  if (blank(f.focalName)) return [0, "Please enter the focal person's name."];
  if (blank(f.focalRole)) return [0, "Please enter the focal person's designation."];
  if (blank(f.focalContact)) return [0, "Please enter the focal person's contact number."];

  if (blank(f.rationale)) return [1, 'Please provide the rationale.'];
  if (blank(f.objectives)) return [1, 'Please provide the objectives.'];

  for (const [i, r] of f.phases.entries()) {
    if (blank(r.stage)) return [2, `Please fill in the stage for Phase ${i + 1}.`];
    if (blank(r.activities)) return [2, `Please fill in the activities for Phase ${i + 1}.`];
  }
  for (const [i, r] of f.matrix.entries()) {
    for (const k of ['day', 'time', 'event', 'speaker'] as const) {
      if (blank(r[k])) return [3, `Please fill in the ${k} for activity matrix row ${i + 1}.`];
    }
  }
  for (const [i, r] of f.materials.entries()) {
    for (const [k, label] of [['item', 'item'], ['qty', 'quantity'], ['cost', 'cost'], ['total', 'total']] as const) {
      if (blank(r[k])) return [4, `Please fill in the ${label} for training material row ${i + 1}.`];
    }
  }
  for (const [i, r] of f.snacks.entries()) {
    for (const k of ['item', 'pax', 'cost', 'total'] as const) {
      if (blank(r[k])) return [4, `Please fill in the ${k} for snack row ${i + 1}.`];
    }
  }
  for (const [i, r] of f.exec.entries()) {
    if (blank(r.name)) return [4, `Please fill in the name for executive committee member ${i + 1}.`];
    if (blank(r.position)) return [4, `Please fill in the position for executive committee member ${i + 1}.`];
  }
  for (const [i, g] of f.twg.entries()) {
    if (blank(g.title)) return [4, `Please name TWG group ${i + 1}.`];
    for (const [j, m] of g.members.entries()) {
      for (const [k, label] of [['name', 'name'], ['designation', 'designation'], ['tor', 'terms of reference'], ['output', 'output']] as const) {
        if (blank(m[k])) return [4, `Please fill in the ${label} for ${g.title} member ${j + 1}.`];
      }
      if (m.automate && m.userId == null) {
        return [4, `Choose the TaskNet user for ${g.title} member ${j + 1} to automate their special task.`];
      }
    }
  }

  if (blank(f.monitoring)) return [5, 'Please provide the monitoring instructions / evaluation criteria.'];
  const ind = f.indicators.findIndex(blank);
  if (ind >= 0) return [5, `Please fill in indicator #${ind + 1}.`];
  return null;
}

/** Approved/disabled proposals aren't silently demoted back to draft. */
export const canSaveAsDraft = (status?: string | null) => !status || status === 'draft' || status === 'pending_approval';
