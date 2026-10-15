import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/assign_picker_dialog.dart';

part 'create_task_screen_widgets.dart';

class CreateTaskScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onCreated;
  final bool isTemplate;
  final String? lockedCategory; // when set ('special'/'common'), force it and hide the toggle
  const CreateTaskScreen({super.key, this.onBack, this.onCreated,
      this.isTemplate = false, this.lockedCategory});

  @override
  State<CreateTaskScreen> createState() => _CreateTaskScreenState();
}

class _CreateTaskScreenState extends State<CreateTaskScreen> {
  final _titleCtrl = TextEditingController();
  final _subjectCtrl = TextEditingController();
  final _instrCtrl = TextEditingController();

  DateTime? _startDate;
  DateTime? _endDate;
  TimeOfDay? _dueTime;

  List<User> _allAssignable = [];
  final Set<int> _selectedIds = {};
  String _taskCategory = 'common'; // 'common' | 'special'
  String? _targetRole; // which identity the assignees receive the task as
  bool _loadingUsers = true;
  bool _submitting = false;

  // Which target identities the current creator may assign to.
  // From the backend (login / /me): the roles this session may assign to.
  List<String> _targetRoleOptions(String _) => context.read<AppState>().assignableRoles;

  final List<Map<String, String>> _attachments = [];

  @override
  void initState() {
    super.initState();
    if (widget.lockedCategory != null) _taskCategory = widget.lockedCategory!;
    _loadUsers();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _subjectCtrl.dispose();
    _instrCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    final creatorRole = context.read<AppState>().userRole;
    final opts = _targetRoleOptions(creatorRole);
    _targetRole ??= opts.isNotEmpty ? opts.first : null;
    try {
      final users = await ApiService.getAssignableUsers(targetRole: _targetRole);
      if (mounted) setState(() { _allAssignable = users; _loadingUsers = false; });
    } catch (_) {
      // Who may be assigned is decided by the server only.
      if (mounted) setState(() { _allAssignable = []; _loadingUsers = false; });
    }
  }

