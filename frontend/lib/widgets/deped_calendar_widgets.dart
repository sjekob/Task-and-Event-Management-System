import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../models/deped_calendar.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

String _iso(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String _err(Object e) => e.toString().replaceFirst('Exception: ', '');

/// "DepEd Memo" tag used wherever official DepEd dates appear.
class DepedTag extends StatelessWidget {
  const DepedTag({super.key});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: DepedEntry.bg, borderRadius: BorderRadius.circular(20)),
        child: const Text('DepEd Memo',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: DepedEntry.color)),
      );
}

// ── Mandatory compliance tasks from a DepEd entry ────────────────────────────

/// Principal/admin: turn a DepEd calendar entry into one mandatory task
/// assigned to every active faculty member in the chosen roles.
/// Pops with the server result ({task_id, assigned, roles}) on success.
class DepedTaskDialog extends StatefulWidget {
  const DepedTaskDialog({super.key});

  @override
  State<DepedTaskDialog> createState() => _DepedTaskDialogState();
}

class _DepedTaskDialogState extends State<DepedTaskDialog> {
  static const _roleLabels = {
    'teacher': 'Teachers', 'dean': 'Deans', 'coordinator': 'Coordinators', 'registrar': 'Registrars',
  };
  List<DepedEntry>? _entries;
  String? _loadError;
  DepedEntry? _entry;
  final _title = TextEditingController();
  final _instructions = TextEditingController();
  DateTime? _due;
  final Set<String> _roles = {'teacher'};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    ApiService.getDepedCalendar().then((all) {
      if (!mounted) return;
      final today = DateTime.now();
      final start = DateTime(today.year, today.month, today.day);
      // Upcoming entries first, then past ones (most recent first).
      final upcoming = all.where((e) => !e.end.isBefore(start)).toList();
      final past = all.where((e) => e.end.isBefore(start)).toList().reversed;
      setState(() => _entries = [...upcoming, ...past]);
    }).catchError((Object e) {
      if (mounted) setState(() => _loadError = _err(e));
    });
  }

  @override
  void dispose() {
    _title.dispose();
    _instructions.dispose();
    super.dispose();
  }

  void _select(DepedEntry? e) => setState(() {
        _entry = e;
        if (e != null) {
          _title.text = e.category == 'Quarter Compliance' ? e.title : '${e.title} Compliance';
          _due = e.end;
        }
      });

  Future<void> _pickDue() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _due ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (d != null) setState(() => _due = d);
  }

  Future<void> _generate() async {
    final entry = _entry;
    if (entry == null || _title.text.trim().isEmpty || _roles.isEmpty) return;
    setState(() => _saving = true);
    try {
      final res = await ApiService.generateDepedTasks(entry.id,
          title: _title.text.trim(),
          instructions: _instructions.text.trim(),
          dueDate: _due == null ? null : _iso(_due!),
          roles: _roles.toList());
      if (mounted) Navigator.pop(context, res);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_err(e)), backgroundColor: AppTheme.redColor));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = _entries;
    final ready = _entry != null && _title.text.trim().isNotEmpty && _roles.isNotEmpty && !_saving;
    return AlertDialog(
      title: Row(children: [
        Expanded(
          child: Text('Generate from DepEd Calendar',
              style: GoogleFonts.plusJakartaSans(fontSize: 17, fontWeight: FontWeight.w700)),
        ),
        const DepedTag(),
      ]),
      content: SizedBox(
        width: 460,
        child: _loadError != null
            ? Text(_loadError!, style: const TextStyle(color: AppTheme.redColor))
            : entries == null
                ? const SizedBox(height: 120, child: Center(child: CircularProgressIndicator()))
                : SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text('Creates one mandatory task assigned to every active faculty account in the '
                          'selected roles.', style: AppTheme.bodySm),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<DepedEntry>(
                        initialValue: _entry,
                        isExpanded: true,
                        decoration: const InputDecoration(labelText: 'DepEd calendar entry'),
                        items: [
                          for (final e in entries)
                            DropdownMenuItem(
                              value: e,
                              child: Text('${e.title}  ·  ${e.rangeLabel}',
                                  overflow: TextOverflow.ellipsis),
                            ),
                        ],
                        onChanged: _select,
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _title,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                            labelText: 'Task title',
                            hintText: 'e.g. Submit Quarter 1 Grades & Appraisal'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _instructions,
                        maxLines: 3,
                        decoration: const InputDecoration(
                            labelText: 'Instructions (optional)',
                            hintText: 'Defaults to a note naming the DepEd entry and its dates'),
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: _pickDue,
                        child: InputDecorator(
                          decoration: const InputDecoration(
                              labelText: 'Due date', suffixIcon: Icon(Icons.calendar_today_outlined, size: 18)),
                          child: Text(_due == null ? 'Defaults to the entry\'s end date' : _iso(_due!)),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text('Assign to', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 6),
                      Wrap(spacing: 8, runSpacing: 6, children: [
                        for (final r in _roleLabels.entries)
                          FilterChip(
                            label: Text(r.value),
                            selected: _roles.contains(r.key),
                            onSelected: (on) => setState(() => on ? _roles.add(r.key) : _roles.remove(r.key)),
                          ),
                      ]),
                    ]),
                  ),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton.icon(
          onPressed: ready ? _generate : null,
          style: FilledButton.styleFrom(backgroundColor: AppTheme.darkBanner),
          icon: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.playlist_add_check_rounded, size: 18),
          label: const Text('Generate tasks'),
        ),
      ],
    );
  }
}

