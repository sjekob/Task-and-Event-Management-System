import {
  BAGONG_PILIPINAS_DATA_URI,
  DEPED_MATATAG_DATA_URI,
  KAGAWARAN_DATA_URI,
  LOGO_DATA_URI,
} from './eventPrintAssets';

/// The already-escaped values and pre-built HTML fragments the proposal
/// document is assembled from.
export interface ProposalTemplateValues {
  title: string;
  targetDate: string;
  venue: string;
  budget: string;
  fundSrc: string;
  focalName: string;
  focalRole: string;
  focalCp: string;
  dateDisplay: string;
  isCurricular: boolean;
  isCoCurricular: boolean;
  isExtraCurricular: boolean;
  fileSafeTitle: string;
  proponentName: string;
  proponentTitle: string;
  participantsHtml: string;
  outputsHtml: string;
  rationaleHtml: string;
  objectivesHtml: string;
  methodologyRows: string;
  matrixRows: string;
  execRows: string;
  twgHtml: string;
  budgetHtml: string;
  monitoringHtml: string;
  sigBlocks: string[];
  obsRows: string;
}

/// The DepEd event-proposal document (A4, print-ready), as one HTML page.
export function proposalDocument(v: ProposalTemplateValues): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Event Proposal – ${v.title}</title>
<style>

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Page-break helpers ──
   Keep paragraphs and list items whole so a line of text is never
   sliced in half across a page boundary when printing or generating
   the PDF. (Kept deliberately narrow — marking too many elements as
   "avoid" confuses html2pdf's pagination and causes blank/overflowing
   pages.) */
