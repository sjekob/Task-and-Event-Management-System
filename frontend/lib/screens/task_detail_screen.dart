import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import 'edit_task_screen.dart';
import '../utils/web_file_picker.dart';
import '../utils/web_downloader.dart';

class TaskDetailScreen extends StatefulWidget {
  final int taskId;
  final VoidCallback? onBack;
  const TaskDetailScreen({super.key, required this.taskId, this.onBack});

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  Task? _task;
  bool _loading = true;
  Report? _selectedReport;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final task = await ApiService.getTask(widget.taskId);
      if (mounted) {
        setState(() {
          _task = task;
          _loading = false;
          if (task.reports.isNotEmpty) _selectedReport = task.reports.first;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendComment(String content, String type, {int? reportId}) async {
    try {
      await ApiService.addComment(widget.taskId, content, type, reportId: reportId);
      _load();
    } catch (e) {
      _showSnack(e.toString(), error: true);
    }
  }

  Future<void> _deleteComment(int commentId) async {
    try {
      await ApiService.deleteComment(commentId);
      if (mounted) _load();
    } catch (e) {
      if (mounted) _showSnack(e.toString(), error: true);
    }
  }

  Future<void> _editComment(int commentId, String current) async {
    final ctrl = TextEditingController(text: current);
    final result = await showDialog<String>(
      context: context,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        child: SizedBox(
          width: 380,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Edit Comment',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 14),
                TextField(
                  controller: ctrl,
                  maxLines: 4,
                  autofocus: true,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.all(12),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text('Cancel', style: AppTheme.labelMd),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () => Navigator.pop(context, ctrl.text.trim()),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.darkBanner),
                      child: const Text('Save',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    ctrl.dispose();
    if (!mounted) return;
    if (result != null && result.isNotEmpty) {
      try {
        await ApiService.editComment(commentId, result);
        if (mounted) _load();
      } catch (e) {
        if (mounted) _showSnack(e.toString(), error: true);
      }
    }
  }

  void _showSnack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? AppTheme.redColor : AppTheme.darkBanner,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final user = context.read<AppState>().currentUser;
    if (user == null) return const SizedBox.shrink();

    final canAssign = user.canAssign;
    final canReview = user.canReviewSubmissions;
    final canSubmit = user.isTeacher || user.isRegistrar || user.isDean;
    final isReviewOnly = canReview && !canSubmit; // principal/admin/coordinator

    if (_loading) {
      final loader = const Center(child: CircularProgressIndicator(color: AppTheme.accentBlue));
      if (widget.onBack != null) return loader;
      return Scaffold(backgroundColor: AppTheme.bgColor, body: loader);
    }

    if (_task == null) {
      final notFound = Center(child: Text('Task not found', style: AppTheme.bodyMd));
      if (widget.onBack != null) return notFound;
      return Scaffold(backgroundColor: AppTheme.bgColor, body: notFound);
    }

    final body = isMobile
        ? _buildMobileLayout(user, canAssign, canReview, canSubmit, isReviewOnly)
        : _buildDesktopLayout(user, canAssign, canReview, canSubmit, isReviewOnly);

    if (widget.onBack != null) return body;
    return Scaffold(backgroundColor: AppTheme.bgColor, body: body);
  }

  Widget _buildDesktopLayout(User user, bool canAssign, bool canReview, bool canSubmit, bool isReviewOnly) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(28, 14, 28, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _BackButton(onBack: widget.onBack),
                _buildMainContent(user, canAssign, canReview,
                    canManage: user.isAdmin || user.isPrincipal),
              ],
            ),
          ),
        ),
        Container(
          width: 320,
          decoration: BoxDecoration(
            color: isReviewOnly ? Colors.white : AppTheme.bgColor,
            border: const Border(left: BorderSide(color: AppTheme.borderColor)),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
            child: isReviewOnly
                ? _buildReviewSidebar()
                : _buildSubmitSidebar(user),
          ),
        ),
      ],
    );
  }

  Widget _buildMobileLayout(User user, bool canAssign, bool canReview, bool canSubmit, bool isReviewOnly) {
    return SingleChildScrollView(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _BackButton(onBack: widget.onBack),
                _buildMainContent(user, canAssign, canReview,
                    canManage: user.isAdmin || user.isPrincipal),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderColor),
          Padding(
            padding: const EdgeInsets.all(16),
            child: isReviewOnly
                ? _buildReviewSidebar()
                : _buildSubmitSidebar(user),
          ),
        ],
      ),
    );
  }

  Widget _buildMainContent(User user, bool canAssign, bool canReview,
      {bool canManage = false}) {
    final t = _task!;
    final isLeaf = user.isTeacher || user.isRegistrar;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Title row
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(child: Text('📋', style: TextStyle(fontSize: 22))),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.title, style: AppTheme.heading2),
                  Text(_fmtDate(t.startDate ?? ''), style: AppTheme.bodyMd),
                ],
              ),
            ),
            if (canManage)
              IconButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => EditTaskScreen(task: t)),
                ).then((_) => _load()),
                icon: const Icon(Icons.edit_outlined, size: 20, color: AppTheme.textMuted),
                tooltip: 'Edit Task',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
          ],
        ),
        const SizedBox(height: 16),

        // Submission status badge
        if (isLeaf)
          Row(children: [
            t.isSubmitted ? StatusBadge.submitted() : StatusBadge.pending(),
          ]),

        // Team progress badge for reviewers
        if (canReview && t.teamTotal != null) ...[
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.blueBg,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${t.teamSubmitted ?? 0} / ${t.teamTotal} submitted',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.accentBlue),
            ),
          ),
        ],
        // Dean own submission status badge
        if (user.isDean) ...[
          const SizedBox(height: 4),
          Row(children: [
            t.isSubmitted ? StatusBadge.submitted() : StatusBadge.pending(),
          ]),
        ],
        const SizedBox(height: 14),

        if (t.instructions != null)
          Text(t.instructions!, style: AppTheme.bodyMd.copyWith(height: 1.75)),
        const SizedBox(height: 14),

        _DeadlineBox(date: t.endDate ?? '', time: t.dueTime ?? '11:59 PM'),
        const SizedBox(height: 8),
        _PointsBox(task: t),
        const SizedBox(height: 16),

        // Assign Users section
        if (canAssign) ...[
          _AssignSection(
            taskId: t.id,
            assignedUsers: t.assignedUsers,
            onAssigned: _load,
          ),
          const SizedBox(height: 16),
        ],

        // Public Comments
        Row(children: [
          const Icon(Icons.chat_bubble_outline, size: 16, color: AppTheme.textMuted),
          const SizedBox(width: 6),
          Flexible(child: Text('Public Comments', style: AppTheme.heading3)),
        ]),
        const SizedBox(height: 10),
        CommentInputField(
          placeholder: 'Add a comment...',
          onSend: (c) => _sendComment(c, 'public'),
        ),
        const SizedBox(height: 8),
        if (t.publicComments.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text('No comments yet.', style: AppTheme.bodyMd),
          )
        else
          ...t.publicComments.map((c) => CommentItem(
                comment: c,
                onEdit: c.userId == user.id
                    ? () => _editComment(c.id, c.content)
                    : null,
                onDelete: c.userId == user.id
                    ? () => _deleteComment(c.id)
                    : null,
              )),

        // Team submissions list (for reviewers)
        if (canReview && t.reports.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Team Submissions', style: AppTheme.heading3),
          const SizedBox(height: 10),
          ...t.reports.map((r) => _ReportListItem(
                report: r,
                isSelected: _selectedReport?.id == r.id,
                onTap: () => setState(() => _selectedReport = r),
                onStatusChange: (status) async {
                  await ApiService.updateReportStatus(r.id, status);
                  _load();
                },
              )),
        ],
      ],
    );
  }

  // Sidebar for roles that can only review (principal/admin/coordinator)
  Widget _buildReviewSidebar() {
    if (_selectedReport == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 6),
          Text('Report Details', style: AppTheme.heading3),
          const SizedBox(height: 10),
          Text('Select a submission to review', style: AppTheme.bodyMd),
        ],
      );
    }
    final r = _selectedReport!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 6),
        Text((r.fullName ?? '').toUpperCase(), style: AppTheme.heading3),
        if (r.gradeLevel != null) ...[
          const SizedBox(height: 4),
          Text(r.gradeLevel!, style: AppTheme.bodySm),
        ],
        const SizedBox(height: 12),
        _StatusChip(status: r.reportStatus),
        const SizedBox(height: 12),
        Text(r.reportTitle, style: AppTheme.labelMd),
        if (r.reportDescription != null) ...[
          const SizedBox(height: 6),
          Text(r.reportDescription!, style: AppTheme.bodyMd),
        ],
        if (r.reportFilename != null && r.reportFilePath != null) ...[
          const SizedBox(height: 8),
          _FileItem(
            filename: r.reportFilename!,
            url: '${ApiService.baseUrl}${r.reportFilePath!}',
          ),
        ],
        if (r.reportLinkUrl != null) ...[
          const SizedBox(height: 8),
          _LinkItem(url: r.reportLinkUrl!),
        ],
        const SizedBox(height: 16),
        Row(children: [
          const Icon(Icons.lock_outline, size: 15, color: AppTheme.textMuted),
          const SizedBox(width: 6),
          Flexible(child: Text('Private Comments', style: AppTheme.heading3)),
        ]),
        const SizedBox(height: 4),
        Text('Only visible to submitter and reviewer.',
            style: AppTheme.bodySm),
        const SizedBox(height: 10),
        CommentInputField(
          placeholder: 'Add private comment...',
          onSend: (c) => _sendComment(c, 'private', reportId: r.id),
        ),
        const SizedBox(height: 10),
        Builder(builder: (context) {
          final currentUser = context.read<AppState>().currentUser;
          // Show: comments from the submitter OR comments tagged to this report
          final submitterComments = _task!.privateComments
              .where((c) =>
                  c.userId == r.personnelId ||
                  (c.reportId != null && c.reportId == r.id))
              .toList();
          if (submitterComments.isEmpty) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text('No private comments yet.', style: AppTheme.bodyMd),
            );
          }
          return Column(
            children: submitterComments.map((c) => CommentItem(
              comment: c,
              onEdit: c.userId == currentUser?.id
                  ? () => _editComment(c.id, c.content)
                  : null,
              onDelete: c.userId == currentUser?.id
                  ? () => _deleteComment(c.id)
                  : null,
            )).toList(),
          );
        }),
      ],
    );
  }

  // Sidebar for submitters (teacher/registrar/dean)
  Widget _buildSubmitSidebar(User user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 14),
          child: Text('Your Submission',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 16, fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary)),
        ),
        // ── Points preview (only when not yet submitted) ──
        if (_task!.myReport == null)
          _PointsPreviewCard(task: _task!),
        if (_task!.myReport == null) const SizedBox(height: 14),
        _ReportForm(
          taskId: widget.taskId,
          task: _task!,
          existingReport: _task!.myReport,
          onSubmitted: () => _load(),
          onError: (msg) => _showSnack(msg, error: true),
          onUnsubmit: () async {
            try {
              await ApiService.deleteReport(_task!.myReport!.id);
              _load();
            } catch (e) {
              if (mounted) _showSnack(e.toString(), error: true);
            }
          },
        ),
        const SizedBox(height: 14),
        // ── Private Comments card ──
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                child: Text('Private Comments',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 14, fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary)),
              ),
              if (_task!.privateComments.isEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Text('No private comments yet.',
                      style: AppTheme.bodyMd),
                )
              else
                ..._task!.privateComments.map((c) => Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                      child: CommentItem(
                        comment: c,
                        onEdit: c.userId == user.id
                            ? () => _editComment(c.id, c.content)
                            : null,
                        onDelete: c.userId == user.id
                            ? () => _deleteComment(c.id)
                            : null,
                      ),
                    )),
              const Divider(height: 1, color: AppTheme.borderColor),
              _InlineCommentInput(
                userInitials: user.initials,
                onSend: (c) => _sendComment(c, 'private'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _fmtDate(String d) {
    if (d.isEmpty) return '';
    try {
      final dt = DateTime.parse(d);
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      return d;
    }
  }
}

// ── Assign Users Section ──────────────────────────────────────────────────────

class _AssignSection extends StatefulWidget {
  final int taskId;
  final List<User> assignedUsers;
  final VoidCallback onAssigned;

  const _AssignSection({
    required this.taskId,
    required this.assignedUsers,
    required this.onAssigned,
  });

  @override
  State<_AssignSection> createState() => _AssignSectionState();
}

class _AssignSectionState extends State<_AssignSection> {
  void _openAssignDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _AssignDialog(
        taskId: widget.taskId,
        alreadyAssigned: widget.assignedUsers,
      ),
    );
    if (result == true) widget.onAssigned();
  }

  Future<void> _unassign(int userId) async {
    try {
      await ApiService.unassignTask(widget.taskId, userId);
      widget.onAssigned();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppTheme.redColor,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Assigned To', style: AppTheme.heading3),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _openAssignDialog,
                icon: const Icon(Icons.person_add_outlined, size: 16),
                label: const Text('Assign'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.accentBlue,
                  side: const BorderSide(color: AppTheme.accentBlue),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  visualDensity: VisualDensity.compact,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          if (widget.assignedUsers.isEmpty) ...[
            const SizedBox(height: 8),
            Text('No one assigned yet', style: AppTheme.bodyMd),
          ] else ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: widget.assignedUsers.map((u) => _UserChip(
                user: u,
                onRemove: () => _unassign(u.id),
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _UserChip extends StatelessWidget {
  final User user;
  final VoidCallback? onRemove;
  const _UserChip({required this.user, this.onRemove});

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.only(left: 8, right: onRemove != null ? 4 : 8, top: 5, bottom: 5),
        decoration: BoxDecoration(
          color: AppTheme.blueBg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 10,
              backgroundColor: AppTheme.sidebarActive,
              child: Text(user.initials,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 6),
            Text(user.fullName,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.accentBlue)),
            if (onRemove != null) ...[
              const SizedBox(width: 4),
              GestureDetector(
                onTap: onRemove,
                child: const Icon(Icons.close_rounded, size: 14, color: AppTheme.accentBlue),
              ),
            ],
          ],
        ),
      );
}

// ── Assign Dialog ──────────────────────────────────────────────────────────────

class _AssignDialog extends StatefulWidget {
  final int taskId;
  final List<User> alreadyAssigned;

  const _AssignDialog({required this.taskId, required this.alreadyAssigned});

  @override
  State<_AssignDialog> createState() => _AssignDialogState();
}

class _AssignDialogState extends State<_AssignDialog> {
  List<User> _available = [];
  final Set<int> _selected = {};
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    try {
      final users = await ApiService.getAssignableUsers();
      final assignedIds = widget.alreadyAssigned.map((u) => u.id).toSet();
      if (mounted) {
        setState(() {
          _available = users.where((u) => !assignedIds.contains(u.id)).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _confirm() async {
    if (_selected.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await ApiService.assignTask(widget.taskId, _selected.toList());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppTheme.redColor,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 400,
        constraints: const BoxConstraints(maxHeight: 520),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Text('Assign Users', style: AppTheme.heading2),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, color: AppTheme.textMuted),
              ),
            ]),
            const SizedBox(height: 4),
            Text('Select personnel to assign this task to',
                style: AppTheme.bodySm),
            const SizedBox(height: 16),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.accentBlue))
                  : _error != null
                      ? Center(child: Text(_error!, style: AppTheme.bodyMd))
                      : _available.isEmpty
                          ? Center(
                              child: Text('No available personnel to assign',
                                  style: AppTheme.bodyMd))
                          : ListView.builder(
                              itemCount: _available.length,
                              itemBuilder: (_, i) {
                                final u = _available[i];
                                final checked = _selected.contains(u.id);
                                return CheckboxListTile(
                                  value: checked,
                                  onChanged: (_) => setState(() {
                                    if (checked) {
                                      _selected.remove(u.id);
                                    } else {
                                      _selected.add(u.id);
                                    }
                                  }),
                                  title: Text(u.fullName, style: AppTheme.labelMd),
                                  subtitle: Text(
                                    '${u.roleLabel}${u.gradeLevel != null ? ' · ${u.gradeLevel}' : ''}',
                                    style: AppTheme.bodySm,
                                  ),
                                  secondary: CircleAvatar(
                                    radius: 16,
                                    backgroundColor: AppTheme.sidebarActive,
                                    child: Text(u.initials,
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700)),
                                  ),
                                  activeColor: AppTheme.accentBlue,
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                );
                              },
                            ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel', style: AppTheme.labelMd),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  onPressed: (_selected.isEmpty || _submitting) ? null : _confirm,
                  child: _submitting
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text('Assign ${_selected.isEmpty ? '' : '(${_selected.length})'}'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Report submission form ────────────────────────────────────────────────────

class _ReportForm extends StatefulWidget {
  final int taskId;
  final Task task;
  final Report? existingReport;
  final VoidCallback onSubmitted;
  final ValueChanged<String> onError;
  final VoidCallback? onUnsubmit;

  const _ReportForm({
    required this.taskId,
    required this.task,
    required this.existingReport,
    required this.onSubmitted,
    required this.onError,
    this.onUnsubmit,
  });

  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<_ReportForm> {
  bool _showAddOptions = false;
  String? _selectedType; // 'file' or 'link'
  final _linkCtrl = TextEditingController();
  List<int>? _pickedFileBytes;
  String? _fileName;
  bool _submitting = false;

  @override
  void dispose() {
    _linkCtrl.dispose();
    super.dispose();
  }

  bool get _hasContent =>
      _fileName != null || _linkCtrl.text.trim().isNotEmpty;

  Future<void> _pickFile() async {
    final result = await pickWebFile();
    if (result != null && mounted) {
      setState(() {
        _pickedFileBytes = result['bytes'] as List<int>;
        _fileName = result['name'] as String;
        _showAddOptions = false;
      });
    }
  }

  Future<void> _submit() async {
    if (!_hasContent) return;
    setState(() => _submitting = true);
    try {
      final title = _selectedType == 'link'
          ? _linkCtrl.text.trim()
          : (_fileName ?? 'File submission');
      await ApiService.submitReport(
        widget.taskId,
        reportTitle: title,
        reportType: _selectedType,
        reportLinkUrl: _selectedType == 'link' ? _linkCtrl.text.trim() : null,
      );
      // Upload file bytes if file was picked
      if (_selectedType == 'file' && _pickedFileBytes != null) {
        try {
          await ApiService.uploadReportFile(widget.taskId, _pickedFileBytes!, _fileName!);
        } catch (_) {} // file upload failure is non-critical
      }
      if (mounted) widget.onSubmitted();
    } catch (e) {
      widget.onError(e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.existingReport != null) return _buildSubmittedState();
    return _buildFormState();
  }

  Widget _buildFormState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Files & Links card ──
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                child: Text('Files & Links',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 14, fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: _hasContent
                    ? _buildAddedPreview()
                    : Text('No files added yet', style: AppTheme.bodySm),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                child: OutlinedButton(
                  onPressed: () => setState(() {
                    _showAddOptions = !_showAddOptions;
                    if (!_showAddOptions) _selectedType = null;
                  }),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.textPrimary,
                    side: const BorderSide(color: AppTheme.borderColor),
                    backgroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    minimumSize: const Size(double.infinity, 0),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text('+ Add File or Link',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 13, fontWeight: FontWeight.w500)),
                ),
              ),
              if (_showAddOptions) ...[
                const Divider(height: 1, color: AppTheme.borderColor),
                _OptionRow(
                  icon: Icons.insert_drive_file_outlined,
                  label: 'Files',
                  onTap: () => setState(() {
                    _selectedType = 'file';
                    _showAddOptions = false;
                  }),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16,
                    color: AppTheme.borderColor),
                _OptionRow(
                  icon: Icons.link_rounded,
                  label: 'Links',
                  onTap: () => setState(() {
                    _selectedType = 'link';
                    _showAddOptions = false;
                  }),
                ),
              ],
              if (_selectedType == 'file') ...[
                const Divider(height: 1, color: AppTheme.borderColor),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: OutlinedButton(
                    onPressed: _pickFile,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.textPrimary,
                      side: const BorderSide(color: AppTheme.borderColor),
                      backgroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      minimumSize: const Size(double.infinity, 0),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                      const Icon(Icons.insert_drive_file_outlined, size: 16),
                      const SizedBox(width: 8),
                      Text('Select A File',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 13, fontWeight: FontWeight.w500)),
                    ]),
                  ),
                ),
              ],
              if (_selectedType == 'link') ...[
                const Divider(height: 1, color: AppTheme.borderColor),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: TextField(
                    controller: _linkCtrl,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'www.example.com',
                      hintStyle: AppTheme.bodyMd,
                      suffixIcon: const Icon(Icons.link_rounded, size: 18,
                          color: AppTheme.textMuted),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                              color: AppTheme.borderColor)),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                              color: AppTheme.borderColor)),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                              color: AppTheme.accentBlue)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        // ── Submit button ──
        ElevatedButton.icon(
          onPressed: (_hasContent && !_submitting) ? _submit : null,
          icon: _submitting
              ? const SizedBox(width: 15, height: 15,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.send_outlined, size: 16),
          label: Text('Submit Report',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, fontWeight: FontWeight.w600)),
          style: ElevatedButton.styleFrom(
            backgroundColor:
                _hasContent ? AppTheme.darkBanner : const Color(0xFFCBD5E1),
            disabledBackgroundColor: const Color(0xFFCBD5E1),
            foregroundColor: Colors.white,
            disabledForegroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }

  Widget _buildAddedPreview() {
    if (_selectedType == 'link' && _linkCtrl.text.trim().isNotEmpty) {
      return Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Row(children: [
          const Icon(Icons.link_rounded, size: 14, color: AppTheme.accentBlue),
          const SizedBox(width: 6),
          Expanded(
            child: Text(_linkCtrl.text.trim(),
                style: AppTheme.bodySm.copyWith(color: AppTheme.accentBlue),
                maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ]),
      );
    }
    if (_fileName != null) {
      return Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Row(children: [
          const Icon(Icons.insert_drive_file_outlined,
              size: 14, color: AppTheme.accentBlue),
          const SizedBox(width: 6),
          Expanded(
            child: Text(_fileName!,
                style: AppTheme.bodySm.copyWith(color: AppTheme.textPrimary),
                maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ]),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildSubmittedState() {
    final r = widget.existingReport!;
    final points = _calcPoints();
    final reason = _pointsReason(points);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Submitted badge ──
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppTheme.greenBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.greenColor.withOpacity(0.3)),
          ),
          child: Row(children: [
            const Icon(Icons.check_circle,
                color: AppTheme.greenColor, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Submitted',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 14, fontWeight: FontWeight.w700,
                        color: AppTheme.greenColor)),
                Text('Your report has been received',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 11, color: AppTheme.greenColor.withOpacity(0.75))),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 10),
        // ── Submitted content card ──
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              _SubmissionTypeLabel(type: r.reportType),
            ]),
            const SizedBox(height: 8),
            Text(r.reportTitle,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary)),
            if (r.reportFilename != null && r.reportFilePath != null) ...[
              const SizedBox(height: 8),
              _FileItem(
                filename: r.reportFilename!,
                url: '${ApiService.baseUrl}${r.reportFilePath!}',
              ),
            ],
            if (r.reportLinkUrl != null) ...[
              const SizedBox(height: 8),
              _LinkItem(url: r.reportLinkUrl!),
            ],
          ]),
        ),
        const SizedBox(height: 10),
        // ── Points card ──
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.darkBanner,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Points Earned',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, fontWeight: FontWeight.w500,
                    color: Colors.white.withOpacity(0.65))),
            const SizedBox(height: 6),
            Text('+$points',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 28, fontWeight: FontWeight.w800,
                    color: Colors.white)),
            Text(reason,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, color: Colors.white.withOpacity(0.65))),
            if (r.reportDate.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(children: [
                Icon(Icons.access_time, size: 12,
                    color: Colors.white.withOpacity(0.5)),
                const SizedBox(width: 4),
                Text('Submitted: ${_fmtDateTime(r.reportDate)}',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: Colors.white.withOpacity(0.55))),
              ]),
            ],
          ]),
        ),
        const SizedBox(height: 10),
        // ── Unsubmit ──
        ElevatedButton(
          onPressed: widget.onUnsubmit,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF3D4350),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
          child: Text('Unsubmit',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }

  int _calcPoints() {
    final t = widget.task;
    final r = widget.existingReport!;
    if (t.endDate == null || r.reportDate.isEmpty) return 0;
    try {
      final due = DateTime.parse(t.endDate!);
      final submitted = DateTime.parse(r.reportDate);
      final diff = submitted.difference(due);
      if (diff.inHours <= -24) return t.pointsEarly ?? 100;
      if (diff.inHours <= 0) return t.pointsOntime ?? 100;
      if (diff.inHours <= 24) return t.pointsLate24 ?? 50;
      return t.pointsAfter24 ?? 0;
    } catch (_) {
      return 0;
    }
  }

  String _pointsReason(int points) {
    if (points >= 100) return 'On time';
    if (points >= 50) return 'Late (within 24h)';
    return 'Late (after 24h)';
  }

  String _fmtDateTime(String dt) {
    try {
      final d = DateTime.parse(dt);
      final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
      final m = d.minute.toString().padLeft(2, '0');
      final ampm = d.hour >= 12 ? 'PM' : 'AM';
      return '${d.month}/${d.day}/${d.year}, $h:$m $ampm';
    } catch (_) {
      return dt;
    }
  }
}

