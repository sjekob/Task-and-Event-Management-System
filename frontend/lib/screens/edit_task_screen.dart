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
import '../widgets/common_widgets.dart';

part 'edit_task_screen_widgets.dart';

class EditTaskScreen extends StatefulWidget {
  final Task task;
  const EditTaskScreen({super.key, required this.task});

  @override
  State<EditTaskScreen> createState() => _EditTaskScreenState();
}

class _EditTaskScreenState extends State<EditTaskScreen> {
  late final TextEditingController _titleCtrl;
  late final TextEditingController _subjectCtrl;
  late final TextEditingController _instrCtrl;

  DateTime? _startDate;
  DateTime? _endDate;
  TimeOfDay? _dueTime;

  List<User> _allAssignable = [];
  late Set<int> _selectedIds;
  bool _loadingUsers = true;
  bool _submitting = false;

  final List<Map<String, String>> _attachments = [];

  @override
  void initState() {
    super.initState();
    final t = widget.task;
    _titleCtrl = TextEditingController(text: t.title);
    _subjectCtrl = TextEditingController(text: t.subject ?? '');
    _instrCtrl = TextEditingController(text: t.instructions ?? '');
    _startDate = _parseDate(t.startDate);
    _endDate = _parseDate(t.endDate);
    _dueTime = _parseTime(t.dueTime);
    _selectedIds = t.assignedUsers.map((u) => u.id).toSet();
    _loadUsers();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _subjectCtrl.dispose();
    _instrCtrl.dispose();
    super.dispose();
  }

  DateTime? _parseDate(String? s) {
    if (s == null || s.isEmpty) return null;
    try { return DateTime.parse(s); } catch (_) { return null; }
  }

  TimeOfDay? _parseTime(String? s) {
    if (s == null || s.isEmpty) return null;
    try {
      final parts = s.split(':');
      if (parts.length < 2) return null;
      int hour = int.parse(parts[0]);
      final rest = parts[1].split(' ');
      final minute = int.parse(rest[0]);
      final period = rest.length > 1 ? rest[1].toUpperCase() : '';
      if (period == 'PM' && hour != 12) hour += 12;
      if (period == 'AM' && hour == 12) hour = 0;
      return TimeOfDay(hour: hour, minute: minute);
    } catch (_) { return null; }
  }

  Future<void> _loadUsers() async {
    try {
      final users = await ApiService.getAssignableUsers();
      if (mounted) setState(() { _allAssignable = users; _loadingUsers = false; });
    } catch (_) {
      try {
        final currentUser = context.read<AppState>().currentUser;
        final all = await ApiService.getUsers();
        final filtered = _filterByRole(all, currentUser);
        if (mounted) setState(() { _allAssignable = filtered; _loadingUsers = false; });
      } catch (_) {
        if (mounted) setState(() => _loadingUsers = false);
      }
    }
  }

  List<User> _filterByRole(List<User> all, User? currentUser) {
    final role = currentUser?.role ?? '';
    final glId = currentUser?.gradeLevelId;
    if (role == 'dean') {
      return all.where((u) => u.role == 'teacher' && (glId == null || u.gradeLevelId == glId)).toList();
    }
    if (role == 'coordinator') {
      return all.where((u) => {'coordinator', 'dean', 'teacher'}.contains(u.role)).toList();
    }
    return all.where((u) => {'coordinator', 'dean', 'teacher', 'registrar'}.contains(u.role)).toList();
  }

