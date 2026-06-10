// ignore_for_file: lines_longer_than_80_chars
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'event_printer.dart';

// ─────────────────────────────────────────────────────────────────────────────
// DATA SCHEMA BLUEPRINT (JSON)
//
// All dynamic fields that the Create-Event form must supply to populate the
// DepEd proposal layout (matching the SPAWNING proposal structure).
//
// {
//   "id": 1,
//   "title": "Project SPAWNING",
//   "nature": "Co-curricular",          // "Curricular" | "Co-curricular" | "Extra-curricular"
//   "target_date": "October 23, 24 & 28, 2024",
//   "venue": "NCS II Pavilion",
//   "proposed_budget": "P3,120.00",
//   "fund_source": "School Paper Fund/SPTA Fund",
//   "focal_name": "Sheila P. Chevallier",
//   "focal_role": "Teacher III, NCS II, Proponent",
//   "focal_contact": "09213218233",
//   "expected_outputs": "Written articles\nA complete list of campus journalists",
//   "participants": "{\"rows\":[{\"category\":\"Teachers/Speakers\",\"male\":2,\"female\":9,\"total\":11}],\"totals\":{\"male\":19,\"female\":48,\"total\":67}}",
//   "rationale": "Paragraph 1...\n\nParagraph 2...",
//   "objectives": "equip young journalists...\nproduce journalistic articles...\nchoose campus journalists...",
//   "phase1": "Planning\nRecruitment of participants",
//   "phase2": "Training-workshop sessions",
//   "phase3": "Selection of school paper staff\nEvaluation of the activity",
//   "activity_matrix": "[{\"day\":\"Oct. 23\",\"time\":\"4:00-5:00 PM\",\"event\":\"News Writing\",\"speaker\":\"Cheryl Aquino\"}]",
//   "training_materials": "[{\"item\":\"A4 Bond Paper\",\"quantity\":\"1 ream\",\"cost\":270,\"total\":270}]",
//   "snacks": "[{\"item\":\"Meals\",\"participants\":\"For 11 pax\",\"cost_per_day\":100,\"total\":1100}]",
//   "exec_committee": "[{\"name\":\"PRINCIPAL NAME\",\"designation\":\"Principal\"},{\"name\":\"TEACHER NAME\",\"designation\":\"Teacher III (Proponent)\"}]",
//   "twg_groups": "{\"supervising\":[{\"name\":\"...\",\"designation\":\"Chairperson\",\"terms\":\"Leads the Committee\",\"output\":\"Checked reports\"}],\"program_implementation\":[...],\"monitoring_evaluation\":[...]}",
//   "monitoring_criteria": "Monitoring paragraph...",
//   "creator_name": "Sheila Chevallier",
//   "created_at": "2024-10-17T00:00:00"
// }
// ─────────────────────────────────────────────────────────────────────────────

class EventPrintHelper {
  // ── Embedded assets ─────────────────────────────────────────────────────────

  // School seal logo (assets/images/logo.png) encoded as base64 data URI.
  static const _logoDataUri =
      'data:image/png;base64,'
      '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';

  // ── Public API ──────────────────────────────────────────────────────────────

