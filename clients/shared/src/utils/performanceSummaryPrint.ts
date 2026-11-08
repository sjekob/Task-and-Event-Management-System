import { PerformanceSummary } from '../models/PerformanceSummary';

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (v: number | null, digits = 2, suffix = '') => (v === null ? '—' : `${v.toFixed(digits)}${suffix}`);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function stamp(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

const HEADERS = ['No.', 'Employee Name', 'Position / Title', 'Subject / Department', 'Special Task Score', 'Event Evaluation Score',
  'Report Timing Points', 'Total Appraisal Points', 'Overall Grade', 'Escalation Count', 'Remarks / Status'];

const CSS = `
  @page { size: A4 landscape; margin: 12mm 10mm 14mm;
    @bottom-left { content: "Exported: EXPORTED"; font: 8pt Arial, sans-serif; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Arial, sans-serif; } }
  body { font-family: 'Noto Sans', Arial, Helvetica, sans-serif; color: #000; margin: 0; }
  .bar { position: sticky; top: 0; display: flex; gap: 10px; justify-content: center; padding: 8px; background: #1a56db; color: #fff; font: 600 13px Arial; }
  .bar button { border: 0; border-radius: 4px; padding: 6px 18px; font-weight: 700; cursor: pointer; }
  .sheet { padding: 14px 18px; }
  .head { display: flex; align-items: center; }
  .head img { width: 52px; height: 52px; }
  .head .mid { flex: 1; text-align: center; font-size: 9pt; line-height: 1.35; }
  .head .dep { font-size: 11pt; font-weight: 700; } .head .sch { font-size: 12pt; font-weight: 700; margin-top: 4px; }
  h1 { text-align: center; font-size: 14pt; margin: 12px 0 0; } .sy { text-align: center; font-size: 10pt; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  th, td { border: 0.5pt solid #555; padding: 3px 4px; } th { background: #ddd; } td.c { text-align: center; }
  thead { display: table-header-group; } tr { break-inside: avoid; }
  .note { font-size: 8pt; font-style: italic; margin-top: 10px; }
  .signs { display: flex; margin-top: 26px; break-inside: avoid; }
  .signs div { flex: 1; text-align: center; font-size: 7pt; } .signs hr { margin: 34px 24px 3px; border: 0; border-top: 0.7pt solid #000; }
  .signs b { display: block; font-size: 9pt; margin-top: 4px; }
  @media print { .bar { display: none; } .sheet { padding: 0; } }
`;

/**
 * The "Annual Faculty Performance Summary" (A4 landscape) as a standalone
 * HTML document: letterhead, one row per personnel, note and signatories.
 * Printing it (or "Save as PDF") gives the DepEd-ready PDF.
 */
export function performanceSummaryHtml(data: PerformanceSummary, sealDataUri: string, now = new Date()): string {
  const sy = data.schoolYear ?? '';
  const rows = data.rows.map((r, i) => `<tr>
    <td class="c">${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.position || '—')}</td><td>${esc(r.department ?? '—')}</td>
    <td class="c">${fmt(r.specialTaskScore, 2, ' / 5')}</td><td class="c">${fmt(r.eventScore, 1, '%')}</td>
    <td class="c">${r.timingPoints}</td><td class="c">${fmt(r.totalPoints)}</td><td class="c">${esc(r.overallGrade ?? '—')}</td>
    <td class="c">${r.escalationCount}</td><td class="c">${esc(r.remarks || '—')}</td></tr>`).join('');
  const body = data.rows.length ? rows : `<tr><td colspan="11" class="c" style="padding:24px">No personnel appraisal records for this school year.</td></tr>`;
  const sign = (role: string) => `<div><hr>Signature over Printed Name<b>${role}</b></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Annual Faculty Performance Summary${sy ? ` – S.Y. ${esc(sy)}` : ''}</title>
<style>${CSS.replace('EXPORTED', esc(stamp(now)))}</style></head><body>
<div class="bar"><span>Annual Faculty Performance Summary</span><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">
  <div class="head">
    ${sealDataUri ? `<img src="${sealDataUri}" alt="">` : '<span style="width:52px"></span>'}
    <div class="mid">Republic of the Philippines<div class="dep">Department of Education</div>${esc(data.division)}
      <div class="sch">${esc(data.schoolName.toUpperCase())}</div>School ID / Station ID: ${esc(data.stationId || '____________')}</div>
    <span style="width:52px"></span>
  </div>
  <h1>ANNUAL FACULTY PERFORMANCE SUMMARY</h1>
  <div class="sy">School Year ${esc(sy || '—')}</div>
  <table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
  <div class="note">Note: Aggregated from all event and special task appraisals. Ready for DepEd Annual Faculty Performance Evaluation.</div>
  <div class="signs">${sign('Prepared by')}${sign('Recommending Approval')}${sign('Approved by')}</div>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>
</body></html>`;
}
