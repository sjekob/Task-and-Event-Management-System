import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../services/app_state.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

enum _AppraisalTab { specialTasks, events, analytics }

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

class AppraisalScreen extends StatefulWidget {
  const AppraisalScreen({super.key});
  @override
  State<AppraisalScreen> createState() => _AppraisalScreenState();
}

class _AppraisalScreenState extends State<AppraisalScreen> {
  late List<_AppraisalTab> _availableTabs;
  late _AppraisalTab _activeTab;

  List<SpecialTask> _tasks = [];
  List<SchoolEvent> _events = [];
  bool _loadingTasks = true;
  bool _loadingEvents = true;
  String? _taskError;
  String? _eventError;

  @override
  void initState() {
    super.initState();
    final role = context.read<AppState>().userRole;
    if (role == 'dean') {
      _availableTabs = [_AppraisalTab.specialTasks, _AppraisalTab.events];
    } else {
      _availableTabs = [_AppraisalTab.specialTasks, _AppraisalTab.events, _AppraisalTab.analytics];
    }
    _activeTab = _availableTabs.first;
    _loadTasks();
    _loadEvents();
  }

  Future<void> _loadTasks() async {
    setState(() { _loadingTasks = true; _taskError = null; });
    try {
      final t = await ApiService.getSpecialTasks();
      if (mounted) setState(() => _tasks = t);
    } catch (e) {
      if (mounted) setState(() => _taskError = e.toString());
    }
    if (mounted) setState(() => _loadingTasks = false);
  }

  Future<void> _loadEvents() async {
    setState(() { _loadingEvents = true; _eventError = null; });
    try {
      final e = await ApiService.getSchoolEvents();
      if (mounted) setState(() => _events = e);
    } catch (e) {
      if (mounted) setState(() => _eventError = e.toString());
    }
    if (mounted) setState(() => _loadingEvents = false);
  }

  String _tabLabel(_AppraisalTab t) => switch (t) {
    _AppraisalTab.specialTasks => 'Special Tasks',
    _AppraisalTab.events => 'Events',
    _AppraisalTab.analytics => 'Analytics',
  };

