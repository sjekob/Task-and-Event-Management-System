import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../models/deped_calendar.dart';
import '../theme/app_theme.dart';
import 'app_calendar.dart';
import '../utils/date_parse.dart';

/// Expanded, interactive event calendar: the shared [AppCalendar] grid (event
/// dots per day, month/year picker, swipe or arrows to page) with the events of the
/// shown month — or of the tapped day — listed underneath as cards
/// (date | time, title, venue, status).
///
/// [events] are raw event rows from the API; each is placed by `target_date`
/// and shows its `venue`. Times come from the event's Activity Matrix rows.
class EventCalendarView extends StatefulWidget {
  final List<Map<String, dynamic>> events;
  /// Official DepEd calendar dates, shown alongside with a "DepEd Memo" tag.
  final List<DepedEntry> depedEntries;

  /// Month to open on; also pre-selects that day when [selectInitialDay].
  final DateTime? initialDay;
  final bool selectInitialDay;
  final ValueChanged<Map<String, dynamic>>? onOpenEvent;
  final VoidCallback? onCollapse;

  const EventCalendarView({
    super.key,
    required this.events,
    this.depedEntries = const [],
    this.initialDay,
    this.selectInitialDay = false,
    this.onOpenEvent,
    this.onCollapse,
  });

  @override
  State<EventCalendarView> createState() => _EventCalendarViewState();
}

const _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
const _monthsShort = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'June',
  'July',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec'
];

DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

/// Status → (label, colour) for dots and pills.
(String, Color) _status(Map<String, dynamic> e) =>
    switch ((e['status'] ?? '').toString()) {
      'approved' => ('Approved', AppTheme.greenColor),
      'pending_approval' => ('Pending', AppTheme.amberColor),
      'draft' => ('Draft', AppTheme.textMuted),
      'disabled' => ('Disabled', AppTheme.redColor),
      _ => ('Event', AppTheme.accentBlue),
    };

// ── Activity-matrix times ("4:00-5:00 PM") → "16:00 - 17:00" ────────────────

final _clock = RegExp(r'^(\d{1,2})(?:[:.](\d{2}))?\s*(?:([ap])\.?\s*m\.?)?$',
    caseSensitive: false);

/// (start, end) minutes since midnight, mirroring the backend's parser.
(int, int)? _parseRange(String? text) {
  if (text == null || text.trim().isEmpty) return null;
  final parts = text
      .trim()
      .split(RegExp(r'\s*(?:-|–|—|\bto\b)\s*', caseSensitive: false));
  if (parts.length != 2) return null;
  final a = _clock.firstMatch(parts[0].trim()),
      b = _clock.firstMatch(parts[1].trim());
  if (a == null || b == null) return null;
  int to24(int h, String? mer) =>
      mer == null ? h : h % 12 + (mer == 'p' ? 12 : 0);
  final merA = a.group(3)?.toLowerCase(),
      merB = b.group(3)?.toLowerCase() ?? merA;
  final ha = int.parse(a.group(1)!), hb = int.parse(b.group(1)!);
  final ma = int.parse(a.group(2) ?? '0'), mb = int.parse(b.group(2) ?? '0');
  var start = to24(ha, merA ?? merB) * 60 + ma;
  final end = to24(hb, merB) * 60 + mb;
  if (merA == null && merB != null && start > end) {
    start = to24(ha, merB == 'p' ? 'a' : 'p') * 60 + ma;
  }
  return start < end && end <= 24 * 60 ? (start, end) : null;
}

/// Earliest start to latest end across the event's activities on [date].
(int, int)? _eventTimes(Map<String, dynamic> e, DateTime date) {
  List rows;
  try {
    final decoded = jsonDecode((e['activity_matrix'] ?? '[]').toString());
    rows = decoded is List ? decoded : const [];
  } catch (_) {
    return null;
  }
  int? start, end;
  for (final r in rows.whereType<Map>()) {
    final rowDay = parseEventDate(r['day']?.toString());
    if (rowDay != null && _day(rowDay) != date) continue;
    final span = _parseRange(r['time']?.toString());
    if (span == null) continue;
    start = start == null || span.$1 < start ? span.$1 : start;
    end = end == null || span.$2 > end ? span.$2 : end;
  }
  return start == null ? null : (start, end!);
}

String _hm(int minutes) =>
    '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';