  Future<void> _pickDate(bool isStart) async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: AppTheme.accentBlue)),
        child: child!,
      ),
    );
    if (d != null) setState(() => isStart ? _startDate = d : _endDate = d);
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      initialEntryMode: TimePickerEntryMode.input,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: AppTheme.accentBlue)),
        child: child!,
      ),
    );
    if (t != null) setState(() => _dueTime = t);
  }

  void _openAssignPicker() async {
    if (_loadingUsers || _allAssignable.isEmpty) return;
    await showDialog(
      context: context,
      builder: (_) => AssignPickerDialog(
        users: _allAssignable,
        selected: _selectedIds,
        onChanged: (ids) => setState(() { _selectedIds.clear(); _selectedIds.addAll(ids); }),
        hasTaskText: [_titleCtrl, _subjectCtrl, _instrCtrl]
            .any((c) => c.text.trim().isNotEmpty),
        loadSuggestions: () => ApiService.getAssigneeSuggestions(
          targetRole: _targetRole,
          title: _titleCtrl.text,
          subject: _subjectCtrl.text,
          instructions: _instrCtrl.text,
          taskCategory: _taskCategory,
          startDate: _startDate != null ? _fmtApi(_startDate!) : null,
          endDate: _endDate != null ? _fmtApi(_endDate!) : null,
          dueTime: _dueTime != null ? _fmtTime(_dueTime!) : null,
        ),
      ),
    );
  }

  void _openAttachmentInput(String type) async {
    if (type == 'file') {
      try {
        final picked = await FilePicker.platform.pickFiles(withData: true);
        if (picked == null || picked.files.isEmpty) return;
        final file = picked.files.first;

        List<int>? bytes = file.bytes?.toList();
        if (bytes == null && file.path != null) {
          // fallback for desktop: read from path
          final f = await _readFileAsBytes(file.path!);
          bytes = f;
        }
        if (bytes == null) {
          if (mounted) _showSnack('Could not read file', error: true);
          return;
        }

        setState(() => _submitting = true);
        final info = await ApiService.uploadAttachmentFile(bytes, file.name);
        if (mounted) setState(() {
          _attachments.add({
            'attachment_type': 'file',
            'name': info['name']!,
            'url': info['url']!,
          });
        });
      } catch (e) {
        if (mounted) _showSnack('File upload failed: $e', error: true);
      } finally {
        if (mounted) setState(() => _submitting = false);
      }
      return;
    }
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _AttachmentDialog(type: type),
    );
    if (result != null) setState(() => _attachments.add(result));
  }

  Future<void> _submit() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      _showSnack('${widget.isTemplate ? 'Template' : 'Task'} title is required', error: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      if (widget.isTemplate) {
        await ApiService.createTemplate({
          'title': title,
          if (_instrCtrl.text.trim().isNotEmpty) 'instructions': _instrCtrl.text.trim(),
          if (_startDate != null) 'start_date': _fmtApi(_startDate!),
          if (_endDate != null)   'end_date': _fmtApi(_endDate!),
          if (_dueTime != null)   'due_time': _fmtTime(_dueTime!),
        });
      } else {
        await ApiService.createTask({
          'title': title,
          'task_category': _taskCategory,
          if (_targetRole != null) 'target_role': _targetRole,
          if (_subjectCtrl.text.trim().isNotEmpty) 'subject': _subjectCtrl.text.trim(),
          if (_instrCtrl.text.trim().isNotEmpty) 'instructions': _instrCtrl.text.trim(),
          if (_startDate != null) 'start_date': _fmtApi(_startDate!),
          if (_endDate != null)   'end_date': _fmtApi(_endDate!),
          if (_dueTime != null)   'due_time': _fmtTime(_dueTime!),
          'assigned_user_ids': _selectedIds.toList(),
          'attachments': _attachments,
        });
      }
      if (mounted) {
        if (widget.onCreated != null) {
          widget.onCreated!();
        } else {
          Navigator.pop(context, true);
        }
      }
    } catch (e) {
      _showSnack('Failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _openTemplatePicker() async {
    final template = await showDialog<TaskTemplate>(
      context: context,
      builder: (_) => const _TemplatePickerDialog(),
    );
    if (template != null && mounted) {
      setState(() {
        _titleCtrl.text = template.title;
        _instrCtrl.text = template.instructions ?? '';
        if (template.startDate != null) {
          try { _startDate = DateTime.parse(template.startDate!); } catch (_) {}
        }
        if (template.endDate != null) {
          try { _endDate = DateTime.parse(template.endDate!); } catch (_) {}
        }
        if (template.dueTime != null) {
          final parts = template.dueTime!.split(RegExp(r'[: ]'));
          if (parts.length >= 2) {
            int h = int.tryParse(parts[0]) ?? 0;
            final m = int.tryParse(parts[1]) ?? 0;
            final isPm = template.dueTime!.toUpperCase().contains('PM');
            if (isPm && h != 12) h += 12;
            if (!isPm && h == 12) h = 0;
            _dueTime = TimeOfDay(hour: h, minute: m);
          }
        }
      });
    }
  }

  Future<List<int>?> _readFileAsBytes(String path) async {
    if (kIsWeb) return null;
    try { return await File(path).readAsBytes(); } catch (_) { return null; }
  }

  void _showSnack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? AppTheme.redColor : AppTheme.darkBanner,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ));
  }

  String _fmtApi(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2,'0')}-${d.day.toString().padLeft(2,'0')}';

  String _fmtTime(TimeOfDay t) {
    final h = t.hourOfPeriod == 0 ? 12 : t.hourOfPeriod;
    return '$h:${t.minute.toString().padLeft(2,'0')} ${t.period == DayPeriod.am ? 'AM' : 'PM'}';
  }

  @override
  Widget build(BuildContext context) {
    final selectedUsers = _allAssignable.where((u) => _selectedIds.contains(u.id)).toList();
    final wide = MediaQuery.of(context).size.width >= 1100;
    final isSpecial = widget.lockedCategory == 'special';
    final pageTitle = widget.isTemplate
        ? 'Create Template'
        : isSpecial ? 'Create Special Task' : 'Create Task';
    final subtitle = widget.isTemplate
        ? 'Save a reusable task outline.'
        : isSpecial
            ? 'Special tasks are appraised separately from regular duties.'
            : 'Describe the task, set when it is due, then choose who does it.';

    // ── Task details ──
    final details = _SectionCard(
      icon: Icons.description_outlined,
      title: 'Task details',
      children: [
        _FieldLabel(widget.isTemplate ? 'Template name' : 'Title'),
        const SizedBox(height: 6),
        _input(_titleCtrl, widget.isTemplate ? 'e.g. Quarterly report' : 'e.g. First aid station for the sports fest'),
        const SizedBox(height: 16),
        _FieldLabel('Instructions'),
        const SizedBox(height: 6),
        TextField(
          controller: _instrCtrl,
          minLines: 7,
          maxLines: 14,
          style: GoogleFonts.plusJakartaSans(fontSize: 14, height: 1.5),
          decoration: _inputDecoration(
              'What needs to be done, what to submit, and anything the assignee should know.'),
        ),
        const SizedBox(height: 18),
        _FieldLabel('Attachments'),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          _AttachButton(Icons.link, 'Link', () => _openAttachmentInput('link')),
          _AttachButton(Icons.upload_file_outlined, 'Upload file', () => _openAttachmentInput('file')),
          _AttachButton(Icons.add_to_drive_outlined, 'Google Drive', () => _openAttachmentInput('gdrive')),
          _AttachButton(Icons.play_circle_outline, 'YouTube', () => _openAttachmentInput('youtube')),
        ]),
        if (_attachments.isNotEmpty) ...[
          const SizedBox(height: 12),
          for (final e in _attachments.asMap().entries) _attachmentRow(e.key, e.value),
        ],
      ],
    );

    // ── Schedule ──
    final schedule = _SectionCard(
      icon: Icons.event_outlined,
      title: 'Schedule',
      children: [
        _PickerField(icon: Icons.calendar_today_outlined, label: 'Start date',
            value: _startDate == null ? null : _fmtLongDate(_startDate!),
            onTap: () => _pickDate(true)),
        const SizedBox(height: 10),
        _PickerField(icon: Icons.event_available_outlined, label: 'Due date',
            value: _endDate == null ? null : _fmtLongDate(_endDate!),
            onTap: () => _pickDate(false)),
        const SizedBox(height: 10),
        _PickerField(icon: Icons.schedule_outlined, label: 'Due time',
            value: _dueTime == null ? null : _fmtTime(_dueTime!),
            onTap: _pickTime),
      ],
    );

    // ── Assignment ──
    final roleOpts = widget.isTemplate
        ? const <String>[]
        : _targetRoleOptions(context.read<AppState>().userRole);
    final assignment = widget.isTemplate
        ? null
        : _SectionCard(
            icon: Icons.groups_outlined,
            title: 'Assignment',
            children: [
              if (roleOpts.length >= 2) ...[
                _FieldLabel('Assign as'),
                const SizedBox(height: 6),
                _targetRoleField(roleOpts),
                const SizedBox(height: 16),
              ],
              _FieldLabel('People'),
              const SizedBox(height: 8),
              if (selectedUsers.isEmpty)
                Text('No one selected yet.', style: AppTheme.bodySm)
              else
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final u in selectedUsers)
                    InputChip(
                      avatar: CircleAvatar(
                        backgroundColor: AppTheme.sidebarActive,
                        child: Text(u.initials,
                            style: const TextStyle(fontSize: 10, color: Colors.white,
                                fontWeight: FontWeight.w700)),
                      ),
                      label: Text(u.fullName,
                          style: GoogleFonts.plusJakartaSans(fontSize: 12.5,
                              fontWeight: FontWeight.w600)),
                      onDeleted: () => setState(() => _selectedIds.remove(u.id)),
                      backgroundColor: Colors.white,
                      side: const BorderSide(color: AppTheme.borderColor),
                    ),
                ]),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _loadingUsers ? null : _openAssignPicker,
                  icon: _loadingUsers
                      ? const SizedBox(width: 14, height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.auto_awesome, size: 16),
                  label: Text(selectedUsers.isEmpty ? 'Choose people' : 'Change people',
                      style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.accentBlue,
                    side: const BorderSide(color: AppTheme.accentBlue),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text('Suggestions match the title and instructions against each '
                  "person's skills and certifications, and weigh their current workload.",
                  style: AppTheme.bodySm.copyWith(fontSize: 11.5)),
            ],
          );

    final side = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      schedule,
      if (assignment != null) ...[const SizedBox(height: 16), assignment],
    ]);

    final actions = Row(children: [
      const Spacer(),
      OutlinedButton(
        onPressed: () {
          if (widget.onBack != null) {
            widget.onBack!();
          } else {
            Navigator.pop(context);
          }
        },
        style: OutlinedButton.styleFrom(
          foregroundColor: AppTheme.textPrimary,
          side: const BorderSide(color: AppTheme.borderColor),
          backgroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: Text('Cancel', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600)),
      ),
      const SizedBox(width: 10),
      ElevatedButton(
        onPressed: _submitting ? null : _submit,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.darkBanner,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: _submitting
            ? const SizedBox(width: 16, height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(widget.isTemplate ? 'Save template' : isSpecial ? 'Create special task' : 'Create task',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700)),
      ),
    ]);

    final body = SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(28, 20, 28, 28),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1240),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(pageTitle,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 24, fontWeight: FontWeight.w800, color: AppTheme.textPrimary)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: AppTheme.bodyMd),
                ]),
              ),
              if (!widget.isTemplate)
                OutlinedButton.icon(
                  onPressed: _openTemplatePicker,
                  icon: const Icon(Icons.library_books_outlined, size: 16),
                  label: Text('Use template',
                      style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.accentBlue,
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: AppTheme.accentBlue),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
            ]),
            const SizedBox(height: 20),
            if (wide)
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(flex: 3, child: details),
                const SizedBox(width: 20),
                Expanded(flex: 2, child: side),
              ])
            else ...[
              details,
              const SizedBox(height: 16),
              side,
            ],
            const SizedBox(height: 20),
            actions,
          ]),
        ),
      ),
    );

    if (widget.onBack != null) {
      return ColoredBox(color: AppTheme.bgColor, child: body);
    }
    return Scaffold(backgroundColor: AppTheme.bgColor, body: SafeArea(child: body));
  }

  String _fmtLongDate(DateTime d) {
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const w = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return '${w[d.weekday - 1]}, ${m[d.month - 1]} ${d.day}, ${d.year}';
  }

  Widget _attachmentRow(int i, Map<String, String> att) {
    final icon = _attIcon(att['attachment_type'] ?? 'link');
    final iconColor = _attColor(att['attachment_type'] ?? 'link');
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: iconColor),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(att['name'] ?? 'Attachment',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                maxLines: 1, overflow: TextOverflow.ellipsis),
            if ((att['url'] ?? '').isNotEmpty)
              Text(att['url']!,
                  style: AppTheme.bodySm.copyWith(color: AppTheme.accentBlue),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
        IconButton(
          tooltip: 'Remove',
          onPressed: () => setState(() => _attachments.removeAt(i)),
          icon: const Icon(Icons.close, size: 16, color: AppTheme.textMuted),
        ),
      ]),
    );
  }

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: AppTheme.bodyMd.copyWith(color: AppTheme.textLight),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppTheme.borderColor)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppTheme.borderColor)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5)),
      );

  IconData _attIcon(String type) {
    switch (type) {
      case 'gdrive': return Icons.storage_outlined;
      case 'youtube': return Icons.play_circle_outline;
      case 'file': return Icons.insert_drive_file_outlined;
      default: return Icons.link;
    }
  }

  Color _attColor(String type) {
    switch (type) {
      case 'gdrive': return const Color(0xFF34A853);
      case 'youtube': return const Color(0xFFFF0000);
      case 'file': return const Color(0xFF6B7280);
      default: return const Color(0xFF4A90E2);
    }
  }

  Widget _input(TextEditingController ctrl, String hint) => TextField(
        controller: ctrl,
        style: GoogleFonts.plusJakartaSans(fontSize: 14),
        decoration: _inputDecoration(hint),
      );

  // Common vs Special task tag. Two-option toggle so the choice is obvious.
  String _roleLabel(String r) {
    switch (r) {
      case 'teacher': return 'Teacher';
      case 'dean': return 'Dean';
      case 'coordinator': return 'Coordinator';
      case 'registrar': return 'Registrar';
      default: return r;
    }
  }

  void _setTargetRole(String r) {
    if (_targetRole == r) return;
    setState(() { _targetRole = r; _selectedIds.clear(); _loadingUsers = true; });
    _loadUsers();
  }

  Widget _targetRoleField(List<String> opts) {
    return Wrap(spacing: 8, runSpacing: 8, children: opts.map((r) {
      final selected = _targetRole == r;
      return GestureDetector(
        onTap: () => _setTargetRole(r),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? AppTheme.darkBanner : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
                color: selected ? AppTheme.darkBanner : AppTheme.borderColor),
          ),
          child: Text(_roleLabel(r),
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AppTheme.textMuted)),
        ),
      );
    }).toList());
  }
}

// ── Small helpers ──────────────────────────────────────────────────────────────