p, li {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* ── Page (A4, reduced margins for compact layout) ── */
@page {
  size: A4 portrait;
  margin: 10mm 14mm 16mm 16mm;
}

body {
  font-family: 'Times New Roman', Times, serif;
  font-size: 10pt;
  color: #000;
  background: #fff;
  line-height: 1.35;
}

/* ── Fixed footer – repeats on every printed page ── */
.page-footer {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 14mm;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1.5px solid #444;
  padding: 2mm 14mm 0 16mm;
  background: #fff;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 7.5pt;
}

.pf-center { text-align: center; }
.pf-right  { text-align: right; white-space: nowrap; }

/* ── Print / Download button bar (screen only) ── */
.print-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  background: #1a56db;
  color: #fff;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 9999;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
.print-btn {
  background: #fff;
  color: #1a56db;
  border: none;
  padding: 6px 20px;
  border-radius: 4px;
  font-size: 10pt;
  font-weight: bold;
  cursor: pointer;
}
.print-btn:hover { background: #dbeafe; }
.download-btn {
  background: transparent;
  color: #fff;
  border: 2px solid rgba(255,255,255,0.8);
  padding: 4px 18px;
  border-radius: 4px;
  font-size: 10pt;
  font-weight: bold;
  cursor: pointer;
}
.download-btn:hover { background: rgba(255,255,255,0.15); }

/* ── Document Header ── */
.doc-header {
  text-align: center;
  padding-bottom: 7px;
  border-bottom: 2px solid #000;
  margin-bottom: 10px;
}
.doc-header .seal   { height: 56px; margin-bottom: 3px; }
.doc-header .rep    { font-family: 'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif; font-size: 12pt; letter-spacing: 1px; }
.doc-header .dept   { font-family: 'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif; font-size: 17pt; font-weight: bold; letter-spacing: 0.5px; }
.doc-header .sub-hd { font-family: Arial,Helvetica,sans-serif; font-size: 7.5pt; font-weight: bold; letter-spacing: 0.5px; line-height: 1.6; }

/* ── Date ── */
.date-line { text-align: right; margin-bottom: 10px; }

/* ── Sections ── */
.section       { margin-bottom: 12px; }
.section-title { font-weight: bold; font-size: 10pt; margin-bottom: 6px; text-transform: uppercase; }
.sub-title     { font-weight: bold; font-size: 10pt; margin: 8px 0 4px 12px; text-transform: uppercase; }
.avoid-break   { page-break-inside: avoid; break-inside: avoid; }

/* ── Proposal Brief Table ── */
.brief-table   { width: 100%; border-collapse: collapse; }
.brief-table td { padding: 2px 5px; vertical-align: top; font-size: 10pt; }
.lbl  { font-weight: bold; white-space: nowrap; width: 175px; }
.colon{ width: 12px; text-align: center; }

/* ── Checkboxes ── */
.cb     { display: inline-flex; align-items: center; gap: 3px; margin-right: 12px; font-size: 10pt; }
.cb-box { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #000; text-align: center; line-height: 10px; font-size: 9pt; }

/* ── Participants Table ── */
.p-table { border-collapse: collapse; margin: 4px 0; }
.p-table th, .p-table td { border: 1px solid #000; padding: 2px 9px; text-align: center; font-size: 10pt; }
.p-table th   { font-weight: bold; }
.plabel { text-align: left; min-width: 140px; }
.ptotal { font-weight: bold; }

/* ── Lists + Paragraphs ── */
ol, ul  { margin-left: 24px; margin-top: 3px; }
li      { margin-bottom: 3px; text-align: justify; font-size: 10pt; }
p       { text-align: justify; text-indent: 24px; margin-bottom: 7px; font-size: 10pt; }

/* ── Methodology Phases ── */
.phase-table    { width: 88%; border-collapse: collapse; margin: 6px 0 6px 8px; }
.phase-table td { border: 1px solid #000; padding: 4px 8px; vertical-align: top; font-size: 10pt; }
.phase-lbl      { font-weight: bold; white-space: nowrap; width: 72px; }

/* ── Activity Matrix ── */
.matrix-table    { width: 100%; border-collapse: collapse; margin-top: 6px; }
.matrix-table th { border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; background: #f2f2f2; font-size: 10pt; }
.matrix-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; font-size: 10pt; }
.matrix-table tr { page-break-inside: avoid; }

/* ── Committee Tables ── */
.cmt-group  { margin-bottom: 10px; page-break-inside: avoid; }
.cmt-title  { text-align: center; font-weight: bold; padding: 4px; border: 1px solid #000; background: #f5f5f5; font-size: 10pt; }
.cmt-table  { width: 100%; border-collapse: collapse; }
.cmt-table th, .cmt-table td { border: 1px solid #000; padding: 3px 6px; font-size: 10pt; vertical-align: top; }
.cmt-table th { text-align: center; font-weight: bold; }

/* ── Budget Tables ── */
.bgt-sub   { font-weight: bold; margin: 8px 0 4px; font-size: 10pt; }
.bgt-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
.bgt-table th { border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; background: #f2f2f2; font-size: 10pt; }
.bgt-table td { border: 1px solid #000; padding: 3px 6px; font-size: 10pt; }
.sub-row td   { text-align: right; font-weight: bold; background: #f9f9f9; border-top: 1.5px solid #000; }

/* ── Signatures ── */
.sig-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 12px; }
.sig-lbl   { font-size: 10pt; margin-bottom: 20px; }
.sig-line  { border-top: 1px solid #000; padding-top: 2px; }
.sig-name  { font-weight: bold; font-size: 10pt; }
.sig-title { font-size: 9.5pt; }
.sig-ctr   { text-align: center; margin-top: 10px; }

/* ── Observation Tool ── */
.obs-table    { width: 100%; border-collapse: collapse; margin-top: 8px; }
.obs-table th { border: 1px solid #000; padding: 3px 5px; font-weight: bold; text-align: center; font-size: 9.5pt; }
.obs-table td { border: 1px solid #000; padding: 3px 5px; font-size: 9.5pt; }
.obs-page     { page-break-inside: avoid; break-inside: avoid; }

/* ── Page Break ── */
.pg-break { page-break-before: always; }
.pg-spacer { height: 10mm; }

/* Screen preview only */
@media screen {
  body { max-width: 210mm; margin: 46px auto 10mm; padding: 10mm 14mm 25mm 16mm; box-shadow: 0 0 15px rgba(0,0,0,0.15); min-height: 297mm; }
}
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}

/* Applied to <body> while html2pdf renders the document for download. */
body.generating-pdf {
  box-shadow: none !important;
  margin: 0 !important;
  max-width: none !important;
  min-height: 0 !important;
  padding: 10mm 14mm 22mm 16mm !important;
}

</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
(function () {
  // Calculate total pages based on scroll height vs A4 content height.
  // A4 = 297mm; top margin 10mm + bottom margin 16mm = 26mm used.
  // Content area ≈ 271mm. At 96 DPI: 1mm = 3.7795px → 271 * 3.7795 ≈ 1024px.
  var PAGE_CONTENT_H = 1024;
  function updateTotal() {
    var total = Math.max(1, Math.ceil(document.body.scrollHeight / PAGE_CONTENT_H));
    var els = document.querySelectorAll('.pg-total');
    for (var i = 0; i < els.length; i++) { els[i].textContent = total; }
  }
  document.addEventListener('DOMContentLoaded', updateTotal);
  window.addEventListener('resize', updateTotal);
  window.onbeforeprint = updateTotal;

  // Auto-trigger the browser print / Save-as-PDF dialog after the page loads.
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 700);
  });
})();

var DOC_FILENAME     = '${v.fileSafeTitle}.pdf';
var LOGO_DATA_URI    = '${LOGO_DATA_URI}';
var MATATAG_DATA_URI = '${DEPED_MATATAG_DATA_URI}';
var BAGONG_DATA_URI  = '${BAGONG_PILIPINAS_DATA_URI}';

function downloadDoc() {
  // Fallback if the CDN script failed to load (e.g. offline).
  if (typeof html2pdf === 'undefined') {
    alert('PDF generator could not be loaded (check your internet connection). '
        + 'Opening the print dialog instead \\u2014 choose "Save as PDF" as the destination.');
    window.print();
    return;
  }

  var btn    = document.querySelector('.download-btn');
  var bar    = document.querySelector('.print-bar');
  var footer = document.querySelector('.page-footer');

  if (btn) { btn.disabled = true; btn.innerHTML = 'Generating PDF\\u2026'; }
  document.body.classList.add('generating-pdf');
  if (bar)    bar.style.display    = 'none';
  // The fixed HTML footer only renders once in the captured canvas, so it
  // is hidden here — a proper repeating footer is drawn on every page
  // below using jsPDF once the PDF has been built.
  if (footer) footer.style.display = 'none';

  function restore() {
    document.body.classList.remove('generating-pdf');
    if (bar)    bar.style.display    = '';
    if (footer) footer.style.display = '';
    if (btn) { btn.disabled = false; btn.innerHTML = '&#11015;&nbsp;Download'; }
  }

  // The body's own padding (set via .generating-pdf above) bakes the page
  // margins into the captured image, so html2pdf needs no extra margin.
  var opt = {
    margin: 0,
    filename: DOC_FILENAME,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  html2pdf().set(opt).from(document.body).toPdf().get('pdf')
    .then(function (pdf) {
      var pageCount  = pdf.internal.getNumberOfPages();
      var pageWidth  = pdf.internal.pageSize.getWidth();
      var pageHeight = pdf.internal.pageSize.getHeight();
      var marginL = 16, marginR = 14, footerH = 22;
      var lineY = pageHeight - footerH;
      var textY = pageHeight - 8;

      for (var i = 1; i <= pageCount; i++) {
        pdf.setPage(i);

        // Separator line above the footer
        pdf.setDrawColor(68, 68, 68);
        pdf.setLineWidth(0.3);
        pdf.line(marginL, lineY, pageWidth - marginR, lineY);

        // DepEd MATATAG | School seal | Bagong Pilipinas
        pdf.addImage(MATATAG_DATA_URI, 'PNG', marginL, lineY + 1.5, 9.4, 9);
        pdf.addImage(LOGO_DATA_URI, 'PNG', marginL + 10.4, lineY + 1.5, 9.1, 9);
        pdf.addImage(BAGONG_DATA_URI, 'PNG', marginL + 20.5, lineY + 1.5, 9.5, 9);

        // Center text
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.text('Telephone No.: (054) 881-3938     Email Address: 114501@deped.gov.ph',
            pageWidth / 2, textY, { align: 'center' });

        // Page number (accurate — based on the final rendered PDF)
        pdf.text('Page ' + i + ' of ' + pageCount, pageWidth - marginR, textY, { align: 'right' });
      }
    })
    .save()
    .then(restore)
    .catch(function (err) {
      restore();
      alert('Could not generate PDF: ' + err);
    });
}
</script>
</head>
<body>

<!-- ╔══════════════════════════════════════════════╗
     ║  PRINT BUTTON BAR  (screen only)            ║
     ╚══════════════════════════════════════════════╝ -->
<div class="print-bar no-print">
  <span style="margin-right:8px;">Event Proposal — ${v.title}</span>
  <button class="print-btn" onclick="window.print()">&#128438;&nbsp;Print</button>
  <button class="download-btn" onclick="downloadDoc()">&#11015;&nbsp;Download</button>
</div>

<!-- ╔══════════════════════════════════════════════╗
     ║  PAGE FOOTER  (fixed – repeats every page)  ║
     ╚══════════════════════════════════════════════╝ -->
<div class="page-footer">
  <!-- Three logos matching the DepEd footer: MATATAG | school seal | BAGONG PILIPINAS -->
  <div style="display:flex;align-items:center;gap:5px;">
    <img src="${DEPED_MATATAG_DATA_URI}" style="height:28px;" alt="DepEd MATATAG">
    <img src="${LOGO_DATA_URI}" style="height:28px;" alt="NCS II Seal">
    <img src="${BAGONG_PILIPINAS_DATA_URI}" style="height:28px;" alt="Bagong Pilipinas">
  </div>
  <div class="pf-center">
    Telephone No.: (054) 881-3938&nbsp;&nbsp;&nbsp;Email Address: 114501@deped.gov.ph
  </div>
  <div class="pf-right">
    Page&nbsp;1&nbsp;of&nbsp;<span class="pg-total">…</span>
  </div>
</div>

<!-- ╔══════════════════════════════╗
     ║  DOCUMENT HEADER            ║
     ╚══════════════════════════════╝ -->
<div class="doc-header">
  <img src="${KAGAWARAN_DATA_URI}" class="seal" alt="Kagawaran ng Edukasyon Seal">
  <div class="rep">Republika ng Pilipinas</div>
  <div class="dept">Kagawaran ng Edukasyon</div>
  <div class="sub-hd">
    REHIYON V--BICOL<br>
    TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA<br>
    NAGA CENTRAL SCHOOL II<br>
    JACOB ST., PE&Ntilde;AFRANCIA, NAGA CITY
  </div>
</div>

<div class="date-line">${v.dateDisplay.length > 0 ? v.dateDisplay : '&nbsp;'}</div>

<!-- ╔══════════════════════════════╗
     ║  I. PROPOSAL BRIEF          ║
     ╚══════════════════════════════╝ -->
<div class="section avoid-break">
  <div class="section-title">I.&nbsp;&nbsp;Proposal Brief</div>
  <table class="brief-table">
    <tr>
      <td class="lbl">a. Title</td><td class="colon">:</td>
      <td><strong>${v.title}</strong></td>
    </tr>
    <tr>
      <td class="lbl">b. Nature of Activity</td><td class="colon">:</td>
      <td>
        <span class="cb"><span class="cb-box">${v.isCurricular ? '&#10003;' : '&nbsp;'}</span>Curricular</span>
        <span class="cb"><span class="cb-box">${v.isCoCurricular ? '&#10003;' : '&nbsp;'}</span>Co-curricular</span>
        <span class="cb"><span class="cb-box">${v.isExtraCurricular ? '&#10003;' : '&nbsp;'}</span>Extra-curricular</span>
      </td>
    </tr>
    <tr>
      <td class="lbl">c. Target Date</td><td class="colon">:</td>
      <td>${v.targetDate}</td>
    </tr>
    <tr>
      <td class="lbl">d. Proposed Venue</td><td class="colon">:</td>
      <td>${v.venue}</td>
    </tr>
    <tr>
      <td class="lbl">e. Target Participants</td><td class="colon">:</td>
      <td>${v.participantsHtml}</td>
    </tr>
    <tr>
      <td class="lbl">f. Expected Outputs</td><td class="colon">:</td>
      <td>${v.outputsHtml}</td>
    </tr>
    <tr>
      <td class="lbl">g. Proposed Budget</td><td class="colon">:</td>
      <td><strong>${v.budget}</strong></td>
    </tr>
    <tr>
      <td class="lbl">h. Source of Fund</td><td class="colon">:</td>
      <td>${v.fundSrc}</td>
    </tr>
    <tr>
      <td class="lbl">h. Focal Person</td><td class="colon">:</td>
      <td>
        ${v.focalName}<br>
        <em>${v.focalRole}</em>
        ${v.focalCp.length > 0 ? `<br>CP# ${v.focalCp}` : ''}
      </td>
    </tr>
  </table>
</div>

<!-- ╔══════════════════════════════╗
     ║  II. RATIONALE              ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">II.&nbsp;&nbsp;Rationale</div>
  ${v.rationaleHtml}
</div>

<!-- ╔══════════════════════════════╗
     ║  III. OBJECTIVES            ║
     ╚══════════════════════════════╝ -->
<div class="section avoid-break">
  <div class="section-title">III.&nbsp;&nbsp;Objectives</div>
  <p>This project aims to:</p>
  ${v.objectivesHtml}
</div>

<!-- ╔══════════════════════════════╗
     ║  IV. METHODOLOGY            ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">IV.&nbsp;&nbsp;Methodology</div>
  <p>The training shall be composed of lectures, video clip viewing, sharing and games.
     5E&#x2019;s approach shall be utilized for most of the sessions.
     The schedule will be as follows:</p>
  <table class="phase-table">
    ${v.methodologyRows}
  </table>
</div>

<!-- ╔══════════════════════════════╗
     ║  V. ACTIVITY MATRIX         ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">V.&nbsp;&nbsp;Activity Matrix</div>
  <table class="matrix-table">
    <thead>
      <tr>
        <th style="width:115px;">Day</th>
        <th style="width:110px;">Time</th>
        <th>Event</th>
        <th>Speaker</th>
      </tr>
    </thead>
    <tbody>
      ${v.matrixRows}
    </tbody>
  </table>
</div>

<!-- ╔══════════════════════════════╗
     ║  VI. WORKING COMMITTEE      ║
     ╚══════════════════════════════╝ -->
<div class="section pg-break">
  <div class="pg-spacer"></div>
  <div class="section-title">VI.&nbsp;&nbsp;Working Committee</div>
  <div class="sub-title">a. Executive Committee</div>
  <table class="cmt-table" style="margin-bottom:14px;">
    <tbody>
      ${v.execRows}
    </tbody>
  </table>
  <div class="sub-title">b. Technical Working Group</div>
  ${v.twgHtml}
</div>

<!-- ╔══════════════════════════════╗
     ║  VII. PROPOSED BUDGET       ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">VII.&nbsp;&nbsp;Proposed Budget</div>
  <p>The budget for this training shall be charged against
     ${v.fundSrc.length > 0 ? v.fundSrc : 'School Fund'}
     subject to the usual accounting and auditing rules and regulations.
     This program adheres to the <strong>NO COLLECTION POLICY</strong> of DepEd.</p>
  ${v.budgetHtml}
</div>

<!-- ╔══════════════════════════════╗
     ║  VIII. MONITORING & EVAL    ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">VIII.&nbsp;&nbsp;Monitoring and Evaluation</div>
  ${v.monitoringHtml}
</div>

<!-- ╔══════════════════════════════╗
     ║  SIGNATURE BLOCK            ║
     ╚══════════════════════════════╝ -->
<div class="section avoid-break" style="margin-top:22px;">
  <div class="sig-grid">
    <div>
      <div class="sig-lbl">Proponent:</div>
      <div class="sig-line">
        <div class="sig-name">${v.proponentName}</div>
        <div class="sig-title">${v.proponentTitle}</div>
      </div>
    </div>
    <div>
      <div class="sig-lbl">Noted:</div>
      <div class="sig-line">${v.sigBlocks[0]}</div>
    </div>
    <div>
      <div class="sig-lbl">Endorsed:</div>
      <div class="sig-line">${v.sigBlocks[1]}</div>
    </div>
    <div>
      <div class="sig-lbl">Recommending Approval:</div>
      <div class="sig-line">${v.sigBlocks[2]}</div>
    </div>
  </div>
  <div class="sig-ctr">
    <div class="sig-lbl">Approved:</div><br>
    <div class="sig-line" style="display:inline-block;width:52%;text-align:center;">
      ${v.sigBlocks[3]}
    </div>
  </div>
</div>

<!-- ╔══════════════════════════════╗
     ║  PAGE 8 – OBSERVATION TOOL  ║
     ╚══════════════════════════════╝ -->
<div class="pg-break">
<div class="obs-page">
  <div class="doc-header" style="margin-bottom:8px;">
    <img src="${KAGAWARAN_DATA_URI}" class="seal" alt="Kagawaran ng Edukasyon Seal">
    <div class="rep">Republika ng Pilipinas</div>
    <div class="dept">Kagawaran ng Edukasyon</div>
    <div class="sub-hd">
      REHIYON V--BICOL<br>
      TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA<br>
      NAGA CENTRAL SCHOOL II<br>
      JACOB ST., PE&Ntilde;AFRANCIA, NAGA CITY
    </div>
  </div>

  <div style="text-align:center;margin:10px 0 10px;">
    <div class="section-title">OBSERVATION TOOL</div>
    <p style="text-indent:0;margin-top:6px;margin-bottom:2px;"><strong>${v.title}</strong></p>
    ${v.targetDate.length > 0 ? `<p style="text-indent:0;margin:2px 0;">${v.targetDate}</p>` : ''}
  </div>

  <div style="margin:8px 0;font-size:10pt;">
    Name (Optional): ___________________________________ &nbsp;&nbsp; Grade &amp; Section: ____________________
  </div>

  <p style="margin:6px 0;font-size:10pt;"><strong>Directions:</strong> Please assess the effectiveness of the project/program
     according to the indicators below. Put a check (&#10003;) under the appropriate column.</p>

  <table class="obs-table">
    <thead>
      <tr>
        <th style="width:65%;">INDICATORS</th>
        <th style="width:11%;">Evident</th>
        <th style="width:13%;">Not Evident</th>
        <th style="width:11%;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${v.obsRows}
    </tbody>
  </table>

  <div style="margin-top:14px;font-size:10pt;">
    <strong>COMMENTS AND RECOMMENDATIONS:</strong><br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________
  </div>
</div>
</div>

</body>
</html>`;
}