class _Entry {
  final Map<String, dynamic> event;
  final DateTime date;
  final (int, int)? times;
  _Entry(this.event, this.date) : times = _eventTimes(event, date);

  String get title => (event['title'] ?? 'Untitled event').toString();
  String get venue => (event['venue'] ?? '').toString().trim();
  String get when {
    final d = '${_monthsShort[date.month - 1]} ${date.day}, ${date.year}';
    final t = times;
    return t == null ? d : '$d | ${_hm(t.$1)} - ${_hm(t.$2)}';
  }
}

class _EventCalendarViewState extends State<EventCalendarView> {
  late DateTime _focused;
  DateTime? _selected;
  late Map<DateTime, List<_Entry>> _byDay;
  Map<DateTime, List<DepedEntry>> _depedByDay = {};

  @override
  void initState() {
    super.initState();
    final start = widget.initialDay ?? DateTime.now();
    _focused = _day(start);
    if (widget.selectInitialDay && widget.initialDay != null) {
      _selected = _day(start);
    }
    _index();
  }

  @override
  void didUpdateWidget(EventCalendarView old) {
    super.didUpdateWidget(old);
    if (!identical(old.events, widget.events) ||
        !identical(old.depedEntries, widget.depedEntries)) {
      _index();
    }
  }

  void _index() {
    final map = <DateTime, List<_Entry>>{};
    for (final e in widget.events) {
      final d = parseEventDate(e['target_date']?.toString());
      if (d == null) continue; // undated events can't be placed on the grid
      final key = _day(d);
      (map[key] ??= []).add(_Entry(e, key));
    }
    for (final list in map.values) {
      list.sort((a, b) => (a.times?.$1 ?? -1).compareTo(b.times?.$1 ?? -1));
    }
    _byDay = map;
    _depedByDay = DepedEntry.byDay(widget.depedEntries);
  }

  /// DepEd entries for the list: covering the selected day, or overlapping
  /// the shown month.
  List<DepedEntry> get _visibleDeped {
    final sel = _selected;
    if (sel != null) return _depedByDay[sel] ?? const [];
    final first = DateTime(_focused.year, _focused.month, 1);
    final last = DateTime(_focused.year, _focused.month + 1, 0);
    return widget.depedEntries
        .where((e) => !e.end.isBefore(first) && !e.start.isAfter(last))
        .toList()
      ..sort((a, b) => a.start.compareTo(b.start));
  }

  List<_Entry> get _visible {
    if (_selected != null) return _byDay[_selected] ?? const [];
    final keys = _byDay.keys
        .where((d) => d.year == _focused.year && d.month == _focused.month)
        .toList()
      ..sort();
    return [for (final k in keys) ..._byDay[k]!];
  }

