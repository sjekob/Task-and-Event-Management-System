import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import '../widgets/skeleton_widgets.dart';
import '../widgets/school_year_picker.dart';
import 'task_detail_screen.dart';
import 'edit_task_screen.dart';

class TaskManagerScreen extends StatefulWidget {
  final VoidCallback? onCreateTask;
  final VoidCallback? onCreateTemplate;
  final ValueChanged<int>? onSelectTask;
  final String category; // 'common' | 'special' — which task type this screen manages
  const TaskManagerScreen({super.key, this.onCreateTask, this.onCreateTemplate,
      this.onSelectTask, this.category = 'common'});

  @override
  State<TaskManagerScreen> createState() => _TaskManagerScreenState();
}

class _TaskManagerScreenState extends State<TaskManagerScreen> {
  List<Task> _tasks = [];
  bool _loading = true;
  String _search = '';
  String? _errorMsg;
  // Principal-only: 'mine' = tasks they created, 'all' = every task.
  String _scope = 'mine';
  // Current school year by default; earlier years are archived.
  SchoolYearFilter _filter = SchoolYearFilter.current;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _errorMsg = null; });
    try {
      final tasks = await ApiService.getTasks(scope: _scope, filter: _filter);
      final filtered = tasks.where((t) => t.taskCategory == widget.category).toList();
      if (mounted) setState(() { _tasks = filtered; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _errorMsg = e.toString(); });
    }
  }

  void _setScope(String scope) {
    if (_scope == scope) return;
    setState(() => _scope = scope);
    _load();
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
    if (_loading) return const TaskManagerSkeleton();
    final isMobile = MediaQuery.of(context).size.width < 768;
    final role = context.read<AppState>().userRole;

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

            // ── Scope tabs (principal: their created tasks vs. all tasks) and
            // the school year shown (older years are archived) ──
            Wrap(
              spacing: 8,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (context.read<AppState>().can('view_all_tasks')) ...[
                  _ScopeTab(
                    label: 'My Created Tasks',
                    selected: _scope == 'mine',
                    onTap: () => _setScope('mine'),
                  ),
                  _ScopeTab(
                    label: 'All Tasks',
                    selected: _scope == 'all',
                    onTap: () => _setScope('all'),
                  ),
                ],
                SchoolYearPicker(
                  value: _filter,
                  onChanged: (f) { setState(() => _filter = f); _load(); },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // ── Search ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.cardColor,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE3E9F3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.search, size: 18, color: AppTheme.textLight),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      onChanged: (q) => setState(() => _search = q),
                      style: GoogleFonts.plusJakartaSans(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Search tasks by title...',
                        hintStyle: AppTheme.bodyMd,
                        // Override the app-wide filled/outlined field style.
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
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

            // ── Empty ──
            if (!_loading && _errorMsg == null && _active.isEmpty && _disabled.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(40),
                  child: Column(children: [
                    Icon(Icons.assignment_outlined, size: 48, color: AppTheme.textLight),
                    const SizedBox(height: 12),
                    Text(_search.isNotEmpty ? 'No tasks match "$_search"' : 'No tasks in this school year',
                        style: AppTheme.labelMd),
                    if (_search.isEmpty && _filter == SchoolYearFilter.current) ...[
                      const SizedBox(height: 4),
                      Text('Tasks from earlier school years are archived. '
                          'Choose a year in the selector above to see them.',
                          textAlign: TextAlign.center, style: AppTheme.bodySm),
                    ],
                  ]),
                ),
              ),

            // ── Active tasks ──
            if (!_loading && _errorMsg == null && _active.isNotEmpty)
              _SectionLabel(widget.category == 'special' ? 'Active special tasks' : 'Active tasks',
                  _active.length),
            if (!_loading && _errorMsg == null)
              ..._active.map((t) => _TaskCard(
                    task: t,
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
              const SizedBox(height: 14),
              _SectionLabel('Disabled', _disabled.length),
              ..._disabled.map((t) => _TaskCard(
                    task: t,
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: t.id)),
                    ).then((_) => _load()),
                    onEdit: () {},
                    onDisable: () {},
                    onEnable: () => _enable(t.id),
                  )),
            ],
          ],
        ),
      ),
    );
  }

  String _bannerTitle(String role) {
    if (widget.category == 'special') return 'Special Tasks';
    switch (role) {
      case 'admin':
      case 'principal': return 'Task Manager';
      case 'coordinator':
      case 'dean': return 'Task Manager';
      default: return 'Tasks';
    }
  }

  String _bannerSubtitle(String role) {
    if (widget.category == 'special') {
      return 'Create and manage special tasks. Assign to your team.';
    }
    switch (role) {
      case 'admin':
      case 'principal': return 'Create and manage tasks. Assign to your team.';
      case 'coordinator': return 'Manage tasks assigned to you. Reassign to deans or teachers.';
      case 'dean': return 'Manage tasks assigned to you. Assign to your grade-level teachers.';
      default: return 'Tasks assigned to you. Submit reports on time.';
    }
  }
}

// ── Task row card ─────────────────────────────────────────────────────────────

const _monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _dueText(Task t) {
  final dl = t.deadline;
  if (dl == null) return 'No deadline';
  final date = '${_monthsShort[dl.month - 1]} ${dl.day}, ${dl.year}';
  final time = (t.dueTime ?? '').trim();
  return time.isEmpty || time.toUpperCase() == '11:59 PM' ? 'Due $date' : 'Due $date, $time';
}

