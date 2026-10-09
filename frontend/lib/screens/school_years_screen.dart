import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

/// Principal/admin page for setting when each school year and its terms start
/// and end. Tasks, events and appraisal records dated in a school year that
/// has ended are archived: lists show the current year by default, and older
/// years stay viewable from each page's school-year selector.
class SchoolYearsScreen extends StatefulWidget {
  const SchoolYearsScreen({super.key});
  @override
  State<SchoolYearsScreen> createState() => _SchoolYearsScreenState();
}

const _monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _fmt(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : '${_monthNames[d.month - 1]} ${d.day}, ${d.year}';
}

String _iso(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

(String, Color, Color) _statusStyle(String status) => switch (status) {
      'current' => ('Current', const Color(0xFF15803D), AppTheme.greenBg),
      'archived' => ('Archived', const Color(0xFF92400E), AppTheme.amberBg),
      _ => ('Upcoming', AppTheme.accentBlue, AppTheme.blueBg),
    };

class _SchoolYearsScreenState extends State<SchoolYearsScreen> {
  List<SchoolYear> _years = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final y = await ApiService.getSchoolYears();
      if (mounted) setState(() { _years = y; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _edit([SchoolYear? year]) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _SchoolYearDialog(existing: year),
    );
    if (saved == true) {
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(year == null ? 'School year added.' : 'School year updated.'),
          backgroundColor: const Color(0xFF16A34A),
        ));
      }
    }
  }

  Future<void> _delete(SchoolYear year) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Remove S.Y. ${year.name}?'),
        content: const Text(
            'Only the calendar entry is removed. Tasks, events and appraisal records '
            'are kept; they just stop being grouped under this school year.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.redColor),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Remove S.Y. ${year.name}'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.deleteSchoolYear(year.id);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: AppTheme.redColor));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(isMobile ? 16 : 24, 8, isMobile ? 16 : 24, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const AppBanner(
          title: 'School Year',
          subtitle: 'Set when each school year and term starts and ends. Records from '
              'school years that have ended are archived automatically.',
        ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
            child: Text('School years',
                style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary)),
          ),
          FilledButton.icon(
            onPressed: () => _edit(),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.darkBanner),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add school year'),
          ),
        ]),
        const SizedBox(height: 12),
        if (_loading)
          const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))
        else if (_error != null)
          _Card(child: Text(_error!, style: AppTheme.bodyMd))
        else if (_years.isEmpty)
          _Card(
            child: Row(children: [
              const Icon(Icons.info_outline, color: AppTheme.textMuted),
              const SizedBox(width: 12),
              Expanded(child: Text(
                  'No school year set up yet, so nothing is archived. Add the current '
                  'school year and its terms to start grouping tasks, events and appraisals by year.',
                  style: AppTheme.bodyMd)),
            ]),
          )
        else
          for (final y in _years) ...[
            _YearCard(year: y, onEdit: () => _edit(y), onDelete: () => _delete(y)),
            const SizedBox(height: 12),
          ],
      ]),
    );
  }
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE3E9F3)),
        ),
        child: child,
      );
}

class _Chip extends StatelessWidget {
  final String status;
  const _Chip(this.status);
  @override
  Widget build(BuildContext context) {
    final (label, fg, bg) = _statusStyle(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: GoogleFonts.plusJakartaSans(
          fontSize: 11.5, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}

class _YearCard extends StatelessWidget {
  final SchoolYear year;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _YearCard({required this.year, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) => _Card(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: const Color(0xFFEEF2FA), borderRadius: BorderRadius.circular(10)),
              child: Icon(year.status == 'archived' ? Icons.inventory_2_outlined : Icons.school_outlined,
                  color: AppTheme.darkBanner, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text('S.Y. ${year.name}', style: GoogleFonts.plusJakartaSans(
                    fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                const SizedBox(width: 10),
                _Chip(year.status),
              ]),
              const SizedBox(height: 2),
              Text('${_fmt(year.startDate)} – ${_fmt(year.endDate)}', style: AppTheme.bodyMd),
            ])),
            IconButton(tooltip: 'Edit S.Y. ${year.name}', onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined, size: 20, color: AppTheme.textMuted)),
            IconButton(tooltip: 'Remove S.Y. ${year.name}', onPressed: onDelete,
                icon: const Icon(Icons.delete_outline, size: 20, color: AppTheme.textMuted)),
          ]),
          const SizedBox(height: 14),
          if (year.terms.isEmpty)
            Text('No terms set — add quarters/terms to filter appraisals by term.', style: AppTheme.bodySm)
          else
            Wrap(spacing: 10, runSpacing: 10, children: [
              for (final t in year.terms)
                Container(
                  width: 220,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: t.status == 'current' ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: t.status == 'current'
                        ? const Color(0xFF86EFAC) : const Color(0xFFE2E8F0)),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(t.name, overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary))),
                      _Chip(t.status),
                    ]),
                    const SizedBox(height: 4),
                    Text('${_fmt(t.startDate)} – ${_fmt(t.endDate)}', style: AppTheme.caption),
                  ]),
                ),
            ]),
        ]),
      );
}

// ── Editor ──────────────────────────────────────────────────────────────────

class _TermDraft {
  final TextEditingController name;
  DateTime? start;
  DateTime? end;
  _TermDraft(String n, this.start, this.end) : name = TextEditingController(text: n);
}

