import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import 'task_detail_screen.dart';
import 'edit_task_screen.dart';

class TaskManagerScreen extends StatefulWidget {
  final VoidCallback? onCreateTask;
  final VoidCallback? onCreateTemplate;
  final ValueChanged<int>? onSelectTask;
  const TaskManagerScreen({super.key, this.onCreateTask, this.onCreateTemplate, this.onSelectTask});

  @override
  State<TaskManagerScreen> createState() => _TaskManagerScreenState();
}

class _TaskManagerScreenState extends State<TaskManagerScreen> {
  List<Task> _tasks = [];
  bool _loading = true;
  String _search = '';
  String? _errorMsg;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _errorMsg = null; });
    try {
      final tasks = await ApiService.getTasks();
      if (mounted) setState(() { _tasks = tasks; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _errorMsg = e.toString(); });
    }
  }

  List<Task> get _active => _tasks
      .where((t) =>
          t.status == 'active' &&
          (_search.isEmpty || t.title.toLowerCase().contains(_search.toLowerCase())))
      .toList();

  List<Task> get _disabled => _tasks
      .where((t) =>
          t.status != 'active' &&
          (_search.isEmpty || t.title.toLowerCase().contains(_search.toLowerCase())))
      .toList();

  Future<void> _disable(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => const _ConfirmDisableDialog(),
    );
    if (ok != true) return;
    try {
      await ApiService.updateTask(id, {'status': 'disabled'});
      _showSnack('Task disabled');
      _load();
    } catch (e) {
      _showSnack('Failed: $e', error: true);
    }
  }

  Future<void> _enable(int id) async {
    try {
      await ApiService.updateTask(id, {'status': 'active'});
      _showSnack('Task enabled');
      _load();
    } catch (e) {
      _showSnack('Failed: $e', error: true);
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
    final role = context.read<AppState>().userRole;
    final canManage = role == 'admin' || role == 'principal' ||
        role == 'coordinator' || role == 'dean';

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(isMobile ? 14 : 24, 8, isMobile ? 14 : 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Banner ──
            AppBanner(
              title: _bannerTitle(role),
              subtitle: _bannerSubtitle(role),
            ),
            const SizedBox(height: 20),

            // ── Search ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.cardColor,
                borderRadius: BorderRadius.circular(8),
                boxShadow: AppTheme.cardShadow,
              ),
              child: Row(
                children: [
                  const Icon(Icons.search, size: 16, color: AppTheme.textLight),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      onChanged: (q) => setState(() => _search = q),
                      style: GoogleFonts.plusJakartaSans(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Search tasks...',
                        hintStyle: AppTheme.bodyMd,
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Error ──
            if (_errorMsg != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.redBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.redColor.withOpacity(0.3)),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.error_outline, color: AppTheme.redColor, size: 18),
                    const SizedBox(width: 8),
                    Text('Failed to load tasks', style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.w600, color: AppTheme.redColor)),
                  ]),
                  const SizedBox(height: 6),
                  Text(_errorMsg!, style: AppTheme.bodyMd),
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Retry'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.redColor),
                  ),
                ]),
              ),

            // ── Loading ──
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(color: AppTheme.accentBlue),
                ),
              ),

            // ── Empty ──
            if (!_loading && _errorMsg == null && _active.isEmpty && _disabled.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(40),
                  child: Column(children: [
                    Icon(Icons.assignment_outlined, size: 48, color: AppTheme.textLight),
                    const SizedBox(height: 12),
                    Text('No tasks found', style: AppTheme.bodyMd),
                  ]),
                ),
              ),

            // ── Active Task Cards ──
            if (!_loading && _errorMsg == null)
              ..._active.map((t) => _TaskCard(
                    task: t,
                    canManage: canManage,
                    onTap: () {
                      if (widget.onSelectTask != null) {
                        widget.onSelectTask!(t.id);
                      } else {
                        Navigator.push(context,
                            MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: t.id)),
                        ).then((_) => _load());
                      }
                    },
                    onEdit: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => EditTaskScreen(task: t)),
                    ).then((updated) { if (updated == true) _load(); }),
                    onDisable: () => _disable(t.id),
                  )),

            // ── Disabled Tasks Section ──
            if (!_loading && _errorMsg == null && _disabled.isNotEmpty) ...[
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  Text('Disabled Task',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 12, fontWeight: FontWeight.w600,
                          color: AppTheme.textLight)),
                  const SizedBox(width: 10),
                  Expanded(child: Divider(color: AppTheme.borderColor)),
                ]),
              ),
              ..._disabled.map((t) => _DisabledTaskCard(
                    task: t,
                    onEnable: () => _enable(t.id),
                  )),
            ],
          ],
        ),
      ),
    );
  }

  String _bannerTitle(String role) {
    switch (role) {
      case 'admin':
      case 'principal': return 'Task Manager';
      case 'coordinator':
      case 'dean': return 'Task Manager';
      default: return 'Tasks';
    }
  }

  String _bannerSubtitle(String role) {
    switch (role) {
      case 'admin':
      case 'principal': return 'Create and manage tasks. Assign to your team.';
      case 'coordinator': return 'Manage tasks assigned to you. Reassign to deans or teachers.';
      case 'dean': return 'Manage tasks assigned to you. Assign to your grade-level teachers.';
      default: return 'Tasks assigned to you. Submit reports on time.';
    }
  }
}

