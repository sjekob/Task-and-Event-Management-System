// DepEd-format event proposal (A4) as a standalone HTML document. The web app
// opens it in a print window; the mobile app hands it to expo-print.
import type { EventRecord } from '../types';
import { MONTHS_LONG, parseTimestamp } from '../utils/dates';
import { parseParticipants } from '../utils/eventFormat';

export interface ProposalImages {
  /** school seal (footer) */
  logo: string;
  /** Kagawaran ng Edukasyon seal (header) */
  kagawaran: string;
  depedMatatag: string;
  bagongPilipinas: string;
}

export interface ProposalHtmlOptions {
  images: ProposalImages;
  /** On-screen Print / Download bar plus scripts (web print window only). */
  withToolbar?: boolean;
}

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function json<T>(raw: unknown): T | null {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const stripBullet = (s: string) => s.trim().replace(/^[•\-*·●○]\s*/, '');

/** A list field stored as a JSON array or newline text → items. */
function listText(text: string): string[] {
  const t = text.trim();
  if (t.startsWith('[')) {
    const decoded = json<unknown[]>(t);
    if (Array.isArray(decoded)) return decoded.map(String).filter((s) => s.trim());
  }
  return text.split('\n').filter((l) => l.trim());
}

const list = (tag: 'ul' | 'ol', text: string) => {
  const items = listText(text);
  return items.length ? `<${tag}>${items.map((l) => `<li>${esc(stripBullet(l))}</li>`).join('\n')}</${tag}>` : `<${tag}><li>—</li></${tag}>`;
};

const paragraphs = (text: string) => text.trim()
  ? text.split(/\n\n+/).filter((p) => p.trim()).map((p) => `<p>${esc(p.trim()).replace(/\n/g, ' ')}</p>`).join('\n')
  : '';

type Row = Record<string, unknown>;

function methodologyRows(p1: unknown, p2: unknown, p3: unknown): string {
  const decoded = json<Row[]>(p1);
  if (Array.isArray(decoded)) {
    return decoded.map((m, i) => `<tr><td class="phase-lbl"><strong>Phase ${i + 1}</strong></td>`
      + `<td>${esc(m.stage)}</td><td>${esc(m.activities).replace(/\n/g, '<br>')}</td></tr>`).join('');
  }
  // Legacy plain-text phases with fixed stage names.
  const br = (v: unknown, d: string) => esc(v ?? d).replace(/\n/g, '<br>');
  return `<tr><td class="phase-lbl"><strong>Phase 1</strong></td><td>Pre-Implementation Stage</td><td>${br(p1, 'Planning\nRecruitment of participants')}</td></tr>`
    + `<tr><td class="phase-lbl"><strong>Phase 2</strong></td><td>Implementation</td><td>${br(p2, 'Training-workshop sessions')}</td></tr>`
    + `<tr><td class="phase-lbl"><strong>Phase 3</strong></td><td>Post-Implementation</td><td>${br(p3, 'Selection of staff\nEvaluation of the activity')}</td></tr>`;
}

function participants(raw: unknown): string {
  const head = '<table class="p-table"><thead><tr><th></th><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead><tbody>';
  const data = parseParticipants(raw) as { rows: Row[]; totals?: Row } | null;
  if (!data) {
    return `${head}<tr><td class="plabel">Participants</td><td>—</td><td>—</td><td>—</td></tr>`
      + '<tr><td class="plabel ptotal"><strong>TOTAL</strong></td><td class="ptotal">—</td><td class="ptotal">—</td><td class="ptotal">—</td></tr></tbody></table>';
  }
  const t = data.totals ?? {};
  return head + data.rows.map((m) => `<tr><td class="plabel">${esc(m.category)}</td><td>${esc(m.male ?? '—')}</td>`
    + `<td>${esc(m.female ?? '—')}</td><td>${esc(m.total ?? '—')}</td></tr>`).join('')
    + `<tr><td class="plabel ptotal"><strong>TOTAL</strong></td><td class="ptotal"><strong>${esc(t.male ?? '—')}</strong></td>`
    + `<td class="ptotal"><strong>${esc(t.female ?? '—')}</strong></td><td class="ptotal"><strong>${esc(t.total ?? '—')}</strong></td></tr></tbody></table>`;
}

function matrixRows(raw: unknown): string {
  const empty = '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No activity schedule defined.</td></tr>';
  const rows = json<Row[]>(raw);
  if (raw == null || raw === '') return empty;
  if (!Array.isArray(rows)) return `<tr><td colspan="4">${esc(raw)}</td></tr>`;
  return rows.length ? rows.map((m) => `<tr><td>${esc(m.day)}</td><td>${esc(m.time)}</td><td>${esc(m.event)}</td><td>${esc(m.speaker)}</td></tr>`).join('\n') : empty;
}

function execRows(raw: unknown, creator: string, focalName: string, focalRole: string): string {
  const rows = json<Row[]>(raw);
  if (Array.isArray(rows) && rows.length) {
    return rows.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.designation ?? m.position)}</td></tr>`).join('');
  }
  return `<tr><td>${esc((focalName || creator).toUpperCase())}</td><td>${esc(focalRole || 'Teacher (Proponent)')}</td></tr>`;
}

/** TWG groups: either {section: members[]} or [{title, members}]. */
function twgSection(raw: unknown): string {
  const data = json<unknown>(raw);
  let groups: [string, Row[]][] = [];
  if (Array.isArray(data)) {
    groups = (data as Row[]).map((g) => [String(g.title ?? ''), (g.members as Row[]) ?? []]);
  } else if (data && typeof data === 'object') {
    groups = Object.entries(data as Record<string, Row[]>).map(([k, v]) => [
      k.replace(/_/g, ' ').split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' '), v ?? []]);
  }
  return groups.filter(([, members]) => members.length).map(([title, members]) => '<div class="cmt-group">'
    + `<div class="cmt-title">${esc(title)}</div><table class="cmt-table"><thead><tr>`
    + '<th>Name</th><th>Designation</th><th>Terms of Reference</th><th>Output</th></tr></thead><tbody>'
    + members.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.designation)}</td>`
      + `<td>${esc(m.terms ?? m.terms_of_reference)}</td><td>${esc(m.output)}</td></tr>`).join('')
    + '</tbody></table></div>').join('');
}