  IconData _tabIcon(_AppraisalTab t) => switch (t) {
    _AppraisalTab.specialTasks => Icons.assignment_outlined,
    _AppraisalTab.events => Icons.calendar_month_outlined,
    _AppraisalTab.analytics => Icons.bar_chart_outlined,
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const AppBanner(
          title: 'Performance Appraisal',
          subtitle: 'Evaluate special tasks and events · Track faculty performance · View annual analytics',
        ),
        const SizedBox(height: 20),
        _buildTabBar(),
        const SizedBox(height: 16),
        Expanded(child: _buildBody()),
      ]),
    );
  }

  Widget _buildTabBar() {
    int pendingTasks = _tasks.where((t) => t.status == 'pending').length;
    int pendingEvents = _events.where((e) => e.status == 'pending' || e.status == 'upcoming').length;
    return Row(children: _availableTabs.map((tab) {
      final active = tab == _activeTab;
      int badge = tab == _AppraisalTab.specialTasks ? pendingTasks
          : tab == _AppraisalTab.events ? pendingEvents : 0;
      return Padding(
        padding: const EdgeInsets.only(right: 8),
        child: GestureDetector(
          onTap: () => setState(() => _activeTab = tab),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: active ? AppTheme.darkBanner : Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: active ? AppTheme.darkBanner : Colors.grey.shade300),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(_tabIcon(tab), size: 15, color: active ? Colors.white : AppTheme.textMuted),
              const SizedBox(width: 6),
              Text(_tabLabel(tab),
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500,
                      color: active ? Colors.white : AppTheme.textMuted)),
              if (badge > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                      color: active ? Colors.white24 : Colors.red,
                      borderRadius: BorderRadius.circular(10)),
                  child: Text('$badge',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                          color: active ? Colors.white : Colors.white)),
                ),
              ],
            ]),
          ),
        ),
      );
    }).toList());
  }

  Widget _buildBody() => switch (_activeTab) {
    _AppraisalTab.specialTasks => _SpecialTasksTab(
        tasks: _tasks, loading: _loadingTasks, error: _taskError,
        onRefresh: _loadTasks,
        onEvaluated: (u) { setState(() { final i = _tasks.indexWhere((t) => t.id == u.id); if (i >= 0) _tasks[i] = u; }); }),
    _AppraisalTab.events => _EventsTab(
        events: _events, loading: _loadingEvents, error: _eventError,
        onRefresh: _loadEvents,
        onEvaluated: (u) { setState(() { final i = _events.indexWhere((e) => e.id == u.id); if (i >= 0) _events[i] = u; }); }),
    _AppraisalTab.analytics => _AnalyticsTab(tasks: _tasks, events: _events),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Special Tasks Tab
// ─────────────────────────────────────────────────────────────────────────────

class _SpecialTasksTab extends StatefulWidget {
  final List<SpecialTask> tasks;
  final bool loading;
  final String? error;
  final VoidCallback onRefresh;
  final ValueChanged<SpecialTask> onEvaluated;
  const _SpecialTasksTab({required this.tasks, required this.loading,
      this.error, required this.onRefresh, required this.onEvaluated});
  @override
  State<_SpecialTasksTab> createState() => _SpecialTasksTabState();
}

class _SpecialTasksTabState extends State<_SpecialTasksTab> {
  String? _filterDept;
  String? _filterRole;
  String? _filterPersonnel;

  List<SpecialTask> get _filtered {
    var list = widget.tasks;
    if (_filterDept != null) {
      list = list.where((t) => t.assigneeDepartment == _filterDept).toList();
    }
    if (_filterRole != null) {
      list = list.where((t) => (t.assigneeRole ?? '').toLowerCase() == _filterRole!.toLowerCase()).toList();
    }
    if (_filterPersonnel != null) {
      list = list.where((t) => t.assigneeName == _filterPersonnel).toList();
    }
    return list;
  }

  List<String> get _deptOptions =>
      widget.tasks.map((t) => t.assigneeDepartment ?? '').where((d) => d.isNotEmpty).toSet().toList()..sort();

  List<String> get _roleOptions =>
      widget.tasks.map((t) => t.assigneeRole ?? '').where((r) => r.isNotEmpty).toSet().toList()..sort();

  List<String> get _personnelOptions =>
      widget.tasks.map((t) => t.assigneeName ?? '').where((n) => n.isNotEmpty).toSet().toList()..sort();

  @override
  Widget build(BuildContext context) {
    if (widget.loading) return const Center(child: CircularProgressIndicator());
    if (widget.error != null) return _ErrorPanel(message: widget.error!, onRetry: widget.onRefresh);
    return SingleChildScrollView(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _buildStatCards(),
        const SizedBox(height: 16),
        _buildCoverageSection(),
        const SizedBox(height: 16),
        _buildSubmissionsTable(),
        const SizedBox(height: 16),
        _buildPerformanceSummary(),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildStatCards() {
    final evaluated = widget.tasks.where((t) => t.status == 'evaluated').length;
    final flagged = widget.tasks.where((t) => t.status == 'flagged').length;
    final departments = widget.tasks.map((t) => t.assigneeDepartment ?? '').where((d) => d.isNotEmpty).toSet().length;
    double avgScore = 0;
    final evalTasks = widget.tasks.where((t) => t.evaluation?.weightedAverage != null).toList();
    if (evalTasks.isNotEmpty) {
      avgScore = evalTasks.map((t) => t.scoreOutOf100.toDouble()).reduce((a, b) => a + b) / evalTasks.length;
    }

    return Row(children: [
      Expanded(child: _AppraisalStatCard(
        value: '$evaluated', label: 'Total Faculty Evaluated',
        icon: Icons.check_circle_outline, iconColor: const Color(0xFF22C55E),
        iconBg: const Color(0xFFDCFCE7),
      )),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
        value: '$flagged', label: 'Flagged Personnel',
        icon: Icons.error_outline, iconColor: const Color(0xFFEF4444),
        iconBg: const Color(0xFFFEE2E2),
      )),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
        value: '$departments', label: 'Departments Monitored',
        icon: Icons.group_outlined, iconColor: const Color(0xFF8B5CF6),
        iconBg: const Color(0xFFEDE9FE),
      )),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
        value: avgScore > 0 ? avgScore.toStringAsFixed(0) : '—',
        label: 'School Avg Compliance / 100',
        icon: Icons.emoji_events_outlined, iconColor: const Color(0xFF9CA3AF),
        iconBg: const Color(0xFFF3F4F6),
      )),
    ]);
  }

  Widget _buildCoverageSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Appraisal Coverage — All Evaluation Types',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: _CoverageCard(
              icon: Icons.description_outlined, iconColor: const Color(0xFF3B82F6),
              iconBg: const Color(0xFFEFF6FF),
              title: 'Special Task Timing', subtitle: 'Task completion and timeline')),
          const SizedBox(width: 12),
          Expanded(child: _CoverageCard(
              icon: Icons.calendar_month_outlined, iconColor: const Color(0xFF10B981),
              iconBg: const Color(0xFFECFDF5),
              title: 'Event Evaluation', subtitle: 'Multi-stakeholder')),
          const SizedBox(width: 12),
          Expanded(child: _CoverageCard(
              icon: Icons.assignment_outlined, iconColor: const Color(0xFF8B5CF6),
              iconBg: const Color(0xFFEDE9FE),
              title: 'Special Task Ratings', subtitle: 'Weighted rubric')),
          const SizedBox(width: 12),
          Expanded(child: _CoverageCard(
              icon: Icons.error_outline, iconColor: const Color(0xFFEF4444),
              iconBg: const Color(0xFFFEE2E2),
              title: 'Escalation Threshold', subtitle: 'Below 3 stars auto-flags')),
        ]),
        const SizedBox(height: 12),
        Container(
          width: double.infinity, height: 40,
          decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(8)),
        ),
      ]),
    );
  }

  Widget _buildSubmissionsTable() {
    final filtered = _filtered;
    return Container(
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Title + 3 filters on the right
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
          child: Row(children: [
            Text('Dean Special Task Submissions',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            const Spacer(),
            _buildTripleFilterRow(),
          ]),
        ),
        const Divider(height: 1),
        _buildTableHeader(),
        const Divider(height: 1),
        ...filtered.asMap().entries.map((e) => _buildTableRow(e.value, e.key)),
      ]),
    );
  }

  Widget _buildTripleFilterRow() {
    return Row(children: [
      _FilterDropdown(
        icon: Icons.filter_list,
        label: _filterDept ?? 'By Department',
        options: _deptOptions,
        selected: _filterDept,
        onSelect: (v) => setState(() { _filterDept = v; }),
      ),
      const SizedBox(width: 8),
      _FilterDropdown(
        icon: Icons.filter_list,
        label: _filterRole ?? 'By Role',
        options: _roleOptions,
        selected: _filterRole,
        onSelect: (v) => setState(() { _filterRole = v; }),
      ),
      const SizedBox(width: 8),
      _FilterDropdown(
        icon: null,
        label: _filterPersonnel ?? 'Select personnel...',
        options: _personnelOptions,
        selected: _filterPersonnel,
        onSelect: (v) => setState(() { _filterPersonnel = v; }),
      ),
    ]);
  }

  Widget _buildTableHeader() {
    const style = TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
        color: AppTheme.textMuted, letterSpacing: 0.5);
    return Container(
      color: const Color(0xFFF9FAFB),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(children: [
        SizedBox(width: 52, child: Text('ID', style: style)),
        Expanded(flex: 3, child: Text('PERSONNEL', style: style)),
        Expanded(flex: 2, child: Text('DEPARTMENT', style: style)),
        Expanded(flex: 4, child: Text('TASK', style: style)),
        Expanded(flex: 2, child: Text('ASSIGNED BY', style: style)),
        SizedBox(width: 80, child: Text('DUE DATE', style: style)),
        SizedBox(width: 90, child: Text('SUBMITTED', style: style)),
        SizedBox(width: 80, child: Text('SCORE', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 100, child: Text('STATUS', style: style)),
        SizedBox(width: 90, child: Text('ACTION', style: style, textAlign: TextAlign.end)),
      ]),
    );
  }

  Widget _buildTableRow(SpecialTask task, int idx) {
    final id = 'ST${task.id.toString().padLeft(3, '0')}';
    final isEvaluated = task.status == 'evaluated';
    final isFlagged = task.status == 'flagged';
    final isNotSubmitted = task.status == 'not_submitted';

    return Container(
      decoration: BoxDecoration(
        color: idx.isOdd ? const Color(0xFFFAFAFB) : Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(children: [
        // ID
        SizedBox(width: 52,
            child: Text(id, style: GoogleFonts.plusJakartaSans(
                fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w500))),
        // Personnel
        Expanded(flex: 3, child: Row(children: [
          CircleAvatar(radius: 14, backgroundColor: const Color(0xFFE2E8F0),
              child: const Icon(Icons.person_outline, size: 14, color: AppTheme.textMuted)),
          const SizedBox(width: 8),
          Flexible(child: Text(task.assigneeName ?? '—',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
              overflow: TextOverflow.ellipsis)),
        ])),
        // Department
        Expanded(flex: 2, child: Text(task.assigneeDepartment ?? '—',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted),
            overflow: TextOverflow.ellipsis)),
        // Task
        Expanded(flex: 4, child: Text(task.title,
            style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textPrimary),
            overflow: TextOverflow.ellipsis, maxLines: 1)),
        // Assigned By
        Expanded(flex: 2, child: Text(task.assignerName ?? '—',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted),
            overflow: TextOverflow.ellipsis)),
        // Due Date
        SizedBox(width: 80, child: Text(_fmtDate(task.dueDate),
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted))),
        // Submitted
        SizedBox(width: 90, child: Text(
            (isEvaluated || isFlagged) ? _fmtDate(task.submittedDate) : '—',
            style: GoogleFonts.plusJakartaSans(fontSize: 12,
                color: (isEvaluated || isFlagged)
                    ? const Color(0xFF22C55E) : AppTheme.textMuted))),
        // Score
        SizedBox(width: 80, child: Center(child: isEvaluated || isFlagged
            ? _ScoreBadge(score: task.scoreOutOf100, flagged: isFlagged)
            : Text('—', style: GoogleFonts.plusJakartaSans(
                fontSize: 13, color: AppTheme.textMuted)))),
        // Status
        SizedBox(width: 100, child: _StatusChip(status: task.status)),
        // Action
        SizedBox(width: 90, child: Align(
          alignment: Alignment.centerRight,
          child: isEvaluated || isFlagged
              ? _ActionBtn(label: 'View', dark: false,
                  onTap: () => _showViewDialog(task))
              : _ActionBtn(label: isNotSubmitted ? 'Evaluate' : 'Evaluate', dark: true,
                  onTap: () => _showEvaluateDialog(task)),
        )),
      ]),
    );
  }

  void _showEvaluateDialog(SpecialTask task) async {
    final updated = await showDialog<SpecialTask>(
      context: context,
      builder: (_) => _EvaluateSpecialTaskDialog(task: task),
    );
    if (updated != null) widget.onEvaluated(updated);
  }

  void _showViewDialog(SpecialTask task) {
    showDialog(
      context: context,
      builder: (_) => _ViewSpecialTaskDialog(task: task),
    );
  }

  Widget _buildPerformanceSummary() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFBFDBFE))),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Annual Faculty Performance Summary',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF1D4ED8))),
          const SizedBox(height: 4),
          Text('Aggregated from all event and special task appraisals. Ready for DepEd Annual Faculty Performance Evaluation.',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: const Color(0xFF3B82F6))),
        ])),
        const SizedBox(width: 16),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          ElevatedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.download_outlined, size: 16),
            label: Text('Export Performance Summary',
                style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.darkBanner, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
          const SizedBox(height: 4),
          Text('Last exported: March 15, 2025',
              style: GoogleFonts.plusJakartaSans(fontSize: 11, color: const Color(0xFF3B82F6))),
        ]),
      ]),
    );
  }

  String _fmtDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw.split(' ').first);
      return '${dt.month}/${dt.day}/${dt.year}';
    } catch (_) { return raw; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate Special Task Dialog (2-step)
// ─────────────────────────────────────────────────────────────────────────────

class _EvaluateSpecialTaskDialog extends StatefulWidget {
  final SpecialTask task;
  const _EvaluateSpecialTaskDialog({required this.task});
  @override
  State<_EvaluateSpecialTaskDialog> createState() => _EvaluateSpecialTaskDialogState();
}

class _EvaluateSpecialTaskDialogState extends State<_EvaluateSpecialTaskDialog> {
  int _step = 1; // 1 = info, 2 = rating
  int _completion = 0;
  int _timeliness = 0;
  int _initiative = 0;
  final _remarksCtrl = TextEditingController();
  bool _submitting = false;

  int get _estimatedScore =>
      ((_completion * 40 + _timeliness * 30 + _initiative * 30) / 5).round();

  @override
  void dispose() { _remarksCtrl.dispose(); super.dispose(); }

  String _fmtDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw.split(' ').first);
      return '${dt.month}/${dt.day}/${dt.year}';
    } catch (_) { return raw; }
  }

  Future<void> _submit() async {
    if (_completion == 0 || _timeliness == 0 || _initiative == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please rate all criteria.')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final updated = await ApiService.evaluateSpecialTask(widget.task.id, {
        'completion_quality_score': _completion,
        'timeliness_score': _timeliness,
        'initiative_score': _initiative,
        'coordination_score': _initiative,
        'remarks': _remarksCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context, updated);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Header
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Evaluate Special Task',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                Text(widget.task.title,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, color: AppTheme.textMuted)),
              ])),
              IconButton(onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
                  padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            ]),
            const SizedBox(height: 20),
            if (_step == 1) _buildInfoStep() else _buildRatingStep(),
          ]),
        ),
      ),
    );
  }

  Widget _buildInfoStep() {
    final t = widget.task;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: _InfoField('Personnel', t.assigneeName ?? '—')),
        const SizedBox(width: 24),
        Expanded(child: _InfoField('Department', t.assigneeDepartment ?? '—')),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _InfoField('Assigned By', t.assignerName ?? '—')),
        const SizedBox(width: 24),
        Expanded(child: _InfoField('Supervisor', '—')),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _InfoField('Task', t.title)),
        const SizedBox(width: 24),
        Expanded(child: _InfoField('Submitted', _fmtDate(t.submittedDate))),
      ]),
      const SizedBox(height: 16),
      _InfoField('Due Date', _fmtDate(t.dueDate)),
      const SizedBox(height: 24),
      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
        TextButton(onPressed: () => Navigator.pop(context),
            child: Text('Close', style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w600, color: AppTheme.textMuted))),
        const SizedBox(width: 12),
        ElevatedButton.icon(
          onPressed: () => setState(() => _step = 2),
          icon: const SizedBox(),
          label: Row(children: [
            Text('Start Evaluation',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_forward, size: 16),
          ]),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.darkBanner, foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ]),
    ]);
  }

  Widget _buildRatingStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _StarRatingRow('Task Completion Quality (40%)', _completion,
          (v) => setState(() => _completion = v)),
      const SizedBox(height: 16),
      _StarRatingRow('Timeliness and Reliability (30%)', _timeliness,
          (v) => setState(() => _timeliness = v)),
      const SizedBox(height: 16),
      _StarRatingRow('Initiative and Problem-Solving (30%)', _initiative,
          (v) => setState(() => _initiative = v)),
      const SizedBox(height: 16),
      Text('Remarks', style: GoogleFonts.plusJakartaSans(
          fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
      const SizedBox(height: 6),
      TextField(
        controller: _remarksCtrl, maxLines: 4,
        style: GoogleFonts.plusJakartaSans(fontSize: 13),
        decoration: InputDecoration(
          hintText: 'Add remarks...', hintStyle: AppTheme.bodyMd,
          filled: true, fillColor: Colors.white,
          contentPadding: const EdgeInsets.all(12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppTheme.borderColor)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppTheme.borderColor)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5)),
        ),
      ),
      const SizedBox(height: 10),
      Text('Estimated score: $_estimatedScore/100',
          style: GoogleFonts.plusJakartaSans(
              fontSize: 13, fontWeight: FontWeight.w500, color: AppTheme.textMuted)),
      const SizedBox(height: 20),
      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
        TextButton(onPressed: () => setState(() => _step = 1),
            child: Text('Back', style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w600, color: AppTheme.textMuted))),
        const SizedBox(width: 8),
        TextButton(onPressed: () => Navigator.pop(context),
            child: Text('Close', style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w600, color: AppTheme.textMuted))),
        const SizedBox(width: 12),
        ElevatedButton(
          onPressed: _submitting ? null : _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.darkBanner, foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: _submitting
              ? const SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text('Submit Evaluation',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 13, fontWeight: FontWeight.w600)),
        ),
      ]),
    ]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// View Special Task Evaluation Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _ViewSpecialTaskDialog extends StatelessWidget {
  final SpecialTask task;
  const _ViewSpecialTaskDialog({required this.task});

  String _fmtDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw.split(' ').first);
      return '${dt.month}/${dt.day}/${dt.year}';
    } catch (_) { return raw; }
  }

  @override
  Widget build(BuildContext context) {
    final ev = task.evaluation;
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('View Evaluation', style: GoogleFonts.plusJakartaSans(
                    fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                Text(task.title, style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, color: AppTheme.textMuted)),
              ])),
              IconButton(onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
                  padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            ]),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: _InfoField('Personnel', task.assigneeName ?? '—')),
              const SizedBox(width: 24),
              Expanded(child: _InfoField('Department', task.assigneeDepartment ?? '—')),
            ]),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: _InfoField('Assigned By', task.assignerName ?? '—')),
              const SizedBox(width: 24),
              Expanded(child: _InfoField('Supervisor', '—')),
            ]),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: _InfoField('Task', task.title)),
              const SizedBox(width: 24),
              Expanded(child: _InfoField('Submitted', _fmtDate(task.submittedDate))),
            ]),
            const SizedBox(height: 16),
            _InfoField('Due Date', _fmtDate(task.dueDate)),
            if (ev != null) ...[
              const SizedBox(height: 20),
              const Divider(),
              const SizedBox(height: 12),
              Text('Previous Evaluation:',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              const SizedBox(height: 12),
              _EvalReadRow('Task Completion Quality (40%)', ev.completionScore),
              const SizedBox(height: 8),
              _EvalReadRow('Timeliness and Reliability (30%)', ev.timelinessScore),
              const SizedBox(height: 8),
              _EvalReadRow('Initiative and Problem-Solving (30%)', ev.initiativeScore),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: Text('Total Weighted Score',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(6)),
                  child: Text('${task.scoreOutOf100}/100',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 14, fontWeight: FontWeight.w700,
                          color: const Color(0xFF1D4ED8))),
                ),
              ]),
              if (ev.remarks != null && ev.remarks!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('Coordinator Remarks:',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                const SizedBox(height: 4),
                Text(ev.remarks!,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, color: AppTheme.textMuted)),
              ],
            ],
            const SizedBox(height: 24),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text('Close', style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w600, color: AppTheme.textMuted)),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Events Tab