// ── Report list item (for reviewer views) ────────────────────────────────────

class _ReportListItem extends StatelessWidget {
  final Report report;
  final bool isSelected;
  final VoidCallback onTap;
  final ValueChanged<String>? onStatusChange;

  const _ReportListItem({
    required this.report,
    required this.isSelected,
    required this.onTap,
    this.onStatusChange,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppTheme.accentBlue : AppTheme.borderColor,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: AppTheme.sidebarActive,
                child: Text(
                  (report.fullName ?? '?')[0].toUpperCase(),
                  style: const TextStyle(
                      color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(report.fullName ?? '', style: AppTheme.labelMd),
                  if (report.gradeLevel != null)
                    Text(report.gradeLevel!, style: AppTheme.bodySm),
                ]),
              ),
              _StatusChip(status: report.reportStatus, small: true),
            ]),
            if (isSelected && report.reportTitle.isNotEmpty) ...[
              const SizedBox(height: 8),
              _SubmissionTypeLabel(type: report.reportType),
              const SizedBox(height: 6),
              Text(report.reportTitle, style: AppTheme.bodyMd),
              if (report.reportDescription != null) ...[
                const SizedBox(height: 4),
                Text(report.reportDescription!, style: AppTheme.bodySm),
              ],
              if (report.reportFilename != null && report.reportFilePath != null) ...[
                const SizedBox(height: 6),
                _FileItem(
                  filename: report.reportFilename!,
                  url: '${ApiService.baseUrl}${report.reportFilePath!}',
                ),
              ],
              if (report.reportLinkUrl != null) ...[
                const SizedBox(height: 6),
                _LinkItem(url: report.reportLinkUrl!),
              ],
              if (onStatusChange != null) ...[
                const SizedBox(height: 10),
                _StatusButtons(
                  onCompleted: () => onStatusChange!('Completed'),
                  onMissing: () => onStatusChange!('Missing'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

// ── Small components ──────────────────────────────────────────────────────────

class _StatusButtons extends StatelessWidget {
  final VoidCallback onCompleted;
  final VoidCallback onMissing;
  const _StatusButtons({required this.onCompleted, required this.onMissing});

  @override
  Widget build(BuildContext context) => Row(children: [
        OutlinedButton(
          onPressed: onCompleted,
          style: OutlinedButton.styleFrom(
            foregroundColor: AppTheme.greenColor,
            side: const BorderSide(color: AppTheme.greenColor),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            visualDensity: VisualDensity.compact,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          ),
          child: const Text('Completed', style: TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 8),
        OutlinedButton(
          onPressed: onMissing,
          style: OutlinedButton.styleFrom(
            foregroundColor: AppTheme.redColor,
            side: const BorderSide(color: AppTheme.redColor),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            visualDensity: VisualDensity.compact,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          ),
          child: const Text('Missing', style: TextStyle(fontSize: 12)),
        ),
      ]);
}

class _StatusChip extends StatelessWidget {
  final String status;
  final bool small;
  const _StatusChip({required this.status, this.small = false});

  @override
  Widget build(BuildContext context) {
    Color bg, fg;
    switch (status) {
      case 'Completed':
        bg = AppTheme.greenBg; fg = AppTheme.greenColor; break;
      case 'Missing':
        bg = AppTheme.redBg; fg = AppTheme.redColor; break;
      default:
        bg = AppTheme.amberBg; fg = const Color(0xFF92400E);
    }
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(status,
          style: GoogleFonts.plusJakartaSans(
              fontSize: small ? 10 : 12, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}

class _LinkItem extends StatelessWidget {
  final String url;
  const _LinkItem({required this.url});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => webOpenUrl(url),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: AppTheme.blueBg,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(children: [
            const Icon(Icons.link, size: 14, color: AppTheme.accentBlue),
            const SizedBox(width: 6),
            Expanded(
              child: Text(url,
                  style: AppTheme.bodySm.copyWith(
                      color: AppTheme.accentBlue,
                      decoration: TextDecoration.underline),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.open_in_new, size: 13, color: AppTheme.accentBlue),
          ]),
        ),
      );
}

class _FileItem extends StatelessWidget {
  final String filename;
  final String url;
  const _FileItem({required this.filename, required this.url});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppTheme.greenColor.withOpacity(0.25)),
        ),
        child: Row(children: [
          const Icon(Icons.insert_drive_file_outlined,
              size: 14, color: AppTheme.greenColor),
          const SizedBox(width: 6),
          Expanded(
            child: Text(filename,
                style: AppTheme.bodySm.copyWith(color: AppTheme.textPrimary),
                maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: () => webDownload(url, filename),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.greenColor,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.download_rounded,
                    size: 12, color: Colors.white),
                const SizedBox(width: 4),
                Text('Download',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 10, fontWeight: FontWeight.w600,
                        color: Colors.white)),
              ]),
            ),
          ),
        ]),
      );
}

