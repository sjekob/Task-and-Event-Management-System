import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { showSnackBar } from '../components/ui/overlay';
import { Json, tryParseDate } from '../models/models';
import { exceptionText } from '../services/apiService';
import { proposalDocument } from './eventPrintTemplate';

// ─────────────────────────────────────────────────────────────────────────────
// DATA SCHEMA BLUEPRINT (JSON)
//
// All dynamic fields that the Create-Event form must supply to populate the
// DepEd proposal layout (matching the SPAWNING proposal structure): title,
// nature ("Curricular" | "Co-curricular" | "Extra-curricular"), target_date,
// venue, proposed_budget, fund_source, focal_name/role/contact,
// expected_outputs, participants ({rows, totals}), rationale, objectives,
// phase1..3, activity_matrix, training_materials, snacks, exec_committee,
// twg_groups, monitoring_criteria, indicators, comments ({signatories}),
// creator_name, created_at.
// ─────────────────────────────────────────────────────────────────────────────

// ── Public API ──────────────────────────────────────────────────────────────

/// Encodes [htmlContent] as a Blob URL and opens it in a new browser tab.
/// The HTML itself triggers `window.print()` on load via an inline script.
///
/// Returns `true` on success, `false` where there is no browser tab to open.
function triggerPrint(htmlContent: string): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revoke blob URL after 5 minutes (enough time for print + save).
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    return true;
  } catch {
    return false;
  }
}

/// Opens the event proposal in a new browser tab and triggers the
/// system print / save-as-PDF dialog.
///
/// On web: opens a new tab with the full HTML layout and calls
/// `window.print()` — the browser's native "Save as PDF" option
/// appears there. Falls back to the system print dialog on native.
export async function printEvent(event: Json): Promise<void> {
  const htmlContent = generateHtml(event);

  // ── Web path: open new tab + trigger browser print dialog ──────────────
  if (triggerPrint(htmlContent)) {
    showSnackBar('Print preview opened — use "Save as PDF" in the print dialog.', { duration: 4000 });
    return;
  }

  // ── Native / fallback path: system print dialog ────────────────────────
  try {
    await Print.printAsync({ html: htmlContent });
  } catch (e) {
    showSnackBar(`Could not open print dialog: ${exceptionText(e)}`, { backgroundColor: '#E53E3E' });
  }
}

// ── HTML Generator ──────────────────────────────────────────────────────────

const DEFAULT_INDICATORS = [
  'The special program has an approved proposal.',
  'The training matrix was observed or was completely delivered.',
  'The number of days were maximized as stated in the training design.',
  'The objectives of the special program were met.',
  'The monitoring and evaluation tools were utilized.',
  'Participants were able to submit the required output.',
  'Attendance was systematically monitored.',
  'The venue was conducive.',
  'The session started and ended on time.',
  'The trainers/facilitators used appropriate resource package ' +
    '(Pretest and post-tests, PowerPoint, video presentation, etc.)',
];

const DEFAULT_MONITORING =
  'In compliance, facilitators and participants will be monitored jointly by the school ' +
  'administration and the District Supervisor. The SGOD/CID staff will be in charge of ' +
  "ensuring that the special program's provisions are followed. The chairman and proponent " +
  'must account for gaps and challenges in order to receive technical support and improve the ' +
  'program. The entire activity shall be evaluated using the observation tool. See attached tool.';

