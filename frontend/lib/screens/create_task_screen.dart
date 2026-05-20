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

class CreateTaskScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onCreated;
  final bool isTemplate;
  const CreateTaskScreen({super.key, this.onBack, this.onCreated, this.isTemplate = false});

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
  bool _loadingUsers = true;
  bool _submitting = false;

  final List<Map<String, String>> _attachments = [];

  @override
  void initState() {
    super.initState();
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

  String _fmtDate(DateTime? d) {
    if (d == null) return 'Select';
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${m[d.month-1]} ${d.day}';
  }

  @override
  Widget build(BuildContext context) {
    final selectedUsers = _allAssignable.where((u) => _selectedIds.contains(u.id)).toList();

    final body = Padding(
      padding: const EdgeInsets.fromLTRB(28, 20, 28, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Page Title row ──
          Row(
            children: [
              Text(widget.isTemplate ? 'Create Template' : 'Create Task',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 24, fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary)),
              const Spacer(),
              if (!widget.isTemplate)
                OutlinedButton.icon(
                  onPressed: _openTemplatePicker,
                  icon: const Icon(Icons.library_books_outlined, size: 16),
                  label: Text('Use Template',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.accentBlue,
                    side: const BorderSide(color: AppTheme.accentBlue),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),

          // ── Title field ──
          _FieldLabel('Title'),
          const SizedBox(height: 6),
          _input(_titleCtrl, widget.isTemplate ? 'Template Name' : 'Task Name'),
          const SizedBox(height: 16),

          // ── Assign to | Start Date | End Date | Time ──
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!widget.isTemplate) ...[
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
                                  selectedUsers.isEmpty
                                      ? 'Select'
                                      : selectedUsers.map((u) => u.fullName.split(' ').first).join(', '),
                                  style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      color: selectedUsers.isEmpty
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
                ],
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
                decoration: const InputDecoration(
                  hintText: 'Value',
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.all(14),
                ),
              ),
            ),
          ),

          // ── Attachments box ──
          if (_attachments.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.borderColor),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
                    child: Text('Attachments',
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 12, fontWeight: FontWeight.w600,
                            color: AppTheme.textMuted)),
                  ),
                  const Divider(height: 1, color: AppTheme.borderColor),
                  ..._attachments.asMap().entries.map((e) {
                    final i = e.key;
                    final att = e.value;
                    final icon = _attIcon(att['attachment_type'] ?? 'link');
                    final iconColor = _attColor(att['attachment_type'] ?? 'link');
                    return Container(
                      decoration: i < _attachments.length - 1
                          ? const BoxDecoration(
                              border: Border(bottom: BorderSide(color: AppTheme.borderColor)))
                          : null,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        child: Row(children: [
                          Container(
                            width: 32, height: 32,
                            decoration: BoxDecoration(
                              color: iconColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(icon, size: 16, color: iconColor),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(att['name'] ?? 'Attachment',
                                    style: GoogleFonts.plusJakartaSans(
                                        fontSize: 12, fontWeight: FontWeight.w600,
                                        color: AppTheme.textPrimary),
                                    maxLines: 1, overflow: TextOverflow.ellipsis),
                                if ((att['url'] ?? '').isNotEmpty)
                                  Text(att['url']!,
                                      style: AppTheme.bodySm.copyWith(
                                          color: AppTheme.accentBlue),
                                      maxLines: 1, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () => setState(() => _attachments.removeAt(i)),
                            child: const Icon(Icons.close,
                                size: 16, color: AppTheme.textMuted),
                          ),
                        ]),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],

          const SizedBox(height: 12),

          // ── Bottom bar ──
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
              // ── Cancel with gradient ──
              GestureDetector(
                onTap: () {
                  if (widget.onBack != null) widget.onBack!();
                  else Navigator.pop(context);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6B7280), Color(0xFF374151)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('Cancel',
                      style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: Colors.white)),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: _submitting ? null : _submit,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: _submitting
                        ? null
                        : const LinearGradient(
                            colors: [Color(0xFF6B7280), Color(0xFF374151)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                    color: _submitting ? AppTheme.borderColor : null,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: _submitting
                      ? const SizedBox(width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(widget.isTemplate ? 'Save Template' : 'Submit',
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
    );

    if (widget.onBack != null) {
      return ColoredBox(color: AppTheme.bgColor, child: body);
    }
    return Scaffold(backgroundColor: AppTheme.bgColor, body: SafeArea(child: body));
  }

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

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: GoogleFonts.plusJakartaSans(
          fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary));
}

class _AttIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _AttIcon(this.icon, this.color, this.onTap);

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            color: AppTheme.darkBanner,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 18, color: Colors.white),
        ),
      );
}

