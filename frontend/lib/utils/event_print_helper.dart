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
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADFCAMAAAAmGE1yAAABgF'
      'BMVEXaJRAlYynm7Nn5pCXeVxDpKRthjmX15Z2zIRH71irgJxj432Dvn2jqVU/oWUnps6A7dU'
      'GmuqSaxZ7lTS8APAJ8p4LxLBv///+91cFwIyODoHtaWlrujm/ulZW9a2t2YxK+bWdOZjeqqq'
      'oA//+qVQ5BbUd///8+gUV/f7//qsa/v38AAH/GOFUAfwC9RTcAAAD7/Pv8GAHxJg/319H56u'
      'b/AAD96wTzt67yRjMBSQPzmIzwOSbxd2nyZlXyWEj0hnfxNBT3xLr0pZn649v0ysUIUwrWOC'
      'nWV0rvqqTWRjXXd2zXZlfbKBb88AH1HAXS5dPalo7vi4PrRgcuZzH92A/sVgv7xw/0UzpId0'
      'yuyK/zGwXzdgvZhHnuaAj0hw1ul3H4qA2St5PZi4RRhlTuJQztbGLuJQ33uAnI2crZNRb2lw'
      '2KqYzwGwb6DgDvJAzUbGPxJA1/AAC11LbsGwbxIgvVTULyIg30clrXVDTuGwXaqaR0pHbvGw'
      'Pco5r9+LHrJwtj/fkQAAAAgHRSTlMd/////1v//wn//P//Ff//////Fv//jgH/Bf8DCwYHBP'
      '//AwEG/wL/BAkEAgkC/wD//v7//gH///7//v7////+/v/+/v/////////////S//////////'
      '/+//+x////////////MP9O//////+Q/2//kAL/ca3/z///T///MP//GafQ7r8AAC83SURBVH'
      'ja1X0He9RIt6YcAZNhwpdv3rzr7pJsyWplyR0dutuhnSMGGwMGBoNJw1/fc06Vsto2YO7u6H'
      'lmAAd1vXVyqpLGf/AzMTHxCv770R8zLv1oFPHfJv6oQF7R0v/88Pb127f/NQ3rDwSEL1p6/H'
      'Lt7du5t2/WfhmRbtOX/1hAaL23R0bmyolnbWTk9o+DIv0gGL9KL9+Wsw97OwKfN/FHAQIL/e'
      'vjN+XiZ27k7z+GKNIPIIf0fq3c/1l7/EOIIl09OaTzYODz4m8/gCjSVZPj+m/lC583t6+eKF'
      'cJZOL6+PijtfIlnrcvrl81EulKddU/XpQv+bx5OD7x8P9HIEiN//F4rXzpZ+7xv12ppEhXRo'
      '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'
      'VORK5CYII=';

  // Kagawaran ng Edukasyon (DepEd) seal (assets/images/kagawaran_seal.png)
  // encoded as base64 data URI. Used in the document header.
  static const _kagawaranDataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANwAAADcCAMAAAAshD+zAAABgF'
      'BMVEUpIFzr26qkKymmU1atlmnVpiCiZSpiIiTeuFLi4edoVlmEd6AvI5hlZZEhISHCvdvVIS'
      'bqzm+rjYrIrZBYM1FUU8JbSi+5kBfCa2upptr/0hs/QJo3O8O/weGdPUB+gMz+/v4hBaITAq'
      'QNAZro6OupqKn9xCtpaGnY2Nd1dXW4uLjHx8iGhoaXl5csJqnY1+koGZkkGaRLR7JaWlpKN4'
      'rUpi7JyOSop9THmk6Jh8o1JpMbE6O2tdiwiFOXls85Na1ZVrdoZbp4dsSKaGzqtytyV3P+xB'
      'aWdWvk4tjPpEvGmyxmZIXJmmW7kk7NuJAyLExXRIltasJHOXdCO671uhXRxq8bE5r51W7YxZ'
      'OOh7CvhmjryHBiXLfUuG9lS3n+1U4SA3G7uuCXdlZ4dbXXpRj1yU9XRHfw1Y+wiTCkemjGuK'
      'vkyIu7lC1uWIewpZSXlrDOJStKSEuomJLk3M2BfcehndKmmqy0JyxjSoOjfFf/0jFCLY3UMz'
      'mLaFThrirKqWxd2l7aAAAAgHRSTlP///////////////////////////////////////////'
      '////////////////////////////////////////////////////////////////////////'
      '///////////////////////////////////////////////////////xUHpOoAADP+SURBVH'
      'ja7X2Hf9pKuja4xY6TTXLK7t77NTwaQCCQQAZkejUYJ+bYce9xix07vZeT5F+/7xRJI1FtJ3'
      'v23t+nezcHG4T1zNvLvOPx/Q++PP8f3HUuLMuKEvZHhcsfVhRFxv+twWHFH42EQqEgXKFgxM'
      '+vCP9NKBSJ+hX83w8c4IoEp0ORHo9PoUdC04D6ZyH8CeDkcBSARcKKPNCnlXAEAEbD8r8/OD'
      'kK/BYJX5IUOEx4NSr/G4PDSjQ4fWUSAMGng9EfyqE/DpwSBaXREZhWSBvsRfrowF4KjDvSPa'
      'L8u4HDfrLqXd7MSVI2xV+k+efTerG4rKe1DmsUDPrlfyNwSmQ60oOfctkpSSdvKyoHlypK7M'
      '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';

  // DepEd MATATAG logo (assets/images/deped_matatag.png) encoded as base64
  // data URI. Used in the document footer.
  static const _depedMatatagDataUri =
      'data:image/png;base64,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'
      'BJRU5ErkJggg==';

  // Bagong Pilipinas logo (assets/images/bagong_pilipinas.png) encoded as
  // base64 data URI. Used in the document footer.
  static const _bagongPilipinasDataUri =
      'data:image/png;base64,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'
      'jk2CkAAAAASUVORK5CYII=';

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

    final methodologyRows = _buildMethodologyRows(event['phase1'], event['phase2'], event['phase3']);

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