// ── Active Task Card ──────────────────────────────────────────────────────────

class _TaskCard extends StatelessWidget {
  final Task task;
  final bool canManage;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDisable;

  const _TaskCard({
    required this.task,
    required this.canManage,
    required this.onTap,
    required this.onEdit,
    required this.onDisable,
  });

  bool get _hasTeam => task.teamTotal != null && (task.teamTotal! > 0);

  String _fmtDate(String? d) {
    if (d == null || d.isEmpty) return '';
    try {
      final dt = DateTime.parse(d);
      return '${dt.month.toString().padLeft(2,'0')} - ${dt.day.toString().padLeft(2,'0')} - ${dt.year}';
    } catch (_) { return d; }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(12),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // ── Content ──
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.title,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 15, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 3),
                  Text(_fmtDate(task.startDate), style: AppTheme.bodySm),
                  if (task.instructions != null && task.instructions!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      task.instructions!.replaceAll('\n', ' ').length > 80
                          ? '${task.instructions!.replaceAll('\n', ' ').substring(0, 80)}...'
                          : task.instructions!.replaceAll('\n', ' '),
                      style: AppTheme.bodyMd,
                    ),
                  ],
                  if (_hasTeam) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: (task.teamSubmitted ?? 0) >= (task.teamTotal ?? 1)
                            ? AppTheme.greenColor : AppTheme.accentBlue,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.people_outlined, size: 13, color: Colors.white),
                        const SizedBox(width: 4),
                        Text('${task.teamSubmitted ?? 0}/${task.teamTotal} submitted',
                            style: GoogleFonts.plusJakartaSans(
                                fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
                      ]),
                    ),
                  ] else if (task.submissionCount > 0) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppTheme.greenColor,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.description_outlined, size: 13, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          '${task.submissionCount} Submission${task.submissionCount > 1 ? "s" : ""}',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white),
                        ),
                      ]),
                    ),
                  ],
                ],
              ),
            ),

            // ── Ellipsis menu ──
            if (canManage) ...[
              const SizedBox(width: 6),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 20, color: AppTheme.textMuted),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                onSelected: (v) {
                  if (v == 'edit') onEdit();
                  if (v == 'disable') onDisable();
                },
                itemBuilder: (_) => [
                  PopupMenuItem(
                    value: 'edit',
                    child: Row(children: [
                      const Icon(Icons.edit_outlined, size: 16, color: AppTheme.accentBlue),
                      const SizedBox(width: 8),
                      Text('Edit',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 13, fontWeight: FontWeight.w500,
                              color: AppTheme.accentBlue)),
                    ]),
                  ),
                  PopupMenuItem(
                    value: 'disable',
                    child: Row(children: [
                      const Icon(Icons.block_outlined, size: 16, color: AppTheme.redColor),
                      const SizedBox(width: 8),
                      Text('Disable',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 13, fontWeight: FontWeight.w500,
                              color: AppTheme.redColor)),
                    ]),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Disabled Task Card ────────────────────────────────────────────────────────

class _DisabledTaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback onEnable;

  const _DisabledTaskCard({required this.task, required this.onEnable});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(task.title,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 15, fontWeight: FontWeight.w600,
                        color: AppTheme.textMuted)),
                if (task.instructions != null && task.instructions!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    task.instructions!.replaceAll('\n', ' ').length > 80
                        ? '${task.instructions!.replaceAll('\n', ' ').substring(0, 80)}...'
                        : task.instructions!.replaceAll('\n', ' '),
                    style: AppTheme.bodyMd,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          ElevatedButton(
            onPressed: onEnable,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.greenColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            child: Text('Enable',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

// ── Confirm Disable Dialog ────────────────────────────────────────────────────

class _ConfirmDisableDialog extends StatelessWidget {
  const _ConfirmDisableDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        width: 360,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 28, 28, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Confirm Disable',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 18, fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary)),
              const SizedBox(height: 10),
              Text('Are you sure you want to disable the task?',
                  textAlign: TextAlign.center,
                  style: AppTheme.bodyMd),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.accentBlue,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text('Yes',
                          style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w600, fontSize: 15)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.accentBlue,
                        side: const BorderSide(color: AppTheme.accentBlue),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text('No',
                          style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w600, fontSize: 15)),
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
}