  void _goToMonth(DateTime month) => setState(() {
        _focused = DateTime(month.year, month.month, 1);
        _selected = null;
      });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final wide = c.maxWidth >= 900;
      final mobile = c.maxWidth < 600;
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _calendarPanel(wide: wide, mobile: mobile),
        const SizedBox(height: 18),
        _listHeader(),
        const SizedBox(height: 12),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          switchInCurve: Curves.easeOut,
          transitionBuilder: (child, anim) => FadeTransition(
            opacity: anim,
            child: SizeTransition(
                sizeFactor: anim, axisAlignment: -1, child: child),
          ),
          child: KeyedSubtree(
            key: ValueKey('${_focused.year}-${_focused.month}-$_selected'),
            child: _list(c.maxWidth, wide: wide),
          ),
        ),
      ]);
    });
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  String? _tooltip(DateTime day) {
    final parts = [
      for (final d in _depedByDay[day] ?? const <DepedEntry>[])
        'DepEd Memo · ${d.category}\n${d.title}\n${d.rangeLabel}',
      for (final e in _byDay[day] ?? const <_Entry>[])
        [e.title, 'When: ${e.when}', if (e.venue.isNotEmpty) 'Where: ${e.venue}'].join('\n'),
    ];
    return parts.isEmpty ? null : parts.join('\n\n');
  }

  Widget _calendarPanel({required bool wide, required bool mobile}) => AppCalendar(
        month: _focused,
        // Taller rows on wide screens; still at least 44px tall on phones.
        maxCellHeight: wide ? 72 : 56,
        onMonthChanged: _goToMonth,
        selectedDay: _selected,
        onDaySelected: (d) => setState(() {
          // Tap the selected day again to go back to the whole month.
          _selected = _selected == d ? null : d;
          _focused = d;
        }),
        eventDays: _byDay.keys.toSet(),
        depedDays: _depedByDay.keys.toSet(),
        tooltipFor: _tooltip,
        actions: [
          AppCalendarAction(
              icon: Icons.today_rounded,
              tooltip: 'Today',
              onTap: () => setState(() {
                    final now = DateTime.now();
                    _focused = _day(now);
                    _selected = _day(now);
                  })),
          if (widget.onCollapse != null)
            AppCalendarAction(
                icon: Icons.close_fullscreen_rounded,
                tooltip: 'Collapse calendar',
                onTap: widget.onCollapse!),
        ],
      );

  // ── Event list ─────────────────────────────────────────────────────────────

  Widget _listHeader() {
    final sel = _selected;
    final label = sel == null
        ? 'Events in ${_months[_focused.month - 1]} ${_focused.year}'
        : 'Events on ${_monthsShort[sel.month - 1]} ${sel.day}, ${sel.year}';
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 10,
      runSpacing: 6,
      children: [
        Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary)),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
              color: AppTheme.blueBg, borderRadius: BorderRadius.circular(20)),
          child: Text('${_visible.length + _visibleDeped.length}',
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.accentBlue)),
        ),
        if (sel != null)
          ActionChip(
            avatar: const Icon(Icons.calendar_view_month_rounded, size: 16),
            label: const Text('Whole month'),
            onPressed: () => setState(() => _selected = null),
          ),
      ],
    );
  }

  Widget _list(double width, {required bool wide}) {
    final items = _visible;
    final deped = _visibleDeped;
    if (items.isEmpty && deped.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
        decoration: BoxDecoration(
            color: AppTheme.cardColor, borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          const Icon(Icons.event_busy_outlined,
              size: 32, color: AppTheme.textLight),
          const SizedBox(height: 8),
          Text(
              _selected == null
                  ? 'No events this month.'
                  : 'No events on this day.',
              style: AppTheme.bodySm),
        ]),
      );
    }
    final cols = wide
        ? 3
        : width >= 600
            ? 2
            : 1;
    const gap = 12.0;
    final cardWidth = (width - gap * (cols - 1)) / cols;
    return Wrap(
      spacing: gap,
      runSpacing: gap,
      children: [
        // Official DepEd dates first, then the school's own events.
        for (final d in deped) SizedBox(width: cardWidth, child: _depedCard(d)),
        for (final e in items) SizedBox(width: cardWidth, child: _card(e)),
      ],
    );
  }

  Widget _depedCard(DepedEntry d) {
    return Container(
      constraints: const BoxConstraints(minHeight: 88),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: const BoxDecoration(
            border: Border(left: BorderSide(color: DepedEntry.color, width: 4))),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.event_note_rounded, size: 14, color: AppTheme.textMuted),
            const SizedBox(width: 6),
            Expanded(
              child: Text(d.rangeLabel,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textMuted)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                  color: DepedEntry.bg, borderRadius: BorderRadius.circular(20)),
              child: const Text('DepEd Memo',
                  style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w700, color: DepedEntry.color)),
            ),
          ]),
          const SizedBox(height: 6),
          Text(d.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          const SizedBox(height: 4),
          Text(d.isMandatory ? '${d.category} · Mandatory' : d.category,
              style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textMuted)),
        ]),
      ),
    );
  }

  Widget _card(_Entry e) {
    final (label, color) = _status(e.event);
    return Material(
      color: AppTheme.cardColor,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: widget.onOpenEvent == null
            ? null
            : () => widget.onOpenEvent!(e.event),
        child: Container(
          constraints: const BoxConstraints(minHeight: 88),
          decoration: BoxDecoration(
              border: Border(left: BorderSide(color: color, width: 4))),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.schedule_rounded,
                  size: 14, color: AppTheme.textMuted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(e.when,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textMuted)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20)),
                child: Text(label,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: color)),
              ),
            ]),
            const SizedBox(height: 6),
            Text(e.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary)),
            if (e.venue.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.place_outlined,
                    size: 14, color: AppTheme.textMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(e.venue,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 13, color: AppTheme.textMuted)),
                ),
              ]),
            ],
          ]),
        ),
      ),
    );
  }
}