// ─────────────────────────────────────────────────────────────────────────────

class _EventsTab extends StatefulWidget {
  final List<SchoolEvent> events;
  final bool loading;
  final String? error;
  final VoidCallback onRefresh;
  final ValueChanged<SchoolEvent> onEvaluated;
  const _EventsTab({required this.events, required this.loading,
      this.error, required this.onRefresh, required this.onEvaluated});
  @override
  State<_EventsTab> createState() => _EventsTabState();
}

class _EventsTabState extends State<_EventsTab> {
  String? _filterOrganizer;
  String? _filterStatus;

  List<SchoolEvent> get _filteredEvents {
    var list = widget.events;
    if (_filterOrganizer != null) {
      list = list.where((e) => e.organizerName == _filterOrganizer).toList();
    }
    if (_filterStatus != null) {
      list = list.where((e) => e.status == _filterStatus).toList();
    }
    return list;
  }

  List<String> get _organizerOptions =>
      widget.events.map((e) => e.organizerName ?? '').where((n) => n.isNotEmpty).toSet().toList()..sort();

  List<String> get _statusOptions =>
      widget.events.map((e) => e.status).toSet().toList()..sort();

  @override
  Widget build(BuildContext context) {
    if (widget.loading) return const Center(child: CircularProgressIndicator());
    if (widget.error != null) return _ErrorPanel(message: widget.error!, onRetry: widget.onRefresh);
    return SingleChildScrollView(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _buildStatCards(),
        const SizedBox(height: 16),
        _buildRubricSection(),
        const SizedBox(height: 16),
        _buildEventsTable(),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildStatCards() {
    final pending = widget.events.where((e) => e.status == 'pending' || e.status == 'upcoming').length;
    final evaluated = widget.events.where((e) => e.evaluations.isNotEmpty).length;
    final flagged = widget.events.where((e) => e.status == 'flagged').length;
    double avgRating = 0;
    final withEvals = widget.events.where((e) => e.evaluations.isNotEmpty).toList();
    if (withEvals.isNotEmpty) {
      avgRating = withEvals.map((e) => e.avgRating).reduce((a, b) => a + b) / withEvals.length;
    }
    return Row(children: [
      Expanded(child: _AppraisalStatCard(
          value: '$pending', label: 'Pending Review',
          icon: Icons.calendar_month_outlined, iconColor: const Color(0xFFF59E0B),
          iconBg: const Color(0xFFFEF3C7))),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
          value: '$evaluated', label: 'Evaluated',
          icon: Icons.star_outline, iconColor: const Color(0xFF10B981),
          iconBg: const Color(0xFFECFDF5))),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
          value: '$flagged', label: 'Flagged Alerts',
          icon: Icons.error_outline, iconColor: const Color(0xFFEF4444),
          iconBg: const Color(0xFFFEE2E2))),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
          value: avgRating > 0 ? '${avgRating.toStringAsFixed(1)}/5' : '—',
          label: 'Avg Rating',
          icon: Icons.star_outline, iconColor: const Color(0xFF9CA3AF),
          iconBg: const Color(0xFFF3F4F6))),
    ]);
  }

  Widget _buildRubricSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Event Evaluation Rubric (5-Point Scale)',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: _RubricCard(icon: Icons.calendar_month_outlined,
              iconColor: const Color(0xFF10B981), label: 'Organization', pct: '20%')),
          const SizedBox(width: 12),
          Expanded(child: _RubricCard(icon: Icons.group_outlined,
              iconColor: const Color(0xFFF59E0B), label: 'Engagement', pct: '25%')),
          const SizedBox(width: 12),
          Expanded(child: _RubricCard(icon: Icons.check_circle_outline,
              iconColor: const Color(0xFF8B5CF6), label: 'Content Quality', pct: '30%')),
          const SizedBox(width: 12),
          Expanded(child: _RubricCard(icon: Icons.access_time_outlined,
              iconColor: const Color(0xFFEC4899), label: 'Time Management', pct: '15%')),
          const SizedBox(width: 12),
          Expanded(child: _RubricCard(icon: Icons.sentiment_satisfied_outlined,
              iconColor: const Color(0xFF9CA3AF), label: 'Overall Experience', pct: '10%')),
        ]),
        const SizedBox(height: 12),
        Container(height: 36,
            decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(8))),
      ]),
    );
  }

  Widget _buildEventsTable() {
    final filtered = _filteredEvents;
    return Container(
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
          child: Row(children: [
            Text('School-Wide Events',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            const Spacer(),
            _FilterDropdown(
              icon: Icons.filter_list,
              label: _filterStatus != null ? _filterStatus! : 'By Department',
              options: _statusOptions,
              selected: _filterStatus,
              onSelect: (v) => setState(() => _filterStatus = v),
            ),
            const SizedBox(width: 8),
            _FilterDropdown(
              icon: Icons.filter_list,
              label: 'By Role',
              options: const [],
              selected: null,
              onSelect: (_) {},
            ),
            const SizedBox(width: 8),
            _FilterDropdown(
              icon: null,
              label: _filterOrganizer ?? 'Select personnel...',
              options: _organizerOptions,
              selected: _filterOrganizer,
              onSelect: (v) => setState(() => _filterOrganizer = v),
            ),
          ]),
        ),
        const Divider(height: 1),
        _buildEventTableHeader(),
        const Divider(height: 1),
        ...filtered.asMap().entries.map((e) => _buildEventRow(e.value, e.key)),
      ]),
    );
  }

  Widget _buildEventTableHeader() {
    const style = TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
        color: AppTheme.textMuted, letterSpacing: 0.5);
    return Container(
      color: const Color(0xFFF9FAFB),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(children: [
        Expanded(flex: 4, child: Text('EVENT NAME', style: style)),
        SizedBox(width: 90, child: Text('DATE', style: style)),
        Expanded(flex: 2, child: Text('ORGANIZER', style: style)),
        SizedBox(width: 80, child: Text('RESPONSES', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 90, child: Text('AVG RATING', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 100, child: Text('STATUS', style: style)),
        SizedBox(width: 100, child: Text('ACTION', style: style, textAlign: TextAlign.end)),
      ]),
    );
  }

  Widget _buildEventRow(SchoolEvent event, int idx) {
    final hasEvals = event.evaluations.isNotEmpty;
    final avg = hasEvals ? event.avgRating : 0.0;
    return Container(
      decoration: BoxDecoration(
        color: idx.isOdd ? const Color(0xFFFAFAFB) : Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(children: [
        Expanded(flex: 4, child: Text(event.title,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
            overflow: TextOverflow.ellipsis)),
        SizedBox(width: 90, child: Text(_fmtDate(event.eventDate),
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted))),
        Expanded(flex: 2, child: Text(event.organizerName ?? '—',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted),
            overflow: TextOverflow.ellipsis)),
        SizedBox(width: 80, child: Center(child: Text('${event.evaluations.length}',
            style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textPrimary)))),
        SizedBox(width: 90, child: hasEvals
            ? Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.star, size: 14, color: Colors.amber),
                const SizedBox(width: 2),
                Text('${avg.toStringAsFixed(1)}/5',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
              ])
            : Text('—', style: GoogleFonts.plusJakartaSans(
                fontSize: 12, color: AppTheme.textMuted))),
        SizedBox(width: 100, child: _StatusChip(status: event.status)),
        SizedBox(width: 100, child: Align(
          alignment: Alignment.centerRight,
          child: event.status == 'pending' || event.status == 'upcoming'
              ? Text('No Data', style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: AppTheme.textMuted))
              : _ActionBtn(label: 'View Results', dark: true,
                  onTap: () => _showEventEvalDialog(event)),
        )),
      ]),
    );
  }

  void _showEventEvalDialog(SchoolEvent event) async {
    final updated = await showDialog<SchoolEvent>(
      context: context,
      builder: (_) => _EventEvalDialog(event: event, onSubmitted: widget.onEvaluated),
    );
    if (updated != null) widget.onEvaluated(updated);
  }

  String _fmtDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw.split(' ').first);
      return '${dt.month}/${dt.day}/${dt.year}';
    } catch (_) { return raw; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Evaluation Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _EventEvalDialog extends StatefulWidget {
  final SchoolEvent event;
  final ValueChanged<SchoolEvent> onSubmitted;
  const _EventEvalDialog({required this.event, required this.onSubmitted});
  @override
  State<_EventEvalDialog> createState() => _EventEvalDialogState();
}

class _EventEvalDialogState extends State<_EventEvalDialog> {
  int _planning = 0, _objectives = 0, _personnel = 0,
      _timeMgmt = 0, _engagement = 0, _resource = 0;
  final _commentsCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() { _commentsCtrl.dispose(); super.dispose(); }

  double get _average =>
      (_planning + _objectives + _personnel + _timeMgmt + _engagement + _resource) / 6.0;

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final updated = await ApiService.evaluateSchoolEvent(widget.event.id, {
        'evaluator_name': 'Evaluator',
        'evaluator_role': 'Coordinator',
        'planning_score': _planning,
        'objectives_score': _objectives,
        'personnel_score': _personnel,
        'time_mgmt_score': _timeMgmt,
        'engagement_score': _engagement,
        'resource_score': _resource,
        'feedback_comments': _commentsCtrl.text.trim(),
      });
      widget.onSubmitted(updated);
      if (mounted) Navigator.pop(context, updated);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500, maxHeight: 680),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppTheme.darkBanner,
              borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(12), topRight: Radius.circular(12)),
            ),
            child: Row(children: [
              const Icon(Icons.rate_review_outlined, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Text('Evaluate: ${widget.event.title}',
                  style: const TextStyle(color: Colors.white, fontSize: 15,
                      fontWeight: FontWeight.w700))),
              IconButton(onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.white, size: 18)),
            ]),
          ),
          Expanded(child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Rating Criteria', style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.darkBanner)),
              const SizedBox(height: 10),
              _StarRatingRow('Planning & Preparation', _planning,
                  (v) => setState(() => _planning = v)),
              _StarRatingRow('Achievement of Objectives', _objectives,
                  (v) => setState(() => _objectives = v)),
              _StarRatingRow('Personnel Management', _personnel,
                  (v) => setState(() => _personnel = v)),
              _StarRatingRow('Time Management', _timeMgmt,
                  (v) => setState(() => _timeMgmt = v)),
              _StarRatingRow('Audience Engagement', _engagement,
                  (v) => setState(() => _engagement = v)),
              _StarRatingRow('Resource Management', _resource,
                  (v) => setState(() => _resource = v)),
              if (_planning > 0) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8)),
                  child: Text('Average Score: ${_average.toStringAsFixed(2)} / 5',
                      style: const TextStyle(fontSize: 13,
                          fontWeight: FontWeight.w600, color: Colors.blue)),
                ),
              ],
              const SizedBox(height: 10),
              TextField(controller: _commentsCtrl, maxLines: 6,
                  decoration: InputDecoration(labelText: 'Comments (optional)',
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)))),
            ]),
          )),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              TextButton(onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel')),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.darkBanner, foregroundColor: Colors.white),
                child: _submitting
                    ? const SizedBox(width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Submit'),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Tab
// ─────────────────────────────────────────────────────────────────────────────

class _AnalyticsTab extends StatelessWidget {
  final List<SpecialTask> tasks;
  final List<SchoolEvent> events;
  const _AnalyticsTab({required this.tasks, required this.events});

  @override
  Widget build(BuildContext context) {
    final evaluated = tasks.where((t) => t.evaluation?.weightedAverage != null).toList();
    double overallAvg = 0;
    if (evaluated.isNotEmpty) {
      overallAvg = evaluated.map((t) => t.scoreOutOf100.toDouble())
          .reduce((a, b) => a + b) / evaluated.length;
    }
    final uniquePersonnel = tasks.map((t) => t.assigneeId).whereType<int>().toSet().length;
    final eventEvalCount = events.fold<int>(0, (s, e) => s + e.evaluations.length);

    // Department performance
    final deptMap = <String, List<int>>{};
    for (final t in evaluated) {
      final dept = t.assigneeDepartment ?? 'Unknown';
      deptMap.putIfAbsent(dept, () => []).add(t.scoreOutOf100);
    }
    final deptPerf = deptMap.entries.map((e) {
      final avg = e.value.reduce((a, b) => a + b) / e.value.length;
      return (dept: e.key, avg: avg, count: e.value.length);
    }).toList()..sort((a, b) => b.avg.compareTo(a.avg));

    // Top performers
    final personMap = <String, List<int>>{};
    for (final t in evaluated) {
      final name = t.assigneeName ?? 'Unknown';
      personMap.putIfAbsent(name, () => []).add(t.scoreOutOf100);
    }
    final topPerformers = personMap.entries.map((e) {
      final avg = e.value.reduce((a, b) => a + b) / e.value.length;
      return (name: e.key, avg: avg, count: e.value.length);
    }).toList()..sort((a, b) => b.avg.compareTo(a.avg));

    return SingleChildScrollView(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Stat cards
        Row(children: [
          Expanded(child: _AppraisalStatCard(
              value: overallAvg > 0 ? '${overallAvg.toStringAsFixed(1)}%' : '—',
              label: 'Overall Performance', subLabel: 'Real-time avg',
              icon: Icons.emoji_events_outlined, iconColor: const Color(0xFF10B981),
              iconBg: const Color(0xFFECFDF5))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '$uniquePersonnel', label: 'Total Personnel', subLabel: 'In your scope',
              icon: Icons.group_outlined, iconColor: const Color(0xFF3B82F6),
              iconBg: const Color(0xFFEFF6FF))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '${evaluated.length}', label: 'Special Tasks', subLabel: 'Evaluated tasks',
              icon: Icons.assignment_outlined, iconColor: const Color(0xFFF59E0B),
              iconBg: const Color(0xFFFEF3C7))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '$eventEvalCount', label: 'Events Evaluated', subLabel: 'Real-time count',
              icon: Icons.calendar_month_outlined, iconColor: const Color(0xFF8B5CF6),
              iconBg: const Color(0xFFEDE9FE))),
        ]),
        const SizedBox(height: 16),

        // Monthly trend
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Monthly Performance Trend',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            const SizedBox(height: 16),
            _MonthlyTrendChart(tasks: tasks),
          ]),
        ),
        const SizedBox(height: 16),

        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Department Performance
          Expanded(child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Department Performance',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              const SizedBox(height: 16),
              if (deptPerf.isEmpty)
                Text('No data yet.', style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, color: AppTheme.textMuted))
              else
                ...deptPerf.map((d) => _DeptPerformanceRow(
                    dept: d.dept, avg: d.avg, count: d.count)),
            ]),
          )),
          const SizedBox(width: 16),
          // Top Performers
          Expanded(child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Top Performers',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              const SizedBox(height: 16),
              if (topPerformers.isEmpty)
                Text('No data yet.', style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, color: AppTheme.textMuted))
              else
                ...topPerformers.take(5).toList().asMap().entries.map((e) =>
                    _TopPerformerRow(rank: e.key + 1, name: e.value.name,
                        avg: e.value.avg, taskCount: e.value.count)),
            ]),
          )),
        ]),
        const SizedBox(height: 24),
      ]),
    );
  }
}

