import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/ui/Icon';
import { ElevatedButton, IconButton, OutlinedButton, Tap, TextButton } from '../components/ui/buttons';
import { InputDecoration, Radio, TextField } from '../components/ui/inputs';
import { CircularProgressIndicator } from '../components/ui/misc';
import { showSnackBar } from '../components/ui/overlay';
import { showDatePicker, themePickerColors } from '../components/ui/pickers';
import { Json } from '../models/models';
import { ApiService, errorMessage } from '../services/apiService';
import { useAppState } from '../services/appState';
import { ts, tsField } from '../theme/appTheme';
import { dayKey, parseEventDate } from '../utils/dateParse';
import { titleCase } from '../utils/inputFormatters';

interface AddEventScreenProps {
  onBack: () => void;
  onCreated: () => void;
  /// null = create, non-null = edit
  existingEvent?: Json | null;
}

type Row = Record<string, string>;
interface TwgGroup {
  title: string;
  members: Row[];
}
interface Signatory {
  role: string;
  name: string;
  title: string;
}

const STEP_TITLES = [
  'Proposal Brief',
  'Rationale & Objectives',
  'Methodology',
  'Activity Matrix',
  'Budget',
  'Monitoring & Evaluation',
];

// Target date is picked from a calendar and stored month-in-words
// ("October 1, 2026") so viewing shows it directly and the calendar parses it.
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const fmtLongDate = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

const str = (v: unknown): string => (v ?? '').toString();
const int = (v: unknown): number => (typeof v === 'number' ? Math.trunc(v) : 0);

function decodeList(raw: unknown): Json[] | null {
  if (raw == null) return null;
  try {
    const decoded = JSON.parse(String(raw));
    return Array.isArray(decoded) && decoded.length > 0 ? (decoded as Json[]) : null;
  } catch {
    return null;
  }
}

const newMember = (): Row => ({ name: '', designation: '', tor: '', output: '' });

/// The form's starting values: blank for a new proposal, or parsed from the
/// event being edited.
function initialForm(e: Json | null) {
  // Parse participants
  let pCat1 = 'Teachers/Speakers';
  let pCat2 = 'Aspiring journalists';
  let tMale = 0, tFemale = 0, jMale = 0, jFemale = 0;
  if (e?.participants != null) {
    try {
      const p = JSON.parse(e.participants) as Json;
      const rows = p.rows as Json[] | null;
      if (rows != null && rows.length >= 2) {
        pCat1 = (rows[0].category ?? pCat1).toString();
        tMale = int(rows[0].male);
        tFemale = int(rows[0].female);
        pCat2 = (rows[1].category ?? pCat2).toString();
        jMale = int(rows[1].male);
        jFemale = int(rows[1].female);
      } else {
        tMale = int(p.teachers?.male);
        tFemale = int(p.teachers?.female);
        jMale = int(p.journalists?.male);
        jFemale = int(p.journalists?.female);
      }
    } catch {}
  }

  // Parse expected outputs
  let outputs: string[] = ['', ''];
  if (e?.expected_outputs != null) {
    try {
      const decoded = JSON.parse(e.expected_outputs);
      if (Array.isArray(decoded)) outputs = decoded.map((o) => String(o));
    } catch {}
  }
  if (outputs.length === 0) outputs = ['', ''];

  let objectives = '';
  if (e?.objectives != null) {
    const raw = e.objectives.toString();
    try {
      const decoded = JSON.parse(raw);
      // Legacy JSON-array format → join as newline-separated text
      objectives = Array.isArray(decoded) ? decoded.filter((s) => String(s).trim().length > 0).join('\n') : raw;
    } catch {
      objectives = raw;
    }
  }

  // Step 3 - Methodology phases
  const methodologyRows: Row[] = decodeList(e?.phase1)?.map((r) => ({ stage: str(r.stage), activities: str(r.activities) })) ?? [
    { stage: 'Pre-Implementation Stage', activities: (e?.phase1 ?? 'Planning\nRecruitment of participants').toString() },
    { stage: 'Implementation', activities: (e?.phase2 ?? 'Training-workshop sessions').toString() },
    { stage: 'Post-Implementation', activities: (e?.phase3 ?? 'Selection of school paper staff\nEvaluation of the activity').toString() },
  ];

  const rowsOf = (raw: unknown, keys: string[], blank: number): Row[] =>
    decodeList(raw)?.map((r) => Object.fromEntries(keys.map((k) => [k, str(r[k])]))) ??
    Array.from({ length: blank }, () => Object.fromEntries(keys.map((k) => [k, ''])));

  // TWG groups
  const twgGroups: TwgGroup[] = decodeList(e?.twg_groups)?.map((g) => {
    const members = Array.isArray(g.members)
      ? (g.members as Json[]).map((m) => ({ name: str(m.name), designation: str(m.designation), tor: str(m.tor), output: str(m.output) }))
      : [];
    return { title: str(g.title), members: members.length === 0 ? [newMember()] : members };
  }) ?? [
    { title: 'Supervising Committee', members: [newMember()] },
    { title: 'Program Implementation Committee', members: [newMember()] },
  ];

  // Signatories (stored in comments field as JSON)
  const signatories: Signatory[] = [
    { role: 'Noted', name: '', title: 'School Principal' },
    { role: 'Endorsed', name: '', title: 'Public Schools District Supervisor' },
    { role: 'Recommending Approval', name: '', title: 'Assistant Schools Division Superintendent' },
    { role: 'Approved', name: '', title: 'Schools Division Superintendent' },
  ];
  if (e?.comments != null) {
    try {
      const dec = JSON.parse(e.comments.toString());
      if (dec != null && typeof dec === 'object' && Array.isArray(dec.signatories)) {
        const list = dec.signatories as Json[];
        for (let i = 0; i < signatories.length && i < list.length; i++) {
          signatories[i].name = (list[i].name ?? '').toString();
          signatories[i].title = (list[i].title ?? signatories[i].title).toString();
        }
      }
    } catch {}
  }

  return {
    // Step 1
    title: str(e?.title),
    date: str(e?.target_date),
    venue: str(e?.venue),
    budget: str(e?.proposed_budget),
    fund: str(e?.fund_source),
    focalName: str(e?.focal_name),
    focalRole: str(e?.focal_role),
    focalCp: str(e?.focal_contact),
    nature: (e?.nature as string | null) ?? 'Co-curricular',
    pCat1,
    pCat2,
    tMale,
    tFemale,
    jMale,
    jFemale,
    outputs,
    // Step 2
    rationale: str(e?.rationale),
    objectives,
    // Step 3
    methodologyRows,
    // Step 4 - Activity matrix
    matrixRows: rowsOf(e?.activity_matrix, ['day', 'time', 'event', 'speaker'], 3),
    // Step 5 - Budget
    matRows: rowsOf(e?.training_materials, ['item', 'qty', 'cost', 'total'], 2),
    snackRows: rowsOf(e?.snacks, ['item', 'pax', 'cost', 'total'], 1),
    execRows: rowsOf(e?.exec_committee, ['name', 'position'], 2),
    twgGroups,
    // Step 6
    monitoring: str(e?.monitoring_criteria),
    // Indicators
    indicators: decodeList(e?.indicators)?.map((d) => str(d.label)) ?? [''],
    signatories,
  };
}

