import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import 'task_detail_screen.dart';

class MyTasksScreen extends StatefulWidget {
  final ValueChanged<int>? onSelectTask;
  const MyTasksScreen({super.key, this.onSelectTask});

  @override
  State<MyTasksScreen> createState() => _MyTasksScreenState();
}

class _MyTasksScreenState extends State<MyTasksScreen> {
  List<Task> _tasks = [];
  bool _loading = true;
  String _search = '';
  String _statusFilter = 'all'; // 'all' | 'pending' | 'submitted'

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final tasks = await ApiService.getAssignedTasks();
      if (mounted) setState(() { _tasks = tasks; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Task> get _filtered {
    return _tasks.where((t) {
      if (_search.isNotEmpty &&
          !t.title.toLowerCase().contains(_search.toLowerCase())) return false;
      if (_statusFilter == 'pending' && t.isSubmitted) return false;
      if (_statusFilter == 'submitted' && !t.isSubmitted) return false;
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(isMobile ? 14 : 24, 8, isMobile ? 14 : 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Banner ──
            const AppBanner(
              title: 'My Tasks',
              subtitle: 'Track your assigned tasks and submit reports on time.',
            ),
            const SizedBox(height: 20),

            // ── Search bar ──
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
            const SizedBox(height: 12),

            // ── Status filter pills ──
            Row(
              children: [
                _FilterPill(label: 'All', active: _statusFilter == 'all',
                    onTap: () => setState(() => _statusFilter = 'all')),
                const SizedBox(width: 8),
                _FilterPill(label: 'Pending', active: _statusFilter == 'pending',
                    onTap: () => setState(() => _statusFilter = 'pending')),
                const SizedBox(width: 8),
                _FilterPill(label: 'Submitted', active: _statusFilter == 'submitted',
                    onTap: () => setState(() => _statusFilter = 'submitted')),
              ],
            ),
            const SizedBox(height: 16),

            // ── Loading ──
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(color: AppTheme.accentBlue),
                ),
              ),

            // ── Empty ──
            if (!_loading && _filtered.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(40),
                  child: Column(children: [
                    Icon(Icons.assignment_outlined, size: 48, color: AppTheme.textLight),
                    const SizedBox(height: 12),
                    Text(
                      _tasks.isEmpty ? 'No tasks assigned yet.' : 'No tasks match your filter.',
                      style: AppTheme.bodyMd,
                    ),
                  ]),
                ),
              ),

            // ── Task cards ──
            if (!_loading)
              ..._filtered.map((t) => _MyTaskCard(
                    task: t,
                    onTap: () {
                      if (widget.onSelectTask != null) {
                        widget.onSelectTask!(t.id);
                      } else {
                        Navigator.push(context,
                            MaterialPageRoute(
                                builder: (_) => TaskDetailScreen(taskId: t.id)),
                        ).then((_) => _load());
                      }
                    },
                  )),
          ],
        ),
      ),
    );
  }
}

// ── Filter pill ───────────────────────────────────────────────────────────────

class _FilterPill extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _FilterPill({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppTheme.darkBanner : AppTheme.cardColor,
            borderRadius: BorderRadius.circular(20),
            boxShadow: active ? null : AppTheme.cardShadow,
          ),
          child: Text(label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : AppTheme.textMuted)),
        ),
      );
}

// ── Task card ─────────────────────────────────────────────────────────────────

class _MyTaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback onTap;

  const _MyTaskCard({required this.task, required this.onTap});

  String _fmtDate(String? d) {
    if (d == null || d.isEmpty) return '';
    try {
      final dt = DateTime.parse(d);
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${m[dt.month-1]} ${dt.day}, ${dt.year}';
    } catch (_) { return d; }
  }

  bool get _isOverdue {
    final end = task.endDate;
    if (end == null || end.isEmpty || task.isSubmitted) return false;
    try { return DateTime.parse(end).isBefore(DateTime.now()); } catch (_) { return false; }
  }

  @override
  Widget build(BuildContext context) {
    final overdue = _isOverdue;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(12),
          boxShadow: AppTheme.cardShadow,
          border: overdue
              ? Border.all(color: AppTheme.redColor.withOpacity(0.35), width: 1.5)
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon column
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: task.isSubmitted ? AppTheme.greenBg : AppTheme.blueBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                task.isSubmitted
                    ? Icons.check_circle_outline
                    : Icons.assignment_outlined,
                size: 22,
                color: task.isSubmitted ? AppTheme.greenColor : AppTheme.accentBlue,
              ),
            ),
            const SizedBox(width: 14),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.title,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 14, fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary)),
                  const SizedBox(height: 4),
                  if (task.subject != null)
                    Text(task.subject!,
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 11, fontWeight: FontWeight.w500,
                            color: AppTheme.accentBlue)),
                  if (task.endDate != null && task.endDate!.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Row(children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 11,
                        color: overdue ? AppTheme.redColor : AppTheme.textLight,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Due ${_fmtDate(task.endDate)}',
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 11, fontWeight: FontWeight.w500,
                            color: overdue ? AppTheme.redColor : AppTheme.textLight),
                      ),
                      if (overdue) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.redBg,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('Overdue',
                              style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10, fontWeight: FontWeight.w600,
                                  color: AppTheme.redColor)),
                        ),
                      ],
                    ]),
                  ],
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

            // Status badge
            task.isSubmitted ? StatusBadge.submitted() : StatusBadge.pending(),
          ],
        ),
      ),
    );
  }
}