class _MonthlyTrendChart extends StatelessWidget {
  final List<SpecialTask> tasks;
  const _MonthlyTrendChart({required this.tasks});

  @override
  Widget build(BuildContext context) {
    final months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
    final now = DateTime.now();
    final monthScores = <String, List<int>>{};
    for (final m in months) { monthScores[m] = []; }
    for (final t in tasks) {
      if (t.evaluation?.weightedAverage == null) continue;
      final dateStr = t.submittedDate ?? '';
      try {
        final dt = DateTime.parse(dateStr.split(' ').first);
        final key = _monthKey(dt);
        if (monthScores.containsKey(key)) {
          monthScores[key]!.add(t.scoreOutOf100);
        }
      } catch (_) {}
    }

    return SizedBox(
      height: 180,
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('100%', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted)),
          Text('50%', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted)),
          Text('0%', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted)),
        ]),
        const SizedBox(width: 8),
        Expanded(child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: months.map((m) {
            final scores = monthScores[m] ?? [];
            final avg = scores.isEmpty ? 0
                : scores.reduce((a, b) => a + b) ~/ scores.length;
            final h = avg == 0 ? 30.0 : (avg / 100.0 * 140).clamp(20.0, 140.0);
            return Column(mainAxisAlignment: MainAxisAlignment.end, children: [
              Container(width: 32, height: h,
                  decoration: BoxDecoration(
                      color: avg == 0 ? Colors.grey.shade200 : AppTheme.darkBanner,
                      borderRadius: BorderRadius.circular(4))),
              const SizedBox(height: 6),
              Text(m, style: GoogleFonts.plusJakartaSans(
                  fontSize: 11, color: AppTheme.textMuted)),
            ]);
          }).toList(),
        )),
      ]),
    );
  }

  String _monthKey(DateTime dt) {
    const map = {9:'Sep',10:'Oct',11:'Nov',12:'Dec',1:'Jan',2:'Feb',3:'Mar',4:'Apr'};
    return map[dt.month] ?? '';
  }
}

