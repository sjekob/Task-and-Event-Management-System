import 'package:flutter/material.dart';

/// One entry of the official DepEd school calendar (memorandum dates).
class DepedEntry {
  final int id;
  final String title;
  final String? description;
  final DateTime start;
  final DateTime end;
  final String category;
  final bool isMandatory;

  const DepedEntry({
    required this.id,
    required this.title,
    this.description,
    required this.start,
    required this.end,
    required this.category,
    required this.isMandatory,
  });

  /// Distinct colour for DepEd baseline dates on every calendar.
  static const color = Color(0xFF7C3AED);
  static const bg = Color(0xFFEDE9FE);

  static const categories = [
    'Mandatory Examination', 'Quarter Compliance', 'Holiday', 'Administrative Period',
  ];

  factory DepedEntry.fromJson(Map<String, dynamic> j) {
    final start = DateTime.parse(j['start_date'].toString());
    return DepedEntry(
      id: j['id'] as int,
      title: (j['title'] ?? '').toString(),
      description: j['description']?.toString(),
      start: start,
      end: DateTime.tryParse((j['end_date'] ?? '').toString()) ?? start,
      category: (j['category'] ?? '').toString(),
      isMandatory: j['is_mandatory'] == true,
    );
  }

  /// Every calendar day the entry covers (date-only).
  Iterable<DateTime> get days sync* {
    for (var d = DateTime(start.year, start.month, start.day);
        !d.isAfter(end);
        d = DateTime(d.year, d.month, d.day + 1)) {
      yield d;
    }
  }

  bool covers(DateTime day) {
    final d = DateTime(day.year, day.month, day.day);
    return !d.isBefore(DateTime(start.year, start.month, start.day)) &&
        !d.isAfter(DateTime(end.year, end.month, end.day));
  }

  static String _iso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  String get startIso => _iso(start);
  String get endIso => _iso(end);

  /// "Dec 16 – 17, 2026" / "Dec 19, 2026 – Jan 3, 2027" / "Nov 30, 2026".
  String get rangeLabel {
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final s = '${m[start.month - 1]} ${start.day}';
    if (_iso(start) == _iso(end)) return '$s, ${start.year}';
    if (start.year == end.year && start.month == end.month) return '$s – ${end.day}, ${end.year}';
    if (start.year == end.year) return '$s – ${m[end.month - 1]} ${end.day}, ${end.year}';
    return '$s, ${start.year} – ${m[end.month - 1]} ${end.day}, ${end.year}';
  }

  /// Day → entries lookup for calendars.
  static Map<DateTime, List<DepedEntry>> byDay(List<DepedEntry> entries) {
    final map = <DateTime, List<DepedEntry>>{};
    for (final e in entries) {
      for (final d in e.days) {
        (map[d] ??= []).add(e);
      }
    }
    return map;
  }
}