// ── Maintaining the DepEd calendar (School Year page) ─────────────────────────

/// List of DepEd calendar entries with add / edit / remove (principal/admin).
class DepedCalendarManager extends StatefulWidget {
  const DepedCalendarManager({super.key});

  @override
  State<DepedCalendarManager> createState() => _DepedCalendarManagerState();
}

class _DepedCalendarManagerState extends State<DepedCalendarManager> {
  List<DepedEntry>? _entries;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final e = await ApiService.getDepedCalendar();
      if (mounted) setState(() { _entries = e; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = _err(e));
    }
  }

  Future<void> _edit([DepedEntry? entry]) async {
    final saved = await showDialog<bool>(context: context, builder: (_) => _DepedEntryDialog(existing: entry));
    if (saved == true) _load();
  }

  Future<void> _delete(DepedEntry entry) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Remove "${entry.title}"?'),
        content: const Text('It disappears from every calendar and no longer triggers date warnings. '
            'Tasks already generated from it are kept.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.redColor),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.deleteDepedEntry(entry.id);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_err(e)), backgroundColor: AppTheme.redColor));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = _entries;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        alignment: WrapAlignment.spaceBetween,
        spacing: 12,
        runSpacing: 8,
        children: [
          Row(mainAxisSize: MainAxisSize.min, children: [
            Text('DepEd school calendar',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            const SizedBox(width: 10),
            const DepedTag(),
          ]),
          FilledButton.icon(
            onPressed: () => _edit(),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.darkBanner),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add DepEd date'),
          ),
        ],
      ),
      const SizedBox(height: 4),
      Text('Official memorandum dates shown on every calendar. Mandatory entries warn proponents '
          'who pick an overlapping event date. Confirm the baseline dates against the DepEd Order '
          'for the school year.', style: AppTheme.bodySm),
      const SizedBox(height: 12),
      Container(
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE3E9F3)),
        ),
        child: _error != null
            ? Padding(padding: const EdgeInsets.all(18), child: Text(_error!, style: AppTheme.bodyMd))
            : entries == null
                ? const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator()))
                : entries.isEmpty
                    ? Padding(padding: const EdgeInsets.all(18), child: Text('No DepEd dates yet.', style: AppTheme.bodyMd))
                    : Column(children: [
                        for (var i = 0; i < entries.length; i++) ...[
                          if (i > 0) const Divider(height: 1, color: AppTheme.borderColor),
                          _row(entries[i]),
                        ],
                      ]),
      ),
    ]);
  }

  Widget _row(DepedEntry e) => ListTile(
        leading: Container(
          width: 6, height: 36,
          decoration: BoxDecoration(color: DepedEntry.color, borderRadius: BorderRadius.circular(3)),
        ),
        title: Text(e.title, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600)),
        subtitle: Text('${e.rangeLabel} · ${e.category}${e.isMandatory ? ' · Mandatory' : ''}',
            style: AppTheme.bodySm),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(tooltip: 'Edit', icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () => _edit(e)),
          IconButton(
              tooltip: 'Remove',
              icon: const Icon(Icons.delete_outline, size: 18, color: AppTheme.redColor),
              onPressed: () => _delete(e)),
        ]),
      );
}