class _DeptPerformanceRow extends StatelessWidget {
  final String dept;
  final double avg;
  final int count;
  const _DeptPerformanceRow({required this.dept, required this.avg, required this.count});

  @override
  Widget build(BuildContext context) {
    final pct = avg / 100.0;
    final color = avg >= 80 ? const Color(0xFF22C55E)
        : avg >= 60 ? const Color(0xFF3B82F6) : const Color(0xFFEF4444);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(dept, style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
            Text('$count tasks evaluated', style: GoogleFonts.plusJakartaSans(
                fontSize: 11, color: AppTheme.textMuted)),
          ])),
          Row(children: [
            Icon(Icons.trending_up, size: 14, color: color),
            const SizedBox(width: 2),
            Text('${avg.toStringAsFixed(1)}%',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w700, color: color)),
          ]),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct.clamp(0.0, 1.0),
            minHeight: 6,
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ]),
    );
  }
}

class _TopPerformerRow extends StatelessWidget {
  final int rank;
  final String name;
  final double avg;
  final int taskCount;
  const _TopPerformerRow({required this.rank, required this.name,
      required this.avg, required this.taskCount});

  @override
  Widget build(BuildContext context) {
    final color = avg >= 90 ? const Color(0xFF22C55E)
        : avg >= 75 ? const Color(0xFF3B82F6) : AppTheme.textPrimary;
    final badgeColor = rank == 1 ? const Color(0xFFF59E0B)
        : rank == 2 ? const Color(0xFF9CA3AF) : const Color(0xFFCD7F32);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Container(width: 26, height: 26,
            decoration: BoxDecoration(color: badgeColor, shape: BoxShape.circle),
            child: Center(child: Text('#$rank',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                    color: Colors.white)))),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: GoogleFonts.plusJakartaSans(
              fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          Text('$taskCount task${taskCount != 1 ? 's' : ''}',
              style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted)),
        ])),
        Text('${avg.toStringAsFixed(1)}%',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w700, color: color)),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared small widgets