var DOC_FILENAME     = '$fileSafeTitle.pdf';
var LOGO_DATA_URI    = '$_logoDataUri';
var MATATAG_DATA_URI = '$_depedMatatagDataUri';
var BAGONG_DATA_URI  = '$_bagongPilipinasDataUri';

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
  <span style="margin-right:8px;">Event Proposal — $title</span>
  <button class="print-btn" onclick="window.print()">&#128438;&nbsp;Print</button>
  <button class="download-btn" onclick="downloadDoc()">&#11015;&nbsp;Download</button>
</div>

<!-- ╔══════════════════════════════════════════════╗
     ║  PAGE FOOTER  (fixed – repeats every page)  ║
     ╚══════════════════════════════════════════════╝ -->
<div class="page-footer">
  <!-- Three logos matching the DepEd footer: MATATAG | school seal | BAGONG PILIPINAS -->
  <div style="display:flex;align-items:center;gap:5px;">
    <img src="$_depedMatatagDataUri" style="height:28px;" alt="DepEd MATATAG">
    <img src="$_logoDataUri" style="height:28px;" alt="NCS II Seal">
    <img src="$_bagongPilipinasDataUri" style="height:28px;" alt="Bagong Pilipinas">
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
  <img src="$_kagawaranDataUri" class="seal" alt="Kagawaran ng Edukasyon Seal">
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
    $methodologyRows
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
    <img src="$_kagawaranDataUri" class="seal" alt="Kagawaran ng Edukasyon Seal">
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

  static String _buildMethodologyRows(dynamic phase1Raw, dynamic phase2Raw, dynamic phase3Raw) {
    if (phase1Raw != null) {
      try {
        final decoded = jsonDecode(phase1Raw.toString());
        if (decoded is List && decoded.isNotEmpty) {
          final buf = StringBuffer();
          for (var i = 0; i < decoded.length; i++) {
            final m = decoded[i] as Map;
            final activities = _esc((m['activities'] ?? '').toString()).replaceAll('\n', '<br>');
            buf.write('<tr>'
                '<td class="phase-lbl"><strong>Phase ${i + 1}</strong></td>'
                '<td>${_esc((m['stage'] ?? '').toString())}</td>'
                '<td>$activities</td>'
                '</tr>');
          }
          return buf.toString();
        }
      } catch (_) {}
    }
    // Legacy fallback: plain-text phase1/phase2/phase3 with fixed stage names
    final p1 = _esc((phase1Raw ?? 'Planning\nRecruitment of participants').toString()).replaceAll('\n', '<br>');
    final p2 = _esc((phase2Raw ?? 'Training-workshop sessions').toString()).replaceAll('\n', '<br>');
    final p3 = _esc((phase3Raw ?? 'Selection of staff\nEvaluation of the activity').toString()).replaceAll('\n', '<br>');
    return '<tr><td class="phase-lbl"><strong>Phase 1</strong></td><td>Pre-Implementation Stage</td><td>$p1</td></tr>'
        '<tr><td class="phase-lbl"><strong>Phase 2</strong></td><td>Implementation</td><td>$p2</td></tr>'
        '<tr><td class="phase-lbl"><strong>Phase 3</strong></td><td>Post-Implementation</td><td>$p3</td></tr>';
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