class _DepedEntryDialog extends StatefulWidget {
  final DepedEntry? existing;
  const _DepedEntryDialog({this.existing});

  @override
  State<_DepedEntryDialog> createState() => _DepedEntryDialogState();
}

class _DepedEntryDialogState extends State<_DepedEntryDialog> {
  late final _title = TextEditingController(text: widget.existing?.title ?? '');
  late final _desc = TextEditingController(text: widget.existing?.description ?? '');
  late DateTime? _start = widget.existing?.start;
  late DateTime? _end = widget.existing?.end;
  late String _category = widget.existing?.category ?? DepedEntry.categories.first;
  late bool _mandatory = widget.existing?.isMandatory ?? true;
  bool _saving = false;

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    super.dispose();
  }

  Future<void> _pick(bool start) async {
    final d = await showDatePicker(
      context: context,
      initialDate: (start ? _start : _end ?? _start) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (d == null) return;
    setState(() {
      if (start) {
        _start = d;
        if (_end != null && _end!.isBefore(d)) _end = d;
      } else {
        _end = d;
      }
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiService.saveDepedEntry(widget.existing?.id, {
        'title': _title.text.trim(),
        'description': _desc.text.trim().isEmpty ? null : _desc.text.trim(),
        'start_date': _iso(_start!),
        'end_date': _iso(_end ?? _start!),
        'category': _category,
        'is_mandatory': _mandatory,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_err(e)), backgroundColor: AppTheme.redColor));
      }
    }
  }

  Widget _dateBox(String label, DateTime? value, bool start) => Expanded(
        child: InkWell(
          onTap: () => _pick(start),
          child: InputDecorator(
            decoration: InputDecoration(labelText: label),
            child: Text(value == null ? (start ? 'Select' : 'Same as start') : _iso(value)),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final ok = _title.text.trim().isNotEmpty && _start != null && !_saving;
    return AlertDialog(
      title: Text(widget.existing == null ? 'Add DepEd date' : 'Edit DepEd date'),
      content: SizedBox(
        width: 440,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: _title,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Title', hintText: 'e.g. First Quarter Examinations'),
            ),
            const SizedBox(height: 12),
            Row(children: [
              _dateBox('Start date', _start, true),
              const SizedBox(width: 12),
              _dateBox('End date', _end, false),
            ]),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: const InputDecoration(labelText: 'Category'),
              items: [for (final c in DepedEntry.categories) DropdownMenuItem(value: c, child: Text(c))],
              onChanged: (v) => setState(() => _category = v ?? _category),
            ),
            const SizedBox(height: 4),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Mandatory', style: TextStyle(fontSize: 14)),
              subtitle: const Text('Warn proponents who schedule an event on these dates',
                  style: TextStyle(fontSize: 12)),
              value: _mandatory,
              onChanged: (v) => setState(() => _mandatory = v),
            ),
            TextField(
              controller: _desc,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Description (optional)'),
            ),
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: ok ? _save : null,
          style: FilledButton.styleFrom(backgroundColor: AppTheme.darkBanner),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