export function generateHtml(event: Json): string {
  const title = esc(event.title ?? 'Untitled Event');
  const nature = (event.nature ?? 'Co-curricular').toString();
  const targetDate = esc(event.target_date ?? '');
  const venue = esc(event.venue ?? '');
  const budget = esc(event.proposed_budget ?? '');
  const fundSrc = esc(event.fund_source ?? '');
  const focalName = esc(event.focal_name ?? '');
  const focalRole = esc(event.focal_role ?? '');
  const focalCp = esc(event.focal_contact ?? '');
  const rationale = (event.rationale ?? '').toString();
  const objectives = (event.objectives ?? '').toString();
  const outputs = (event.expected_outputs ?? '').toString();
  const monitoring = (event.monitoring_criteria ?? '').toString();
  const creatorName = esc(event.creator_name ?? '');

  // Parse proponent-defined observation indicators
  let indicatorLabels: string[] = [];
  try {
    const raw = event.indicators;
    if (raw != null && raw.toString().length > 0) {
      const decoded = JSON.parse(raw.toString());
      if (Array.isArray(decoded)) {
        for (const item of decoded) {
          const label = (item != null && typeof item === 'object' ? item.label ?? '' : item).toString().trim();
          if (label.length > 0) indicatorLabels.push(label);
        }
      }
    }
  } catch {}
  // Fall back to standard DepEd indicators if proponent left them blank
  if (indicatorLabels.length === 0) indicatorLabels = DEFAULT_INDICATORS;
  const obsRows = indicatorLabels
    .map((label, i) => `<tr><td>${i + 1}. ${esc(label)}</td><td></td><td></td><td></td></tr>`)
    .join('\n      ');

  // Date display
  let dateDisplay = '';
  const createdAt = (event.created_at ?? '').toString();
  if (createdAt.length > 0) {
    const dt = tryParseDate(createdAt);
    if (dt != null) dateDisplay = `${month(dt.getMonth() + 1)} ${dt.getDate()}, ${dt.getFullYear()}`;
  }

  // Parse signatories from comments field
  const sigDefaults = [
    { role: 'Noted', name: '________________________________', title: 'School Principal' },
    { role: 'Endorsed', name: '________________________________', title: 'Public Schools District Supervisor' },
    { role: 'Recommending Approval', name: '________________________________', title: 'Assistant Schools Division Superintendent' },
    { role: 'Approved', name: '________________________________', title: 'Schools Division Superintendent' },
  ];
  try {
    const commentsRaw = (event.comments ?? '').toString();
    if (commentsRaw.length > 0) {
      const dec = JSON.parse(commentsRaw);
      if (dec != null && typeof dec === 'object' && Array.isArray(dec.signatories)) {
        const list = dec.signatories as Json[];
        for (let i = 0; i < sigDefaults.length && i < list.length; i++) {
          const n = (list[i].name ?? '').toString().trim();
          const t = (list[i].title ?? '').toString().trim();
          if (n.length > 0) sigDefaults[i].name = n.toUpperCase();
          if (t.length > 0) sigDefaults[i].title = t;
        }
      }
    }
  } catch {}

  return proposalDocument({
    title,
    targetDate,
    venue,
    budget,
    fundSrc,
    focalName,
    focalRole,
    focalCp,
    dateDisplay,
    isCurricular: nature === 'Curricular',
    isCoCurricular: nature === 'Co-curricular',
    isExtraCurricular: nature === 'Extra-curricular',
    fileSafeTitle: (event.title ?? 'EventProposal').toString().replace(/[^a-zA-Z0-9]+/g, '_'),
    proponentName: focalName.length > 0 ? focalName.toUpperCase() : creatorName.toUpperCase(),
    proponentTitle: focalRole.length > 0 ? focalRole : 'Proponent',
    participantsHtml: buildParticipants(event.participants),
    outputsHtml: bulletList(outputs),
    rationaleHtml: paragraphs(rationale),
    objectivesHtml: numberedList(objectives),
    methodologyRows: buildMethodologyRows(event.phase1, event.phase2, event.phase3),
    matrixRows: activityMatrixRows(event.activity_matrix),
    execRows: execRows(event.exec_committee, creatorName, focalName, focalRole),
    twgHtml: twgSection(event.twg_groups),
    budgetHtml: budgetSection(event.training_materials, event.snacks),
    monitoringHtml: paragraphs(monitoring.length > 0 ? monitoring : DEFAULT_MONITORING),
    sigBlocks: sigDefaults.map(
      (s) => `<div class="sig-name">${esc(s.name)}</div><div class="sig-title">${esc(s.title)}</div>`,
    ),
    obsRows,
  });
}