function budgetSection(materialsRaw: unknown, snacksRaw: unknown): string {
  let trainingTotal = 0;
  let snacksTotal = 0;
  const none = '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No items listed.</td></tr>';
  const materials = (json<Row[]>(materialsRaw) ?? []).map((m) => {
    trainingTotal += Number(m.total) || 0;
    return `<tr><td>${esc(m.item)}</td><td style="text-align:center;">${esc(m.qty)}</td>`
      + `<td style="text-align:right;">${esc(m.cost)}</td><td style="text-align:right;">${esc(m.total)}</td></tr>`;
  }).join('');
  const snacks = (json<Row[]>(snacksRaw) ?? []).map((m) => {
    snacksTotal += Number(m.total) || 0;
    return `<tr><td>${esc(m.item)}</td><td style="text-align:center;">${esc(m.pax)}</td>`
      + `<td style="text-align:right;">${esc(m.cost)}</td><td style="text-align:right;">${esc(m.total)}</td></tr>`;
  }).join('');
  // The summary total is the sum of the line items — not the estimated
  // proposed budget shown in the brief.
  const grand = trainingTotal + snacksTotal;
  const fmt = (n: number) => (n > 0 ? n.toFixed(2) : '—');
  return `
<div class="bgt-sub">a. Training Materials</div>
<table class="bgt-table"><thead><tr><th>Particulars</th><th style="width:100px;">Quantity</th><th style="width:80px;">Cost</th><th style="width:90px;">Total</th></tr></thead>
<tbody>${materials || none}<tr class="sub-row"><td colspan="3"><strong>Sub-Total</strong></td><td style="text-align:right;"><strong>${fmt(trainingTotal)}</strong></td></tr></tbody></table>
<div class="bgt-sub" style="margin-top:14px;">b. Snacks for Program Partners</div>
<table class="bgt-table"><thead><tr><th>Particulars</th><th style="width:140px;">No. of Participants</th><th style="width:110px;">Cost per day/pax</th><th style="width:90px;">Total</th></tr></thead>
<tbody>${snacks || none}<tr class="sub-row"><td colspan="3"><strong>Sub-Total</strong></td><td style="text-align:right;"><strong>${fmt(snacksTotal)}</strong></td></tr></tbody></table>
<div class="bgt-sub" style="margin-top:14px;">c. Summary of Expenditures</div>
<table class="bgt-table"><tbody>
<tr><td>1. Training Materials</td><td style="text-align:right;">${fmt(trainingTotal)}</td></tr>
<tr><td>2. Snacks for Program Partners</td><td style="text-align:right;">${fmt(snacksTotal)}</td></tr>
<tr><td style="text-align:right;font-weight:bold;border-top:2px solid #000;"><strong>Total</strong></td>
<td style="text-align:right;font-weight:bold;border-top:2px solid #000;text-decoration:underline;"><strong>${grand > 0 ? `P${grand.toFixed(2)}` : '—'}</strong></td></tr>
</tbody></table>`;
}

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
  'The trainers/facilitators used appropriate resource package (Pretest and post-tests, PowerPoint, video presentation, etc.)',
];

