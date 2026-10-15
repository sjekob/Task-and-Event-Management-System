import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../models/deped_calendar.dart';
import '../theme/app_theme.dart';

/// The one month calendar used across TaskNet (dashboard, Events page, the
/// expanded calendar). Layout: "Month YYYY" title (tap → month/year picker)
/// with prev/next arrows, S–S weekday row, rounded-square day cells — today
/// filled dark, the selected day filled blue — a blue dot for days with
/// events, an amber dot for task deadlines, a violet dot for official DepEd
/// calendar dates, and a legend.
///
/// Controlled: the caller owns [month] and [selectedDay].
class AppCalendar extends StatelessWidget {
  /// Any day in the month to show.
  final DateTime month;
  final ValueChanged<DateTime> onMonthChanged;
  final DateTime? selectedDay;
  final ValueChanged<DateTime>? onDaySelected;
  /// Days (date-only) that have events → blue dot.
  final Set<DateTime> eventDays;
  /// Days with open task deadlines → amber dot. Null hides it from the legend.
  final Set<DateTime>? deadlineDays;
  /// Days covered by DepEd memorandum entries → violet dot ("DepEd Memo").
  final Set<DateTime>? depedDays;
  /// Hover text for a day, or null for none.
  final String? Function(DateTime day)? tooltipFor;
  /// Extra header buttons after the arrows (e.g. expand / collapse).
  final List<AppCalendarAction> actions;
  /// Caps the row height when the calendar is wide; null keeps cells square.
  final double? maxCellHeight;
  /// Wrap in the standard white card. Off when embedded in another card.
  final bool card;

  const AppCalendar({
    super.key,
    required this.month,
    required this.onMonthChanged,
    this.selectedDay,
    this.onDaySelected,
    this.eventDays = const {},
    this.deadlineDays,
    this.depedDays,
    this.tooltipFor,
    this.actions = const [],
    this.maxCellHeight,
    this.card = true,
  });

  static const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  static const _weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  static DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  void _shift(int months) => onMonthChanged(DateTime(month.year, month.month + months, 1));

  Future<void> _pickMonth(BuildContext context) async {
    final picked = await showDialog<DateTime>(
      context: context,
      builder: (_) => _MonthPicker(initial: month),
    );
    if (picked != null) onMonthChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    final content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
          child: Align(
            alignment: Alignment.centerLeft,
            child: InkWell(
              onTap: () => _pickMonth(context),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Flexible(
                    child: Text('${monthNames[month.month - 1]} ${month.year}',
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 15, fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary)),
                  ),
                  const Icon(Icons.arrow_drop_down_rounded, size: 20, color: AppTheme.textMuted),
                ]),
              ),
            ),
          ),
        ),
        _HeaderButton(icon: Icons.chevron_left_rounded, tooltip: 'Previous month',
            onTap: () => _shift(-1)),
        _HeaderButton(icon: Icons.chevron_right_rounded, tooltip: 'Next month',
            onTap: () => _shift(1)),
        for (final a in actions) _HeaderButton(icon: a.icon, tooltip: a.tooltip, onTap: a.onTap),
      ]),
      const SizedBox(height: 10),
      Row(children: [
        for (final d in _weekdays)
          Expanded(
            child: Center(
              child: Text(d,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textLight)),
            ),
          ),
      ]),
      const SizedBox(height: 4),
      GestureDetector(
        // Swipe the grid to change month.
        onHorizontalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (v.abs() > 250) _shift(v < 0 ? 1 : -1);
        },
        child: LayoutBuilder(builder: (context, c) {
          final cellW = c.maxWidth / 7;
          final cellH = maxCellHeight == null ? cellW : cellW.clamp(0.0, maxCellHeight!);
          return _grid(cellH, large: cellH >= 52);
        }),
      ),
      const SizedBox(height: 8),
      Wrap(spacing: 16, runSpacing: 4, children: [
        _legend(AppTheme.accentBlue, 'Event'),
        if (deadlineDays != null) _legend(AppTheme.amberColor, 'Task deadline'),
        if (depedDays != null) _legend(DepedEntry.color, 'DepEd Memo'),
      ]),
    ]);
    if (!card) return content;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: appCardDecoration,
      child: content,
    );
  }

  Widget _grid(double cellH, {required bool large}) {
    final first = DateTime(month.year, month.month, 1);
    final lead = first.weekday % 7;
    final days = DateTime(month.year, month.month + 1, 0).day;
    final weeks = ((lead + days) / 7).ceil();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final selected = selectedDay == null ? null : dateOnly(selectedDay!);
    return Column(children: [
      for (var w = 0; w < weeks; w++)
        SizedBox(
          height: cellH,
          child: Row(children: [
            for (var i = 0; i < 7; i++)
              Expanded(child: () {
                final day = w * 7 + i - lead + 1;
                if (day < 1 || day > days) return const SizedBox();
                final date = DateTime(month.year, month.month, day);
                return _cell(date,
                    isToday: date == today, isSelected: date == selected, large: large);
              }()),
          ]),
        ),
    ]);
  }

  Widget _cell(DateTime date, {required bool isToday, required bool isSelected, required bool large}) {
    final hasEvent = eventDays.contains(date);
    final hasDeadline = deadlineDays?.contains(date) ?? false;
    final hasDeped = depedDays?.contains(date) ?? false;
    final filled = isSelected || isToday;
    final bg = isSelected ? AppTheme.accentBlue : isToday ? AppTheme.darkBanner : Colors.transparent;
    // Dots stay visible on the blue selected fill.
    final eventDot = isSelected ? Colors.white : AppTheme.accentBlue;
    Widget cell = AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      margin: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text('${date.day}',
            style: GoogleFonts.plusJakartaSans(
                fontSize: large ? 14 : 12,
                fontWeight: filled ? FontWeight.w700 : FontWeight.w500,
                color: filled ? Colors.white : AppTheme.textPrimary)),
        const SizedBox(height: 3),
        SizedBox(
          height: 5,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (final c in [
              if (hasEvent) eventDot,
              if (hasDeadline) AppTheme.amberColor,
              if (hasDeped) isSelected ? const Color(0xFFDDD6FE) : DepedEntry.color,
            ].indexed) ...[
              if (c.$1 > 0) const SizedBox(width: 3),
              _Dot(c.$2),
            ],
          ]),
        ),
      ]),
    );
    if (onDaySelected != null) {
      cell = InkWell(
        onTap: () => onDaySelected!(date),
        borderRadius: BorderRadius.circular(8),
        child: cell,
      );
    }
    final tip = tooltipFor?.call(date);
    if (tip != null && tip.isNotEmpty) {
      cell = Tooltip(
        message: tip,
        waitDuration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: AppTheme.darkBanner, borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(color: Colors.white, fontSize: 11.5, height: 1.4),
        child: cell,
      );
    }
    return cell;
  }

  Widget _legend(Color c, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
        _Dot(c),
        const SizedBox(width: 6),
        Text(label, style: AppTheme.caption),
      ]);
}