// ── Private HTML Builders ────────────────────────────────────────────────────

function esc(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function month(m: number): string {
  const ms = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return m >= 1 && m <= 12 ? ms[m] : '';
}

/// A field that may arrive as a JSON string or already decoded.
const decode = (raw: unknown): unknown => (typeof raw === 'string' ? JSON.parse(raw) : raw);
const text = (v: unknown): string => v?.toString() ?? '';

function paragraphs(value: string): string {
  if (value.trim().length === 0) return '';
  return value
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, ' ')}</p>`)
    .join('\n');
}

/// Normalizes a list field that may be stored either as a JSON array
/// (e.g. expected_outputs = ["Basta","sample"]) or as newline-separated text.
/// Returns newline-joined items in both cases.
function normalizeListText(value: string): string {
  const t = value.trim();
  if (t.startsWith('[')) {
    try {
      const decoded = JSON.parse(t);
      if (Array.isArray(decoded)) {
        return decoded.map((e) => String(e)).filter((s) => s.trim().length > 0).join('\n');
      }
    } catch {}
  }
  return value;
}

// Strips a leading bullet marker so a user-typed "• x" doesn't double up with
// the auto-numbering/bulleting of the list it's placed in.
const stripBullet = (s: string): string => s.trim().replace(/^[•\-*·●○]\s*/, '');

function listItems(value: string): string | null {
  const norm = normalizeListText(value);
  if (norm.trim().length === 0) return null;
  return norm
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => `<li>${esc(stripBullet(l))}</li>`)
    .join('\n');
}

function bulletList(value: string): string {
  const items = listItems(value);
  return items == null ? '<ul><li>—</li></ul>' : `<ul>${items}</ul>`;
}

function numberedList(value: string): string {
  const items = listItems(value);
  return items == null ? '<ol><li>—</li></ol>' : `<ol>${items}</ol>`;
}

function buildMethodologyRows(phase1Raw: unknown, phase2Raw: unknown, phase3Raw: unknown): string {
  if (phase1Raw != null) {
    try {
      const decoded = JSON.parse(phase1Raw.toString());
      if (Array.isArray(decoded)) {
        return (decoded as Json[])
          .map((m, i) => {
            const activities = esc((m.activities ?? '').toString()).replace(/\n/g, '<br>');
            return (
              '<tr>' +
              `<td class="phase-lbl"><strong>Phase ${i + 1}</strong></td>` +
              `<td>${esc((m.stage ?? '').toString())}</td>` +
              `<td>${activities}</td>` +
              '</tr>'
            );
          })
          .join('');
      }
    } catch {}
  }
  // Legacy fallback: plain-text phase1/phase2/phase3 with fixed stage names
  const p1 = esc((phase1Raw ?? 'Planning\nRecruitment of participants').toString()).replace(/\n/g, '<br>');
  const p2 = esc((phase2Raw ?? 'Training-workshop sessions').toString()).replace(/\n/g, '<br>');
  const p3 = esc((phase3Raw ?? 'Selection of staff\nEvaluation of the activity').toString()).replace(/\n/g, '<br>');
  return (
    `<tr><td class="phase-lbl"><strong>Phase 1</strong></td><td>Pre-Implementation Stage</td><td>${p1}</td></tr>` +
    `<tr><td class="phase-lbl"><strong>Phase 2</strong></td><td>Implementation</td><td>${p2}</td></tr>` +
    `<tr><td class="phase-lbl"><strong>Phase 3</strong></td><td>Post-Implementation</td><td>${p3}</td></tr>`
  );
}

const DEFAULT_PARTICIPANTS =
  '<table class="p-table">' +
  '<thead><tr><th></th><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead>' +
  '<tbody>' +
  '<tr><td class="plabel">Participants</td><td>—</td><td>—</td><td>—</td></tr>' +
  '<tr><td class="plabel ptotal"><strong>TOTAL</strong></td>' +
  '<td class="ptotal">—</td><td class="ptotal">—</td><td class="ptotal">—</td></tr>' +
  '</tbody></table>';

function buildParticipants(raw: unknown): string {
  if (raw == null) return DEFAULT_PARTICIPANTS;
  try {
    const data = decode(raw) as Json;
    const rows = (data.rows as Json[] | null) ?? [];
    const totals = (data.totals as Json | null) ?? {};
    const rowsHtml = rows
      .map(
        (m) =>
          '<tr>' +
          `<td class="plabel">${esc(text(m.category))}</td>` +
          `<td>${m.male ?? '—'}</td>` +
          `<td>${m.female ?? '—'}</td>` +
          `<td>${m.total ?? '—'}</td>` +
          '</tr>',
      )
      .join('');
    const totalRow =
      '<tr>' +
      '<td class="plabel ptotal"><strong>TOTAL</strong></td>' +
      `<td class="ptotal"><strong>${totals.male ?? '—'}</strong></td>` +
      `<td class="ptotal"><strong>${totals.female ?? '—'}</strong></td>` +
      `<td class="ptotal"><strong>${totals.total ?? '—'}</strong></td>` +
      '</tr>';
    return (
      '<table class="p-table">' +
      '<thead><tr><th></th><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead>' +
      `<tbody>${rowsHtml}${totalRow}</tbody>` +
      '</table>'
    );
  } catch {
    return DEFAULT_PARTICIPANTS;
  }
}

const NO_SCHEDULE =
  '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No activity schedule defined.</td></tr>';

function activityMatrixRows(raw: unknown): string {
  if (raw == null) return NO_SCHEDULE;
  try {
    const list = decode(raw) as Json[];
    if (list.length === 0) return NO_SCHEDULE;
    return list
      .map(
        (m) =>
          '<tr>' +
          `<td>${esc(text(m.day))}</td>` +
          `<td>${esc(text(m.time))}</td>` +
          `<td>${esc(text(m.event))}</td>` +
          `<td>${esc(text(m.speaker))}</td>` +
          '</tr>',
      )
      .join('\n');
  } catch {
    return `<tr><td colspan="4">${esc(String(raw))}</td></tr>`;
  }
}

function execRows(raw: unknown, creatorName: string, focalName: string, focalRole: string): string {
  try {
    if (raw != null) {
      const list = decode(raw) as Json[];
      if (list.length > 0) {
        return list.map((m) => `<tr><td>${esc(text(m.name))}</td><td>${esc(text(m.designation))}</td></tr>`).join('');
      }
    }
  } catch {}
  const name = focalName.length > 0 ? focalName.toUpperCase() : creatorName.toUpperCase();
  const role = focalRole.length > 0 ? focalRole : 'Teacher (Proponent)';
  return `<tr><td>${name}</td><td>${role}</td></tr>`;
}

function twgSection(raw: unknown): string {
  if (raw == null) return '';
  try {
    const data = decode(raw) as Record<string, unknown>;
    let out = '';
    for (const [key, value] of Object.entries(data)) {
      const sectionTitle = key
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.substring(1)))
        .join(' ');
      const members = (value as Json[] | null) ?? [];
      if (members.length === 0) continue;
      out += '<div class="cmt-group">';
      out += `<div class="cmt-title">${sectionTitle}</div>`;
      out +=
        '<table class="cmt-table"><thead><tr>' +
        '<th>Name</th><th>Designation</th><th>Terms of Reference</th><th>Output</th>' +
        '</tr></thead><tbody>';
      for (const mm of members) {
        out +=
          '<tr>' +
          `<td>${esc(text(mm.name))}</td>` +
          `<td>${esc(text(mm.designation))}</td>` +
          `<td>${esc(mm.terms?.toString() ?? mm.terms_of_reference?.toString() ?? '')}</td>` +
          `<td>${esc(text(mm.output))}</td>` +
          '</tr>';
      }
      out += '</tbody></table></div>';
    }
    return out;
  } catch {
    return '';
  }
}

const NO_ITEMS = '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No items listed.</td></tr>';

/// The rows of one budget table and the sum of their totals. [middleKey] is
/// the centred column ('qty' for materials, 'pax' for snacks).
function budgetRows(raw: unknown, middleKey: string): { rows: string; total: number } {
  let rows = '';
  let total = 0;
  try {
    if (raw != null) {
      for (const m of decode(raw) as Json[]) {
        const tot = parseFloat(m.total?.toString() ?? '0');
        total += isNaN(tot) ? 0 : tot;
        rows +=
          '<tr>' +
          `<td>${esc(text(m.item))}</td>` +
          `<td style="text-align:center;">${esc(text(m[middleKey]))}</td>` +
          `<td style="text-align:right;">${m.cost ?? ''}</td>` +
          `<td style="text-align:right;">${m.total ?? ''}</td>` +
          '</tr>';
      }
    }
  } catch {}
  return { rows: rows.length === 0 ? NO_ITEMS : rows, total };
}

function budgetSection(materialsRaw: unknown, snacksRaw: unknown): string {
  const materials = budgetRows(materialsRaw, 'qty');
  const snacks = budgetRows(snacksRaw, 'pax');

  const grandTotal = materials.total + snacks.total;
  // The summary total is the sum of the line items — NOT the proposed
  // (estimated) budget, which is a separate figure shown in the brief.
  const totalLabel = grandTotal > 0 ? `P${grandTotal.toFixed(2)}` : '—';
  const trainingLabel = materials.total > 0 ? materials.total.toFixed(2) : '—';
  const snacksLabel = snacks.total > 0 ? snacks.total.toFixed(2) : '—';

  return `