type Form = ReturnType<typeof initialForm>;

function buildPayload(f: Form): Json {
  return {
    title: f.title,
    nature: f.nature,
    target_date: f.date,
    venue: f.venue,
    proposed_budget: f.budget,
    fund_source: f.fund,
    focal_name: f.focalName,
    focal_role: f.focalRole,
    focal_contact: f.focalCp,
    expected_outputs: JSON.stringify(f.outputs),
    participants: JSON.stringify({
      rows: [
        { category: f.pCat1, male: f.tMale, female: f.tFemale, total: f.tMale + f.tFemale },
        { category: f.pCat2, male: f.jMale, female: f.jFemale, total: f.jMale + f.jFemale },
      ],
      totals: {
        male: f.tMale + f.jMale,
        female: f.tFemale + f.jFemale,
        total: f.tMale + f.tFemale + f.jMale + f.jFemale,
      },
    }),
    rationale: f.rationale,
    objectives: f.objectives,
    phase1: JSON.stringify(f.methodologyRows),
    phase2: '',
    phase3: '',
    activity_matrix: JSON.stringify(f.matrixRows),
    training_materials: JSON.stringify(f.matRows),
    snacks: JSON.stringify(f.snackRows),
    exec_committee: JSON.stringify(f.execRows),
    twg_groups: JSON.stringify(f.twgGroups),
    monitoring_criteria: f.monitoring,
    indicators: JSON.stringify(f.indicators.map((label) => ({ label }))),
    comments: JSON.stringify({ signatories: f.signatories }),
  };
}