// ─────────────────────────────────────────────────────────────────────────────

class _ErrorPanel extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorPanel({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.error_outline, color: AppTheme.redColor, size: 48),
          const SizedBox(height: 12),
          Text('Failed to load data', style: GoogleFonts.plusJakartaSans(
              fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          const SizedBox(height: 6),
          Text(message, style: AppTheme.bodyMd, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 16),
            label: Text('Retry', style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w600)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.darkBanner, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable filter dropdown
// ─────────────────────────────────────────────────────────────────────────────

class _FilterDropdown extends StatelessWidget {
  final IconData? icon;
  final String label;
  final List<String> options;
  final String? selected;
  final ValueChanged<String?> onSelect;

  const _FilterDropdown({
    required this.icon,
    required this.label,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String?>(
      onSelected: onSelect,
      enabled: options.isNotEmpty,
      itemBuilder: (_) => [
        PopupMenuItem<String?>(
          value: null,
          child: Text('All', style: GoogleFonts.plusJakartaSans(fontSize: 13)),
        ),
        ...options.map((o) => PopupMenuItem<String?>(
          value: o,
          child: Text(o, style: GoogleFonts.plusJakartaSans(fontSize: 13)),
        )),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: AppTheme.textMuted),
            const SizedBox(width: 6),
          ],
          Text(
            selected ?? label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: selected != null ? AppTheme.textPrimary : AppTheme.textMuted),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.keyboard_arrow_down, size: 15, color: AppTheme.textMuted),
        ]),
      ),
    );
  }
}

