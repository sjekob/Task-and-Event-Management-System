import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import '../widgets/skeleton_widgets.dart';
import 'edit_task_screen.dart';
import '../utils/web_file_picker.dart';
import '../utils/web_downloader.dart';

part 'task_detail_assign.dart';
part 'task_detail_report_form.dart';
part 'task_detail_widgets.dart';

class TaskDetailScreen extends StatefulWidget {
  final int taskId;
  final VoidCallback? onBack;
  /// True when opened from "My Tasks" — the viewer is acting as a submitter
  /// working on their own assigned task, so assign/review UI (which reveals
  /// who else the task is assigned to) is hidden.
  final bool ownTaskView;
  const TaskDetailScreen({super.key, required this.taskId, this.onBack, this.ownTaskView = false});

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

    // Separation of duties is route-based: in Task Manager (/tasks) the assigner
    // sees who is assigned and team submissions; in My Tasks (/my-tasks,
    // ownTaskView) those are hidden so the user only sees their own work.
    final canAssign = user.canAssign && !widget.ownTaskView;
    final canReview = user.canReviewSubmissions && !widget.ownTaskView;
    final canSubmit = user.isTeacher || user.isRegistrar || user.isDean;
    final isReviewOnly = canReview && !canSubmit; // principal/admin/coordinator

    if (_loading) {
      return TaskDetailSkeleton(hasBack: widget.onBack != null);
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
    final t = _task!;
    final deadlineText = (t.endDate ?? '').isEmpty
        ? 'No due date'
        : 'Due ${_fmtDate(t.endDate!)}, ${t.dueTime ?? '11:59 PM'}';

    return Stack(
      children: [
        // ── Base: task details (scrolls behind the sheet) ──
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 300),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _BackButton(onBack: widget.onBack),
              _buildMainContent(user, canAssign, canReview,
                  canManage: user.isAdmin || user.isPrincipal),
            ],
          ),
        ),

        // ── Draggable "Your work" sheet ──
        DraggableScrollableSheet(
          initialChildSize: 0.42,
          minChildSize: 0.14,
          maxChildSize: 0.92,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: AppTheme.bgColor,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(color: Color(0x22000000), blurRadius: 16, offset: Offset(0, -4)),
                ],
              ),
              child: Column(
                children: [
                  // Drag handle
                  Padding(
                    padding: const EdgeInsets.only(top: 10, bottom: 8),
                    child: Container(
                      width: 40, height: 4,
                      decoration: BoxDecoration(
                        color: AppTheme.borderColor,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  // Header: "Your work" + due date
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                    child: Row(
                      children: [
                        Text('Your work', style: AppTheme.heading3),
                        const Spacer(),
                        Flexible(
                          child: Text(deadlineText,
                              style: AppTheme.bodyMd,
                              textAlign: TextAlign.right,
                              overflow: TextOverflow.ellipsis),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: AppTheme.borderColor),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                      child: isReviewOnly
                          ? _buildReviewSidebar()
                          : _buildSubmitSidebar(user, showHeader: false),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
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
                  if ((t.startDate ?? '').isNotEmpty)
                    Text('Start: ${_fmtDate(t.startDate!)}', style: AppTheme.bodyMd),
                  Text(
                    'Deadline: ${_fmtDate(t.endDate ?? '')}, ${t.dueTime ?? '11:59 PM'}',
                    style: AppTheme.bodyMd.copyWith(
                        fontWeight: FontWeight.w600, color: AppTheme.accentBlue),
                  ),
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
  Widget _buildSubmitSidebar(User user, {bool showHeader = true}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showHeader)
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
