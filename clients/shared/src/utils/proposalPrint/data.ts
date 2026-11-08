import { Json } from '../../models';
import { PrintAssets } from './assets';
import { richFields } from './rich';
import { MONTHS, DEFAULT_INDICATORS, str, _esc, _paragraphs, _bulletList, _numberedList, _buildMethodologyRows, _buildParticipants, _activityMatrixRows, _execRows, _twgSection, _budgetSection } from './sections';

/** The values the document templates fill in. */
export function printData(event: Json, assets: PrintAssets) {
  const title = _esc(event.title ?? 'Untitled Event');
  const nature = str(event.nature ?? 'Co-curricular');
  const targetDate = _esc(event.target_date ?? '');
  const venue = _esc(event.venue ?? '');
  const budget = pesos(event.proposed_budget);
  const fundSrc = _esc(event.fund_source ?? '');
  const focalName = _esc(event.focal_name ?? '');
  const focalRole = _esc(event.focal_role ?? '');
  const focalCp = _esc(event.focal_contact ?? '');
  const rationale = str(event.rationale);
  const objectives = str(event.objectives);
  const outputs = str(event.expected_outputs);
  const monitoring = str(event.monitoring_criteria);
  const creatorName = _esc(event.creator_name ?? '');

  // Proponent-defined observation indicators, else the standard DepEd ones.
  let indicatorLabels: string[] = [];
  try {
    const d = event.indicators ? JSON.parse(str(event.indicators)) : null;
    if (Array.isArray(d)) indicatorLabels = d.map((x: any) => str(x && typeof x === 'object' ? x.label : x).trim()).filter(Boolean);
  } catch { /* none */ }
  if (!indicatorLabels.length) indicatorLabels = DEFAULT_INDICATORS;
  const obsRows = indicatorLabels.map((l, i) => `<tr><td>${i + 1}. ${_esc(l)}</td><td></td><td></td><td></td></tr>`).join('\n      ');

  const isCurricular = nature === 'Curricular';
  const isCoCurricular = nature === 'Co-curricular';
  const isExtraCurricular = nature === 'Extra-curricular';
  const methodologyRows = _buildMethodologyRows(event.phase1, event.phase2, event.phase3);

  let dateDisplay = '';
  const cm = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(event.created_at));
  if (cm) dateDisplay = `${MONTHS[Number(cm[2])]} ${Number(cm[3])}, ${cm[1]}`;

  const proponentName = (focalName || creatorName).toUpperCase();
  const proponentTitle = focalRole || 'Proponent';

  // Signatories from the comments field ({signatories: [...]}).
  const sig = [
    { role: 'Noted', name: '\u00a0', title: 'School Principal' },
    { role: 'Endorsed', name: '\u00a0', title: 'Public Schools District Supervisor' },
    { role: 'Recommending Approval', name: '\u00a0', title: 'Assistant Schools Division Superintendent' },
    { role: 'Approved', name: '\u00a0', title: 'Schools Division Superintendent' },
  ];
  try {
    const dec = event.comments ? JSON.parse(str(event.comments)) : null;
    if (dec && Array.isArray(dec.signatories)) {
      dec.signatories.slice(0, sig.length).forEach((s: Json, i: number) => {
        const n = str(s?.name).trim();
        const t = str(s?.title).trim();
        if (n) sig[i].name = n.toUpperCase();
        if (t) sig[i].title = t;
      });
    }
  } catch { /* legacy free text */ }
  const sigBlock = (i: number) => `<div class="sig-name">${_esc(sig[i].name)}</div><div class="sig-title">${_esc(sig[i].title)}</div>`;

  const fileSafeTitle = str(event.title ?? 'EventProposal').replace(/[^a-zA-Z0-9]+/g, '_');

  return {
    title,
    nature,
    targetDate,
    venue,
    budget,
    fundSrc,
    focalName,
    focalRole,
    focalCp,
    rationale,
    objectives,
    outputs,
    monitoring,
    creatorName,
    obsRows,
    isCurricular,
    isCoCurricular,
    isExtraCurricular,
    methodologyRows,
    dateDisplay,
    proponentName,
    proponentTitle,
    sigBlock,
    fileSafeTitle,
    assets,
    event,
    ...richFields(event),
  };
}

export type PrintData = ReturnType<typeof printData>;

/** "3120" → "₱3,120.00"; non-numeric text is printed as written. */
function pesos(raw: unknown): string {
  const text = str(raw).trim();
  const n = Number(text.replace(/[₱,\s]|^php?/gi, ''));
  if (!text || !Number.isFinite(n)) return _esc(text);
  return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