class _SubmissionTypeLabel extends StatelessWidget {
  final String? type;
  const _SubmissionTypeLabel({this.type});

  @override
  Widget build(BuildContext context) {
    final isFile = type == 'file';
    final label = isFile ? 'File Attachment' : 'Link Submission';
    final icon = isFile ? Icons.attach_file_rounded : Icons.link_rounded;
    final color = isFile ? AppTheme.greenColor : AppTheme.accentBlue;
    final bg = isFile ? const Color(0xFFF0FDF4) : AppTheme.blueBg;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 11, color: color),
        const SizedBox(width: 4),
        Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 10, fontWeight: FontWeight.w600, color: color)),
      ]),
    );
  }
}

class _BackButton extends StatelessWidget {
  final VoidCallback? onBack;
  const _BackButton({this.onBack});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => onBack != null ? onBack!() : Navigator.pop(context),
        child: Container(
          width: 34, height: 34,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.borderColor, width: 1.5),
            color: Colors.white,
          ),
          child: const Icon(Icons.arrow_back, size: 16),
        ),
      );
}

class _DeadlineBox extends StatelessWidget {
  final String date;
  final String time;
  const _DeadlineBox({required this.date, required this.time});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Row(children: [
          const Text('📅', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Text('Deadline: $date, $time',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.accentBlue)),
        ]),
      );
}

