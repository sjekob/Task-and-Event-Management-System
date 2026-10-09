import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import '../widgets/skeleton_widgets.dart';
import '../widgets/assign_role_selector.dart';
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
    final canSubmit = user.can('receive_tasks');
    // Opened from Task Manager the viewer is handling the task, so the side
    // panel reviews assignees' submissions; their own submission (if they are
    // also assigned) is done from My Tasks (ownTaskView).
    final isReviewOnly = canReview || canAssign;

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
                    canManage: _task!.canEdit),
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
                  canManage: _task!.canEdit),
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
    final isLeaf = user.can('receive_tasks');
    final reviewing = canAssign || canReview;
    final deadline = t.deadline;
    final pastDue = deadline != null && deadline.isBefore(DateTime.now());

    // Per-assignee status for reviewers: their report (if visible) decides
    // Completed / Pending review / Marked missing; otherwise Submitted (log
    // only), Missing (past deadline) or Not submitted.
    final reportsBy = {for (final r in t.reports) r.personnelId: r};
    // A coordinator/dean who only delegated part of the task tracks the people
    // they assigned (team_scope 'mine'); everything below uses that same set.
    final mineOnly = t.teamScope == 'mine';
    final team = mineOnly
        ? t.assignedUsers.where((u) => t.assignedByOf[u.id] == user.id).toList()
        : t.assignedUsers;
    final submitted = team.where((u) => t.submittedAssigneeIds.contains(u.id)).length;
    final total = team.length;
    final missing = pastDue ? total - submitted : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Header ──
        _DetailCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FA),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                    t.taskCategory == 'special' ? Icons.star_outline_rounded : Icons.assignment_outlined,
                    color: AppTheme.darkBanner, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t.title, style: GoogleFonts.plusJakartaSans(
                      fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.textPrimary,
                      height: 1.25)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    _Pill(t.taskCategory == 'special' ? 'Special task' : 'Task',
                        fg: AppTheme.textMuted, bg: const Color(0xFFF1F5F9)),
                    if (t.status != 'active')
                      const _Pill('Disabled', fg: AppTheme.textMuted, bg: Color(0xFFF1F5F9)),
                    if (isLeaf && !reviewing)
                      t.isSubmitted
                          ? const _Pill('Submitted', fg: Color(0xFF15803D), bg: AppTheme.greenBg)
                          : pastDue
                              ? const _Pill('Missing', fg: Color(0xFFB91C1C), bg: AppTheme.redBg)
                              : const _Pill('Not submitted', fg: Color(0xFF92400E), bg: AppTheme.amberBg),
                  ]),
                ]),
              ),
              if (canManage)
                OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => EditTaskScreen(task: t)),
                  ).then((_) => _load()),
                  icon: const Icon(Icons.edit_outlined, size: 16),
                  label: const Text('Edit task'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.textPrimary,
                    side: const BorderSide(color: AppTheme.borderColor),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
            ]),
            const SizedBox(height: 16),
            const Divider(height: 1, color: AppTheme.borderColor),
            const SizedBox(height: 14),
            Wrap(spacing: 32, runSpacing: 12, children: [
              _MetaItem(
                icon: Icons.play_circle_outline,
                label: 'Start',
                value: (t.startDate ?? '').isEmpty ? 'Not set' : _fmtDate(t.startDate!),
              ),
              _MetaItem(
                icon: Icons.flag_outlined,
                label: 'Deadline',
                value: deadline == null
                    ? 'No deadline'
                    : '${_fmtDate(t.endDate!)}'
                      '${(t.dueTime ?? '').isNotEmpty && t.dueTime!.toUpperCase() != '11:59 PM' ? ', ${t.dueTime}' : ''}',
                emphasis: pastDue ? AppTheme.redColor : AppTheme.textPrimary,
                note: pastDue ? 'Past deadline' : null,
              ),
              if (reviewing)
                _MetaItem(
                  icon: Icons.groups_outlined,
                  label: mineOnly ? 'Assigned by you' : 'Assigned',
                  value: mineOnly
                      ? '$total of ${t.assignedUsers.length} people'
                      : '$total ${total == 1 ? 'person' : 'people'}',
                ),
            ]),
          ]),
        ),
        const SizedBox(height: 16),

        // ── Submission progress (reviewers) ──
        if (reviewing && (total > 0 || mineOnly)) ...[
          _DetailCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text('Submission progress', style: _cardTitle),
                const Spacer(),
                Text('$submitted of $total submitted', style: GoogleFonts.plusJakartaSans(
                    fontSize: 14, fontWeight: FontWeight.w700,
                    color: submitted >= total ? const Color(0xFF15803D) : AppTheme.textPrimary)),
              ]),
              if (mineOnly) ...[
                const SizedBox(height: 2),
                Text('Counting the $total ${total == 1 ? 'person' : 'people'} you assigned '
                    '(${t.assignedUsers.length} on this task in total).', style: AppTheme.caption),
              ],
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: total == 0 ? 0 : submitted / total,
                  minHeight: 10,
                  backgroundColor: const Color(0xFFEEF2FA),
                  color: submitted >= total ? AppTheme.greenColor : AppTheme.accentBlue,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(spacing: 20, runSpacing: 8, children: [
                _Legend(color: AppTheme.greenColor, label: 'Submitted', count: submitted),
                _Legend(color: AppTheme.amberColor, label: 'Not yet submitted',
                    count: (total - submitted - missing).clamp(0, total)),
                _Legend(color: AppTheme.redColor, label: 'Missing (past deadline)', count: missing),
              ]),
            ]),
          ),
          const SizedBox(height: 16),
        ],

        // ── Instructions ──
        _DetailCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Instructions', style: _cardTitle),
            const SizedBox(height: 10),
            Text((t.instructions ?? '').trim().isEmpty ? 'No instructions provided.' : t.instructions!,
                style: AppTheme.bodyLg.copyWith(height: 1.6,
                    color: (t.instructions ?? '').trim().isEmpty ? AppTheme.textLight : AppTheme.textPrimary)),
          ]),
        ),
        const SizedBox(height: 16),

        // ── Assignees with their status (reviewers) ──
        if (reviewing) ...[
          _AssigneesCard(
            taskId: t.id,
            assignedUsers: team,
            allAssigned: t.assignedUsers,
            title: mineOnly ? 'People you assigned' : 'Assigned personnel',
            canEdit: canAssign,
            statusFor: (u) {
              final r = reportsBy[u.id];
              if (r != null) {
                return switch (r.reportStatus) {
                  'Completed' => ('Completed', const Color(0xFF15803D), AppTheme.greenBg),
                  'Missing' => ('Marked missing', const Color(0xFFB91C1C), AppTheme.redBg),
                  _ => ('Pending review', AppTheme.accentBlue, AppTheme.blueBg),
                };
              }
              if (t.submittedAssigneeIds.contains(u.id)) {
                return ('Submitted', const Color(0xFF15803D), AppTheme.greenBg);
              }
              return pastDue
                  ? ('Missing', const Color(0xFFB91C1C), AppTheme.redBg)
                  : ('Not submitted', const Color(0xFF92400E), AppTheme.amberBg);
            },
            selectedUserId: _selectedReport?.personnelId,
            onSelect: (u) {
              final r = reportsBy[u.id];
              if (r != null) setState(() => _selectedReport = r);
            },
            hasReport: (u) => reportsBy.containsKey(u.id),
            onChanged: _load,
          ),
          const SizedBox(height: 16),
        ],

        // ── Public comments ──
        _DetailCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const Icon(Icons.chat_bubble_outline, size: 18, color: AppTheme.textMuted),
              const SizedBox(width: 8),
              Text('Public comments', style: _cardTitle),
              if (t.publicComments.isNotEmpty) ...[
                const SizedBox(width: 8),
                _Pill('${t.publicComments.length}', fg: AppTheme.textMuted, bg: const Color(0xFFF1F5F9)),
              ],
            ]),
            const SizedBox(height: 4),
            Text('Visible to everyone assigned to this task.', style: AppTheme.caption),
            const SizedBox(height: 12),
            if (t.publicComments.isNotEmpty) ...[
              ...t.publicComments.map((c) => CommentItem(
                    comment: c,
                    onEdit: c.userId == user.id ? () => _editComment(c.id, c.content) : null,
                    onDelete: c.userId == user.id ? () => _deleteComment(c.id) : null,
                  )),
              const SizedBox(height: 8),
            ],
            CommentInputField(
              placeholder: 'Add a comment...',
              onSend: (c) => _sendComment(c, 'public'),
            ),
          ]),
        ),
      ],
    );
  }

  TextStyle get _cardTitle => GoogleFonts.plusJakartaSans(
      fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary);

  // Sidebar for roles that can only review (principal/admin/coordinator)
  Widget _buildReviewSidebar() {
    final t = _task!;
    if (_selectedReport == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Submission', style: _cardTitle),
          const SizedBox(height: 24),
          Center(
            child: Column(children: [
              Container(
                width: 56, height: 56,
                decoration: const BoxDecoration(color: Color(0xFFEEF2FA), shape: BoxShape.circle),
                child: const Icon(Icons.description_outlined, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 12),
              Text(t.reports.isEmpty ? 'No submissions yet' : 'No submission selected',
                  style: AppTheme.labelMd),
              const SizedBox(height: 4),
              Text(
                t.reports.isEmpty
                    ? 'Reports appear here once assignees submit.'
                    : 'Choose someone marked "Pending review" or "Completed" to read their report.',
                textAlign: TextAlign.center,
                style: AppTheme.bodySm,
              ),
            ]),
          ),
        ]),
      );
    }
    final r = _selectedReport!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 6),
        Text('Submission', style: AppTheme.caption),
        const SizedBox(height: 6),
        Row(children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppTheme.sidebarActive,
            child: Text((r.fullName ?? '?').isEmpty ? '?' : r.fullName![0].toUpperCase(),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r.fullName ?? '', style: _cardTitle, overflow: TextOverflow.ellipsis),
            if (r.gradeLevel != null) Text(r.gradeLevel!, style: AppTheme.bodySm),
          ])),
          _StatusChip(status: r.reportStatus, small: true),
        ]),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.borderColor),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _SubmissionTypeLabel(type: r.reportType),
            const SizedBox(height: 6),
            Text(r.reportTitle, style: AppTheme.labelMd),
            if (r.reportDescription != null) ...[
              const SizedBox(height: 6),
              Text(r.reportDescription!, style: AppTheme.bodyMd),
            ],
            if (r.reportFilename != null && r.reportFilePath != null) ...[
              const SizedBox(height: 8),
              _FileItem(filename: r.reportFilename!, url: '${ApiService.baseUrl}${r.reportFilePath!}'),
            ],
            if (r.reportLinkUrl != null) ...[
              const SizedBox(height: 8),
              _LinkItem(url: r.reportLinkUrl!),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        Text('Mark this submission as', style: AppTheme.caption),
        const SizedBox(height: 6),
        _StatusButtons(
          onCompleted: () async {
            await ApiService.updateReportStatus(r.id, 'Completed');
            _load();
          },
          onMissing: () async {
            await ApiService.updateReportStatus(r.id, 'Missing');
            _load();
          },
        ),
        const SizedBox(height: 20),
        const Divider(height: 1, color: AppTheme.borderColor),
        const SizedBox(height: 16),
        Row(children: [
          const Icon(Icons.lock_outline, size: 15, color: AppTheme.textMuted),
          const SizedBox(width: 6),
          Flexible(child: Text('Private comments', style: _cardTitle)),
        ]),
        const SizedBox(height: 4),
        Text('Only visible to the submitter and reviewers.', style: AppTheme.bodySm),
        const SizedBox(height: 10),
        Builder(builder: (context) {
          final currentUser = context.read<AppState>().currentUser;
          // Comments from the submitter or tagged to this report.
          final comments = _task!.privateComments
              .where((c) => c.userId == r.personnelId || (c.reportId != null && c.reportId == r.id))
              .toList();
          if (comments.isEmpty) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('No private comments yet.', style: AppTheme.bodyMd),
            );
          }
          return Column(
            children: comments.map((c) => CommentItem(
              comment: c,
              onEdit: c.userId == currentUser?.id ? () => _editComment(c.id, c.content) : null,
              onDelete: c.userId == currentUser?.id ? () => _deleteComment(c.id) : null,
            )).toList(),
          );
        }),
        const SizedBox(height: 8),
        CommentInputField(
          placeholder: 'Add private comment...',
          onSend: (c) => _sendComment(c, 'private', reportId: r.id),
        ),
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