const DEFAULT_MONITORING = 'In compliance, facilitators and participants will be monitored jointly by the school '
  + 'administration and the District Supervisor. The SGOD/CID staff will be in charge of ensuring that the special '
  + "program's provisions are followed. The chairman and proponent must account for gaps and challenges in order to "
  + 'receive technical support and improve the program. The entire activity shall be evaluated using the observation tool. See attached tool.';

export function proposalFileName(event: Pick<EventRecord, 'title'>) {
  return `${(event.title || 'EventProposal').replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
}

export function generateProposalHtml(event: EventRecord, { images, withToolbar = false }: ProposalHtmlOptions): string {
  const title = esc(event.title || 'Untitled Event');
  const nature = event.nature || 'Co-curricular';
  const targetDate = esc(event.target_date);
  const venue = esc(event.venue);
  const budget = esc(event.proposed_budget);
  const fundSrc = esc(event.fund_source);
  const focalName = esc(event.focal_name);
  const focalRole = esc(event.focal_role);
  const focalCp = esc(event.focal_contact);
  const creatorName = esc(event.creator_name);

  // Proponent-defined observation indicators, else the standard DepEd ones.
  let indicators = (json<unknown[]>(event.indicators) ?? [])
    .map((i) => String(i && typeof i === 'object' ? (i as Row).label ?? '' : i).trim()).filter(Boolean);
  if (!indicators.length) indicators = DEFAULT_INDICATORS;
  const obsRows = indicators.map((l, i) => `<tr><td>${i + 1}. ${esc(l)}</td><td></td><td></td><td></td></tr>`).join('\n      ');

  const created = parseTimestamp(event.created_at);
  const dateDisplay = created ? `${MONTHS_LONG[created.getMonth()]} ${created.getDate()}, ${created.getFullYear()}` : '';

  const proponentName = (focalName || creatorName).toUpperCase();
  const proponentTitle = focalRole || 'Proponent';

  const sigs = [
    { name: '________________________________', title: 'School Principal' },
    { name: '________________________________', title: 'Public Schools District Supervisor' },
    { name: '________________________________', title: 'Assistant Schools Division Superintendent' },
    { name: '________________________________', title: 'Schools Division Superintendent' },
  ];
  const sigData = json<{ signatories?: Row[] }>(event.comments);
  if (sigData && !Array.isArray(sigData) && Array.isArray(sigData.signatories)) {
    sigData.signatories.slice(0, sigs.length).forEach((s, i) => {
      const n = String(s.name ?? '').trim();
      const t = String(s.title ?? '').trim();
      if (n) sigs[i].name = n.toUpperCase();
      if (t) sigs[i].title = t;
    });
  }
  const sig = (i: number) => `<div class="sig-name">${esc(sigs[i].name)}</div><div class="sig-title">${esc(sigs[i].title)}</div>`;
  const cb = (on: boolean, label: string) => `<span class="cb"><span class="cb-box">${on ? '&#10003;' : '&nbsp;'}</span>${label}</span>`;

  const header = `<div class="doc-header">
  <img src="${images.kagawaran}" class="seal" alt="Kagawaran ng Edukasyon Seal">
  <div class="rep">Republika ng Pilipinas</div>
  <div class="dept">Kagawaran ng Edukasyon</div>
  <div class="sub-hd">REHIYON V--BICOL<br>TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA<br>NAGA CENTRAL SCHOOL II<br>JACOB ST., PE&Ntilde;AFRANCIA, NAGA CITY</div>
</div>`;

  const toolbar = withToolbar ? `<div class="print-bar no-print">
  <span style="margin-right:8px;">Event Proposal — ${title}</span>
  <button class="print-btn" onclick="window.print()">&#128438;&nbsp;Print</button>
  <button class="download-btn" onclick="downloadDoc()">&#11015;&nbsp;Download</button>
</div>` : '';

  const scripts = withToolbar ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
(function () {
  var PAGE_CONTENT_H = 1024;
  function updateTotal() {
    var total = Math.max(1, Math.ceil(document.body.scrollHeight / PAGE_CONTENT_H));
    document.querySelectorAll('.pg-total').forEach(function (el) { el.textContent = total; });
  }
  document.addEventListener('DOMContentLoaded', updateTotal);
  window.addEventListener('resize', updateTotal);
  window.onbeforeprint = updateTotal;
  window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 700); });
})();
var DOC_FILENAME = ${JSON.stringify(proposalFileName(event))};
var LOGO = ${JSON.stringify(images.logo)}, MATATAG = ${JSON.stringify(images.depedMatatag)}, BAGONG = ${JSON.stringify(images.bagongPilipinas)};
function downloadDoc() {
  if (typeof html2pdf === 'undefined') {
    alert('PDF generator could not be loaded (check your internet connection). Opening the print dialog instead \\u2014 choose "Save as PDF".');
    window.print();
    return;
  }
  var btn = document.querySelector('.download-btn'), bar = document.querySelector('.print-bar'), footer = document.querySelector('.page-footer');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Generating PDF\\u2026'; }
  document.body.classList.add('generating-pdf');
  if (bar) bar.style.display = 'none';
  if (footer) footer.style.display = 'none';
  function restore() {
    document.body.classList.remove('generating-pdf');
    if (bar) bar.style.display = '';
    if (footer) footer.style.display = '';
    if (btn) { btn.disabled = false; btn.innerHTML = '&#11015;&nbsp;Download'; }
  }
  var opt = { margin: 0, filename: DOC_FILENAME, image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] } };
  html2pdf().set(opt).from(document.body).toPdf().get('pdf').then(function (pdf) {
    var n = pdf.internal.getNumberOfPages(), w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight();
    var mL = 16, mR = 14, lineY = h - 22, textY = h - 8;
    for (var i = 1; i <= n; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(68, 68, 68); pdf.setLineWidth(0.3); pdf.line(mL, lineY, w - mR, lineY);
      pdf.addImage(MATATAG, 'PNG', mL, lineY + 1.5, 9.4, 9);
      pdf.addImage(LOGO, 'PNG', mL + 10.4, lineY + 1.5, 9.1, 9);
      pdf.addImage(BAGONG, 'PNG', mL + 20.5, lineY + 1.5, 9.5, 9);
      pdf.setTextColor(0, 0, 0); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
      pdf.text('Telephone No.: (054) 881-3938     Email Address: 114501@deped.gov.ph', w / 2, textY, { align: 'center' });
      pdf.text('Page ' + i + ' of ' + n, w - mR, textY, { align: 'right' });
    }
  }).save().then(restore).catch(function (err) { restore(); alert('Could not generate PDF: ' + err); });
}
</script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Event Proposal – ${title}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
p, li { page-break-inside: avoid; break-inside: avoid; }
@page { size: A4 portrait; margin: 10mm 14mm 16mm 16mm; }
body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; background: #fff; line-height: 1.35; }
.page-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 14mm; display: flex; align-items: center; justify-content: space-between;
  border-top: 1.5px solid #444; padding: 2mm 14mm 0 16mm; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; }
.pf-center { text-align: center; }
.pf-right { text-align: right; white-space: nowrap; }
.print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1a56db; color: #fff; padding: 8px 16px; display: flex; align-items: center;
  justify-content: center; gap: 14px; z-index: 9999; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
.print-btn { background: #fff; color: #1a56db; border: none; padding: 6px 20px; border-radius: 4px; font-size: 10pt; font-weight: bold; cursor: pointer; }
.print-btn:hover { background: #dbeafe; }
.download-btn { background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.8); padding: 4px 18px; border-radius: 4px; font-size: 10pt; font-weight: bold; cursor: pointer; }
.download-btn:hover { background: rgba(255,255,255,0.15); }
.doc-header { text-align: center; padding-bottom: 7px; border-bottom: 2px solid #000; margin-bottom: 10px; }
.doc-header .seal { height: 56px; margin-bottom: 3px; }
.doc-header .rep { font-family: 'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif; font-size: 12pt; letter-spacing: 1px; }
.doc-header .dept { font-family: 'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif; font-size: 17pt; font-weight: bold; letter-spacing: 0.5px; }
.doc-header .sub-hd { font-family: Arial,Helvetica,sans-serif; font-size: 7.5pt; font-weight: bold; letter-spacing: 0.5px; line-height: 1.6; }
.date-line { text-align: right; margin-bottom: 10px; }
.section { margin-bottom: 12px; }
.section-title { font-weight: bold; font-size: 10pt; margin-bottom: 6px; text-transform: uppercase; }
.sub-title { font-weight: bold; font-size: 10pt; margin: 8px 0 4px 12px; text-transform: uppercase; }
.avoid-break { page-break-inside: avoid; break-inside: avoid; }
.brief-table { width: 100%; border-collapse: collapse; }
.brief-table td { padding: 2px 5px; vertical-align: top; font-size: 10pt; }
.lbl { font-weight: bold; white-space: nowrap; width: 175px; }
.colon { width: 12px; text-align: center; }
.cb { display: inline-flex; align-items: center; gap: 3px; margin-right: 12px; font-size: 10pt; }
.cb-box { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #000; text-align: center; line-height: 10px; font-size: 9pt; }
.p-table { border-collapse: collapse; margin: 4px 0; }
.p-table th, .p-table td { border: 1px solid #000; padding: 2px 9px; text-align: center; font-size: 10pt; }
.p-table th { font-weight: bold; }
.plabel { text-align: left; min-width: 140px; }
.ptotal { font-weight: bold; }
ol, ul { margin-left: 24px; margin-top: 3px; }
li { margin-bottom: 3px; text-align: justify; font-size: 10pt; }
p { text-align: justify; text-indent: 24px; margin-bottom: 7px; font-size: 10pt; }
.phase-table { width: 88%; border-collapse: collapse; margin: 6px 0 6px 8px; }
.phase-table td { border: 1px solid #000; padding: 4px 8px; vertical-align: top; font-size: 10pt; }
.phase-lbl { font-weight: bold; white-space: nowrap; width: 72px; }
.matrix-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
.matrix-table th { border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; background: #f2f2f2; font-size: 10pt; }
.matrix-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; font-size: 10pt; }
.matrix-table tr { page-break-inside: avoid; }
.cmt-group { margin-bottom: 10px; page-break-inside: avoid; }
.cmt-title { text-align: center; font-weight: bold; padding: 4px; border: 1px solid #000; background: #f5f5f5; font-size: 10pt; }
.cmt-table { width: 100%; border-collapse: collapse; }
.cmt-table th, .cmt-table td { border: 1px solid #000; padding: 3px 6px; font-size: 10pt; vertical-align: top; }
.cmt-table th { text-align: center; font-weight: bold; }
.bgt-sub { font-weight: bold; margin: 8px 0 4px; font-size: 10pt; }
.bgt-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
.bgt-table th { border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; background: #f2f2f2; font-size: 10pt; }
.bgt-table td { border: 1px solid #000; padding: 3px 6px; font-size: 10pt; }
.sub-row td { text-align: right; font-weight: bold; background: #f9f9f9; border-top: 1.5px solid #000; }
.sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 12px; }
.sig-lbl { font-size: 10pt; margin-bottom: 20px; }
.sig-line { border-top: 1px solid #000; padding-top: 2px; }
.sig-name { font-weight: bold; font-size: 10pt; }
.sig-title { font-size: 9.5pt; }
.sig-ctr { text-align: center; margin-top: 10px; }
.obs-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
.obs-table th { border: 1px solid #000; padding: 3px 5px; font-weight: bold; text-align: center; font-size: 9.5pt; }
.obs-table td { border: 1px solid #000; padding: 3px 5px; font-size: 9.5pt; }
.obs-page { page-break-inside: avoid; break-inside: avoid; }
.pg-break { page-break-before: always; }
.pg-spacer { height: 10mm; }
${withToolbar ? '@media screen { body { max-width: 210mm; margin: 46px auto 10mm; padding: 10mm 14mm 25mm 16mm; box-shadow: 0 0 15px rgba(0,0,0,0.15); min-height: 297mm; } }' : ''}
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
body.generating-pdf { box-shadow: none !important; margin: 0 !important; max-width: none !important; min-height: 0 !important; padding: 10mm 14mm 22mm 16mm !important; }
</style>
${scripts}
</head>
<body>
${toolbar}
<div class="page-footer">
  <div style="display:flex;align-items:center;gap:5px;">
    <img src="${images.depedMatatag}" style="height:28px;" alt="DepEd MATATAG">
    <img src="${images.logo}" style="height:28px;" alt="NCS II Seal">
    <img src="${images.bagongPilipinas}" style="height:28px;" alt="Bagong Pilipinas">
  </div>
  <div class="pf-center">Telephone No.: (054) 881-3938&nbsp;&nbsp;&nbsp;Email Address: 114501@deped.gov.ph</div>
  <div class="pf-right">${withToolbar ? 'Page&nbsp;1&nbsp;of&nbsp;<span class="pg-total">…</span>' : ''}</div>
</div>

${header}
<div class="date-line">${dateDisplay || '&nbsp;'}</div>

<div class="section avoid-break">
  <div class="section-title">I.&nbsp;&nbsp;Proposal Brief</div>
  <table class="brief-table">
    <tr><td class="lbl">a. Title</td><td class="colon">:</td><td><strong>${title}</strong></td></tr>
    <tr><td class="lbl">b. Nature of Activity</td><td class="colon">:</td><td>${cb(nature === 'Curricular', 'Curricular')}${cb(nature === 'Co-curricular', 'Co-curricular')}${cb(nature === 'Extra-curricular', 'Extra-curricular')}</td></tr>
    <tr><td class="lbl">c. Target Date</td><td class="colon">:</td><td>${targetDate}</td></tr>
    <tr><td class="lbl">d. Proposed Venue</td><td class="colon">:</td><td>${venue}</td></tr>
    <tr><td class="lbl">e. Target Participants</td><td class="colon">:</td><td>${participants(event.participants)}</td></tr>
    <tr><td class="lbl">f. Expected Outputs</td><td class="colon">:</td><td>${list('ul', event.expected_outputs ?? '')}</td></tr>
    <tr><td class="lbl">g. Proposed Budget</td><td class="colon">:</td><td><strong>${budget}</strong></td></tr>
    <tr><td class="lbl">h. Source of Fund</td><td class="colon">:</td><td>${fundSrc}</td></tr>
    <tr><td class="lbl">i. Focal Person</td><td class="colon">:</td><td>${focalName}<br><em>${focalRole}</em>${focalCp ? `<br>CP# ${focalCp}` : ''}</td></tr>
  </table>
</div>

<div class="section"><div class="section-title">II.&nbsp;&nbsp;Rationale</div>${paragraphs(event.rationale ?? '')}</div>

<div class="section avoid-break">
  <div class="section-title">III.&nbsp;&nbsp;Objectives</div>
  <p>This project aims to:</p>
  ${list('ol', event.objectives ?? '')}
</div>

<div class="section">
  <div class="section-title">IV.&nbsp;&nbsp;Methodology</div>
  <p>The training shall be composed of lectures, video clip viewing, sharing and games. 5E&#x2019;s approach shall be utilized for most of the sessions. The schedule will be as follows:</p>
  <table class="phase-table">${methodologyRows(event.phase1, event.phase2, event.phase3)}</table>
</div>

<div class="section">
  <div class="section-title">V.&nbsp;&nbsp;Activity Matrix</div>
  <table class="matrix-table">
    <thead><tr><th style="width:115px;">Day</th><th style="width:110px;">Time</th><th>Event</th><th>Speaker</th></tr></thead>
    <tbody>${matrixRows(event.activity_matrix)}</tbody>
  </table>
</div>

<div class="section pg-break">
  <div class="pg-spacer"></div>
  <div class="section-title">VI.&nbsp;&nbsp;Working Committee</div>
  <div class="sub-title">a. Executive Committee</div>
  <table class="cmt-table" style="margin-bottom:14px;"><tbody>${execRows(event.exec_committee, creatorName, focalName, focalRole)}</tbody></table>
  <div class="sub-title">b. Technical Working Group</div>
  ${twgSection(event.twg_groups)}
</div>

<div class="section">
  <div class="section-title">VII.&nbsp;&nbsp;Proposed Budget</div>
  <p>The budget for this training shall be charged against ${fundSrc || 'School Fund'} subject to the usual accounting and auditing rules and regulations. This program adheres to the <strong>NO COLLECTION POLICY</strong> of DepEd.</p>
  ${budgetSection(event.training_materials, event.snacks)}
</div>

<div class="section">
  <div class="section-title">VIII.&nbsp;&nbsp;Monitoring and Evaluation</div>
  ${paragraphs(event.monitoring_criteria?.trim() ? event.monitoring_criteria : DEFAULT_MONITORING)}
</div>

<div class="section avoid-break" style="margin-top:22px;">
  <div class="sig-grid">
    <div><div class="sig-lbl">Proponent:</div><div class="sig-line"><div class="sig-name">${proponentName}</div><div class="sig-title">${proponentTitle}</div></div></div>
    <div><div class="sig-lbl">Noted:</div><div class="sig-line">${sig(0)}</div></div>
    <div><div class="sig-lbl">Endorsed:</div><div class="sig-line">${sig(1)}</div></div>
    <div><div class="sig-lbl">Recommending Approval:</div><div class="sig-line">${sig(2)}</div></div>
  </div>
  <div class="sig-ctr">
    <div class="sig-lbl">Approved:</div><br>
    <div class="sig-line" style="display:inline-block;width:52%;text-align:center;">${sig(3)}</div>
  </div>
</div>

<div class="pg-break"><div class="obs-page">
  ${header.replace('class="doc-header"', 'class="doc-header" style="margin-bottom:8px;"')}
  <div style="text-align:center;margin:10px 0 10px;">
    <div class="section-title">OBSERVATION TOOL</div>
    <p style="text-indent:0;margin-top:6px;margin-bottom:2px;"><strong>${title}</strong></p>
    ${targetDate ? `<p style="text-indent:0;margin:2px 0;">${targetDate}</p>` : ''}
  </div>
  <div style="margin:8px 0;font-size:10pt;">Name (Optional): ___________________________________ &nbsp;&nbsp; Grade &amp; Section: ____________________</div>
  <p style="margin:6px 0;font-size:10pt;"><strong>Directions:</strong> Please assess the effectiveness of the project/program according to the indicators below. Put a check (&#10003;) under the appropriate column.</p>
  <table class="obs-table">
    <thead><tr><th style="width:65%;">INDICATORS</th><th style="width:11%;">Evident</th><th style="width:13%;">Not Evident</th><th style="width:11%;">Remarks</th></tr></thead>
    <tbody>${obsRows}</tbody>
  </table>
  <div style="margin-top:14px;font-size:10pt;"><strong>COMMENTS AND RECOMMENDATIONS:</strong><br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________
  </div>
</div></div>
</body>
</html>`;
}