/// The dashboard card look shared by calendar surfaces.
final appCardDecoration = BoxDecoration(
  color: AppTheme.cardColor,
  borderRadius: BorderRadius.circular(14),
  border: Border.all(color: const Color(0xFFE3E9F3)),
  boxShadow: [
    BoxShadow(
        color: const Color(0xFF1A1A2E).withValues(alpha: 0.04),
        blurRadius: 6,
        offset: const Offset(0, 2)),
  ],
);

class AppCalendarAction {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  const AppCalendarAction({required this.icon, required this.tooltip, required this.onTap});
}

class _HeaderButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  const _HeaderButton({required this.icon, required this.tooltip, required this.onTap});

  @override
  Widget build(BuildContext context) => IconButton(
        onPressed: onTap,
        tooltip: tooltip,
        icon: Icon(icon, size: 20, color: AppTheme.textMuted),
        visualDensity: VisualDensity.compact,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      );
}

class _Dot extends StatelessWidget {
  final Color color;
  const _Dot(this.color);

  @override
  Widget build(BuildContext context) => Container(
        width: 5,
        height: 5,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

/// Month + year picker in the calendar's style: year arrows over 12 months.
class _MonthPicker extends StatefulWidget {
  final DateTime initial;
  const _MonthPicker({required this.initial});

  @override
  State<_MonthPicker> createState() => _MonthPickerState();
}

class _MonthPickerState extends State<_MonthPicker> {
  late int _year = widget.initial.year;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return Dialog(
      backgroundColor: AppTheme.cardColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 340),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              _HeaderButton(
                  icon: Icons.chevron_left_rounded, tooltip: 'Previous year',
                  onTap: () => setState(() => _year--)),
              Expanded(
                child: Text('$_year',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              ),
              _HeaderButton(
                  icon: Icons.chevron_right_rounded, tooltip: 'Next year',
                  onTap: () => setState(() => _year++)),
            ]),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 6,
              crossAxisSpacing: 6,
              childAspectRatio: 2.4,
              children: [
                for (var m = 1; m <= 12; m++) _month(m, now),
              ],
            ),
          ]),
        ),
      ),
    );
  }

  Widget _month(int m, DateTime now) {
    final current = _year == widget.initial.year && m == widget.initial.month;
    final thisMonth = _year == now.year && m == now.month;
    return Material(
      color: current ? AppTheme.darkBanner : Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: thisMonth && !current
            ? const BorderSide(color: AppTheme.accentBlue)
            : BorderSide.none,
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => Navigator.pop(context, DateTime(_year, m)),
        child: Center(
          child: Text(AppCalendar.monthNames[m - 1].substring(0, 3),
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: current ? FontWeight.w700 : FontWeight.w500,
                  color: current ? Colors.white : AppTheme.textPrimary)),
        ),
      ),
    );
  }
}