/// Returns the step index and a message for the first unanswered required
/// field, or null if every field across all steps has been filled in.
function firstEmptyField(f: Form, dateIssue: string | null): [number, string] | null {
  const empty = (s: string) => s.trim().length === 0;
  // Step 1 - Proposal Brief
  if (empty(f.title)) return [0, 'Please enter the event title.'];
  if (empty(f.date)) return [0, 'Please enter the target date.'];
  if (dateIssue != null) return [0, dateIssue];
  if (empty(f.venue)) return [0, 'Please enter the proposed venue.'];
  if (empty(f.pCat1)) return [0, 'Please name the first target participant category.'];
  if (empty(f.pCat2)) return [0, 'Please name the second target participant category.'];
  for (let i = 0; i < f.outputs.length; i++) {
    if (empty(f.outputs[i])) return [0, `Please fill in expected output #${i + 1}.`];
  }
  if (empty(f.budget)) return [0, 'Please enter the proposed budget.'];
  if (empty(f.fund)) return [0, 'Please enter the source of fund.'];
  if (empty(f.focalName)) return [0, "Please enter the focal person's name."];
  if (empty(f.focalRole)) return [0, "Please enter the focal person's designation."];
  if (empty(f.focalCp)) return [0, "Please enter the focal person's contact number."];

  // Step 2 - Rationale & Objectives
  if (empty(f.rationale)) return [1, 'Please provide the rationale.'];
  if (empty(f.objectives)) return [1, 'Please provide the objectives.'];

  // Step 3 - Methodology
  for (let i = 0; i < f.methodologyRows.length; i++) {
    const row = f.methodologyRows[i];
    if (empty(row.stage)) return [2, `Please fill in the stage for Phase ${i + 1}.`];
    if (empty(row.activities)) return [2, `Please fill in the activities for Phase ${i + 1}.`];
  }

  // Step 4 - Activity Matrix
  for (let i = 0; i < f.matrixRows.length; i++) {
    const row = f.matrixRows[i];
    for (const key of ['day', 'time', 'event', 'speaker']) {
      if (empty(row[key])) return [3, `Please fill in the ${key} for activity matrix row ${i + 1}.`];
    }
  }

  // Step 5 - Budget
  for (let i = 0; i < f.matRows.length; i++) {
    const row = f.matRows[i];
    for (const [key, label] of [['item', 'item'], ['qty', 'quantity'], ['cost', 'cost'], ['total', 'total']]) {
      if (empty(row[key])) return [4, `Please fill in the ${label} for training material row ${i + 1}.`];
    }
  }
  for (let i = 0; i < f.snackRows.length; i++) {
    const row = f.snackRows[i];
    for (const key of ['item', 'pax', 'cost', 'total']) {
      if (empty(row[key])) return [4, `Please fill in the ${key} for snack row ${i + 1}.`];
    }
  }
  for (let i = 0; i < f.execRows.length; i++) {
    const row = f.execRows[i];
    if (empty(row.name)) return [4, `Please fill in the name for executive committee member ${i + 1}.`];
    if (empty(row.position)) return [4, `Please fill in the position for executive committee member ${i + 1}.`];
  }
  for (let i = 0; i < f.twgGroups.length; i++) {
    const group = f.twgGroups[i];
    if (empty(group.title)) return [4, `Please name TWG group ${i + 1}.`];
    for (let j = 0; j < group.members.length; j++) {
      const m = group.members[j];
      if (empty(m.name)) return [4, `Please fill in the name for ${group.title} member ${j + 1}.`];
      if (empty(m.designation)) return [4, `Please fill in the designation for ${group.title} member ${j + 1}.`];
      if (empty(m.tor)) return [4, `Please fill in the terms of reference for ${group.title} member ${j + 1}.`];
      if (empty(m.output)) return [4, `Please fill in the output for ${group.title} member ${j + 1}.`];
    }
  }

  // Step 6 - Monitoring & Evaluation
  if (empty(f.monitoring)) return [5, 'Please provide the monitoring instructions / evaluation criteria.'];
  for (let i = 0; i < f.indicators.length; i++) {
    if (empty(f.indicators[i])) return [5, `Please fill in indicator #${i + 1}.`];
  }

  return null;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

const hint13 = tsField({ color: '#AAAAAA', size: 13 });
const text13 = tsField({ size: 13 });
const bodyNote = ts({ size: 13, color: '#4A5568' });
const tableHead = ts({ weight: 700, size: 13 });

const boxDecoration = (radius: number, padding: [number, number], hintText?: string, hintSize = 13): InputDecoration => ({
  hintText,
  hintStyle: tsField({ color: '#AAAAAA', size: hintSize }),
  filled: true,
  fillColor: '#F7F9FC',
  radius,
  borderColor: '#E2E8F0',
  borderWidth: 1,
  contentPadding: padding,
});

function FLabel({ text }: { text: string }) {
  return (
    <View style={{ paddingBottom: 6 }}>
      <Text style={ts({ size: 13, weight: 600, color: '#1A1A2E' })}>{text}</Text>
    </View>
  );
}

function SecTitle({ text }: { text: string }) {
  return (
    <View style={{ paddingBottom: 16 }}>
      <Text style={ts({ size: 16, weight: 700, color: '#1A1A2E' })}>{text}</Text>
    </View>
  );
}

function TField({ value, onChange, hint = '', maxLines = 1, title = false, style }: {
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  maxLines?: number;
  /// Person names capitalize as typed.
  title?: boolean;
  style?: object;
}) {
  return (
    <TextField
      style={style}
      value={value}
      onChangeText={(v) => onChange(title ? titleCase(v) : v)}
      maxLines={maxLines}
      minLines={maxLines}
      tabInsertsSpaces={maxLines > 1}
      textStyle={text13}
      decoration={{
        ...boxDecoration(8, [12, 12], hint),
        focusedBorderColor: '#ACC2DF',
        focusedBorderWidth: 1.5,
      }}
    />
  );
}

function Mini({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <TextField value={value} onChangeText={onChange} textStyle={text13} decoration={boxDecoration(6, [10, 10], hint, 12)} />
  );
}

const RemoveIcon = ({ onTap }: { onTap: () => void }) => (
  <Tap onPress={onTap}>
    <Icon name="remove_circle_outline" size={20} color="#E53E3E" />
  </Tap>
);

const AddButton = ({ label, onTap }: { label: string; onTap: () => void }) => (
  <View style={{ flexDirection: 'row' }}>
    <TextButton onPress={onTap} icon="add" iconSize={16} foregroundColor="#63B3ED">{label}</TextButton>
  </View>
);

function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState('');
  return (
    <View style={{ padding: 4 }}>
      <TextField
        value={text}
        keyboardType="number-pad"
        textAlign="center"
        onChangeText={(v) => {
          setText(v);
          const n = /^[+-]?\d+$/.test(v.trim()) ? parseInt(v, 10) : 0;
          onChange(n);
        }}
        textStyle={text13}
        decoration={boxDecoration(6, [8, 10], `${value}`)}
      />
    </View>
  );
}

/// A bordered table with a grey header row.
function TableFrame({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.tableFrame}>
      <View style={styles.tableHeader}>{header}</View>
      <View style={styles.tableDivider} />
      {children}
    </View>
  );
}

const replaceAt = <T,>(list: T[], index: number, value: T): T[] => list.map((item, i) => (i === index ? value : item));
const removeAt = <T,>(list: T[], index: number): T[] => list.filter((_, i) => i !== index);

/// Editable rows of single-line cells (budget items).
function BudgetTable({ headers, rows, keys, hints, onChange }: {
  headers: string[];
  rows: Row[];
  keys: string[];
  hints: string[];
  onChange: (rows: Row[]) => void;
}) {
  return (
    <View>
      <TableFrame
        header={
          <>
            {headers.map((h) => (
              <Text key={h} style={[tableHead, { flex: 1 }]}>{h}</Text>
            ))}
            <View style={{ width: 36 }} />
          </>
        }
      >
        {rows.map((row, r) => (
          <View key={r} style={{ padding: 8, flexDirection: 'row', alignItems: 'center' }}>
            {keys.map((key, k) => (
              <View key={key} style={{ flex: 1, paddingRight: 8 }}>
                <Mini value={row[key]} hint={hints[k]} onChange={(v) => onChange(replaceAt(rows, r, { ...row, [key]: v }))} />
              </View>
            ))}
            <RemoveIcon onTap={() => onChange(removeAt(rows, r))} />
          </View>
        ))}
      </TableFrame>
      <AddButton label="Add item" onTap={() => onChange([...rows, Object.fromEntries(keys.map((k) => [k, '']))])} />
    </View>
  );
}