class _AppraisalStatCard extends StatelessWidget {
  final String value, label;
  final String? subLabel;
  final IconData icon;
  final Color iconColor, iconBg;
  const _AppraisalStatCard({required this.value, required this.label,
      this.subLabel, required this.icon, required this.iconColor, required this.iconBg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: GoogleFonts.plusJakartaSans(
              fontSize: 28, fontWeight: FontWeight.w800, color: AppTheme.textPrimary)),
          Text(label, style: GoogleFonts.plusJakartaSans(
              fontSize: 12, color: AppTheme.textMuted)),
          if (subLabel != null)
            Text(subLabel!, style: GoogleFonts.plusJakartaSans(
                fontSize: 11, color: AppTheme.textMuted)),
        ])),
        Container(padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(icon, color: iconColor, size: 22)),
      ]),
    );
  }
}

class _CoverageCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor, iconBg;
  final String title, subtitle;
  const _CoverageCard({required this.icon, required this.iconColor,
      required this.iconBg, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, color: iconColor, size: 18)),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: GoogleFonts.plusJakartaSans(
            fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
        Text(subtitle, style: GoogleFonts.plusJakartaSans(
            fontSize: 11, color: AppTheme.textMuted)),
      ])),
    ]);
  }
}

class _RubricCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label, pct;
  const _RubricCard({required this.icon, required this.iconColor,
      required this.label, required this.pct});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1), shape: BoxShape.circle),
          child: Icon(icon, color: iconColor, size: 20)),
      const SizedBox(height: 6),
      Text(label, style: GoogleFonts.plusJakartaSans(
          fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
          textAlign: TextAlign.center),
      Text(pct, style: GoogleFonts.plusJakartaSans(
          fontSize: 11, fontWeight: FontWeight.w600, color: iconColor)),
    ]);
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color; String label; bool hasIcon = false;
    switch (status.toLowerCase()) {
      case 'evaluated':
        color = const Color(0xFF22C55E); label = 'Evaluated'; hasIcon = true; break;
      case 'flagged':
        color = const Color(0xFFEF4444); label = 'Flagged'; break;
      case 'not_submitted':
        color = const Color(0xFFEF4444); label = 'Not Submitted'; break;
      case 'pending':
        color = const Color(0xFFF59E0B); label = 'Pending'; break;
      case 'completed':
        color = const Color(0xFF22C55E); label = 'Completed'; break;
      case 'ongoing':
        color = const Color(0xFF3B82F6); label = 'Ongoing'; break;
      default:
        color = Colors.grey; label = status;
    }
    return Row(mainAxisSize: MainAxisSize.min, children: [
      if (hasIcon) Icon(Icons.check_circle, size: 13, color: color),
      if (hasIcon) const SizedBox(width: 3),
      Text(label, style: GoogleFonts.plusJakartaSans(
          fontSize: 12, fontWeight: FontWeight.w600, color: color)),
    ]);
  }
}