// ── Attachment dialog ──────────────────────────────────────────────────────────

class _AttachmentDialog extends StatefulWidget {
  final String type;
  const _AttachmentDialog({required this.type});
  @override
  State<_AttachmentDialog> createState() => _AttachmentDialogState();
}

class _AttachmentDialogState extends State<_AttachmentDialog> {
  final _urlCtrl = TextEditingController(text: 'https://');
  final _nameCtrl = TextEditingController();
  String? _urlError;

  @override
  void dispose() { _urlCtrl.dispose(); _nameCtrl.dispose(); super.dispose(); }

  String get _title => switch (widget.type) {
    'link' => 'Add Link', 'gdrive' => 'Add Google Drive Link',
    'youtube' => 'Add YouTube Video', _ => 'Add File URL',
  };

  String get _urlHint => switch (widget.type) {
    'gdrive' => 'https://drive.google.com/...', 'youtube' => 'https://youtube.com/...',
    _ => 'https://...',
  };

  bool _validate() {
    final url = _urlCtrl.text.trim();
    if (url.isEmpty || url == 'https://') { setState(() => _urlError = 'URL is required'); return false; }
    if (!url.startsWith('http')) { setState(() => _urlError = 'Must start with http://'); return false; }
    setState(() => _urlError = null);
    return true;
  }

  void _confirm() {
    if (!_validate()) return;
    final url = _urlCtrl.text.trim();
    final name = _nameCtrl.text.trim().isEmpty ? _defaultName(url) : _nameCtrl.text.trim();
    Navigator.pop(context, {'attachment_type': widget.type, 'name': name, 'url': url});
  }

  String _defaultName(String url) => switch (widget.type) {
    'youtube' => 'YouTube Video', 'gdrive' => 'Google Drive File',
    'file' => 'Attached File', _ => Uri.tryParse(url)?.host.replaceFirst('www.', '') ?? 'Link',
  };

  @override
  Widget build(BuildContext context) => Dialog(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(_title, style: AppTheme.heading3),
          const Spacer(),
          IconButton(onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
              padding: EdgeInsets.zero, constraints: const BoxConstraints()),
        ]),
        const SizedBox(height: 16),
        Text('URL', style: AppTheme.labelSm),
        const SizedBox(height: 6),
        TextField(controller: _urlCtrl, autofocus: true,
            style: GoogleFonts.plusJakartaSans(fontSize: 14),
            decoration: InputDecoration(hintText: _urlHint, hintStyle: AppTheme.bodyMd, errorText: _urlError,
                filled: true, fillColor: AppTheme.bgColor,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5)))),
        const SizedBox(height: 12),
        Text('Name (optional)', style: AppTheme.labelSm),
        const SizedBox(height: 6),
        TextField(controller: _nameCtrl, style: GoogleFonts.plusJakartaSans(fontSize: 14),
            decoration: InputDecoration(hintText: 'Label for this attachment', hintStyle: AppTheme.bodyMd,
                filled: true, fillColor: AppTheme.bgColor,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5)))),
        const SizedBox(height: 20),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          OutlinedButton(onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: AppTheme.borderColor),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: Text('Cancel', style: AppTheme.labelMd)),
          const SizedBox(width: 10),
          ElevatedButton(onPressed: _confirm,
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.darkBanner,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: const Text('Add')),
        ]),
      ]),
    ),
  );
}

// ── Template picker dialog ─────────────────────────────────────────────────────

class _TemplatePickerDialog extends StatefulWidget {
  const _TemplatePickerDialog();
  @override
  State<_TemplatePickerDialog> createState() => _TemplatePickerDialogState();
}