/// Editable rows of growing multi-line cells (committee members).
function CommitteeTable({ rows, headers, keys, hints, onChange }: {
  rows: Row[];
  headers: string[];
  keys: string[];
  hints: string[];
  onChange: (rows: Row[]) => void;
}) {
  return (
    <View>
      <TableFrame
        header={
          <>
            {headers.map((h) => (
              <Text key={h} style={[tableHead, { flex: 1 }]}>{h}</Text>
            ))}
            <View style={{ width: 36 }} />
          </>
        }
      >
        {rows.map((row, r) => (
          <View key={r} style={{ padding: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
            {keys.map((key, k) => (
              <View key={key} style={{ flex: 1, paddingRight: 8 }}>
                <TextField
                  value={row[key]}
                  maxLines={null}
                  // Person names capitalize as typed.
                  onChangeText={(v) => onChange(replaceAt(rows, r, { ...row, [key]: key === 'name' ? titleCase(v) : v }))}
                  textStyle={tsField({ size: 12 })}
                  decoration={boxDecoration(6, [8, 8], hints[k], 11)}
                />
              </View>
            ))}
            <View style={{ paddingTop: 10 }}>
              <RemoveIcon onTap={() => onChange(removeAt(rows, r))} />
            </View>
          </View>
        ))}
      </TableFrame>
      <AddButton label="Add member" onTap={() => onChange([...rows, Object.fromEntries(keys.map((k) => [k, '']))])} />
    </View>
  );
}

function StepPage({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, alignItems: 'flex-start' }}>{children}</View>
    </ScrollView>
  );
}

const stretch = { alignSelf: 'stretch' } as const;
const subHead = ts({ size: 14, weight: 600 });