class _PointsBox extends StatelessWidget {
  final Task task;
  const _PointsBox({required this.task});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Text('⚡', style: TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Text('Points System', style: AppTheme.heading3),
          ]),
          const SizedBox(height: 10),
          PointsRow(label: 'Early Submission', value: '+${task.pointsEarly}',
              bgColor: AppTheme.greenBg, valueColor: const Color(0xFF15803D)),
          PointsRow(label: 'On Time', value: '+${task.pointsOntime}',
              bgColor: AppTheme.blueBg, valueColor: const Color(0xFF1D4ED8)),
          PointsRow(label: 'Late (within 24h)', value: '+${task.pointsLate24}',
              bgColor: AppTheme.amberBg, valueColor: const Color(0xFF92400E)),
          PointsRow(label: 'Late (after 24h)', value: '${task.pointsAfter24}',
              bgColor: AppTheme.redBg, valueColor: AppTheme.redColor),
        ]),
      );
}

class _OptionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _OptionRow({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(children: [
            Icon(icon, size: 18, color: AppTheme.textMuted),
            const SizedBox(width: 10),
            Text(label, style: AppTheme.labelMd),
          ]),
        ),
      );
}

class _InlineCommentInput extends StatefulWidget {
  final String userInitials;
  final Function(String) onSend;
  const _InlineCommentInput({required this.userInitials, required this.onSend});

