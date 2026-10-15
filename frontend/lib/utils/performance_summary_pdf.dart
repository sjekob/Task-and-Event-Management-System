import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Builds and downloads the "Annual Faculty Performance Summary" PDF from the
/// payload of GET /api/appraisal/performance-summary.
class PerformanceSummaryPdf {
  static const _note =
      'Aggregated from all event and special task appraisals. '
      'Ready for DepEd Annual Faculty Performance Evaluation.';

  static Future<void> export(Map<String, dynamic> data) async {
    final bytes = await build(data);
    final sy = (data['school_year'] ?? '').toString().replaceAll(RegExp(r'[^0-9A-Za-z-]'), '_');
    await Printing.sharePdf(
      bytes: bytes,
      filename: 'Annual_Faculty_Performance_Summary${sy.isEmpty ? '' : '_$sy'}.pdf',
    );
  }

  static String _fmt(num? v, {int digits = 2, String suffix = ''}) =>
      v == null ? '—' : '${v.toStringAsFixed(digits)}$suffix';

  static String _stamp(DateTime d) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final m = d.minute.toString().padLeft(2, '0');
    return '${months[d.month - 1]} ${d.day}, ${d.year} $h:$m ${d.hour >= 12 ? 'PM' : 'AM'}';
  }

  static Future<Uint8List> build(Map<String, dynamic> data) async {
    final regular = await PdfGoogleFonts.notoSansRegular();
    final bold = await PdfGoogleFonts.notoSansBold();
    final doc = pw.Document(theme: pw.ThemeData.withFont(base: regular, bold: bold));

    pw.MemoryImage? seal;
    try {
      seal = pw.MemoryImage((await rootBundle.load('assets/images/kagawaran_seal.png'))
          .buffer.asUint8List());
    } catch (_) {}

    final rows = (data['rows'] as List? ?? []).cast<Map<String, dynamic>>();
    final school = (data['school_name'] ?? '').toString();
    final station = (data['station_id'] ?? '').toString();
    final division = (data['division'] ?? '').toString();
    final sy = (data['school_year'] ?? '').toString();
    final exported = _stamp(DateTime.now());

    const headers = ['No.', 'Employee Name', 'Position / Title', 'Subject / Department',
        'Special Task Score', 'Event Evaluation Score', 'Report Timing Points',
        'Total Appraisal Points', 'Overall Grade', 'Escalation Count', 'Remarks / Status'];

    final table = rows.isEmpty
        ? pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 24),
            child: pw.Center(child: pw.Text('No personnel appraisal records for this school year.')))
        : pw.TableHelper.fromTextArray(
            headers: headers,
            data: [
              for (var i = 0; i < rows.length; i++)
                [
                  '${i + 1}',
                  (rows[i]['name'] ?? '').toString(),
                  (rows[i]['position'] ?? '—').toString(),
                  (rows[i]['department'] ?? '—').toString(),
                  _fmt(rows[i]['special_task_score'] as num?, suffix: ' / 5'),
                  _fmt(rows[i]['event_score'] as num?, digits: 1, suffix: '%'),
                  '${rows[i]['timing_points'] ?? 0}',
                  _fmt(rows[i]['total_points'] as num?),
                  (rows[i]['overall_grade'] ?? '—').toString(),
                  '${rows[i]['escalation_count'] ?? 0}',
                  (rows[i]['remarks'] ?? '—').toString(),
                ],
            ],
            headerStyle: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
            cellStyle: const pw.TextStyle(fontSize: 8),
            headerDecoration: const pw.BoxDecoration(color: PdfColors.grey300),
            border: pw.TableBorder.all(color: PdfColors.grey600, width: 0.5),
            cellAlignments: {
              0: pw.Alignment.center, 4: pw.Alignment.center, 5: pw.Alignment.center,
              6: pw.Alignment.center, 7: pw.Alignment.center, 8: pw.Alignment.center,
              9: pw.Alignment.center, 10: pw.Alignment.center,
            },
            columnWidths: {
              0: const pw.FixedColumnWidth(26),
              1: const pw.FlexColumnWidth(2.6),
              2: const pw.FlexColumnWidth(1.5),
              3: const pw.FlexColumnWidth(1.6),
              4: const pw.FlexColumnWidth(1.2),
              5: const pw.FlexColumnWidth(1.3),
              6: const pw.FlexColumnWidth(1.2),
              7: const pw.FlexColumnWidth(1.3),
              8: const pw.FlexColumnWidth(1.7),
              9: const pw.FlexColumnWidth(1.1),
              10: const pw.FlexColumnWidth(1.3),
            },
          );

    pw.Widget sign(String role) => pw.Expanded(
          child: pw.Column(children: [
            pw.Container(height: 34),
            pw.Container(
                margin: const pw.EdgeInsets.symmetric(horizontal: 24),
                decoration: const pw.BoxDecoration(
                    border: pw.Border(top: pw.BorderSide(width: 0.7)))),
            pw.SizedBox(height: 3),
            pw.Text('Signature over Printed Name', style: const pw.TextStyle(fontSize: 7)),
            pw.SizedBox(height: 4),
            pw.Text(role, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
          ]),
        );

    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      margin: const pw.EdgeInsets.fromLTRB(28, 24, 28, 28),
      header: (ctx) => ctx.pageNumber > 1
          ? pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 8),
              child: pw.Text('Annual Faculty Performance Summary${sy.isEmpty ? '' : ' — S.Y. $sy'}',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)))
          : pw.SizedBox(),
      build: (ctx) => [
        pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
          if (seal != null) pw.Image(seal, width: 52, height: 52) else pw.SizedBox(width: 52),
          pw.Expanded(
            child: pw.Column(children: [
              pw.Text('Republic of the Philippines', style: const pw.TextStyle(fontSize: 9)),
              pw.Text('Department of Education',
                  style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
              pw.Text(division, style: const pw.TextStyle(fontSize: 9)),
              pw.SizedBox(height: 4),
              pw.Text(school.toUpperCase(),
                  style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
              pw.Text('School ID / Station ID: ${station.isEmpty ? '____________' : station}',
                  style: const pw.TextStyle(fontSize: 9)),
            ]),
          ),
          pw.SizedBox(width: 52),
        ]),
        pw.SizedBox(height: 12),
        pw.Center(
          child: pw.Text('ANNUAL FACULTY PERFORMANCE SUMMARY',
              style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
        ),
        pw.Center(
          child: pw.Text('School Year ${sy.isEmpty ? '—' : sy}',
              style: const pw.TextStyle(fontSize: 10)),
        ),
        pw.SizedBox(height: 12),
        table,
        pw.SizedBox(height: 10),
        pw.Text('Note: $_note', style: pw.TextStyle(fontSize: 8, fontStyle: pw.FontStyle.italic)),
        pw.SizedBox(height: 18),
        pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          sign('Prepared by'),
          sign('Recommending Approval'),
          sign('Approved by'),
        ]),
      ],
      footer: (ctx) => pw.Padding(
        padding: const pw.EdgeInsets.only(top: 6),
        child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Text('Exported: $exported', style: const pw.TextStyle(fontSize: 8)),
          pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
              style: const pw.TextStyle(fontSize: 8)),
        ]),
      ),
    ));

    return doc.save();
  }
}