class _ScoreBadge extends StatelessWidget {
  final int score;
  final bool flagged;
  const _ScoreBadge({required this.score, required this.flagged});

  @override
  Widget build(BuildContext context) {
    final Color bg, fg;
    if (flagged || score < 50) {
      bg = const Color(0xFFFEE2E2); fg = const Color(0xFFDC2626);
    } else if (score < 75) {
      bg = const Color(0xFFFEF9C3); fg = const Color(0xFFCA8A04);
    } else {
      bg = const Color(0xFFDCFCE7); fg = const Color(0xFF16A34A);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text('$score/100',
          style: GoogleFonts.plusJakartaSans(
              fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final bool dark;
  final VoidCallback onTap;
  const _ActionBtn({required this.label, required this.dark, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: dark ? AppTheme.darkBanner : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, fontWeight: FontWeight.w600,
                color: dark ? Colors.white : AppTheme.textPrimary)),
      ),
    );
  }
}

Widget _InfoField(String label, String value) => Column(
  crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: GoogleFonts.plusJakartaSans(
        fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w400)),
    const SizedBox(height: 2),
    Text(value, style: GoogleFonts.plusJakartaSans(
        fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
  ]);

Widget _StarRatingRow(String label, int value, ValueChanged<int> onChanged) =>
    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: GoogleFonts.plusJakartaSans(
          fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
      const SizedBox(height: 6),
      Row(children: List.generate(5, (i) {
        final v = i + 1;
        return GestureDetector(
          onTap: () => onChanged(v),
          child: Padding(padding: const EdgeInsets.only(right: 6),
              child: Icon(v <= value ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: v <= value ? Colors.amber : Colors.grey.shade400, size: 28)),
        );
      })),
    ]);

Widget _EvalReadRow(String label, int score) => Padding(
  padding: const EdgeInsets.only(bottom: 4),
  child: Row(children: [
    Expanded(child: Text(label, style: GoogleFonts.plusJakartaSans(
        fontSize: 13, color: AppTheme.textPrimary))),
    Row(children: List.generate(5, (i) => Icon(
        (i + 1) <= score ? Icons.star_rounded : Icons.star_outline_rounded,
        color: (i + 1) <= score ? Colors.amber : Colors.grey.shade300, size: 20))),
  ]),
);