class _TemplatePickerDialogState extends State<_TemplatePickerDialog> {
  List<TaskTemplate> _templates = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final t = await ApiService.getTemplates();
      if (mounted) setState(() { _templates = t; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Dialog(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    child: SizedBox(
      width: 420,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 12, 8),
            child: Row(children: [
              const Icon(Icons.library_books_outlined,
                  size: 20, color: AppTheme.accentBlue),
              const SizedBox(width: 10),
              Expanded(child: Text('Use a Template', style: AppTheme.heading3)),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppTheme.borderColor),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: CircularProgressIndicator(color: AppTheme.accentBlue),
            )
          else if (_templates.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Text('No templates yet.', style: AppTheme.bodyMd),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 380),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _templates.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, color: AppTheme.borderColor),
                itemBuilder: (_, i) {
                  final t = _templates[i];
                  return InkWell(
                    onTap: () => Navigator.pop(context, t),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 14),
                      child: Row(children: [
                        Container(
                          width: 38, height: 38,
                          decoration: BoxDecoration(
                            color: AppTheme.blueBg,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.description_outlined,
                              size: 18, color: AppTheme.accentBlue),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(t.title, style: AppTheme.labelMd),
                              if (t.instructions != null &&
                                  t.instructions!.isNotEmpty)
                                Text(
                                  t.instructions!.replaceAll('\n', ' '),
                                  style: AppTheme.bodySm,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              if (t.createdByName != null)
                                Text('By ${t.createdByName}',
                                    style: AppTheme.captionSm),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios,
                            size: 14, color: AppTheme.textMuted),
                      ]),
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

// ── Assign picker sheet ────────────────────────────────────────────────────────

class _AssignPickerSheet extends StatefulWidget {
  final List<User> users;
  final Set<int> selected;
  final ValueChanged<Set<int>> onChanged;
  const _AssignPickerSheet({required this.users, required this.selected, required this.onChanged});
  @override
  State<_AssignPickerSheet> createState() => _AssignPickerSheetState();
}

class _AssignPickerSheetState extends State<_AssignPickerSheet> {
  late Set<int> _local;
  String _search = '';

  @override
  void initState() { super.initState(); _local = Set.from(widget.selected); }

  List<User> get _filtered => _search.isEmpty
      ? widget.users
      : widget.users.where((u) => u.fullName.toLowerCase().contains(_search.toLowerCase())).toList();

  @override
  Widget build(BuildContext context) => DraggableScrollableSheet(
    initialChildSize: 0.75, maxChildSize: 0.95, minChildSize: 0.4,
    builder: (_, ctrl) => Container(
      decoration: const BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Column(children: [
        Container(width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(color: AppTheme.borderColor, borderRadius: BorderRadius.circular(2))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            Text('Select Personnel', style: AppTheme.heading3),
            const Spacer(),
            TextButton(
              onPressed: () { widget.onChanged(_local); Navigator.pop(context); },
              child: Text('Done (${_local.length})',
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600,
                      color: AppTheme.accentBlue, fontSize: 14)),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(hintText: 'Search by name...', hintStyle: AppTheme.bodyMd,
                prefixIcon: const Icon(Icons.search, size: 18, color: AppTheme.textMuted),
                filled: true, fillColor: AppTheme.bgColor,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
          ),
        ),
        const Divider(height: 1, color: AppTheme.borderColor),
        Expanded(
          child: _filtered.isEmpty
              ? Center(child: Text('No personnel found', style: AppTheme.bodyMd))
              : ListView.builder(
                  controller: ctrl, itemCount: _filtered.length,
                  itemBuilder: (_, i) {
                    final u = _filtered[i];
                    final checked = _local.contains(u.id);
                    return CheckboxListTile(
                      value: checked,
                      onChanged: (_) => setState(() => checked ? _local.remove(u.id) : _local.add(u.id)),
                      title: Text(u.fullName, style: AppTheme.labelMd),
                      subtitle: Text('${u.roleLabel}${u.gradeLevel != null ? ' · ${u.gradeLevel}' : ''}',
                          style: AppTheme.bodySm),
                      secondary: CircleAvatar(radius: 18, backgroundColor: AppTheme.sidebarActive,
                          child: Text(u.initials, style: const TextStyle(color: Colors.white,
                              fontSize: 13, fontWeight: FontWeight.w700))),
                      activeColor: AppTheme.accentBlue,
                      controlAffinity: ListTileControlAffinity.trailing,
                    );
                  }),
        ),
      ]),
    ),
  );
}