<div class="bgt-sub">a. Training Materials</div>
<table class="bgt-table">
  <thead><tr>
    <th>Particulars</th>
    <th style="width:100px;">Quantity</th>
    <th style="width:80px;">Cost</th>
    <th style="width:90px;">Total</th>
  </tr></thead>
  <tbody>
    ${materials.rows}
    <tr class="sub-row">
      <td colspan="3"><strong>Sub-Total</strong></td>
      <td style="text-align:right;"><strong>${trainingLabel}</strong></td>
    </tr>
  </tbody>
</table>

<div class="bgt-sub" style="margin-top:14px;">b. Snacks for Program Partners</div>
<table class="bgt-table">
  <thead><tr>
    <th>Particulars</th>
    <th style="width:140px;">No. of Participants</th>
    <th style="width:110px;">Cost per day/pax</th>
    <th style="width:90px;">Total</th>
  </tr></thead>
  <tbody>
    ${snacks.rows}
    <tr class="sub-row">
      <td colspan="3"><strong>Sub-Total</strong></td>
      <td style="text-align:right;"><strong>${snacksLabel}</strong></td>
    </tr>
  </tbody>
</table>

<div class="bgt-sub" style="margin-top:14px;">c. Summary of Expenditures</div>
<table class="bgt-table">
  <tbody>
    <tr>
      <td>1. Training Materials</td>
      <td style="text-align:right;">${trainingLabel}</td>
    </tr>
    <tr>
      <td>2. Snacks for Program Partners</td>
      <td style="text-align:right;">${snacksLabel}</td>
    </tr>
    <tr>
      <td style="text-align:right;font-weight:bold;border-top:2px solid #000;"><strong>Total</strong></td>
      <td style="text-align:right;font-weight:bold;border-top:2px solid #000;text-decoration:underline;"><strong>${totalLabel}</strong></td>
    </tr>
  </tbody>
</table>`;
}
