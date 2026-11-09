// Print stylesheet for the A4 proposal: paged screen preview, print and PDF.
export const PRINT_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page { size: A4 portrait; margin: 0; }

body {
  font-family: 'Bookman Old Style', 'Bookman', 'URW Bookman', Georgia, serif;
  font-size: 11pt;
  color: #000;
  background: #e5e7eb;
  line-height: 1.5;
}

/* ── Sheets ── */
.page {
  position: relative;
  width: 210mm;
  height: 297mm;
  margin: 0 auto 8mm;
  padding: 14mm 25mm 0;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,0.18);
  overflow: hidden;
}
.page-body { height: calc(297mm - 14mm - 34mm); overflow: hidden; }
#flow { width: 160mm; margin: 56px auto 0; background: #fff; }
body.paged #flow { display: none; }
body.paged #pages { padding-top: 56px; }

/* ── Footer on every sheet ── */
.page-footer {
  position: absolute; left: 25mm; right: 25mm; bottom: 8mm; height: 22mm;
  display: flex; align-items: flex-start; justify-content: space-between;
  padding-top: 1.5mm; border-top: 2.5px solid #000;
  font-family: Calibri, Carlito, Arial, Helvetica, sans-serif;
}
.pf-logos { display: flex; align-items: center; gap: 3mm; }
.pf-logos img { height: 17mm; width: auto; }
.pf-info { text-align: right; font-size: 8pt; line-height: 1.4; padding-top: 3mm; }
.pf-info b { font-weight: bold; }
.pf-page { border-collapse: collapse; margin: 3mm 0 0 auto; font-size: 8pt; }
.pf-page td { border: 1px solid #000; padding: 0 4px; text-align: center; line-height: 1.3; }
.pf-page td:first-child { font-weight: bold; width: 18mm; }
.pf-page td:last-child { width: 19mm; }

/* ── Toolbar (screen only) ── */
.print-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  padding: 8px 16px; background: #1a56db; color: #fff;
  font-family: Arial, Helvetica, sans-serif; font-size: 10pt; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
.print-btn { background: #fff; color: #1a56db; border: none; padding: 6px 20px; border-radius: 4px; font-size: 10pt; font-weight: bold; cursor: pointer; }
.print-btn:hover { background: #dbeafe; }
.download-btn { background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.8); padding: 4px 18px; border-radius: 4px; font-size: 10pt; font-weight: bold; cursor: pointer; }
.download-btn:hover { background: rgba(255,255,255,0.15); }

/* ── Letterhead ── */
.doc-header { text-align: center; padding-bottom: 6px; border-bottom: 1.5px solid #000; margin-bottom: 12px; }
.doc-header .seal { height: 22mm; margin-bottom: 2px; }
.doc-header .rep { font-family: 'Old English Text MT', 'UnifrakturMaguntia', 'Engravers Old English', serif; font-size: 12.5pt; line-height: 1.15; }
.doc-header .dept { font-family: 'Old English Text MT', 'UnifrakturMaguntia', 'Engravers Old English', serif; font-size: 21pt; line-height: 1.15; }
/* The blackletter fonts ship regular only: synthesize bold and thicken the strokes. */
.doc-header .rep, .doc-header .dept { font-weight: bold; font-synthesis: weight; -webkit-text-stroke: 0.4px #000; }
.doc-header .sub-hd { font-family: Tahoma, Verdana, 'DejaVu Sans', Arial, sans-serif; font-size: 8pt; font-weight: bold; line-height: 1.3; -webkit-text-stroke: 0.2px #000; }
.doc-header .sub-hd .region { font-family: 'Times New Roman', Times, serif; font-size: 7.5pt; font-weight: bold; -webkit-text-stroke: 0.15px #000; }
.date-line { text-align: right; margin-bottom: 12px; }

/* ── Sections ── */
.section { margin-bottom: 14px; }
.section-title { font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
.sub-title { font-weight: bold; margin: 8px 0 4px 12px; text-transform: uppercase; }

/* ── Proposal brief ── */
.brief-table { width: calc(100% - 44px); border-collapse: collapse; margin-left: 44px; }
.brief-table td { padding: 2px 5px; vertical-align: top; line-height: 1.75; }
.lbl { font-weight: bold; white-space: nowrap; width: 165px; }
.colon { width: 50px; text-align: center; font-weight: bold; }
.brief-block { padding: 6px 0 10px 30px !important; }
.brief-block .p-table { width: 100%; font-size: 9.5pt; }
.brief-block .p-table th, .brief-block .p-table td { padding: 1px 8px; line-height: 1.6; width: 18%; }
.brief-block .p-table .plabel { width: 46%; }
.brief-block ul { margin: 0 0 0 26px; }
.brief-block li { margin-bottom: 4px; }
.brief-gap td { padding-top: 14px; }
.cb { display: inline-flex; align-items: center; gap: 3px; margin-right: 12px; font-weight: bold; }
.cb-box { display: inline-block; width: 12px; height: 12px; border: 1.2px solid #000; text-align: center; line-height: 10px; font-size: 9pt; }

/* ── Tables ── */
.p-table { border-collapse: collapse; margin: 4px 0; }
.p-table th, .p-table td { border: 1px solid #000; padding: 2px 10px; text-align: center; }
.p-table th { font-weight: bold; }
.plabel { text-align: left !important; min-width: 150px; font-weight: bold; }
.ptotal { font-weight: bold; }
.ptotal.plabel { text-align: right !important; }

ol, ul { margin-left: 24px; margin-top: 3px; }
/* The proponent's checklists (rich text): a box per item, ticked when done. */
ul.checklist { list-style: none; margin-left: 6px; padding-left: 0; }
ul.checklist > li { position: relative; padding-left: 22px; }
ul.checklist > li::before { content: '\\2610'; position: absolute; left: 0; top: 0; }
ul.checklist > li.checked::before { content: '\\2611'; }
li { margin-bottom: 3px; text-align: justify; }
p { text-align: justify; text-indent: 28px; margin-bottom: 10px; }

.phase-table { width: 88%; border-collapse: collapse; margin: 6px 0 6px 8px; }
.phase-table td { border: 1px solid #000; padding: 4px 8px; vertical-align: top; }
.phase-lbl { font-weight: bold; white-space: nowrap; width: 72px; }

.matrix-table, .cmt-table, .bgt-table, .obs-table { width: 100%; border-collapse: collapse; }
.matrix-table { margin-top: 6px; }
.matrix-table th, .bgt-table th { border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; background: #f2f2f2; }
.matrix-table td, .bgt-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }

.cmt-group { margin-bottom: 10px; }
.cmt-title { text-align: center; font-weight: bold; padding: 4px; border: 1px solid #000; background: #f5f5f5; }
.cmt-table th, .cmt-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
.cmt-table th { text-align: center; font-weight: bold; }

.bgt-sub { font-weight: bold; margin: 8px 0 4px; }
.sub-row td { text-align: right; font-weight: bold; background: #f9f9f9; border-top: 1.5px solid #000; }

/* ── Signatures ── */
.sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-bottom: 12px; }
.sig-lbl { margin-bottom: 22px; }
.sig-line { border-top: 1px solid #000; padding-top: 2px; }
.sig-name { font-weight: bold; }
.sig-title { font-size: 9.5pt; }
.sig-ctr { text-align: center; margin-top: 10px; }

/* ── Observation tool ── */
.obs-table th { border: 1px solid #000; padding: 3px 5px; font-weight: bold; text-align: center; font-size: 9.5pt; }
.obs-table td { border: 1px solid #000; padding: 3px 5px; font-size: 9.5pt; }

@media print {
  body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  body.paged #pages { padding-top: 0; }
  .page { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
}

/* While html2pdf captures the sheets for "Download". */
body.generating-pdf { background: #fff; }
body.generating-pdf #pages { padding-top: 0; }
body.generating-pdf .page { margin: 0; box-shadow: none; }
`;