class _SectionLabel extends StatelessWidget {
  final String text;
  final int count;
  const _SectionLabel(this.text, this.count);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10, top: 4),
        child: Row(children: [
          Text(text, style: GoogleFonts.plusJakartaSans(
              fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.borderColor)),
            child: Text('$count', style: GoogleFonts.plusJakartaSans(
                fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textMuted)),
          ),
        ]),
      );
}

class _TaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDisable;
  final VoidCallback? onEnable;

  const _TaskCard({
    required this.task,
    required this.onTap,
    required this.onEdit,
    required this.onDisable,
    this.onEnable,
  });

  bool get _disabled => task.status != 'active';

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 600;
    final total = task.teamTotal ?? 0;
    final done = task.teamSubmitted ?? 0;
    final complete = total > 0 && done >= total;
    final dl = task.deadline;
    final overdue = !_disabled && !complete && dl != null && dl.isBefore(DateTime.now());
    final dotColor = _disabled
        ? AppTheme.textLight
        : complete ? AppTheme.greenColor : overdue ? AppTheme.redColor : AppTheme.accentBlue;
    final instructions = (task.instructions ?? '').replaceAll('\n', ' ').trim();

    final progress = total == 0
        ? _chip('Not assigned', AppTheme.textMuted, const Color(0xFFF1F5F9))
        : SizedBox(
            width: isMobile ? double.infinity : 150,
            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('$done of $total submitted', style: GoogleFonts.plusJakartaSans(
                  fontSize: 12.5, fontWeight: FontWeight.w600,
                  color: complete ? const Color(0xFF16A34A) : AppTheme.textMuted)),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: done / total,
                  minHeight: 6,
                  backgroundColor: const Color(0xFFEEF2FA),
                  color: complete ? AppTheme.greenColor : AppTheme.accentBlue,
                ),
              ),
            ]),
          );

    final menu = task.canEdit
        ? (_disabled
            ? TextButton(
                onPressed: onEnable,
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF16A34A)),
                child: const Text('Enable'),
              )
            : PopupMenuButton<String>(
                tooltip: 'Task actions',
                icon: const Icon(Icons.more_vert, size: 20, color: AppTheme.textMuted),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                onSelected: (v) {
                  if (v == 'edit') onEdit();
                  if (v == 'disable') onDisable();
                },
                itemBuilder: (_) => [
                  _menuItem('edit', Icons.edit_outlined, 'Edit task', AppTheme.textPrimary),
                  _menuItem('disable', Icons.block_outlined, 'Disable task', AppTheme.redColor),
                ],
              ))
        : const SizedBox(width: 8);

    final info = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(task.title, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: GoogleFonts.plusJakartaSans(fontSize: 15.5, fontWeight: FontWeight.w700,
              color: _disabled ? AppTheme.textMuted : AppTheme.textPrimary)),
      const SizedBox(height: 4),
      Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.flag_outlined, size: 14, color: overdue ? AppTheme.redColor : AppTheme.textLight),
          const SizedBox(width: 4),
          Text(_dueText(task), style: GoogleFonts.plusJakartaSans(fontSize: 12.5,
              fontWeight: overdue ? FontWeight.w600 : FontWeight.w500,
              color: overdue ? AppTheme.redColor : AppTheme.textMuted)),
        ]),
        if (overdue) _chip('Overdue', const Color(0xFFB91C1C), AppTheme.redBg),
        if (complete && !_disabled) _chip('All submitted', const Color(0xFF15803D), AppTheme.greenBg),
        if (_disabled) _chip('Disabled', AppTheme.textMuted, const Color(0xFFF1F5F9)),
      ]),
      if (instructions.isNotEmpty && instructions.toLowerCase() != task.title.toLowerCase()) ...[
        const SizedBox(height: 6),
        Text(instructions, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTheme.bodyMd),
      ],
    ]);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: _disabled ? const Color(0xFFF8FAFC) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 6, 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE3E9F3)),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              Container(
                width: 10, height: 10,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: dotColor.withValues(alpha: 0.25), spreadRadius: 3)]),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: isMobile
                    ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        info, const SizedBox(height: 10), progress,
                      ])
                    : Row(children: [
                        Expanded(child: info),
                        const SizedBox(width: 20),
                        progress,
                      ]),
              ),
              const SizedBox(width: 4),
              menu,
            ]),
          ),
        ),
      ),
    );
  }

  static Widget _chip(String text, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        child: Text(text, style: GoogleFonts.plusJakartaSans(
            fontSize: 11.5, fontWeight: FontWeight.w600, color: fg)),
      );

  static PopupMenuItem<String> _menuItem(String value, IconData icon, String label, Color color) =>
      PopupMenuItem(
        value: value,
        child: Row(children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 10),
          Text(label, style: GoogleFonts.plusJakartaSans(
              fontSize: 13, fontWeight: FontWeight.w500, color: color)),
        ]),
      );
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

class _ScopeTab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _ScopeTab({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? AppTheme.darkBanner : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? AppTheme.darkBanner : AppTheme.borderColor),
        ),
        child: Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppTheme.textMuted,
          ),
        ),
      ),
    );
  }
}