  @override
  State<_InlineCommentInput> createState() => _InlineCommentInputState();
}

class _InlineCommentInputState extends State<_InlineCommentInput> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _send() {
    if (_ctrl.text.trim().isEmpty) return;
    widget.onSend(_ctrl.text.trim());
    _ctrl.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      child: Row(children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: AppTheme.sidebarActive,
          child: Text(widget.userInitials,
              style: const TextStyle(
                  color: Colors.white, fontSize: 11,
                  fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: AppTheme.bgColor,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: TextField(
              controller: _ctrl,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: AppTheme.textPrimary),
              textAlignVertical: TextAlignVertical.center,
              decoration: InputDecoration(
                hintText: 'Add a private comment...',
                hintStyle: AppTheme.bodySm,
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              onSubmitted: (_) => _send(),
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: _send,
          child: const Icon(Icons.send_rounded,
              size: 20, color: AppTheme.textMuted),
        ),
      ]),
    );
  }
}

class _FormLabel extends StatelessWidget {
  final String text;
  const _FormLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Text(text, style: AppTheme.labelSm),
      );
}

// ── Points preview card (shown in sidebar before submission) ─────────────────

class _PointsPreviewCard extends StatelessWidget {
  final Task task;
  const _PointsPreviewCard({required this.task});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.darkBanner,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.bolt_rounded, color: Colors.amber, size: 16),
            const SizedBox(width: 6),
            Text('Points You Can Earn',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w700,
                    color: Colors.white)),
          ]),
          const SizedBox(height: 10),
          _row('Early Submission', '+${task.pointsEarly}',
              const Color(0xFF6EE7B7)),
          _row('On Time', '+${task.pointsOntime}',
              const Color(0xFF93C5FD)),
          _row('Late (within 24h)', '+${task.pointsLate24}',
              const Color(0xFFFCD34D)),
          _row('Late (after 24h)', '${task.pointsAfter24}',
              const Color(0xFFF87171)),
        ],
      ),
    );
  }

  Widget _row(String label, String value, Color valueColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        Expanded(
          child: Text(label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: Colors.white.withOpacity(0.7))),
        ),
        Text(value,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w700,
                color: valueColor)),
      ]),
    );
  }
}