  Future<void> _pickDate(bool isStart) async {
    final d = await showDatePicker(
      context: context,
      initialDate: (isStart ? _startDate : _endDate) ?? DateTime.now(),
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
      initialTime: _dueTime ?? TimeOfDay.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: AppTheme.accentBlue)),
        child: child!,
      ),
    );
    if (t != null) setState(() => _dueTime = t);
  }

  void _openAssignPicker() async {
    if (_loadingUsers || _allAssignable.isEmpty) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AssignPickerSheet(
        users: _allAssignable,
        selected: _selectedIds,
        onChanged: (ids) => setState(() { _selectedIds.clear(); _selectedIds.addAll(ids); }),
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
    if (title.isEmpty) { _showSnack('Task title is required', error: true); return; }
    setState(() => _submitting = true);
    try {
      await ApiService.updateTask(widget.task.id, {
        'title': title,
        if (_subjectCtrl.text.trim().isNotEmpty) 'subject': _subjectCtrl.text.trim(),
        if (_instrCtrl.text.trim().isNotEmpty) 'instructions': _instrCtrl.text.trim(),
        if (_startDate != null) 'start_date': _fmtApi(_startDate!),
        if (_endDate != null)   'end_date': _fmtApi(_endDate!),
        if (_dueTime != null)   'due_time': _fmtTime(_dueTime!),
        'assigned_user_ids': _selectedIds.toList(),
        if (_attachments.isNotEmpty) 'attachments': _attachments,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _showSnack('Failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
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

  String _fmtDate(DateTime? d) {
    if (d == null) return 'Select';
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${m[d.month-1]} ${d.day}';
  }

  @override
  Widget build(BuildContext context) {
    final selectedUsers = _allAssignable.where((u) => _selectedIds.contains(u.id)).toList();
    // Also show pre-existing assigned users not in the assignable list (e.g. due to role change)
    final assignedNotInList = widget.task.assignedUsers
        .where((u) => _selectedIds.contains(u.id) && !_allAssignable.any((a) => a.id == u.id))
        .toList();
    final allSelected = [...selectedUsers, ...assignedNotInList];

    return Scaffold(
      backgroundColor: AppTheme.bgColor,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 20, 28, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Page Title ──
              Text('Edit Task',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 24, fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary)),
              const SizedBox(height: 24),

              // ── Title field ──
              _FieldLabel('Title'),
              const SizedBox(height: 6),
              _input(_titleCtrl, 'Task Name'),
              const SizedBox(height: 16),

              // ── Assign to | Start Date | End Date | Time ──
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      flex: 2,
                      child: GestureDetector(
                        onTap: _openAssignPicker,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.borderColor),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Assign to',
                                  style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11, color: AppTheme.textLight,
                                      fontWeight: FontWeight.w500)),
                              const SizedBox(height: 4),
                              Row(children: [
                                Expanded(
                                  child: Text(
                                    allSelected.isEmpty
                                        ? 'Select'
                                        : allSelected.map((u) => u.fullName.split(' ').first).join(', '),
                                    style: GoogleFonts.plusJakartaSans(
                                        fontSize: 13,
                                        color: allSelected.isEmpty
                                            ? AppTheme.textMuted
                                            : AppTheme.textPrimary,
                                        fontWeight: FontWeight.w500),
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const Icon(Icons.keyboard_arrow_down,
                                    size: 18, color: AppTheme.textMuted),
                              ]),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: _dateBtn('Start Date', _fmtDate(_startDate), () => _pickDate(true))),
                    const SizedBox(width: 10),
                    Expanded(child: _dateBtn('End Date', _fmtDate(_endDate), () => _pickDate(false))),
                    const SizedBox(width: 10),
                    Expanded(child: _dateBtn('Time', _dueTime != null ? _fmtTime(_dueTime!) : 'Select', _pickTime)),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ── Instructions ──
              _FieldLabel('Instructions'),
              const SizedBox(height: 6),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: TextField(
                    controller: _instrCtrl,
                    maxLines: null,
                    expands: true,
                    textAlignVertical: TextAlignVertical.top,
                    style: GoogleFonts.plusJakartaSans(fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Value',
                      hintStyle: AppTheme.bodyMd,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.all(14),
                    ),
                  ),
                ),
              ),

              // ── Attachments shown ──
              if (_attachments.isNotEmpty) ...[
                const SizedBox(height: 8),
                SizedBox(
                  height: 36,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _attachments.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 6),
                    itemBuilder: (_, i) {
                      final att = _attachments[i];
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppTheme.blueBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Text(att['name'] ?? 'Attachment',
                              style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.accentBlue)),
                          const SizedBox(width: 4),
                          GestureDetector(
                            onTap: () => setState(() => _attachments.removeAt(i)),
                            child: const Icon(Icons.close, size: 14, color: AppTheme.accentBlue),
                          ),
                        ]),
                      );
                    },
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // ── Bottom bar: icons + Cancel + Save Changes ──
              Row(
                children: [
                  _AttIcon(Icons.link, const Color(0xFF4A90E2), () => _openAttachmentInput('link')),
                  const SizedBox(width: 8),
                  _AttIcon(Icons.upload_file_outlined, const Color(0xFF6B7280), () => _openAttachmentInput('file')),
                  const SizedBox(width: 8),
                  _AttIcon(Icons.storage_outlined, const Color(0xFF34A853), () => _openAttachmentInput('gdrive')),
                  const SizedBox(width: 8),
                  _AttIcon(Icons.play_circle_outline, const Color(0xFFFF0000), () => _openAttachmentInput('youtube')),
                  const Spacer(),
                  HoverScale(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: Text('Cancel',
                          style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: AppTheme.textMuted)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  HoverScale(
                    onTap: _submitting ? null : _submit,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      decoration: BoxDecoration(
                        color: _submitting ? AppTheme.borderColor : AppTheme.darkBanner,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: _submitting
                          ? const SizedBox(width: 16, height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text('Save Changes',
                                style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _input(TextEditingController ctrl, String hint) => TextField(
        controller: ctrl,
        style: GoogleFonts.plusJakartaSans(fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: AppTheme.bodyMd,
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppTheme.borderColor)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppTheme.borderColor)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5)),
        ),
      );

  Widget _dateBtn(String label, String value, VoidCallback onTap) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppTheme.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 11, color: AppTheme.textLight, fontWeight: FontWeight.w500)),
              const SizedBox(height: 4),
              Text(value,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      color: value == 'Select' ? AppTheme.textMuted : AppTheme.textPrimary,
                      fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      );
}

// ── Small helpers ──────────────────────────────────────────────────────────────