  /// Opens the event proposal in a new browser tab and triggers the
  /// system print / save-as-PDF dialog.
  ///
  /// On web: opens a new tab with the full HTML layout and calls
  /// `window.print()` — the browser's native "Save as PDF" option
  /// appears there. Falls back to the `printing` package on native.
  static Future<void> printEvent(
      BuildContext context, Map<String, dynamic> event) async {
    final htmlContent = generateHtml(event);

    // ── Web path: open new tab + trigger browser print dialog ──────────────
    final opened = await triggerPrint(htmlContent);
    if (opened) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Print preview opened — use "Save as PDF" in the print dialog.',
            ),
            duration: Duration(seconds: 4),
          ),
        );
      }
      return;
    }

    // If popup was blocked, show a helpful message instead of silent failure
    if (context.mounted) {
      // triggerPrint returned false only when window.open() was blocked
      // (stub also returns false, falls through to printing package below)
    }

    // ── Native / fallback path: printing package PDF dialog ────────────────
    try {
      await Printing.layoutPdf(
        name: 'EventProposal_${(event['title'] ?? 'Proposal').toString().replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_')}',
        onLayout: (PdfPageFormat format) async {
          // ignore: deprecated_member_use
          return Printing.convertHtml(format: format, html: htmlContent);
        },
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open print dialog: $e'),
            backgroundColor: const Color(0xFFE53E3E),
          ),
        );
      }
    }
  }

  // ── HTML Generator ──────────────────────────────────────────────────────────

  static String generateHtml(Map<String, dynamic> event) {
    final title       = _esc(event['title']           ?? 'Untitled Event');
    final nature      = (event['nature']              ?? 'Co-curricular').toString();
    final targetDate  = _esc(event['target_date']     ?? '');
    final venue       = _esc(event['venue']           ?? '');
    final budget      = _esc(event['proposed_budget'] ?? '');
    final fundSrc     = _esc(event['fund_source']     ?? '');
    final focalName   = _esc(event['focal_name']      ?? '');
    final focalRole   = _esc(event['focal_role']      ?? '');
    final focalCp     = _esc(event['focal_contact']   ?? '');
    final rationale   = (event['rationale']           ?? '').toString();
    final objectives  = (event['objectives']          ?? '').toString();
    final outputs     = (event['expected_outputs']    ?? '').toString();
    final monitoring  = (event['monitoring_criteria'] ?? '').toString();
    final creatorName = _esc(event['creator_name']    ?? '');

    final isCurricular      = nature == 'Curricular';
    final isCoCurricular    = nature == 'Co-curricular';
    final isExtraCurricular = nature == 'Extra-curricular';

    final phase1 = _esc((event['phase1'] ?? 'Planning\nRecruitment of participants').toString());
    final phase2 = _esc((event['phase2'] ?? 'Training-workshop sessions').toString());
    final phase3 = _esc((event['phase3'] ?? 'Selection of staff\nEvaluation of the activity').toString());

    // Date display
    String dateDisplay = '';
    try {
      final raw = (event['created_at'] ?? '').toString();
      if (raw.isNotEmpty) {
        final dt = DateTime.parse(raw);
        dateDisplay = '${_month(dt.month)} ${dt.day}, ${dt.year}';
      }
    } catch (_) {}

    final proponentName  = focalName.isNotEmpty ? focalName.toUpperCase() : creatorName.toUpperCase();
    final proponentTitle = focalRole.isNotEmpty ? focalRole : 'Proponent';

    final fileSafeTitle = (event['title'] ?? 'EventProposal')
        .toString()
        .replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '_');

    return '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Event Proposal – $title</title>
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
.obs-table    { width: 100%; border-collapse: collapse; margin-top: 10px; }
.obs-table th { border: 1px solid #000; padding: 4px 6px; font-weight: bold; text-align: center; font-size: 10pt; }
.obs-table td { border: 1px solid #000; padding: 4px 6px; font-size: 10pt; }

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

var DOC_FILENAME   = '$fileSafeTitle.pdf';
var LOGO_DATA_URI  = '$_logoDataUri';

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

        // School seal
        pdf.addImage(LOGO_DATA_URI, 'PNG', marginL, lineY + 2, 7, 9);

        // DepEd MATATAG badge
        pdf.setFillColor(26, 86, 219);
        pdf.roundedRect(marginL + 9, lineY + 2.5, 13, 7.5, 1, 1, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        pdf.text('DepEd', marginL + 15.5, lineY + 6, { align: 'center' });
        pdf.setFontSize(4);
        pdf.text('MATATAG', marginL + 15.5, lineY + 9, { align: 'center' });

        // BAGONG PILINAS
        pdf.setTextColor(192, 57, 43);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(5.5);
        pdf.text('BAGONG', marginL + 46, lineY + 5.5, { align: 'center' });
        pdf.text('PILINAS', marginL + 46, lineY + 8.5, { align: 'center' });

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
  <span style="margin-right:8px;">Event Proposal — $title</span>
  <button class="print-btn" onclick="window.print()">&#128438;&nbsp;Print</button>
  <button class="download-btn" onclick="downloadDoc()">&#11015;&nbsp;Download</button>
</div>

<!-- ╔══════════════════════════════════════════════╗
     ║  PAGE FOOTER  (fixed – repeats every page)  ║
     ╚══════════════════════════════════════════════╝ -->
<div class="page-footer">
  <!-- Three logos matching the DepEd footer: MATATAG | school seal | BAGONG PILINAS -->
  <div style="display:flex;align-items:center;gap:5px;">
    <!-- DepEd MATATAG -->
    <div style="background:#1a56db;color:#fff;border-radius:4px;padding:1px 5px;
                font-family:Arial,sans-serif;font-size:6.5pt;line-height:1.3;text-align:center;">
      <div style="font-weight:800;letter-spacing:1px;">DepEd</div>
      <div style="font-size:5pt;font-weight:700;letter-spacing:2px;">MATATAG</div>
    </div>
    <!-- School Seal -->
    <img src="$_logoDataUri" style="height:26px;" alt="NCS II Seal">
    <!-- BAGONG PILINAS -->
    <div style="font-family:Arial,sans-serif;font-size:5.5pt;font-weight:700;
                color:#c0392b;line-height:1.3;text-align:center;">
      <div>BAGONG</div>
      <div>PILINAS</div>
    </div>
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
  <img src="$_logoDataUri" class="seal" alt="NCS II Seal">
  <div class="rep">Republika ng Pilipinas</div>
  <div class="dept">Kagawaran ng Edukasyon</div>
  <div class="sub-hd">
    REHIYON V--BICOL<br>
    TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA<br>
    NAGA CENTRAL SCHOOL II<br>
    JACOB ST., PE&Ntilde;AFRANCIA, NAGA CITY
  </div>
</div>

<div class="date-line">${dateDisplay.isNotEmpty ? dateDisplay : '&nbsp;'}</div>

<!-- ╔══════════════════════════════╗
     ║  I. PROPOSAL BRIEF          ║
     ╚══════════════════════════════╝ -->
<div class="section avoid-break">
  <div class="section-title">I.&nbsp;&nbsp;Proposal Brief</div>
  <table class="brief-table">
    <tr>
      <td class="lbl">a. Title</td><td class="colon">:</td>
      <td><strong>$title</strong></td>
    </tr>
    <tr>
      <td class="lbl">b. Nature of Activity</td><td class="colon">:</td>
      <td>
        <span class="cb"><span class="cb-box">${isCurricular ? '&#10003;' : '&nbsp;'}</span>Curricular</span>
        <span class="cb"><span class="cb-box">${isCoCurricular ? '&#10003;' : '&nbsp;'}</span>Co-curricular</span>
        <span class="cb"><span class="cb-box">${isExtraCurricular ? '&#10003;' : '&nbsp;'}</span>Extra-curricular</span>
      </td>
    </tr>
    <tr>
      <td class="lbl">c. Target Date</td><td class="colon">:</td>
      <td>$targetDate</td>
    </tr>
    <tr>
      <td class="lbl">d. Proposed Venue</td><td class="colon">:</td>
      <td>$venue</td>
    </tr>
    <tr>
      <td class="lbl">e. Target Participants</td><td class="colon">:</td>
      <td>${_buildParticipants(event['participants'])}</td>
    </tr>
    <tr>
      <td class="lbl">f. Expected Outputs</td><td class="colon">:</td>
      <td>${_bulletList(outputs)}</td>
    </tr>
    <tr>
      <td class="lbl">g. Proposed Budget</td><td class="colon">:</td>
      <td><strong>$budget</strong></td>
    </tr>
    <tr>
      <td class="lbl">h. Source of Fund</td><td class="colon">:</td>
      <td>$fundSrc</td>
    </tr>
    <tr>
      <td class="lbl">h. Focal Person</td><td class="colon">:</td>
      <td>
        $focalName<br>
        <em>$focalRole</em>
        ${focalCp.isNotEmpty ? '<br>CP# $focalCp' : ''}
      </td>
    </tr>
  </table>
</div>

<!-- ╔══════════════════════════════╗
     ║  II. RATIONALE              ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">II.&nbsp;&nbsp;Rationale</div>
  ${_paragraphs(rationale)}
</div>

<!-- ╔══════════════════════════════╗
     ║  III. OBJECTIVES            ║
     ╚══════════════════════════════╝ -->
<div class="section avoid-break">
  <div class="section-title">III.&nbsp;&nbsp;Objectives</div>
  <p>This project aims to:</p>
  ${_numberedList(objectives)}
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
    <tr>
      <td class="phase-lbl"><strong>Phase 1</strong></td>
      <td>Pre-Implementation Stage</td>
      <td>${phase1.replaceAll('\\n', '<br>')}</td>
    </tr>
    <tr>
      <td class="phase-lbl"><strong>Phase 2</strong></td>
      <td>Implementation</td>
      <td>${phase2.replaceAll('\\n', '<br>')}</td>
    </tr>
    <tr>
      <td class="phase-lbl"><strong>Phase 3</strong></td>
      <td>Post-Implementation</td>
      <td>${phase3.replaceAll('\\n', '<br>')}</td>
    </tr>
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
      ${_activityMatrixRows(event['activity_matrix'])}
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
      ${_execRows(event['exec_committee'], creatorName, focalName, focalRole)}
    </tbody>
  </table>
  <div class="sub-title">b. Technical Working Group</div>
  ${_twgSection(event['twg_groups'])}
</div>

<!-- ╔══════════════════════════════╗
     ║  VII. PROPOSED BUDGET       ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">VII.&nbsp;&nbsp;Proposed Budget</div>
  <p>The budget for this training shall be charged against
     ${fundSrc.isNotEmpty ? fundSrc : 'School Fund'}
     subject to the usual accounting and auditing rules and regulations.
     This program adheres to the <strong>NO COLLECTION POLICY</strong> of DepEd.</p>
  ${_budgetSection(event['training_materials'], event['snacks'], budget)}
</div>

<!-- ╔══════════════════════════════╗
     ║  VIII. MONITORING & EVAL    ║
     ╚══════════════════════════════╝ -->
<div class="section">
  <div class="section-title">VIII.&nbsp;&nbsp;Monitoring and Evaluation</div>
  ${_paragraphs(monitoring.isNotEmpty ? monitoring :
      'In compliance, facilitators and participants will be monitored jointly by the school '
      'administration and the District Supervisor. The SGOD/CID staff will be in charge of '
      'ensuring that the special program\'s provisions are followed. The chairman and proponent '
      'must account for gaps and challenges in order to receive technical support and improve the '
      'program. The entire activity shall be evaluated using the observation tool. See attached tool.')}
</div>

<!-- ╔══════════════════════════════╗
     ║  SIGNATURE BLOCK            ║
     ╚══════════════════════════════╝ -->
<div class="section avoid-break" style="margin-top:22px;">
  <div class="sig-grid">
    <div>
      <div class="sig-lbl">Proponent:</div>
      <div class="sig-line">
        <div class="sig-name">$proponentName</div>
        <div class="sig-title">$proponentTitle</div>
      </div>
    </div>
    <div>
      <div class="sig-lbl">Noted:</div>
      <div class="sig-line">
        <div class="sig-name">________________________________</div>
        <div class="sig-title">School Principal</div>
      </div>
    </div>
    <div>
      <div class="sig-lbl">Endorsed:</div>
      <div class="sig-line">
        <div class="sig-name">________________________________</div>
        <div class="sig-title">Public Schools District Supervisor</div>
      </div>
    </div>
    <div>
      <div class="sig-lbl">Recommending Approval:</div>
      <div class="sig-line">
        <div class="sig-name">________________________________</div>
        <div class="sig-title">Assistant Schools Division Superintendent</div>
      </div>
    </div>
  </div>
  <div class="sig-ctr">
    <div class="sig-lbl">Approved:</div><br>
    <div class="sig-line" style="display:inline-block;width:52%;text-align:center;">
      <div class="sig-name">________________________________</div>
      <div class="sig-title">Schools Division Superintendent</div>
    </div>
  </div>
</div>

<!-- ╔══════════════════════════════╗
     ║  PAGE 8 – OBSERVATION TOOL  ║
     ╚══════════════════════════════╝ -->
<div class="pg-break">
  <div class="doc-header">
    <img src="$_logoDataUri" class="seal" alt="NCS II Seal">
    <div class="rep">Republika ng Pilipinas</div>
    <div class="dept">Kagawaran ng Edukasyon</div>
    <div class="sub-hd">
      REHIYON V--BICOL<br>
      TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA<br>
      NAGA CENTRAL SCHOOL II<br>
      JACOB ST., PE&Ntilde;AFRANCIA, NAGA CITY
    </div>
  </div>

  <div style="text-align:center;margin:20px 0 16px;">
    <div class="section-title">OBSERVATION TOOL</div>
    <p style="text-indent:0;margin-top:8px;"><strong>$title</strong></p>
    ${targetDate.isNotEmpty ? '<p style="text-indent:0;">$targetDate</p>' : ''}
  </div>

  <div style="margin:12px 0;font-size:11pt;">
    Name (Optional): ___________________________________ &nbsp;&nbsp; Grade &amp; Section: ____________________
  </div>

  <p><strong>Directions:</strong> Please assess the effectiveness of the project/program
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
      <tr><td>1. The special program has an approved proposal.</td><td></td><td></td><td></td></tr>
      <tr><td>2. The training matrix was observed or was completely delivered.</td><td></td><td></td><td></td></tr>
      <tr><td>3. The number of days were maximized as stated in the training design.</td><td></td><td></td><td></td></tr>
      <tr><td>4. The objectives of the special program were met.</td><td></td><td></td><td></td></tr>
      <tr><td>5. The monitoring and evaluation tools were utilized.</td><td></td><td></td><td></td></tr>
      <tr><td>6. Participants were able to submit the required output.</td><td></td><td></td><td></td></tr>
      <tr><td>7. Attendance was systematically monitored.</td><td></td><td></td><td></td></tr>
      <tr><td>8. The venue was conducive.</td><td></td><td></td><td></td></tr>
      <tr><td>9. The session started and ended on time.</td><td></td><td></td><td></td></tr>
      <tr><td>10. The trainers/facilitators used appropriate resource package
              (Pretest and post-tests, PowerPoint, video presentation, etc.)</td><td></td><td></td><td></td></tr>
    </tbody>
  </table>

  <div style="margin-top:20px;font-size:11pt;">
    <strong>COMMENTS AND RECOMMENDATIONS:</strong><br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________<br><br>
    ________________________________________________________________________________________
  </div>
</div>

</body>
</html>''';
  }

  // ── Private HTML Builders ────────────────────────────────────────────────────

  static String _esc(String s) => s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  static String _month(int m) {
    const ms = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return (m >= 1 && m <= 12) ? ms[m] : '';
  }

  static String _paragraphs(String text) {
    if (text.trim().isEmpty) return '';
    return text
        .split(RegExp(r'\n\n+'))
        .where((p) => p.trim().isNotEmpty)
        .map((p) => '<p>${_esc(p.trim()).replaceAll('\n', ' ')}</p>')
        .join('\n');
  }

  static String _bulletList(String text) {
    if (text.trim().isEmpty) return '<ul><li>—</li></ul>';
    final items = text
        .split('\n')
        .where((l) => l.trim().isNotEmpty)
        .map((l) => '<li>${_esc(l.trim())}</li>')
        .join('\n');
    return '<ul>$items</ul>';
  }

  static String _numberedList(String text) {
    if (text.trim().isEmpty) return '<ol><li>—</li></ol>';
    final items = text
        .split('\n')
        .where((l) => l.trim().isNotEmpty)
        .map((l) => '<li>${_esc(l.trim())}</li>')
        .join('\n');
    return '<ol>$items</ol>';
  }

  static String _buildParticipants(dynamic raw) {
    if (raw == null) return _defaultParticipants();
    try {
      final data = raw is String ? jsonDecode(raw) as Map : raw as Map;
      final rows   = (data['rows']   as List?) ?? [];
      final totals = (data['totals'] as Map?)  ?? {};
      final rowsHtml = rows.map((r) {
        final m = r as Map;
        return '<tr>'
            '<td class="plabel">${_esc(m['category']?.toString() ?? '')}</td>'
            '<td>${m['male']   ?? '—'}</td>'
            '<td>${m['female'] ?? '—'}</td>'
            '<td>${m['total']  ?? '—'}</td>'
            '</tr>';
      }).join('');
      final totalRow = '<tr>'
          '<td class="plabel ptotal"><strong>TOTAL</strong></td>'
          '<td class="ptotal"><strong>${totals['male']   ?? '—'}</strong></td>'
          '<td class="ptotal"><strong>${totals['female'] ?? '—'}</strong></td>'
          '<td class="ptotal"><strong>${totals['total']  ?? '—'}</strong></td>'
          '</tr>';
      return '<table class="p-table">'
          '<thead><tr><th></th><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead>'
          '<tbody>$rowsHtml$totalRow</tbody>'
          '</table>';
    } catch (_) {
      return _defaultParticipants();
    }
  }

  static String _defaultParticipants() =>
      '<table class="p-table">'
      '<thead><tr><th></th><th>MALE</th><th>FEMALE</th><th>TOTAL</th></tr></thead>'
      '<tbody>'
      '<tr><td class="plabel">Participants</td><td>—</td><td>—</td><td>—</td></tr>'
      '<tr><td class="plabel ptotal"><strong>TOTAL</strong></td>'
      '<td class="ptotal">—</td><td class="ptotal">—</td><td class="ptotal">—</td></tr>'
      '</tbody></table>';

  static String _activityMatrixRows(dynamic raw) {
    if (raw == null) {
      return '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">'
          'No activity schedule defined.</td></tr>';
    }
    try {
      final List list = raw is String ? jsonDecode(raw) : raw as List;
      if (list.isEmpty) {
        return '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">'
            'No activity schedule defined.</td></tr>';
      }
      return list.map((item) {
        final m = item as Map;
        return '<tr>'
            '<td>${_esc(m['day']?.toString()    ?? '')}</td>'
            '<td>${_esc(m['time']?.toString()   ?? '')}</td>'
            '<td>${_esc(m['event']?.toString()  ?? '')}</td>'
            '<td>${_esc(m['speaker']?.toString() ?? '')}</td>'
            '</tr>';
      }).join('\n');
    } catch (_) {
      return '<tr><td colspan="4">${_esc(raw.toString())}</td></tr>';
    }
  }

  static String _execRows(dynamic raw, String creatorName, String focalName, String focalRole) {
    try {
      if (raw != null) {
        final List list = raw is String ? jsonDecode(raw) : raw as List;
        if (list.isNotEmpty) {
          return list.map((m) {
            final mm = m as Map;
            return '<tr>'
                '<td>${_esc(mm['name']?.toString()        ?? '')}</td>'
                '<td>${_esc(mm['designation']?.toString() ?? '')}</td>'
                '</tr>';
          }).join('');
        }
      }
    } catch (_) {}
    final name = focalName.isNotEmpty ? focalName.toUpperCase() : creatorName.toUpperCase();
    final role = focalRole.isNotEmpty ? focalRole : 'Teacher (Proponent)';
    return '<tr><td>$name</td><td>$role</td></tr>';
  }

  static String _twgSection(dynamic raw) {
    if (raw == null) return '';
    try {
      final data = raw is String ? jsonDecode(raw) as Map : raw as Map;
      final buf  = StringBuffer();
      for (final entry in data.entries) {
        final sectionTitle = entry.key
            .toString()
            .replaceAll('_', ' ')
            .split(' ')
            .map((w) => w.isEmpty ? '' : w[0].toUpperCase() + w.substring(1))
            .join(' ');
        final members = (entry.value as List?) ?? [];
        if (members.isEmpty) continue;
        buf.write('<div class="cmt-group">');
        buf.write('<div class="cmt-title">$sectionTitle</div>');
        buf.write('<table class="cmt-table"><thead><tr>'
            '<th>Name</th><th>Designation</th><th>Terms of Reference</th><th>Output</th>'
            '</tr></thead><tbody>');
        for (final m in members) {
          final mm = m as Map;
          buf.write('<tr>'
              '<td>${_esc(mm['name']?.toString()        ?? '')}</td>'
              '<td>${_esc(mm['designation']?.toString() ?? '')}</td>'
              '<td>${_esc(mm['terms']?.toString()        ?? mm['terms_of_reference']?.toString() ?? '')}</td>'
              '<td>${_esc(mm['output']?.toString()       ?? '')}</td>'
              '</tr>');
        }
        buf.write('</tbody></table></div>');
      }
      return buf.toString();
    } catch (_) {
      return '';
    }
  }

  static String _budgetSection(dynamic materialsRaw, dynamic snacksRaw, String budgetDisplay) {
    double trainingTotal = 0;
    double snacksTotal   = 0;
    String materialsRows = '';
    String snacksRows    = '';

    try {
      if (materialsRaw != null) {
        final List list = materialsRaw is String ? jsonDecode(materialsRaw) : materialsRaw as List;
        for (final item in list) {
          final m   = item as Map;
          final tot = double.tryParse(m['total']?.toString() ?? '0') ?? 0;
          trainingTotal += tot;
          materialsRows += '<tr>'
              '<td>${_esc(m['item']?.toString()     ?? '')}</td>'
              '<td style="text-align:center;">${_esc(m['quantity']?.toString() ?? '')}</td>'
              '<td style="text-align:right;">${m['cost']  ?? ''}</td>'
              '<td style="text-align:right;">${m['total'] ?? ''}</td>'
              '</tr>';
        }
      }
    } catch (_) {}

    try {
      if (snacksRaw != null) {
        final List list = snacksRaw is String ? jsonDecode(snacksRaw) : snacksRaw as List;
        for (final item in list) {
          final m   = item as Map;
          final tot = double.tryParse(m['total']?.toString() ?? '0') ?? 0;
          snacksTotal += tot;
          snacksRows += '<tr>'
              '<td>${_esc(m['item']?.toString()         ?? '')}</td>'
              '<td style="text-align:center;">${_esc(m['participants']?.toString() ?? '')}</td>'
              '<td style="text-align:right;">${m['cost_per_day'] ?? ''}</td>'
              '<td style="text-align:right;">${m['total']        ?? ''}</td>'
              '</tr>';
        }
      }
    } catch (_) {}

    if (materialsRows.isEmpty) {
      materialsRows = '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No items listed.</td></tr>';
    }
    if (snacksRows.isEmpty) {
      snacksRows = '<tr><td colspan="4" style="text-align:center;font-style:italic;color:#666;">No items listed.</td></tr>';
    }

    final grandTotal       = trainingTotal + snacksTotal;
    final totalLabel       = budgetDisplay.isNotEmpty ? budgetDisplay
        : (grandTotal > 0 ? 'P${grandTotal.toStringAsFixed(2)}' : '—');
    final trainingLabel    = trainingTotal > 0 ? trainingTotal.toStringAsFixed(2) : '—';
    final snacksLabel      = snacksTotal   > 0 ? snacksTotal.toStringAsFixed(2)   : '—';

    return '''
<div class="bgt-sub">a. Training Materials</div>
<table class="bgt-table">
  <thead><tr>
    <th>Particulars</th>
    <th style="width:100px;">Quantity</th>
    <th style="width:80px;">Cost</th>
    <th style="width:90px;">Total</th>
  </tr></thead>
  <tbody>
    $materialsRows
    <tr class="sub-row">
      <td colspan="3"><strong>Sub-Total</strong></td>
      <td style="text-align:right;"><strong>$trainingLabel</strong></td>
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
    $snacksRows
    <tr class="sub-row">
      <td colspan="3"><strong>Sub-Total</strong></td>
      <td style="text-align:right;"><strong>$snacksLabel</strong></td>
    </tr>
  </tbody>
</table>

<div class="bgt-sub" style="margin-top:14px;">c. Summary of Expenditures</div>
<table class="bgt-table">
  <tbody>
    <tr>
      <td>1. Training Materials</td>
      <td style="text-align:right;">$trainingLabel</td>
    </tr>
    <tr>
      <td>2. Snacks for Program Partners</td>
      <td style="text-align:right;">$snacksLabel</td>
    </tr>
    <tr>
      <td style="text-align:right;font-weight:bold;border-top:2px solid #000;"><strong>Total</strong></td>
      <td style="text-align:right;font-weight:bold;border-top:2px solid #000;text-decoration:underline;"><strong>$totalLabel</strong></td>
    </tr>
  </tbody>
</table>''';
  }
}
