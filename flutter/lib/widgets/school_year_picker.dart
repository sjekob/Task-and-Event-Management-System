import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// Chooses which school year (optionally a term) a list shows. Lists default to
/// the current school year; ended years are "archived" and viewable here.
/// Renders nothing until the principal has set up at least one school year.
class SchoolYearPicker extends StatefulWidget {
  final SchoolYearFilter value;
  final ValueChanged<SchoolYearFilter> onChanged;
  final bool includeTerms;
  const SchoolYearPicker({super.key, required this.value, required this.onChanged,
      this.includeTerms = false});

  @override
  State<SchoolYearPicker> createState() => _SchoolYearPickerState();
}

class _SchoolYearPickerState extends State<SchoolYearPicker> {
  List<SchoolYear> _years = [];

  @override
  void initState() {
    super.initState();
    ApiService.getSchoolYears().then((y) {
      if (mounted) setState(() => _years = y);
    }).catchError((_) {});
  }

  String _key(SchoolYearFilter f) => '${f.schoolYear}|${f.termId ?? ''}';

  @override
  Widget build(BuildContext context) {
    if (_years.isEmpty) return const SizedBox.shrink();
    final current = _years.where((y) => y.isDefault).firstOrNull;
    final options = <String, (SchoolYearFilter, String, String?)>{};
    void add(SchoolYearFilter f, String label, [String? note]) => options[_key(f)] = (f, label, note);

    add(SchoolYearFilter.current, current != null ? 'S.Y. ${current.name}' : 'Current school year',
        current != null ? 'Current' : null);
    for (final y in _years) {
      if (y.id != current?.id) {
        add(SchoolYearFilter(schoolYear: '${y.id}'), 'S.Y. ${y.name}',
            y.status == 'archived' ? 'Archived' : y.status == 'upcoming' ? 'Upcoming' : null);
      }
      if (widget.includeTerms) {
        for (final t in y.terms) {
          add(SchoolYearFilter(schoolYear: '${y.id}', termId: t.id), '   ${t.name} · ${y.name}',
              t.status == 'current' ? 'Now' : null);
        }
      }
    }
    add(const SchoolYearFilter(schoolYear: 'all'), 'All school years');

    final selected = options.containsKey(_key(widget.value)) ? _key(widget.value) : _key(SchoolYearFilter.current);
    final archived = options[selected]!.$3 == 'Archived';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: archived ? AppTheme.amberBg : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: archived ? AppTheme.amberColor : Colors.grey.shade300),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: selected,
          isDense: true,
          borderRadius: BorderRadius.circular(10),
          icon: const Icon(Icons.expand_more_rounded, size: 18),
          selectedItemBuilder: (_) => options.values.map((o) => Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(archived ? Icons.inventory_2_outlined : Icons.event_note_outlined,
                    size: 16, color: archived ? const Color(0xFF92400E) : AppTheme.textMuted),
                const SizedBox(width: 8),
                Text(o.$2.trim(), style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
                if (o.$3 != null) ...[
                  const SizedBox(width: 6),
                  Text('· ${o.$3}', style: GoogleFonts.plusJakartaSans(
                      fontSize: 12, color: archived ? const Color(0xFF92400E) : AppTheme.textMuted)),
                ],
              ])).toList(),
          items: [
            for (final e in options.entries)
              DropdownMenuItem(
                value: e.key,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(e.value.$2, style: GoogleFonts.plusJakartaSans(fontSize: 13)),
                  if (e.value.$3 != null) ...[
                    const SizedBox(width: 8),
                    Text(e.value.$3!, style: GoogleFonts.plusJakartaSans(
                        fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textMuted)),
                  ],
                ]),
              ),
          ],
          onChanged: (k) {
            if (k != null) widget.onChanged(options[k]!.$1);
          },
        ),
      ),
    );
  }
}
