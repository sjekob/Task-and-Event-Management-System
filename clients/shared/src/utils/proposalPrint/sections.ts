import { Json } from '../../models';

// HTML builders for each part of the printed proposal.
export const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const DEFAULT_INDICATORS = [
  'The special program has an approved proposal.',
  'The training matrix was observed or was completely delivered.',
  'The number of days were maximized as stated in the training design.',
  'The objectives of the special program were met.',
  'The monitoring and evaluation tools were utilized.',
  'Participants were able to submit the required output.',
  'Attendance was systematically monitored.',
  'The venue was conducive.',
  'The session started and ended on time.',
  'The trainers/facilitators used appropriate resource package (Pretest and post-tests, PowerPoint, video presentation, etc.)',
];

export const DEFAULT_MONITORING =
  'In compliance, facilitators and participants will be monitored jointly by the school administration and the District Supervisor. ' +
  "The SGOD/CID staff will be in charge of ensuring that the special program's provisions are followed. The chairman and proponent " +
  'must account for gaps and challenges in order to receive technical support and improve the program. The entire activity shall ' +
  'be evaluated using the observation tool. See attached tool.';

export const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function _esc(s: unknown): string {
  return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function parseJson(raw: unknown): any {
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/** The Methodology's opening paragraph when the proponent hasn't written their own. */
export const DEFAULT_METHODOLOGY_INTRO = 'The training shall be composed of lectures, video clip viewing, sharing and games. 5E’s approach shall be utilized for most of the sessions. The schedule will be as follows:';

export function _paragraphs(text: string): string {
  if (!text.trim()) return '';
  return text.split(/\n\n+/).filter((p) => p.trim()).map((p) => `<p>${_esc(p.trim()).replace(/\n/g, ' ')}</p>`).join('\n');
}

/** A list field stored as a JSON array or newline-separated text → newline-joined items. */
export function _normalizeListText(text: string): string {
  const t = text.trim();
  if (t.startsWith('[')) {
    try {
      const d = JSON.parse(t);
      if (Array.isArray(d)) return d.map(String).filter((s) => s.trim()).join('\n');
    } catch { /* plain text */ }
  }
  return text;
}

export function _stripBullet(s: string): string {
  return s.trim().replace(/^[•\-*·●○]\s*/, '');
}

export function _list(tag: 'ul' | 'ol', text: string): string {
  const norm = _normalizeListText(text);
  if (!norm.trim()) return `<${tag}><li>—</li></${tag}>`;
  return `<${tag}>${norm.split('\n').filter((l) => l.trim()).map((l) => `<li>${_esc(_stripBullet(l))}</li>`).join('\n')}</${tag}>`;
}

export const _bulletList = (t: string) => _list('ul', t);
export const _numberedList = (t: string) => _list('ol', t);

export function _buildMethodologyRows(phase1: unknown, phase2: unknown, phase3: unknown): string {
  if (phase1 !== null && phase1 !== undefined) {
    try {
      const d = JSON.parse(str(phase1));
      if (Array.isArray(d)) {
        return d.map((m: Json, i: number) =>
          `<tr><td class="phase-lbl"><strong>Phase ${i + 1}</strong></td><td>${_esc(m.stage)}</td><td>${_esc(m.activities).replace(/\n/g, '<br>')}</td></tr>`,
        ).join('');
      }
    } catch { /* legacy plain text */ }
  }
  const p1 = _esc(phase1 ?? 'Planning\nRecruitment of participants').replace(/\n/g, '<br>');
  const p2 = _esc(phase2 ?? 'Training-workshop sessions').replace(/\n/g, '<br>');
  const p3 = _esc(phase3 ?? 'Selection of staff\nEvaluation of the activity').replace(/\n/g, '<br>');
  return `<tr><td class="phase-lbl"><strong>Phase 1</strong></td><td>Pre-Implementation Stage</td><td>${p1}</td></tr>` +
    `<tr><td class="phase-lbl"><strong>Phase 2</strong></td><td>Implementation</td><td>${p2}</td></tr>` +
    `<tr><td class="phase-lbl"><strong>Phase 3</strong></td><td>Post-Implementation</td><td>${p3}</td></tr>`;
}

export const DEFAULT_PARTICIPANTS =
  '<table class="p-table"><thead><tr><th></th><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead><tbody>' +
  '<tr><td class="plabel">Participants</td><td>—</td><td>—</td><td>—</td></tr>' +
  '<tr><td class="plabel ptotal"><strong>TOTAL</strong></td><td class="ptotal">—</td><td class="ptotal">—</td><td class="ptotal">—</td></tr>' +
  '</tbody></table>';

export function _buildParticipants(raw: unknown): string {
  if (raw === null || raw === undefined) return DEFAULT_PARTICIPANTS;
  try {
    const data = parseJson(raw) as Json;
    const rows: Json[] = data.rows ?? [];
    const t: Json = data.totals ?? {};
    const rowsHtml = rows.map((m) => `<tr><td class="plabel">${_esc(m.category)}</td><td>${m.male ?? '—'}</td><td>${m.female ?? '—'}</td><td>${m.total ?? '—'}</td></tr>`).join('');
    const totalRow = `<tr><td class="plabel ptotal"><strong>TOTAL</strong></td><td class="ptotal"><strong>${t.male ?? '—'}</strong></td><td class="ptotal"><strong>${t.female ?? '—'}</strong></td><td class="ptotal"><strong>${t.total ?? '—'}</strong></td></tr>`;
    return `<table class="p-table"><thead><tr><th></th><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead><tbody>${rowsHtml}${totalRow}</tbody></table>`;
  } catch {
    return DEFAULT_PARTICIPANTS;
  }
}

export const NO_SCHEDULE = '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No activity schedule defined.</td></tr>';

export function _activityMatrixRows(raw: unknown): string {
  if (raw === null || raw === undefined) return NO_SCHEDULE;
  try {
    const list = parseJson(raw) as Json[];
    if (!list.length) return NO_SCHEDULE;
    return list.map((m) => `<tr><td>${_esc(m.day)}</td><td>${_esc(m.time)}</td><td>${_esc(m.event)}</td><td>${_esc(m.speaker)}</td></tr>`).join('\n');
  } catch {
    return `<tr><td colspan="4">${_esc(raw)}</td></tr>`;
  }
}

export function _execRows(raw: unknown, creatorName: string, focalName: string, focalRole: string): string {
  try {
    if (raw !== null && raw !== undefined) {
      const list = parseJson(raw) as Json[];
      if (list.length) return list.map((m) => `<tr><td>${_esc(m.name)}</td><td>${_esc(m.designation ?? m.position)}</td></tr>`).join('');
    }
  } catch { /* fall through */ }
  const name = (focalName || creatorName).toUpperCase();
  return `<tr><td>${name}</td><td>${focalRole || 'Teacher (Proponent)'}</td></tr>`;
}

export function _twgSection(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  try {
    const data = parseJson(raw);
    // Stored either as {section_key: [members]} or [{title, members}].
    const groups: [string, Json[]][] = Array.isArray(data)
      ? data.map((g: Json) => [str(g.title), (g.members ?? []) as Json[]] as [string, Json[]])
      : Object.entries(data as Json).map(([k, v]) => [
        k.replace(/_/g, ' ').split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' '),
        (v ?? []) as Json[],
      ] as [string, Json[]]);
    let out = '';
    for (const [title, members] of groups) {
      if (!members.length) continue;
      out += `<div class="cmt-group"><div class="cmt-title">${_esc(title)}</div><table class="cmt-table"><thead><tr><th>Name</th><th>Designation</th><th>Terms of Reference</th><th>Output</th></tr></thead><tbody>`;
      for (const m of members) {
        out += `<tr><td>${_esc(m.name)}</td><td>${_esc(m.designation)}</td><td>${_esc(m.terms ?? m.terms_of_reference ?? m.tor)}</td><td>${_esc(m.output)}</td></tr>`;
      }
      out += '</tbody></table></div>';
    }
    return out;
  } catch {
    return '';
  }
}

export function _budgetSection(materialsRaw: unknown, snacksRaw: unknown, _budgetDisplay: string): string {
  let trainingTotal = 0;
  let snacksTotal = 0;
  let materialsRows = '';
  let snacksRows = '';
  try {
    if (materialsRaw !== null && materialsRaw !== undefined) {
      for (const m of parseJson(materialsRaw) as Json[]) {
        trainingTotal += Number(m.total ?? 0) || 0;
        materialsRows += `<tr><td>${_esc(m.item)}</td><td style="text-align:center;">${_esc(m.qty)}</td><td style="text-align:right;">${m.cost ?? ''}</td><td style="text-align:right;">${m.total ?? ''}</td></tr>`;
      }
    }
  } catch { /* none */ }
  try {
    if (snacksRaw !== null && snacksRaw !== undefined) {
      for (const m of parseJson(snacksRaw) as Json[]) {
        snacksTotal += Number(m.total ?? 0) || 0;
        snacksRows += `<tr><td>${_esc(m.item)}</td><td style="text-align:center;">${_esc(m.pax)}</td><td style="text-align:right;">${m.cost ?? ''}</td><td style="text-align:right;">${m.total ?? ''}</td></tr>`;
      }
    }
  } catch { /* none */ }
  const none = '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No items listed.</td></tr>';
  materialsRows ||= none;
  snacksRows ||= none;
  const grand = trainingTotal + snacksTotal;
  // The summary total is the sum of the line items, not the proposed (estimated) budget.
  const totalLabel = grand > 0 ? `P${grand.toFixed(2)}` : '—';
  const trainingLabel = trainingTotal > 0 ? trainingTotal.toFixed(2) : '—';
  const snacksLabel = snacksTotal > 0 ? snacksTotal.toFixed(2) : '—';
  return `
<div class="bgt-sub">a. Training Materials</div>
<table class="bgt-table">
  <thead><tr><th>Particulars</th><th style="width:100px;">Quantity</th><th style="width:80px;">Cost</th><th style="width:90px;">Total</th></tr></thead>
  <tbody>
    ${materialsRows}
    <tr class="sub-row"><td colspan="3"><strong>Sub-Total</strong></td><td style="text-align:right;"><strong>${trainingLabel}</strong></td></tr>
  </tbody>
</table>
<div class="bgt-sub" style="margin-top:14px;">b. Snacks for Program Partners</div>
<table class="bgt-table">
  <thead><tr><th>Particulars</th><th style="width:140px;">No. of Participants</th><th style="width:110px;">Cost per day/pax</th><th style="width:90px;">Total</th></tr></thead>
  <tbody>
    ${snacksRows}
    <tr class="sub-row"><td colspan="3"><strong>Sub-Total</strong></td><td style="text-align:right;"><strong>${snacksLabel}</strong></td></tr>
  </tbody>
</table>
<div class="bgt-sub" style="margin-top:14px;">c. Summary of Expenditures</div>
<table class="bgt-table">
  <tbody>
    <tr><td>1. Training Materials</td><td style="text-align:right;">${trainingLabel}</td></tr>
    <tr><td>2. Snacks for Program Partners</td><td style="text-align:right;">${snacksLabel}</td></tr>
    <tr>
      <td style="text-align:right;font-weight:bold;border-top:2px solid #000;"><strong>Total</strong></td>
      <td style="text-align:right;font-weight:bold;border-top:2px solid #000;text-decoration:underline;"><strong>${totalLabel}</strong></td>
    </tr>
  </tbody>
</table>`;
}

/** The full printable proposal document. */