export default function AddEventScreen({ onBack, onCreated, existingEvent = null }: AddEventScreenProps) {
  const app = useAppState();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Form>(() => initialForm(existingEvent));
  // Days already taken by a pending/approved event (greyed out in the picker),
  // and the server's verdict on the chosen date (null = free).
  const [takenDays, setTakenDays] = useState<Set<string>>(new Set());
  const [dateIssue, setDateIssue] = useState<string | null>(null);
  const [checkingDate, setCheckingDate] = useState(false);

  const isEditing = existingEvent != null;
  const eventId = (existingEvent?.id as number | undefined) ?? null;
  /// Whether the event being edited (if any) can still be saved as a draft.
  /// Approved/disabled proposals shouldn't be silently demoted back to draft.
  const existingStatus = (existingEvent?.status as string | null | undefined) ?? null;
  const canSaveAsDraft = existingStatus == null || existingStatus === 'draft' || existingStatus === 'pending_approval';

  // True once the proposal has been explicitly submitted/saved or auto-saved,
  // so we don't create duplicate drafts on exit/logout/expiry.
  const persisted = useRef(false);
  const mounted = useRef(true);
  const latest = useRef(form);
  latest.current = form;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = (payload: Json) =>
    isEditing ? ApiService.updateEvent(eventId as number, payload) : ApiService.createEvent(payload);

  /// Server-side conflict check for the chosen date; the message is shown
  /// under the field and blocks submission.
  const checkDate = async (value: string) => {
    const text = value.trim();
    if (text.length === 0) return;
    setCheckingDate(true);
    try {
      const r = await ApiService.checkEventDate(text, eventId);
      if (mounted.current && latest.current.date.trim() === text) {
        setDateIssue(r.available === true ? null : r.message?.toString() ?? null);
      }
    } catch {
      // Leave the last verdict; the server re-checks on submit anyway.
    } finally {
      if (mounted.current) setCheckingDate(false);
    }
  };

  useEffect(() => {
    mounted.current = true;

    /// Persists the current form as a draft. Invoked by the AppState auto-save
    /// hook on logout / token-expiry. Guarded so it saves at most once and only
    /// when there is meaningful, still-draftable content.
    const autoSaveDraft = async () => {
      if (persisted.current || !canSaveAsDraft) return;
      if (latest.current.title.trim().length === 0) return; // nothing worth saving
      persisted.current = true;
      try {
        await save({ ...buildPayload(latest.current), status: 'draft' });
      } catch {
        persisted.current = false; // let a later trigger retry
      }
    };
    // Register draft auto-save so a logout / token-expiry persists the work.
    app.registerDraftAutosave(autoSaveDraft);

    /// Dates of other live (pending/approved) events, across all school years.
    (async () => {
      try {
        const events = await ApiService.getEvents('all');
        const days = new Set<string>();
        for (const e of events) {
          const st = (e.status ?? '').toString();
          if (e.id === eventId || (st !== 'approved' && st !== 'pending_approval')) continue;
          const d = parseEventDate(e.target_date?.toString());
          if (d != null) days.add(dayKey(d));
        }
        if (mounted.current) setTakenDays(days);
      } catch {/* the server check below still guards submission */}
      if (latest.current.date.trim().length > 0) checkDate(latest.current.date);
    })();

    return () => {
      mounted.current = false;
      // Auto-save as draft on exit (navigating away / closing the screen).
      // Fire-and-forget: the screen is going away, so failures are ignored.
      if (!persisted.current && canSaveAsDraft && latest.current.title.trim().length > 0) {
        persisted.current = true;
        save({ ...buildPayload(latest.current), status: 'draft' }).catch(() => {});
      }
      app.unregisterDraftAutosave(autoSaveDraft);
    };
    // Registered once for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickTargetDate = async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const parsed = parseEventDate(form.date) ?? today;
    // A proposal can't target a date that has already passed — start no earlier
    // than today (the backend re-checks this and any same-day conflict).
    const initial = parsed < today ? today : parsed;
    const free = (d: Date) => !takenDays.has(dayKey(d));
    // Start on a selectable day: the picker rejects a taken initialDate.
    let start = initial;
    for (let i = 0; i < 366 && !free(start); i++) {
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    }
    const picked = await showDatePicker({
      initialDate: free(start) ? start : initial,
      firstDate: today,
      lastDate: new Date(now.getFullYear() + 5, 0, 1),
      helpText: 'Select target date (greyed-out days already have an event)',
      selectableDayPredicate: (d) => free(d) || dayKey(d) === dayKey(initial),
      colors: themePickerColors,
    });
    if (picked != null) {
      const text = fmtLongDate(picked);
      latest.current = { ...latest.current, date: text };
      set('date', text);
      checkDate(text);
    }
  };

  const submit = async (asDraft = false) => {
    if (!asDraft) {
      const issue = firstEmptyField(form, dateIssue);
      if (issue != null) {
        const [issueStep, message] = issue;
        showSnackBar(message, { backgroundColor: '#E53E3E' });
        setStep(issueStep);
        return;
      }
    }
    setSubmitting(true);
    try {
      const result = await save({ ...buildPayload(form), status: asDraft ? 'draft' : 'pending_approval' });
      if (result != null) persisted.current = true;
      if (!mounted.current) return;
      if (result != null) {
        showSnackBar(
          asDraft ? 'Saved as draft.' : isEditing ? 'Event updated successfully!' : 'Event proposal submitted for approval!',
          { backgroundColor: '#48BB78' },
        );
        onCreated();
      } else {
        showSnackBar('Failed to submit. Check server connection.', { backgroundColor: '#E53E3E' });
      }
    } catch (e) {
      if (!mounted.current) return;
      showSnackBar(errorMessage(e), { backgroundColor: '#E53E3E' });
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const dateOk = dateIssue == null && form.date.trim().length > 0 && !checkingDate;
  const totalMale = form.tMale + form.jMale;
  const totalFemale = form.tFemale + form.jFemale;
  const paxCell = ts({ weight: 700, size: 12, align: 'center' });

  const paxRow = (
    label: string,
    setLabel: (v: string) => void,
    male: number,
    female: number,
    setMale: (n: number) => void,
    setFemale: (n: number) => void,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 2.5, paddingHorizontal: 10, paddingVertical: 8 }}>
        {/* Only `border` is cleared here, so the theme's outline still draws. */}
        <TextField value={label} onChangeText={setLabel} textStyle={text13} decoration={{ isDense: true, hintText: 'Category' }} />
      </View>
      <View style={{ flex: 1 }}>
        <NumCell value={male} onChange={setMale} />
      </View>
      <View style={{ flex: 1 }}>
        <NumCell value={female} onChange={setFemale} />
      </View>
      <View style={{ flex: 1, padding: 10 }}>
        <Text style={ts({ weight: 600, size: 13, align: 'center' })}>{`${male + female}`}</Text>
      </View>
    </View>
  );

  const pair = (left: React.ReactNode, right: React.ReactNode) => (
    <View style={[stretch, { flexDirection: 'row', alignItems: 'center' }]}>
      <View style={{ flex: 1 }}>{left}</View>
      <View style={{ width: 16 }} />
      <View style={{ flex: 1 }}>{right}</View>
    </View>
  );

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const proposalBrief = (
    <StepPage>
      <SecTitle text="I. PROPOSAL BRIEF" />
      <FLabel text="a. Title" />
      <TField style={stretch} value={form.title} onChange={(v) => set('title', v)} hint="Enter project title" />
      <View style={{ height: 16 }} />
      <FLabel text="b. Nature of Activity" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
        {['Curricular', 'Co-curricular', 'Extra-curricular'].map((n) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Radio selected={form.nature === n} onPress={() => set('nature', n)} activeColor="#1E2126" />
            <Text style={ts({ size: 13 })}>{n}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 16 }} />
      {pair(
        <>
          <FLabel text="c. Target Date" />
          <TextField
            value={form.date}
            readOnly
            onPress={pickTargetDate}
            textStyle={text13}
            decoration={{
              ...boxDecoration(8, [12, 12], 'Select target date'),
              errorText: dateIssue,
              helperText: checkingDate ? 'Checking the calendar...' : dateOk ? 'No other event is scheduled on this date.' : null,
              helperStyle: { fontSize: 11.5, color: '#16A34A' },
              suffixIcon: <Icon name="calendar_today_outlined" size={18} color="#718096" />,
              focusedBorderColor: '#ACC2DF',
              focusedBorderWidth: 1.5,
            }}
          />
        </>,
        <>
          <FLabel text="d. Proposed Venue" />
          <TField value={form.venue} onChange={(v) => set('venue', v)} hint="e.g. NCS II Pavilion" />
        </>,
      )}
      <View style={{ height: 16 }} />
      <FLabel text="e. Target Participants" />
      <View style={[stretch, { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8 }]}>
        <View style={{ flexDirection: 'row', backgroundColor: '#F7F9FC' }}>
          {['', 'MALE', 'FEMALE', 'TOTAL'].map((h, i) => (
            <View key={i} style={{ flex: i === 0 ? 2.5 : 1, padding: 10 }}>
              <Text style={paxCell}>{h}</Text>
            </View>
          ))}
        </View>
        {paxRow(form.pCat1, (v) => set('pCat1', v), form.tMale, form.tFemale, (n) => set('tMale', n), (n) => set('tFemale', n))}
        {paxRow(form.pCat2, (v) => set('pCat2', v), form.jMale, form.jFemale, (n) => set('jMale', n), (n) => set('jFemale', n))}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 2.5, padding: 10 }}>
            <Text style={ts({ weight: 700, size: 12 })}>TOTAL</Text>
          </View>
          {[totalMale, totalFemale, totalMale + totalFemale].map((v, i) => (
            <View key={i} style={{ flex: 1, padding: 10 }}>
              <Text style={paxCell}>{`${v}`}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ height: 16 }} />
      <FLabel text="f. Expected Outputs" />
      {form.outputs.map((output, i) => (
        <View key={i} style={[stretch, { paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }]}>
          <Text style={ts({ size: 13, color: '#718096' })}>{`${i + 1}. `}</Text>
          <TField style={{ flex: 1 }} value={output} onChange={(v) => set('outputs', replaceAt(form.outputs, i, v))} hint="Expected output..." />
        </View>
      ))}
      <AddButton label="Add output" onTap={() => set('outputs', [...form.outputs, ''])} />
      <View style={{ height: 16 }} />
      {pair(
        <>
          <FLabel text="g. Proposed Budget (₱)" />
          <TField value={form.budget} onChange={(v) => set('budget', v)} hint="e.g. 3,120.00" />
        </>,
        <>
          <FLabel text="h. Source of Fund" />
          <TField value={form.fund} onChange={(v) => set('fund', v)} hint="e.g. School Paper Fund/SPTA Fund" />
        </>,
      )}
      <View style={{ height: 16 }} />
      <FLabel text="h. Focal Person" />
      <View style={[stretch, { flexDirection: 'row', alignItems: 'center' }]}>
        <TField style={{ flex: 1 }} value={form.focalName} onChange={(v) => set('focalName', v)} hint="Full name" title />
        <View style={{ width: 12 }} />
        <TField style={{ flex: 1 }} value={form.focalRole} onChange={(v) => set('focalRole', v)} hint="Designation" />
        <View style={{ width: 12 }} />
        <TField style={{ flex: 1 }} value={form.focalCp} onChange={(v) => set('focalCp', v)} hint="CP # / Contact" />
      </View>
    </StepPage>
  );

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const rationale = (
    <StepPage>
      <SecTitle text="II. RATIONALE" />
      <TField style={stretch} value={form.rationale} onChange={(v) => set('rationale', v)} hint="Provide the rationale for this activity..." maxLines={8} />
      <View style={{ height: 28 }} />
      <SecTitle text="III. OBJECTIVES" />
      <Text style={bodyNote}>
        Enter each objective on a new line. They will be numbered automatically in the printed proposal.
      </Text>
      <View style={{ height: 12 }} />
      <TField
        style={stretch}
        value={form.objectives}
        onChange={(v) => set('objectives', v)}
        hint={'equip young journalists with the basics of writing...\nproduce various journalistic articles...\nchoose the campus journalists who will compete...'}
        maxLines={8}
      />
    </StepPage>
  );

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const phaseField = (i: number, key: 'stage' | 'activities') => (
    <TextField
      value={form.methodologyRows[i][key]}
      maxLines={null}
      onChangeText={(v) => set('methodologyRows', replaceAt(form.methodologyRows, i, { ...form.methodologyRows[i], [key]: v }))}
      textStyle={text13}
      decoration={boxDecoration(6, [10, 10])}
    />
  );
  const methodology = (
    <StepPage>
      <SecTitle text="IV. METHODOLOGY" />
      <Text style={bodyNote}>
        The training shall be composed of lectures, video clip viewing, sharing and games. 5E's approach shall be
        utilized for most of the sessions.
      </Text>
      <View style={{ height: 20 }} />
      <View style={stretch}>
        <TableFrame
          header={
            <>
              <Text style={[tableHead, { flex: 1 }]}>Phase</Text>
              <Text style={[tableHead, { flex: 2 }]}>Stage</Text>
              <Text style={[tableHead, { flex: 3 }]}>Activities</Text>
              <View style={{ width: 36 }} />
            </>
          }
        >
          {form.methodologyRows.map((_, i) => (
            <View key={i}>
              <View style={{ padding: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 12 }}>
                  <Text style={tableHead}>{`Phase ${i + 1}`}</Text>
                </View>
                <View style={{ width: 8 }} />
                <View style={{ flex: 2 }}>{phaseField(i, 'stage')}</View>
                <View style={{ width: 8 }} />
                <View style={{ flex: 3 }}>{phaseField(i, 'activities')}</View>
                <View style={{ width: 8 }} />
                <View style={{ paddingTop: 12 }}>
                  <RemoveIcon onTap={() => set('methodologyRows', removeAt(form.methodologyRows, i))} />
                </View>
              </View>
              {i < form.methodologyRows.length - 1 && <View style={styles.tableDivider} />}
            </View>
          ))}
        </TableFrame>
      </View>
      <View style={{ height: 12 }} />
      <AddButton label="Add phase" onTap={() => set('methodologyRows', [...form.methodologyRows, { stage: '', activities: '' }])} />
    </StepPage>
  );

  // ── Step 4 ────────────────────────────────────────────────────────────────
  const matrixCell = (i: number, key: string, flex: number, hint: string) => (
    <View style={{ flex }}>
      <Mini
        value={form.matrixRows[i][key]}
        hint={hint}
        onChange={(v) => set('matrixRows', replaceAt(form.matrixRows, i, { ...form.matrixRows[i], [key]: v }))}
      />
    </View>
  );
  const activityMatrix = (
    <StepPage>
      <SecTitle text="V. ACTIVITY MATRIX" />
      <View style={stretch}>
        <TableFrame
          header={
            <>
              <Text style={[tableHead, { flex: 2 }]}>Day</Text>
              <Text style={[tableHead, { flex: 2 }]}>Time</Text>
              <Text style={[tableHead, { flex: 3 }]}>Event</Text>
              <Text style={[tableHead, { flex: 3 }]}>Speaker</Text>
              <View style={{ width: 36 }} />
            </>
          }
        >
          {form.matrixRows.map((_, i) => (
            <View key={i}>
              <View style={{ padding: 8, flexDirection: 'row', alignItems: 'center' }}>
                {matrixCell(i, 'day', 2, 'Oct. 23, 2024')}
                <View style={{ width: 8 }} />
                {matrixCell(i, 'time', 2, '4:00-5:00 PM')}
                <View style={{ width: 8 }} />
                {matrixCell(i, 'event', 3, 'e.g. News Writing')}
                <View style={{ width: 8 }} />
                {matrixCell(i, 'speaker', 3, 'Speaker name')}
                <View style={{ width: 8 }} />
                <RemoveIcon onTap={() => set('matrixRows', removeAt(form.matrixRows, i))} />
              </View>
              {i < form.matrixRows.length - 1 && <View style={styles.tableDivider} />}
            </View>
          ))}
        </TableFrame>
      </View>
      <View style={{ height: 12 }} />
      <AddButton label="Add row" onTap={() => set('matrixRows', [...form.matrixRows, { day: '', time: '', event: '', speaker: '' }])} />
    </StepPage>
  );

  // ── Step 5 ────────────────────────────────────────────────────────────────
  const budget = (
    <StepPage>
      <SecTitle text="VII. PROPOSED BUDGET" />
      <Text style={bodyNote}>
        Charged against School Paper Fund/SPTA Fund subject to usual accounting and auditing rules.
      </Text>
      <View style={{ height: 20 }} />
      <Text style={subHead}>a. Training Materials</Text>
      <View style={{ height: 10 }} />
      <View style={stretch}>
        <BudgetTable
          headers={['Particulars', 'Quantity', 'Cost', 'Total']}
          rows={form.matRows}
          keys={['item', 'qty', 'cost', 'total']}
          hints={['Bond paper...', '1 ream', '270.00', '270.00']}
          onChange={(rows) => set('matRows', rows)}
        />
      </View>
      <View style={{ height: 20 }} />
      <Text style={subHead}>b. Snacks for Program Partners</Text>
      <View style={{ height: 10 }} />
      <View style={stretch}>
        <BudgetTable
          headers={['Particulars', 'No. of Participants', 'Cost/pax', 'Total']}
          rows={form.snackRows}
          keys={['item', 'pax', 'cost', 'total']}
          hints={['Meals', '11 pax', '100.00', '1100.00']}
          onChange={(rows) => set('snackRows', rows)}
        />
      </View>
      <View style={{ height: 28 }} />
      <SecTitle text="VI. WORKING COMMITTEE" />
      <Text style={subHead}>a. Executive Committee</Text>
      <View style={{ height: 10 }} />
      <View style={stretch}>
        <CommitteeTable
          rows={form.execRows}
          headers={['Name', 'Position']}
          keys={['name', 'position']}
          hints={['e.g. FREDERICK M. BALDOZA', 'e.g. Principal']}
          onChange={(rows) => set('execRows', rows)}
        />
      </View>
      <View style={{ height: 24 }} />
      <Text style={subHead}>b. Technical Working Group</Text>
      <View style={{ height: 12 }} />
      {form.twgGroups.map((group, g) => (
        <View key={g} style={stretch}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextField
              style={{ flex: 1 }}
              value={group.title}
              onChangeText={(v) => set('twgGroups', replaceAt(form.twgGroups, g, { ...group, title: v }))}
              textStyle={tsField({ size: 13, weight: 600 })}
              decoration={{
                hintText: 'e.g. Supervising Committee',
                hintStyle: hint13,
                filled: true,
                fillColor: '#F0F4FA',
                radius: 8,
                borderColor: '#E2E8F0',
                borderWidth: 1,
                contentPadding: [12, 10],
                prefixIcon: <Icon name="group_outlined" size={18} color="#718096" />,
              }}
            />
            <View style={{ width: 8 }} />
            {form.twgGroups.length > 1 && <RemoveIcon onTap={() => set('twgGroups', removeAt(form.twgGroups, g))} />}
          </View>
          <View style={{ height: 10 }} />
          <CommitteeTable
            rows={group.members}
            headers={['Name', 'Designation', 'Terms of Reference', 'Output']}
            keys={['name', 'designation', 'tor', 'output']}
            hints={['Full name', 'e.g. Chairperson', 'e.g. Leads the Committee', 'e.g. Checked reports']}
            onChange={(members) => set('twgGroups', replaceAt(form.twgGroups, g, { ...group, members }))}
          />
          <View style={{ height: 16 }} />
        </View>
      ))}
      <AddButton
        label="Add Committee Group"
        onTap={() => set('twgGroups', [...form.twgGroups, { title: 'New Committee', members: [newMember()] }])}
      />
    </StepPage>
  );

  // ── Step 6 ────────────────────────────────────────────────────────────────
  const monitoringEvaluation = (
    <StepPage>
      <SecTitle text="VIII. MONITORING AND EVALUATION" />
      <FLabel text="Monitoring Instructions / Evaluation Criteria" />
      <TField
        style={stretch}
        value={form.monitoring}
        onChange={(v) => set('monitoring', v)}
        hint="Add specific monitoring instructions or evaluation criteria..."
        maxLines={6}
      />
      <View style={{ height: 28 }} />
      <SecTitle text="Observation Tool Indicators" />
      <Text style={bodyNote}>
        List the indicators to be observed. The Evident / Not Evident columns will be filled in on the printed
        evaluation form.
      </Text>
      <View style={{ height: 16 }} />
      <View style={[styles.tableFrame, stretch]}>
        <View style={[styles.tableHeader, { paddingHorizontal: 12, paddingVertical: 10 }]}>
          <Text style={ts({ weight: 700, size: 13, color: '#718096' })}>#</Text>
          <View style={{ width: 12 }} />
          <Text style={[tableHead, { flex: 1 }]}>Indicator Description</Text>
        </View>
        <View style={styles.tableDivider} />
        {form.indicators.map((indicator, i) => (
          <View key={i}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={ts({ size: 13, color: '#718096' })}>{`${i + 1}. `}</Text>
              <View style={{ width: 6 }} />
              <TextField
                style={{ flex: 1 }}
                value={indicator}
                onChangeText={(v) => set('indicators', replaceAt(form.indicators, i, v))}
                textStyle={tsField({ size: 13, color: '#1A1A2E' })}
                decoration={{
                  isDense: true,
                  border: 'none',
                  hintText: 'Describe what will be observed...',
                  hintStyle: tsField({ color: '#AAAAAA', size: 12 }),
                }}
              />
              {form.indicators.length > 1 && (
                <>
                  <View style={{ width: 8 }} />
                  <RemoveIcon onTap={() => set('indicators', removeAt(form.indicators, i))} />
                </>
              )}
            </View>
            {i < form.indicators.length - 1 && <View style={styles.tableDivider} />}
          </View>
        ))}
      </View>
      <View style={{ height: 12 }} />
      <AddButton label="Add indicator" onTap={() => set('indicators', [...form.indicators, ''])} />
      <View style={{ height: 32 }} />
      <SecTitle text="Signatories" />
      <Text style={bodyNote}>
        Enter the names and positions of the signatories. These will appear in the printed proposal.
      </Text>
      <View style={{ height: 16 }} />
      {form.signatories.map((s, i) => (
        <View key={s.role} style={[stretch, { paddingBottom: 16 }]}>
          <Text style={ts({ size: 12, weight: 600, color: '#718096' })}>{s.role}</Text>
          <View style={{ height: 6 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TField
              style={{ flex: 1 }}
              value={s.name}
              onChange={(v) => set('signatories', replaceAt(form.signatories, i, { ...s, name: v }))}
              hint="Full name (e.g. Juan D. Cruz)"
              title
            />
            <View style={{ width: 10 }} />
            <TField
              style={{ flex: 1 }}
              value={s.title}
              onChange={(v) => set('signatories', replaceAt(form.signatories, i, { ...s, title: v }))}
              hint="Position/Title"
            />
          </View>
        </View>
      ))}
    </StepPage>
  );

  const pages = [proposalBrief, rationale, methodology, activityMatrix, budget, monitoringEvaluation];
  const last = step === STEP_TITLES.length - 1;

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <IconButton icon="arrow_back_rounded" color="#1A1A2E" onPress={onBack} />
        <View style={{ width: 8 }} />
        <Text style={ts({ size: 22, weight: 700, color: '#1A1A2E' })}>{isEditing ? 'Edit Event' : 'Add New Event'}</Text>
      </View>
      {/* ── Step indicators ── */}
      <View style={styles.steps}>
        {STEP_TITLES.map((title, i) => (
          <Tap key={title} onPress={() => setStep(i)} style={{ flex: 1 }}>
            <View style={{ marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={[
                    styles.stepDot,
                    { backgroundColor: i < step ? '#48BB78' : i === step ? '#1E2126' : '#ACC2DF' },
                  ]}
                >
                  {i < step ? (
                    <Icon name="check" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={ts({ size: 11, weight: 700, color: '#FFFFFF' })}>{`${i + 1}`}</Text>
                  )}
                </View>
                <View style={{ width: 8 }} />
                <Text
                  numberOfLines={1}
                  style={[ts({ size: 12, weight: i === step ? 700 : 400, color: i === step ? '#1A1A2E' : '#718096' }), { flex: 1 }]}
                >
                  {title}
                </Text>
              </View>
              <View style={{ height: 6 }} />
              <View style={{ height: 3, backgroundColor: i <= step ? '#1E2126' : '#E2E8F0', borderRadius: 2 }} />
            </View>
          </Tap>
        ))}
      </View>

      {/* ── Page content ── */}
      <View style={{ flex: 1 }}>
        {pages.map((page, i) => (
          // Every step stays mounted (as in the PageView) so typed numbers and
          // scroll positions survive moving between steps.
          <View key={i} style={[StyleSheet.absoluteFill, i !== step && { display: 'none' }]}>{page}</View>
        ))}
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {step > 0 ? (
          <OutlinedButton
            style={{ width: 120, height: 44 }}
            shrinkWrap
            onPress={() => setStep(step - 1)}
            foregroundColor="#4A5568"
            side={{ color: '#DDE3ED' }}
            radius={8}
          >
            Back
          </OutlinedButton>
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {canSaveAsDraft && (
            <>
              <OutlinedButton
                style={{ width: 140, height: 44 }}
                shrinkWrap
                onPress={submitting ? null : () => submit(true)}
                foregroundColor="#1E2126"
                side={{ color: '#ACC2DF' }}
                radius={8}
              >
                Save as Draft
              </OutlinedButton>
              <View style={{ width: 12 }} />
            </>
          )}
          <ElevatedButton
            style={{ width: 160, height: 44 }}
            shrinkWrap
            onPress={submitting ? null : () => (last ? submit() : setStep(step + 1))}
            backgroundColor="#1E2126"
            foregroundColor="#FFFFFF"
            radius={8}
            elevation={0}
          >
            {submitting ? (
              <CircularProgressIndicator size={18} strokeWidth={2} color="#FFFFFF" />
            ) : last ? (
              isEditing ? 'Save Changes' : 'Submit Proposal'
            ) : (
              'Next →'
            )}
          </ElevatedButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FA',
    paddingLeft: 24,
    paddingTop: 20,
    paddingRight: 24,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FA',
    paddingLeft: 24,
    paddingTop: 12,
    paddingRight: 24,
    paddingBottom: 16,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#E1EBF8',
    borderTopWidth: 1,
    borderTopColor: '#ACC2DF',
  },
  tableFrame: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F7F9FC',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
});