class _SchoolYearDialog extends StatefulWidget {
  final SchoolYear? existing;
  const _SchoolYearDialog({this.existing});
  @override
  State<_SchoolYearDialog> createState() => _SchoolYearDialogState();
}

class _SchoolYearDialogState extends State<_SchoolYearDialog> {
  static const _termNames = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
  late final TextEditingController _name;
  DateTime? _start;
  DateTime? _end;
  late List<_TermDraft> _terms;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _name = TextEditingController(text: e?.name ?? '');
    _start = e != null ? DateTime.tryParse(e.startDate) : null;
    _end = e != null ? DateTime.tryParse(e.endDate) : null;
    _terms = [
      for (final t in e?.terms ?? const <SchoolTerm>[])
        _TermDraft(t.name, DateTime.tryParse(t.startDate), DateTime.tryParse(t.endDate)),
    ];
  }

  @override
  void dispose() {
    _name.dispose();
    for (final t in _terms) {
      t.name.dispose();
    }
    super.dispose();
  }

  Future<DateTime?> _pick(DateTime? initial) => showDatePicker(
        context: context,
        initialDate: initial ?? _start ?? DateTime.now(),
        firstDate: DateTime(2015),
        lastDate: DateTime(2040),
      );

  void _addTerm() {
    final prevEnd = _terms.isNotEmpty ? _terms.last.end : null;
    setState(() => _terms.add(_TermDraft(
        _terms.length < _termNames.length ? _termNames[_terms.length] : 'Term ${_terms.length + 1}',
        prevEnd?.add(const Duration(days: 1)) ?? (_terms.isEmpty ? _start : null),
        null)));
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty || _start == null || _end == null) {
      setState(() => _error = 'Enter the school year name and both dates.');
      return;
    }
    for (final t in _terms) {
      if (t.name.text.trim().isEmpty || t.start == null || t.end == null) {
        setState(() => _error = 'Give every term a name, a start date and an end date.');
        return;
      }
    }
    setState(() { _saving = true; _error = null; });
    try {
      await ApiService.saveSchoolYear({
        'name': name,
        'start_date': _iso(_start!),
        'end_date': _iso(_end!),
        'terms': [
          for (final t in _terms)
            {'name': t.name.text.trim(), 'start_date': _iso(t.start!), 'end_date': _iso(t.end!)},
        ],
      }, id: widget.existing?.id);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _saving = false; });
    }
  }

  Widget _dateBox(String label, DateTime? value, ValueChanged<DateTime> onPicked) => InkWell(
        onTap: () async {
          final d = await _pick(value);
          if (d != null) setState(() => onPicked(d));
        },
        borderRadius: BorderRadius.circular(8),
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            isDense: true,
            suffixIcon: const Icon(Icons.calendar_today_outlined, size: 16),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: Text(value == null ? 'Select date' : _fmt(_iso(value)),
              style: TextStyle(fontSize: 13, color: value == null ? AppTheme.textLight : AppTheme.textPrimary)),
        ),
      );

  Widget _termRow(int i, bool narrow) {
    final t = _terms[i];
    final name = TextField(
      controller: t.name,
      decoration: InputDecoration(
        labelText: 'Term name', isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
    final start = _dateBox('Starts', t.start, (d) => t.start = d);
    final end = _dateBox('Ends', t.end, (d) => t.end = d);
    final remove = IconButton(
      tooltip: 'Remove ${t.name.text}',
      onPressed: () => setState(() => _terms.removeAt(i).name.dispose()),
      icon: const Icon(Icons.close, size: 18, color: AppTheme.textMuted),
    );
    if (narrow) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Expanded(child: name), remove]),
        const SizedBox(height: 8),
        start,
        const SizedBox(height: 8),
        end,
      ]);
    }
    return Row(children: [
      SizedBox(width: 170, child: name),
      const SizedBox(width: 10),
      Expanded(child: start),
      const SizedBox(width: 10),
      Expanded(child: end),
      remove,
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final narrow = MediaQuery.of(context).size.width < 600;
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 680, maxHeight: MediaQuery.of(context).size.height * 0.88),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 22, 24, 18),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(widget.existing == null ? 'Add school year' : 'Edit S.Y. ${widget.existing!.name}',
                style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            Flexible(
              child: SingleChildScrollView(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  TextField(
                    controller: _name,
                    decoration: InputDecoration(
                      labelText: 'School year',
                      hintText: 'e.g. 2026-2027',
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: _dateBox('Starts', _start, (d) => _start = d)),
                    const SizedBox(width: 12),
                    Expanded(child: _dateBox('Ends', _end, (d) => _end = d)),
                  ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(child: Text('Terms', style: GoogleFonts.plusJakartaSans(
                        fontSize: 14, fontWeight: FontWeight.w700))),
                    TextButton.icon(onPressed: _addTerm, icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add term')),
                  ]),
                  Text('Terms must fall inside the school year and must not overlap.',
                      style: AppTheme.bodySm),
                  const SizedBox(height: 10),
                  for (var i = 0; i < _terms.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _termRow(i, narrow),
                    ),
                ]),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppTheme.redColor, fontSize: 13)),
            ],
            const SizedBox(height: 14),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(backgroundColor: AppTheme.darkBanner),
                child: _saving
                    ? const SizedBox(width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(widget.existing == null ? 'Add school year' : 'Save changes'),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
