part of 'appraisal_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Timing Points Tab  (report-submission compliance; all scoring computed server-side)
// ─────────────────────────────────────────────────────────────────────────────

class _TimingPointsTab extends StatefulWidget {
  final List<Map<String, dynamic>> submissions;
  final bool loading;
  final String? error;
  final VoidCallback onRefresh;
  const _TimingPointsTab({required this.submissions, required this.loading,
      this.error, required this.onRefresh});
  @override
  State<_TimingPointsTab> createState() => _TimingPointsTabState();
}

class _TimingPointsTabState extends State<_TimingPointsTab> {
  String _mode = 'all'; // all | personnel | task
  String? _selected;
  final Set<String> _expanded = {};

  List<Map<String, dynamic>> get _filtered {
    var list = widget.submissions;
    if (_mode == 'personnel' && _selected != null) {
      list = list.where((s) => '${s['personnel_name']}' == _selected).toList();
    } else if (_mode == 'task' && _selected != null) {
      list = list.where((s) => '${s['task_name']}' == _selected).toList();
    }
    return list;
  }

  bool get _groupByTask => _mode == 'task';

  int _points(Map<String, dynamic> s) => (s['timing_points'] as num?)?.toInt() ?? 0;
  bool _onTime(Map<String, dynamic> s) => s['timing_status'] == 'On Time';

  Color _statusColor(String? status) {
    switch (status) {
      case 'On Time': return const Color(0xFF16A34A);
      case 'Late within 24 hours': return const Color(0xFFEA580C);
      default: return const Color(0xFFEF4444);
    }
  }

  Color _complianceColor(double pct) {
    if (pct >= 80) return const Color(0xFF16A34A);
    if (pct >= 50) return const Color(0xFFEA580C);
    return const Color(0xFFEF4444);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.loading) return const AppraisalTabSkeleton();
    if (widget.error != null) return _ErrorPanel(message: widget.error!, onRetry: widget.onRefresh);

    final filtered = _filtered;
    final total = filtered.length;
    final totalPts = filtered.fold<int>(0, (a, s) => a + _points(s));
    final onTime = filtered.where(_onTime).length;
    final compliance = total > 0 ? onTime / total * 100 : 0.0;

    return SingleChildScrollView(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: _AppraisalStatCard(
              value: '$total', label: 'Total Reports Submitted',
              subtitle: 'Across all tracked tasks',
              icon: Icons.assignment_turned_in_outlined, iconColor: const Color(0xFF3B82F6),
              iconBg: const Color(0xFFEFF6FF))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '$totalPts pts', label: 'Total Timing Points',
              subtitle: 'Earned from all submissions',
              icon: Icons.timer_outlined, iconColor: const Color(0xFF10B981),
              iconBg: const Color(0xFFECFDF5))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '${compliance.toStringAsFixed(1)}%', label: 'Compliance Rate',
              subtitle: 'On-Time submissions',
              valueColor: _complianceColor(compliance),
              icon: Icons.trending_up, iconColor: const Color(0xFF8B5CF6),
              iconBg: const Color(0xFFF5F3FF))),
        ]),
        const SizedBox(height: 20),
        _buildComplianceSection(filtered),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildComplianceSection(List<Map<String, dynamic>> filtered) {
    final Map<String, List<Map<String, dynamic>>> groups = {};
    for (final s in filtered) {
      final key = _groupByTask ? '${s['task_name']}' : '${s['personnel_name']}';
      groups.putIfAbsent(key, () => []).add(s);
    }
    final keys = groups.keys.toList()..sort();

    return Container(
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
          child: Row(children: [
            Expanded(child: Text('Teacher Submissions & Compliance',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary))),
            _FilterDropdown(
              icon: Icons.tune_rounded,
              label: switch (_mode) { 'personnel' => 'By Personnel', 'task' => 'By Task', _ => 'Show All' },
              options: const ['Show All', 'By Personnel', 'By Task'],
              selected: null,
              onSelect: (v) => setState(() {
                _mode = switch (v) { 'By Personnel' => 'personnel', 'By Task' => 'task', _ => 'all' };
                _selected = null;
              }),
            ),
            if (_mode != 'all') ...[
              const SizedBox(width: 8),
              _FilterDropdown(
                icon: null,
                label: _selected ?? (_mode == 'task' ? 'All Tasks' : 'All Personnel'),
                options: _mode == 'task'
                    ? (widget.submissions.map((s) => '${s['task_name']}').toSet().toList()..sort())
                    : (widget.submissions.map((s) => '${s['personnel_name']}').toSet().toList()..sort()),
                selected: _selected,
                onSelect: (v) => setState(() => _selected = v),
              ),
            ],
            const SizedBox(width: 8),
            IconButton(
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh, size: 18, color: AppTheme.textMuted),
              onPressed: widget.onRefresh,
            ),
          ]),
        ),
        const Divider(height: 1),
        if (keys.isEmpty)
          Padding(
            padding: const EdgeInsets.all(32),
            child: Center(child: Text('No report submissions yet.',
                style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textMuted))),
          )
        else
          ...keys.map((k) => _buildGroupRow(k, groups[k]!)),
      ]),
    );
  }

  Widget _buildGroupRow(String key, List<Map<String, dynamic>> subs) {
    final isOpen = _expanded.contains(key);
    final total = subs.length;
    final onTime = subs.where(_onTime).length;
    final pct = total > 0 ? onTime / total * 100 : 0.0;
    final avgPts = total > 0 ? subs.fold<int>(0, (a, s) => a + _points(s)) / total : 0.0;
    final dept = subs.first['personnel_department'] as String?;
    final initial = key.isNotEmpty ? key[0].toUpperCase() : '?';

    return Column(children: [
      InkWell(
        onTap: () => setState(() => isOpen ? _expanded.remove(key) : _expanded.add(key)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Row(children: [
            CircleAvatar(
              radius: 16, backgroundColor: const Color(0xFFEFF6FF),
              child: Text(initial, style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF3B82F6))),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(key, style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
              if (!_groupByTask && dept != null && dept.isNotEmpty)
                Text(dept, style: GoogleFonts.plusJakartaSans(
                    fontSize: 11, color: AppTheme.textMuted)),
            ])),
            Text('Subs: $total', style: GoogleFonts.plusJakartaSans(
                fontSize: 12, color: AppTheme.textMuted)),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                  color: _complianceColor(pct).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20)),
              child: Text('${pct.toStringAsFixed(0)}% Compliant',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 11, fontWeight: FontWeight.w700, color: _complianceColor(pct))),
            ),
            const SizedBox(width: 8),
            Icon(isOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                size: 20, color: AppTheme.textMuted),
          ]),
        ),
      ),
      if (isOpen) _buildExpanded(subs, avgPts, pct),
      const Divider(height: 1),
    ]);
  }

  Widget _buildExpanded(List<Map<String, dynamic>> subs, double avgPts, double pct) {
    return Container(
      color: const Color(0xFFFAFBFC),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: _miniStat('Total Submissions', '${subs.length}', Icons.assignment_outlined)),
          const SizedBox(width: 12),
          Expanded(child: _miniStat('Avg Timing Points', '${avgPts.toStringAsFixed(1)} / 100', Icons.timer_outlined)),
          const SizedBox(width: 12),
          Expanded(child: _miniStat('Compliance Rate', '${pct.toStringAsFixed(1)}%', Icons.trending_up)),
        ]),
        const SizedBox(height: 16),
        Text('Submission History', style: GoogleFonts.plusJakartaSans(
            fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
        const SizedBox(height: 8),
        _historyHeader(),
        const Divider(height: 1),
        ...subs.map(_historyRow),
      ]),
    );
  }

  Widget _miniStat(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200)),
      child: Row(children: [
        Icon(icon, size: 16, color: AppTheme.textMuted),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppTheme.textMuted)),
          Text(value, style: GoogleFonts.plusJakartaSans(
              fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
        ])),
      ]),
    );
  }

  Widget _historyHeader() {
    const style = TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
        color: AppTheme.textMuted, letterSpacing: 0.4);
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Expanded(flex: 3, child: Text('TASK NAME', style: style)),
        Expanded(flex: 2, child: Text('DEADLINE', style: style)),
        Expanded(flex: 2, child: Text('SUBMITTED AT', style: style)),
        Expanded(flex: 2, child: Text('TIMING STATUS', style: style)),
        SizedBox(width: 70, child: Text('POINTS', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 110, child: Text('RUBRIC SCORES', style: style)),
      ]),
    );
  }

  Widget _historyRow(Map<String, dynamic> s) {
    final status = s['timing_status'] as String?;
    final color = _statusColor(status);
    final cq = s['content_quality_score'], fc = s['format_compliance_score'], cp = s['completeness_score'];
    final hasRubric = cq != null || fc != null || cp != null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(flex: 3, child: Text('${s['task_name'] ?? '—'}',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textPrimary))),
        Expanded(flex: 2, child: Text(_fmt(s['deadline']),
            style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted))),
        Expanded(flex: 2, child: Text(_fmt(s['submitted_at']),
            style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted))),
        Expanded(flex: 2, child: Align(
          alignment: Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(status ?? '—', style: GoogleFonts.plusJakartaSans(
                fontSize: 10, fontWeight: FontWeight.w600, color: color)),
          ),
        )),
        SizedBox(width: 70, child: Center(child: Text('${_points(s)} pts',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 11, fontWeight: FontWeight.w700, color: color)))),
        SizedBox(width: 110, child: hasRubric
            ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Content: ${cq ?? '—'}', style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppTheme.textMuted)),
                Text('Format: ${fc ?? '—'}', style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppTheme.textMuted)),
                Text('Completeness: ${cp ?? '—'}', style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppTheme.textMuted)),
              ])
            : Text('Not scored', style: GoogleFonts.plusJakartaSans(
                fontSize: 10, color: AppTheme.textLight, fontStyle: FontStyle.italic))),
      ]),
    );
  }

  String _fmt(dynamic raw) {
    if (raw == null) return '—';
    final s = raw.toString();
    return s.length >= 16 ? s.substring(0, 16).replaceFirst('T', ' ') : s;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Special Tasks Tab
// ─────────────────────────────────────────────────────────────────────────────

class _SpecialTasksTab extends StatefulWidget {
  final List<SpecialTask> tasks;
  final bool loading;
  final String? error;
  final VoidCallback onRefresh;
  final Future<void> Function() onExport;
  final ValueChanged<SpecialTask> onEvaluated;
  const _SpecialTasksTab({required this.tasks, required this.loading,
      this.error, required this.onRefresh, required this.onExport,
      required this.onEvaluated});
  @override
  State<_SpecialTasksTab> createState() => _SpecialTasksTabState();
}

class _SpecialTasksTabState extends State<_SpecialTasksTab> {
  String? _filterDept;
  String? _filterRole;
  String? _filterPersonnel;
  bool _exporting = false;

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
    if (widget.loading) return const AppraisalTabSkeleton();
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
    final evaluated = widget.tasks.where((t) => t.evaluation != null || t.status == 'evaluated').length;
    final flagged = widget.tasks.where((t) => t.status == 'flagged' || (t.evaluation?.weightedAverage != null && t.evaluation!.weightedAverage! < 3.0)).length;
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
    final isEvaluated = task.status == 'evaluated' || task.evaluation != null;
    final isFlagged = task.status == 'flagged' || (task.evaluation?.weightedAverage != null && task.evaluation!.weightedAverage! < 3.0);
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
            onPressed: _exporting ? null : () async {
              setState(() => _exporting = true);
              try {
                await widget.onExport();
              } finally {
                if (mounted) setState(() => _exporting = false);
              }
            },
            icon: _exporting
                ? const SizedBox(width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.picture_as_pdf_outlined, size: 16),
            label: Text(_exporting ? 'Generating PDF...' : 'Export Performance Summary',
                style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.darkBanner, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
          const SizedBox(height: 4),
          Text('Exports the selected school year as PDF',
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
  int _quality = 0;     // Q
  int _efficiency = 0;  // E
  int _timeliness = 0;  // T
  final _remarksCtrl = TextEditingController();
  bool _submitting = false;

  bool get _allRated => _quality > 0 && _efficiency > 0 && _timeliness > 0;
  double get _finalScore =>
      _allRated ? (_quality + _efficiency + _timeliness) / 3 : 0;

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
    if (!_allRated) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please rate Quality, Efficiency and Timeliness.')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final updated = await ApiService.evaluateSpecialTask(widget.task.id, {
        'completion_quality_score': _quality,
        'timeliness_score': _timeliness,
        'initiative_score': _efficiency,
        'coordination_score': 0,
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
      const SizedBox(height: 20),
      _MovList(task: t),
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
      Text('Rating (Scale 1 - 5):', style: GoogleFonts.plusJakartaSans(
          fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
      const SizedBox(height: 12),
      _RatingDropdownRow(
        'Quality (Q):',
        _quality,
        (v) => setState(() => _quality = v),
        description: 'Measures completeness, accuracy, and adherence to standards (e.g., thorough documentation, verified MOVs, minimal revisions needed).',
      ),
      const SizedBox(height: 12),
      _RatingDropdownRow(
        'Efficiency (E):',
        _efficiency,
        (v) => setState(() => _efficiency = v),
        description: 'Measures effective utilization of resources, effort, and initiative in meeting all task requirements and objectives.',
      ),
      const SizedBox(height: 12),
      _RatingDropdownRow(
        'Timeliness (T):',
        _timeliness,
        (v) => setState(() => _timeliness = v),
        description: 'Measures completion and submission on or before the set deadline (e.g., submitted early, on time, or prompt turnaround).',
      ),
      const SizedBox(height: 16),
      Text(
        _allRated
            ? 'Final IPCRF Score: ${_finalScore.toStringAsFixed(2)} / 5.00 (${_ipcrfRating(_finalScore)})'
            : 'Final IPCRF Score: — / 5.00',
        style: GoogleFonts.plusJakartaSans(
            fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF1D4ED8)),
      ),
      const SizedBox(height: 16),
      Text('Remarks:', style: GoogleFonts.plusJakartaSans(
          fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
      const SizedBox(height: 6),
      TextField(
        controller: _remarksCtrl, maxLines: 3,
        style: GoogleFonts.plusJakartaSans(fontSize: 13),
        decoration: InputDecoration(
          hintText: 'Add performance comments...', hintStyle: AppTheme.bodyMd,
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
            const SizedBox(height: 16),
            _MovList(task: task),
            if (ev != null) ...[
              const SizedBox(height: 20),
              Text('Previous Evaluation:',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              const SizedBox(height: 12),
              _ScoreReadRow(
                'Quality (Q)',
                ev.completionScore,
                description: 'Measures completeness, accuracy, and adherence to standards (e.g., thorough documentation, verified MOVs, minimal revisions needed).',
              ),
              _ScoreReadRow(
                'Efficiency (E)',
                ev.initiativeScore,
                description: 'Measures effective utilization of resources, effort, and initiative in meeting all task requirements and objectives.',
              ),
              _ScoreReadRow(
                'Timeliness (T)',
                ev.timelinessScore,
                description: 'Measures completion and submission on or before the set deadline (e.g., submitted early, on time, or prompt turnaround).',
              ),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: Text('Final IPCRF Score',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(6)),
                  child: Text('${(ev.weightedAverage ?? 0).toStringAsFixed(2)} / 5.00',
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
  final List<EventForAppraisal> events;
  final bool loading;
  final String? error;
  final VoidCallback onRefresh;
  final ValueChanged<EventForAppraisal> onEvaluated;
  const _EventsTab({required this.events, required this.loading,
      this.error, required this.onRefresh, required this.onEvaluated});
  @override
  State<_EventsTab> createState() => _EventsTabState();
}

class _EventsTabState extends State<_EventsTab> {
  String? _filterTitle;

  List<EventForAppraisal> get _filteredEvents {
    var list = widget.events;
    if (_filterTitle != null) {
      list = list.where((e) => e.title == _filterTitle).toList();
    }
    return list;
  }

  List<String> get _titleOptions =>
      widget.events.map((e) => e.title).where((n) => n.isNotEmpty).toSet().toList()..sort();

  @override
  Widget build(BuildContext context) {
    if (widget.loading) return const AppraisalTabSkeleton();
    if (widget.error != null) return _ErrorPanel(message: widget.error!, onRetry: widget.onRefresh);
    return SingleChildScrollView(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _buildStatCards(),
        const SizedBox(height: 16),
        _buildEvidencyLegend(),
        const SizedBox(height: 16),
        _buildEventsTable(),
        const SizedBox(height: 24),
      ]),
    );
  }

  String _effectiveStatus(EventForAppraisal e) {
    if (e.evaluations.isNotEmpty) return 'completed';
    if (e.status == 'approved') return 'awaiting_ratings';
    return e.status;
  }

  Color _evidencyColor(double pct) {
    if (pct >= 80) return const Color(0xFF16A34A);
    if (pct >= 50) return const Color(0xFFEA580C);
    return const Color(0xFFEF4444);
  }

  Widget _buildStatCards() {
    final totalEvents = widget.events.length;
    final ratedEvents = widget.events.where((e) => e.evaluations.isNotEmpty).length;
    final awaitingRatings = widget.events.where((e) => _effectiveStatus(e) == 'awaiting_ratings').length;
    final withEvals = widget.events.where((e) => e.evaluations.isNotEmpty).toList();
    final avgPct = withEvals.isEmpty
        ? null
        : withEvals.map((e) => e.evidencyRate).reduce((a, b) => a + b) / withEvals.length;
    final avgColor = avgPct == null ? AppTheme.textMuted : _evidencyColor(avgPct);
    final avgLabel = avgPct == null ? '—' : '${avgPct.toStringAsFixed(0)}%';
    return Row(children: [
      Expanded(child: _AppraisalStatCard(
          value: '$totalEvents', label: 'Total Events',
          subtitle: '$totalEvents total · $awaitingRatings awaiting ratings',
          icon: Icons.event_note_outlined, iconColor: AppTheme.textMuted,
          iconBg: const Color(0xFFF3F4F6))),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
          value: '$ratedEvents', label: 'Rated Events',
          icon: Icons.assignment_turned_in_outlined, iconColor: const Color(0xFF10B981),
          iconBg: const Color(0xFFECFDF5))),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
          value: avgLabel, label: 'Avg Evidency Rate',
          valueColor: avgColor,
          icon: Icons.percent_rounded, iconColor: avgColor,
          iconBg: const Color(0xFFF3F4F6))),
    ]);
  }

  Widget _buildEvidencyLegend() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.info_outline_rounded, color: Color(0xFF64748B), size: 18),
          const SizedBox(width: 8),
          Text('Evidency Rate Legend',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF334155))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: _EvidencyBadge(color: const Color(0xFF16A34A), label: 'Green', desc: 'High (≥ 80%)')),
          const SizedBox(width: 12),
          Expanded(child: _EvidencyBadge(color: const Color(0xFFEA580C), label: 'Yellow', desc: 'Mid (50% - 79%)')),
          const SizedBox(width: 12),
          Expanded(child: _EvidencyBadge(color: const Color(0xFFEF4444), label: 'Red', desc: 'Low (< 50%)')),
        ]),
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
              icon: Icons.tune_rounded,
              label: _filterTitle ?? 'Show All',
              options: _titleOptions,
              selected: _filterTitle,
              onSelect: (v) => setState(() => _filterTitle = v),
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
        SizedBox(width: 110, child: Text('DEPARTMENT', style: style)),
        Expanded(flex: 2, child: Text('ORGANIZER', style: style)),
        SizedBox(width: 90, child: Text('RESPONSES', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 110, child: Text('EVIDENCY RATE', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 130, child: Text('STATUS', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 100, child: Text('DEMOGRAPHICS', style: style, textAlign: TextAlign.center)),
        SizedBox(width: 120, child: Text('ACTION', style: style, textAlign: TextAlign.end)),
      ]),
    );
  }

  Widget _buildEventRow(EventForAppraisal event, int idx) {
    final hasEvals = event.evaluations.isNotEmpty;
    final pct = hasEvals ? event.evidencyRate : null;
    final pctColor = pct != null ? _evidencyColor(pct) : AppTheme.textMuted;
    final pctLabel = pct != null ? '${pct.toStringAsFixed(0)}%' : '—';
    final responses = event.expectedAttendees != null
        ? '${event.evaluations.length} / ${event.expectedAttendees}'
        : '${event.evaluations.length}';
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
        SizedBox(width: 90, child: Text(_fmtDate(event.targetDate),
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted))),
        SizedBox(width: 110, child: Text(event.department ?? '—',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted),
            overflow: TextOverflow.ellipsis)),
        Expanded(flex: 2, child: Text(event.organizerName ?? '—',
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted),
            overflow: TextOverflow.ellipsis)),
        SizedBox(width: 90, child: Center(child: Text(responses,
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textPrimary)))),
        SizedBox(width: 110, child: Center(child: Text(pctLabel,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w700, color: pctColor)))),
        SizedBox(width: 130, child: Center(child: _StatusChip(status: _effectiveStatus(event)))),
        SizedBox(width: 100, child: Center(
          child: IconButton(
            tooltip: 'Evaluator demographics',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            icon: Icon(Icons.groups_outlined, size: 20,
                color: hasEvals ? const Color(0xFF3B82F6) : Colors.grey.shade400),
            onPressed: () => showDialog<void>(
                context: context, builder: (_) => _DemographicsDialog(event: event)),
          ),
        )),
        SizedBox(width: 120, child: Align(
          alignment: Alignment.centerRight,
          child: hasEvals
              ? _ActionBtn(label: 'View Results', dark: true,
                  onTap: () => _showEventResultsDialog(event))
              : _ActionBtn(label: 'Evaluate', dark: false,
                  onTap: () => _showEvaluationOptions(event)),
        )),
      ]),
    );
  }

  void _showEvaluationOptions(EventForAppraisal event) {
    showDialog<void>(
      context: context,
      builder: (_) => _EvaluationOptionsDialog(
        event: event,
        onEvaluated: widget.onEvaluated,
      ),
    );
  }

  void _showEventResultsDialog(EventForAppraisal event) {
    showDialog<void>(
      context: context,
      builder: (_) => _EventResultsDialog(
        event: event,
        onEvaluated: widget.onEvaluated,
      ),
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
// Event Evaluation QR Code Dialog
// ─────────────────────────────────────────────────────────────────────────────

String _evalUrlFor(EventForAppraisal event) => '${Uri.base.origin}/#/eval/${event.id}';

String _organizerLine(EventForAppraisal event) {
  final org = event.organizerName?.trim();
  final dept = event.department?.trim();
  final parts = [
    if (org != null && org.isNotEmpty) 'Organizer: $org',
    if (dept != null && dept.isNotEmpty) dept,
  ];
  return parts.join(' · ');
}

class _EventQrDialog extends StatelessWidget {
  final EventForAppraisal event;
  const _EventQrDialog({required this.event});

  @override
  Widget build(BuildContext context) {
    final url = _evalUrlFor(event);
    final orgLine = _organizerLine(event);
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 360,
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Expanded(child: Text('Event Evaluation QR Code',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary))),
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              icon: const Icon(Icons.close, size: 18),
              onPressed: () => Navigator.pop(context),
            ),
          ]),
          const SizedBox(height: 12),
          Text(event.title,
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          if (orgLine.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(orgLine,
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted)),
          ],
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: Colors.grey.shade200),
                borderRadius: BorderRadius.circular(12)),
            child: QrImageView(data: url, version: QrVersions.auto, size: 200),
          ),
          const SizedBox(height: 16),
          Text('Event ID: ${event.id}',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted)),
          const SizedBox(height: 4),
          SelectableText(url,
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 11, color: const Color(0xFF3B82F6),
                  decoration: TextDecoration.underline)),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Options Dialog (QR code vs. direct link)
// ─────────────────────────────────────────────────────────────────────────────

class _EvaluationOptionsDialog extends StatelessWidget {
  final EventForAppraisal event;
  final ValueChanged<EventForAppraisal>? onEvaluated;
  const _EvaluationOptionsDialog({required this.event, this.onEvaluated});

  @override
  Widget build(BuildContext context) {
    final orgLine = _organizerLine(event);
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 380,
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Expanded(child: Text('Evaluation Options',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary))),
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              icon: const Icon(Icons.close, size: 18),
              onPressed: () => Navigator.pop(context),
            ),
          ]),
          const SizedBox(height: 12),
          Text(event.title,
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          if (orgLine.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(orgLine,
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted)),
          ],
          const SizedBox(height: 20),
          _OptionCard(
            icon: Icons.qr_code_2_rounded,
            title: 'Show QR Code',
            subtitle: 'Generate a QR code for attendees to scan on their devices',
            onTap: () {
              Navigator.pop(context);
              showDialog<void>(context: context, builder: (_) => _EventQrDialog(event: event));
            },
          ),
          const SizedBox(height: 12),
          _OptionCard(
            icon: Icons.link_rounded,
            title: 'Get Evaluation Link',
            subtitle: 'Copy the direct URL link to the evaluation web page',
            onTap: () {
              Navigator.pop(context);
              showDialog<void>(context: context, builder: (_) => _EvaluationLinkDialog(event: event));
            },
          ),
          const SizedBox(height: 12),
          _OptionCard(
            icon: Icons.upload_file_rounded,
            title: 'Upload Paper Evaluation',
            subtitle: 'Upload a photo or scanned copy of a paper evaluation form to record it accurately',
            onTap: () {
              Navigator.pop(context);
              showDialog<void>(
                context: context,
                builder: (_) => _UploadPaperEvaluationDialog(
                  event: event,
                  onEvaluated: onEvaluated,
                ),
              );
            },
          ),
        ]),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  const _OptionCard({required this.icon, required this.title,
      required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB))),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: const Color(0xFFEFF2FF), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: const Color(0xFF3B82F6)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            const SizedBox(height: 2),
            Text(subtitle,
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppTheme.textMuted)),
          ])),
          const Icon(Icons.chevron_right, size: 20, color: AppTheme.textMuted),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Link Dialog (copy direct URL)
// ─────────────────────────────────────────────────────────────────────────────

class _EvaluationLinkDialog extends StatelessWidget {
  final EventForAppraisal event;
  const _EvaluationLinkDialog({required this.event});

  @override
  Widget build(BuildContext context) {
    final url = _evalUrlFor(event);
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 420,
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Evaluation Link',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            const SizedBox(height: 8),
            Text('Direct evaluation form link for "${event.title}":',
                style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted)),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE5E7EB))),
                child: SelectableText(url,
                    maxLines: 1,
                    style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textPrimary)),
              )),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: url));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Evaluation link copied to clipboard'),
                        backgroundColor: Color(0xFF22C55E)));
                  }
                },
                icon: const Icon(Icons.copy, size: 15),
                label: const Text('Copy'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B82F6),
                    foregroundColor: Colors.white),
              ),
            ]),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text('Close',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, color: AppTheme.textMuted)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Paper Evaluation Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _UploadPaperEvaluationDialog extends StatefulWidget {
  final EventForAppraisal event;
  final ValueChanged<EventForAppraisal>? onEvaluated;
  const _UploadPaperEvaluationDialog({required this.event, this.onEvaluated});

  @override
  State<_UploadPaperEvaluationDialog> createState() => _UploadPaperEvaluationDialogState();
}

class _UploadPaperEvaluationDialogState extends State<_UploadPaperEvaluationDialog> {
  Uint8List? _imageBytes;
  String? _imageFileName;
  final _nameCtrl = TextEditingController(text: 'Paper Evaluator');
  String _selectedRole = 'Student';
  int _planning = 5;
  int _objectives = 5;
  int _personnel = 5;
  int _timeMgmt = 5;
  int _engagement = 5;
  int _resource = 5;
  final _commentsCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  final List<String> _roles = ['Student', 'Faculty', 'Staff', 'Parent / Guest', 'Other'];

  double get _average =>
      (_planning + _objectives + _personnel + _timeMgmt + _engagement + _resource) / 6.0;

  Future<void> _pickImage() async {
    try {
      final res = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
        withData: true,
      );
      if (res != null && res.files.isNotEmpty) {
        final file = res.files.first;
        if (file.bytes != null) {
          setState(() {
            _imageBytes = file.bytes;
            _imageFileName = file.name;
          });
        }
      }
    } catch (e) {
      setState(() => _error = 'Could not select image: $e');
    }
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      String? uploadedUrl;
      if (_imageBytes != null && _imageFileName != null) {
        final uploadRes = await ApiService.uploadAttachmentFile(_imageBytes!, _imageFileName!);
        uploadedUrl = uploadRes['url'];
      }

      final payload = {
        'evaluator_name': _nameCtrl.text.trim().isEmpty ? 'Paper Evaluator' : _nameCtrl.text.trim(),
        'evaluator_role': _selectedRole,
        'planning_score': _planning,
        'objectives_score': _objectives,
        'personnel_score': _personnel,
        'time_mgmt_score': _timeMgmt,
        'engagement_score': _engagement,
        'resource_score': _resource,
        'feedback_comments': _commentsCtrl.text.trim(),
        'image_url': uploadedUrl,
      };

      final updated = await ApiService.submitPaperEvaluation(widget.event.id, payload);
      if (!mounted) return;
      Navigator.pop(context);
      widget.onEvaluated?.call(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Paper evaluation recorded and proof attached successfully!'),
          backgroundColor: Color(0xFF16A34A),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 580,
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: const BoxDecoration(
                color: AppTheme.darkBanner,
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.document_scanner_outlined, color: Colors.white, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Record Paper Evaluation: ${widget.event.title}',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _error!,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: const Color(0xFFB91C1C),
                          ),
                        ),
                      ),
                    ],
                    // Image upload box
                    Text(
                      'Paper Form Photo / Scan (Proof)',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: _pickImage,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _imageBytes != null
                                ? const Color(0xFF3B82F6)
                                : const Color(0xFFCBD5E1),
                            style: BorderStyle.solid,
                          ),
                        ),
                        child: _imageBytes != null
                            ? Column(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.memory(
                                      _imageBytes!,
                                      height: 140,
                                      fit: BoxFit.contain,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.check_circle, size: 16, color: Color(0xFF16A34A)),
                                      const SizedBox(width: 6),
                                      Text(
                                        _imageFileName ?? 'Image selected',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: AppTheme.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(width: 14),
                                      TextButton(
                                        onPressed: _pickImage,
                                        child: const Text('Change Image'),
                                      ),
                                    ],
                                  ),
                                ],
                              )
                            : Column(
                                children: [
                                  const Icon(Icons.add_photo_alternate_outlined,
                                      size: 36, color: Color(0xFF3B82F6)),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Click to upload photo of the paper evaluation form',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF1E293B),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Supports PNG, JPG, or JPEG. Scanned forms ensure accurate records.',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      color: AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    // Evaluator details
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextField(
                            controller: _nameCtrl,
                            decoration: InputDecoration(
                              labelText: 'Evaluator Name (from paper)',
                              hintText: 'e.g., Juan Dela Cruz or Paper Evaluator',
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: DropdownButtonFormField<String>(
                            value: _selectedRole,
                            items: _roles.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                            onChanged: (v) {
                              if (v != null) setState(() => _selectedRole = v);
                            },
                            decoration: InputDecoration(
                              labelText: 'Role',
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Transcribed Ratings (1 to 5 Stars)',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _StarRatingRow('Planning & Preparation', _planning, (v) => setState(() => _planning = v)),
                    _StarRatingRow('Achievement of Objectives', _objectives, (v) => setState(() => _objectives = v)),
                    _StarRatingRow('Personnel Management', _personnel, (v) => setState(() => _personnel = v)),
                    _StarRatingRow('Time Management', _timeMgmt, (v) => setState(() => _timeMgmt = v)),
                    _StarRatingRow('Audience Engagement', _engagement, (v) => setState(() => _engagement = v)),
                    _StarRatingRow('Resource Management', _resource, (v) => setState(() => _resource = v)),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Transcribed Score: ${_average.toStringAsFixed(2)} / 5.00 (${(_average / 5.0 * 100).toStringAsFixed(1)}%)',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF1D4ED8),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _commentsCtrl,
                      maxLines: 4,
                      decoration: InputDecoration(
                        labelText: 'Transcribed Feedback / Comments (optional)',
                        hintText: 'Enter any remarks written on the paper form...',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.darkBanner,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Save Paper Evaluation'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Evaluation Results Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _EventResultsDialog extends StatefulWidget {
  final EventForAppraisal event;
  final ValueChanged<EventForAppraisal>? onEvaluated;
  const _EventResultsDialog({required this.event, this.onEvaluated});

  @override
  State<_EventResultsDialog> createState() => _EventResultsDialogState();
}

class _EventResultsDialogState extends State<_EventResultsDialog> {
  int _activeTab = 0; // 0 = Aggregate Summary, 1 = Individual Responses
  String _roleFilter = 'All';
  final Set<int> _expandedIds = {};

  final List<String> _roleOptions = [
    'All',
    'Teacher',
    'Student',
    'Coordinator',
    'Dean',
    'Principal',
    'Registrar',
    'Parent',
    'Others',
  ];

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw.split(' ').first);
      final month = dt.month.toString().padLeft(2, '0');
      final day = dt.day.toString().padLeft(2, '0');
      return '${dt.year}-$month-$day';
    } catch (_) {
      return raw.split('T').first;
    }
  }

  double get _overallEvidencyRate {
    if (widget.event.evaluations.isEmpty) return 0.0;
    final sum = widget.event.evaluations.map((e) => (e.average / 5.0 * 100.0)).reduce((a, b) => a + b);
    return sum / widget.event.evaluations.length;
  }

  String _evidencySubtext(double pct) {
    if (pct >= 80) return 'High Evidency';
    if (pct >= 50) return 'Moderate Evidency';
    return 'Low Evidency';
  }

  String _getInitials(String name) {
    final clean = name.trim();
    if (clean.isEmpty) return '??';
    final parts = clean.split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return clean.length >= 2 ? clean.substring(0, 2).toUpperCase() : clean.toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  bool _matchesRole(EventEvaluation ev, String filter) {
    if (filter == 'All') return true;
    final role = (ev.evaluatorRole ?? '').toLowerCase().trim();
    switch (filter) {
      case 'Teacher':
        return role.contains('teacher') || role.contains('faculty');
      case 'Student':
        return role.contains('student');
      case 'Coordinator':
        return role.contains('coordinator');
      case 'Dean':
        return role.contains('dean');
      case 'Principal':
        return role.contains('principal');
      case 'Registrar':
        return role.contains('registrar');
      case 'Parent':
        return role.contains('parent');
      case 'Others':
        return !role.contains('teacher') &&
            !role.contains('faculty') &&
            !role.contains('student') &&
            !role.contains('coordinator') &&
            !role.contains('dean') &&
            !role.contains('principal') &&
            !role.contains('registrar') &&
            !role.contains('parent');
      default:
        return true;
    }
  }

  List<EventEvaluation> get _filteredEvaluations {
    return widget.event.evaluations.where((e) => _matchesRole(e, _roleFilter)).toList();
  }

  Widget _buildTabButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final color = isSelected ? const Color(0xFF3B82F6) : const Color(0xFF64748B);
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: isSelected ? const Color(0xFF3B82F6) : Colors.transparent,
              width: 2.5,
            ),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Text(
        '$label: $value',
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: const Color(0xFF334155),
        ),
      ),
    );
  }

  bool get _hasCriteriaData =>
      widget.event.evaluations.any((e) =>
          e.planningScore > 0 ||
          e.objectivesScore > 0 ||
          e.personnelScore > 0 ||
          e.timeMgmtScore > 0 ||
          e.engagementScore > 0 ||
          e.resourceScore > 0);

  double _avgCriteriaScore(int Function(EventEvaluation) selector) {
    final rated = widget.event.evaluations.where((e) => selector(e) > 0).toList();
    if (rated.isEmpty) return 0.0;
    return rated.map((e) => selector(e).toDouble()).reduce((a, b) => a + b) / rated.length;
  }

  Widget _buildIndicatorItem(String title, double score) {
    final pct = (score / 5.0 * 100).round();
    final color = pct >= 80
        ? const Color(0xFF16A34A)
        : (pct >= 50 ? const Color(0xFFEA580C) : const Color(0xFFDC2626));
    final subtext = pct >= 80 ? 'High Evidency' : (pct >= 50 ? 'Moderate Evidency' : 'Low Evidency');

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF1E293B),
                  ),
                ),
              ),
              Row(
                children: [
                  Text(
                    '${score.toStringAsFixed(1)} / 5.0',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '$pct%',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (score / 5.0).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtext,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final evals = widget.event.evaluations;
    final commentsList = evals.where((e) => e.feedbackComments != null && e.feedbackComments!.trim().isNotEmpty).toList();
    final filtered = _filteredEvaluations;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 680,
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 20, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.event.title,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF1E293B),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Organizer: ${widget.event.organizerName ?? "—"} · ${widget.event.department ?? "General"} · ${_formatDate(widget.event.targetDate)}',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: const Color(0xFF64748B),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Color(0xFF64748B), size: 20),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            // Navigation Tabs
            Container(
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1.5)),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 24),
                  _buildTabButton(
                    icon: Icons.poll_outlined,
                    label: 'Aggregate Summary',
                    isSelected: _activeTab == 0,
                    onTap: () => setState(() => _activeTab = 0),
                  ),
                  const SizedBox(width: 20),
                  _buildTabButton(
                    icon: Icons.people_alt_outlined,
                    label: 'Individual Responses',
                    isSelected: _activeTab == 1,
                    onTap: () => setState(() => _activeTab = 1),
                  ),
                ],
              ),
            ),
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: _activeTab == 0
                    ? _buildAggregateSummaryTab(evals, commentsList)
                    : _buildIndividualResponsesTab(filtered),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAggregateSummaryTab(List<EventEvaluation> evals, List<EventEvaluation> commentsList) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Two Metric Cards Side by Side
        Row(
          children: [
            // Overall Evidency Rate Card
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: const BoxDecoration(
                        color: Color(0xFFE6F4EA), // light green circle from screenshot
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Text(
                        '%',
                        style: TextStyle(
                          color: Color(0xFF16A34A),
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Overall Evidency Rate',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_overallEvidencyRate.toStringAsFixed(0)}%',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF16A34A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _evidencySubtext(_overallEvidencyRate),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 16),
            // Total Responses Card
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: const BoxDecoration(
                        color: Color(0xFFE8F0FE), // light blue circle from screenshot
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.people_alt_rounded,
                        color: Color(0xFF2563EB),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Total Responses',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${evals.length}',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF2563EB),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Evaluations submitted',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),
        // Section: Indicator-by-Indicator Performance
        Text(
          'Indicator-by-Indicator Performance',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF1E293B),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          'Distribution of ratings and remarks across all ${evals.length} responses.',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 16),
        if (_hasCriteriaData) ...[
          _buildIndicatorItem('Planning & Preparation', _avgCriteriaScore((e) => e.planningScore)),
          _buildIndicatorItem('Achievement of Objectives', _avgCriteriaScore((e) => e.objectivesScore)),
          _buildIndicatorItem('Personnel Management', _avgCriteriaScore((e) => e.personnelScore)),
          _buildIndicatorItem('Time Management', _avgCriteriaScore((e) => e.timeMgmtScore)),
          _buildIndicatorItem('Audience Engagement', _avgCriteriaScore((e) => e.engagementScore)),
          _buildIndicatorItem('Resource Management', _avgCriteriaScore((e) => e.resourceScore)),
        ] else
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'No indicator evaluations available.',
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ),
          ),
        const SizedBox(height: 32),
        // Section: General Comments & Recommendations
        Text(
          'General Comments & Recommendations',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF1E293B),
          ),
        ),
        const SizedBox(height: 12),
        if (commentsList.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'No comments or recommendations available.',
              style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Color(0xFF94A3B8)),
            ),
          )
        else
          ...commentsList.map((ev) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9), // light cool blue-grey from screenshot
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      '${ev.evaluatorName.isEmpty ? "Attendee" : ev.evaluatorName} (${ev.evaluatorRole ?? "Attendee"}): ${ev.feedbackComments!.trim()}',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF334155),
                      ),
                    ),
                  ),
                  if (ev.imageUrl != null && ev.imageUrl!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: InkWell(
                        onTap: () {
                          showDialog<void>(
                            context: context,
                            builder: (_) => _PaperImagePreviewDialog(
                              imageUrl: ev.imageUrl!,
                              title: '${widget.event.title} - ${ev.evaluatorName}',
                            ),
                          );
                        },
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.photo_library_outlined, size: 14, color: Color(0xFF3B82F6)),
                            SizedBox(width: 4),
                            Text(
                              'View paper',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF3B82F6),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildIndividualResponsesTab(List<EventEvaluation> filtered) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Showing X responses + Filter by Role Dropdown
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Showing ${filtered.length} responses',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1E293B),
              ),
            ),
            Row(
              children: [
                Text(
                  'Filter by Role:',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0).withOpacity(0.4),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _roleFilter,
                      isDense: true,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF1E293B),
                      ),
                      items: _roleOptions.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                      onChanged: (v) {
                        if (v != null) setState(() => _roleFilter = v);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text(
                'No responses matching the selected role.',
                style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: filtered.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, idx) {
              final ev = filtered[idx];
              final isExpanded = _expandedIds.contains(ev.id);
              final rate = (ev.average / 5.0 * 100).round();
              final rateColor = rate >= 80 ? const Color(0xFF16A34A) : const Color(0xFFEA580C);
              final initials = _getInitials(ev.evaluatorName.isEmpty ? 'Attendee' : ev.evaluatorName);

              return Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9), // exact light card style from screenshot
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: const Color(0xFF6B82A8), // steel blue from screenshot
                          child: Text(
                            initials,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ev.evaluatorName.isEmpty ? 'Attendee #${idx + 1}' : ev.evaluatorName,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                ev.evaluatorRole ?? 'Attendee',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '$rate%',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: rateColor,
                              ),
                            ),
                            const SizedBox(height: 2),
                            InkWell(
                              onTap: () {
                                setState(() {
                                  if (isExpanded) {
                                    _expandedIds.remove(ev.id);
                                  } else {
                                    _expandedIds.add(ev.id);
                                  }
                                });
                              },
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    isExpanded ? 'Hide details' : 'View details',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                  Icon(
                                    isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                                    size: 14,
                                    color: const Color(0xFF64748B),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    if (isExpanded) ...[
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFFCBD5E1), height: 1),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 12,
                        runSpacing: 8,
                        children: [
                          _detailChip('Planning', '${ev.planningScore}/5'),
                          _detailChip('Objectives', '${ev.objectivesScore}/5'),
                          _detailChip('Personnel', '${ev.personnelScore}/5'),
                          _detailChip('Time Mgmt', '${ev.timeMgmtScore}/5'),
                          _detailChip('Engagement', '${ev.engagementScore}/5'),
                          _detailChip('Resources', '${ev.resourceScore}/5'),
                        ],
                      ),
                      if (ev.feedbackComments != null && ev.feedbackComments!.trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          'Remarks: "${ev.feedbackComments!.trim()}"',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontStyle: FontStyle.italic,
                            color: const Color(0xFF334155),
                          ),
                        ),
                      ],
                      if (ev.imageUrl != null && ev.imageUrl!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: () {
                            showDialog<void>(
                              context: context,
                              builder: (_) => _PaperImagePreviewDialog(
                                imageUrl: ev.imageUrl!,
                                title: '${widget.event.title} - ${ev.evaluatorName}',
                              ),
                            );
                          },
                          icon: const Icon(Icons.photo_library_outlined, size: 14),
                          label: const Text('View Scanned Paper Form'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF3B82F6),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            textStyle: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanned Paper Image Preview Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _PaperImagePreviewDialog extends StatelessWidget {
  final String imageUrl;
  final String title;
  const _PaperImagePreviewDialog({required this.imageUrl, required this.title});

  @override
  Widget build(BuildContext context) {
    final fullUrl = imageUrl.startsWith('http')
        ? imageUrl
        : '${ApiService.baseUrl}$imageUrl';

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 820,
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Scanned Paper Evaluation Form',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: InteractiveViewer(
                      child: Image.network(
                        fullUrl,
                        fit: BoxFit.contain,
                        loadingBuilder: (_, child, progress) {
                          if (progress == null) return child;
                          return const Center(child: CircularProgressIndicator());
                        },
                        errorBuilder: (_, err, __) => Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.broken_image_outlined, size: 48, color: Colors.grey),
                              const SizedBox(height: 8),
                              Text('Failed to load image: $err', style: AppTheme.bodySm),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidency Rate Legend Badge
// ─────────────────────────────────────────────────────────────────────────────

class _EvidencyBadge extends StatelessWidget {
  final Color color;
  final String label, desc;
  const _EvidencyBadge({required this.color, required this.label, required this.desc});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 0.8)),
      child: Row(children: [
        Container(width: 10, height: 10,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(child: RichText(text: TextSpan(
          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: const Color(0xFF4B5563), height: 1.3),
          children: [
            TextSpan(text: '$label: ', style: TextStyle(fontWeight: FontWeight.w700, color: color)),
            TextSpan(text: desc),
          ],
        ))),
      ]),
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Analytics Tab
// ─────────────────────────────────────────────────────────────────────────────

class _AnalyticsTab extends StatefulWidget {
  final List<SpecialTask> tasks;
  final List<EventForAppraisal> events;
  const _AnalyticsTab({required this.tasks, required this.events});

  @override
  State<_AnalyticsTab> createState() => _AnalyticsTabState();
}

class _AnalyticsTabState extends State<_AnalyticsTab> {
  int _perfMode = 0; // 0 = Department, 1 = Individual

  @override
  Widget build(BuildContext context) {
    final evaluatedTasks = widget.tasks.where((t) => t.evaluation?.weightedAverage != null).toList();
    final evaluatedEvents = widget.events.where((e) => e.evaluations.isNotEmpty).toList();

    // Combined overall performance (Special tasks score + Event evidency rate)
    final allScores = <double>[
      ...evaluatedTasks.map((t) => t.scoreOutOf100.toDouble()),
      ...evaluatedEvents.map((e) => e.evidencyRate),
    ];
    final double overallAvg =
        allScores.isEmpty ? 0 : allScores.reduce((a, b) => a + b) / allScores.length;

    // Unique personnel covered
    final uniquePersonnel = <String>{
      ...widget.tasks.map((t) => t.assigneeName).whereType<String>().where((n) => n.trim().isNotEmpty && n != '—'),
      ...widget.events.map((e) => e.organizerName).whereType<String>().where((n) => n.trim().isNotEmpty && n != '—'),
    }.length;

    final totalEventEvals = widget.events.fold<int>(0, (s, e) => s + e.evaluations.length);

    // Department performance combining special tasks and events
    final deptMap = <String, List<double>>{};
    for (final t in evaluatedTasks) {
      final dept = t.assigneeDepartment?.trim();
      if (dept != null && dept.isNotEmpty && dept != '—') {
        deptMap.putIfAbsent(dept, () => []).add(t.scoreOutOf100.toDouble());
      }
    }
    for (final e in evaluatedEvents) {
      final dept = e.department?.trim();
      if (dept != null && dept.isNotEmpty && dept != '—') {
        deptMap.putIfAbsent(dept, () => []).add(e.evidencyRate);
      }
    }
    final deptPerf = deptMap.entries.map((e) {
      final avg = e.value.reduce((a, b) => a + b) / e.value.length;
      return (dept: e.key, avg: avg, count: e.value.length);
    }).toList()..sort((a, b) => b.avg.compareTo(a.avg));

    // Individual performance combining special tasks and events
    final personMap = <String, ({String? dept, List<double> scores})>{};
    for (final t in evaluatedTasks) {
      final name = t.assigneeName?.trim();
      if (name != null && name.isNotEmpty && name != '—') {
        final entry = personMap.putIfAbsent(name, () => (dept: t.assigneeDepartment?.trim(), scores: <double>[]));
        entry.scores.add(t.scoreOutOf100.toDouble());
      }
    }
    for (final e in evaluatedEvents) {
      final name = e.organizerName?.trim();
      if (name != null && name.isNotEmpty && name != '—') {
        final entry = personMap.putIfAbsent(name, () => (dept: e.department?.trim(), scores: <double>[]));
        entry.scores.add(e.evidencyRate);
      }
    }
    final individualPerf = personMap.entries.map((e) {
      final avg = e.value.scores.reduce((a, b) => a + b) / e.value.scores.length;
      return (name: e.key, dept: e.value.dept, avg: avg, count: e.value.scores.length);
    }).toList()..sort((a, b) => b.avg.compareTo(a.avg));

    final topPerformers = personMap.entries.map((e) {
      final avg = e.value.scores.reduce((a, b) => a + b) / e.value.scores.length;
      return (name: e.key, avg: avg, count: e.value.scores.length);
    }).toList()..sort((a, b) => b.avg.compareTo(a.avg));

    return SingleChildScrollView(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Stat cards
        Row(children: [
          Expanded(child: _AppraisalStatCard(
              value: overallAvg > 0 ? '${overallAvg.toStringAsFixed(1)}%' : '—',
              label: 'Overall Performance', subLabel: 'Tasks & Events combined',
              icon: Icons.emoji_events_outlined, iconColor: const Color(0xFF10B981),
              iconBg: const Color(0xFFECFDF5))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '$uniquePersonnel', label: 'Total Personnel', subLabel: 'Faculty & organizers',
              icon: Icons.group_outlined, iconColor: const Color(0xFF3B82F6),
              iconBg: const Color(0xFFEFF6FF))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '${evaluatedTasks.length}', label: 'Special Tasks',
              subLabel: '${evaluatedTasks.length} of ${widget.tasks.length} evaluated',
              icon: Icons.assignment_outlined, iconColor: const Color(0xFFF59E0B),
              iconBg: const Color(0xFFFEF3C7))),
          const SizedBox(width: 12),
          Expanded(child: _AppraisalStatCard(
              value: '${evaluatedEvents.length}', label: 'Events Evaluated',
              subLabel: '$totalEventEvals attendee responses',
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
            _MonthlyTrendChart(tasks: widget.tasks, events: widget.events),
          ]),
        ),
        const SizedBox(height: 16),

        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Department / Individual Performance with Slide Toggle Button
          Expanded(child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _perfMode == 0 ? 'Department Performance' : 'Individual Performance',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                  ),
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _SlideToggleOption(
                          label: 'Department',
                          isSelected: _perfMode == 0,
                          onTap: () => setState(() => _perfMode = 0),
                        ),
                        _SlideToggleOption(
                          label: 'Individual',
                          isSelected: _perfMode == 1,
                          onTap: () => setState(() => _perfMode = 1),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_perfMode == 0) ...[
                if (deptPerf.isEmpty)
                  Text('No data yet.', style: GoogleFonts.plusJakartaSans(
                      fontSize: 13, color: AppTheme.textMuted))
                else
                  ...deptPerf.map((d) => _DeptPerformanceRow(
                      dept: d.dept, avg: d.avg, count: d.count)),
              ] else ...[
                if (individualPerf.isEmpty)
                  Text('No data yet.', style: GoogleFonts.plusJakartaSans(
                      fontSize: 13, color: AppTheme.textMuted))
                else
                  ...individualPerf.map((p) => _IndividualPerformanceRow(
                      name: p.name,
                      dept: p.dept,
                      avg: p.avg,
                      count: p.count)),
              ],
            ]),
          )),
          const SizedBox(width: 16),
          // Top Performers (Preserved)
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

class _SlideToggleOption extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _SlideToggleOption({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? AppTheme.textPrimary : AppTheme.textMuted,
          ),
        ),
      ),
    );
  }
}

class _MonthlyTrendChart extends StatelessWidget {
  final List<SpecialTask> tasks;
  final List<EventForAppraisal> events;
  const _MonthlyTrendChart({required this.tasks, required this.events});

  @override
  Widget build(BuildContext context) {
    final months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
    final monthScores = <String, List<int>>{};
    for (final m in months) { monthScores[m] = []; }

    for (final t in tasks) {
      if (t.evaluation?.weightedAverage == null) continue;
      final dateStr = t.submittedDate ?? t.dueDate ?? '';
      try {
        final dt = DateTime.parse(dateStr.split(' ').first);
        final key = _monthKey(dt);
        if (monthScores.containsKey(key)) {
          monthScores[key]!.add(t.scoreOutOf100);
        }
      } catch (_) {}
    }

    for (final e in events) {
      if (e.evaluations.isEmpty) continue;
      final dateStr = e.targetDate ?? '';
      try {
        final dt = DateTime.parse(dateStr.split(' ').first);
        final key = _monthKey(dt);
        if (monthScores.containsKey(key)) {
          monthScores[key]!.add(e.evidencyRate.round());
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

class _IndividualPerformanceRow extends StatelessWidget {
  final String name;
  final String? dept;
  final double avg;
  final int count;
  const _IndividualPerformanceRow({
    required this.name,
    this.dept,
    required this.avg,
    required this.count,
  });

  @override
  Widget build(BuildContext context) {
    final pct = avg / 100.0;
    final color = avg >= 80 ? const Color(0xFF22C55E)
        : avg >= 60 ? const Color(0xFF3B82F6) : const Color(0xFFEF4444);
    final subtitle = dept != null && dept!.isNotEmpty && dept != '—'
        ? '$dept · $count task${count != 1 ? 's' : ''} evaluated'
        : '$count task${count != 1 ? 's' : ''} evaluated';

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
            Text(subtitle, style: GoogleFonts.plusJakartaSans(
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
  final String? subtitle;
  final Color? valueColor;
  final IconData icon;
  final Color iconColor, iconBg;
  const _AppraisalStatCard({required this.value, required this.label,
      this.subLabel, this.subtitle, this.valueColor,
      required this.icon, required this.iconColor, required this.iconBg});

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
              fontSize: 28, fontWeight: FontWeight.w800,
              color: valueColor ?? AppTheme.textPrimary)),
          Text(label, style: GoogleFonts.plusJakartaSans(
              fontSize: 12, color: AppTheme.textMuted)),
          if (subLabel != null)
            Text(subLabel!, style: GoogleFonts.plusJakartaSans(
                fontSize: 11, color: AppTheme.textMuted)),
          if (subtitle != null)
            Text(subtitle!, style: GoogleFonts.plusJakartaSans(
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
      case 'pending_approval':
        color = const Color(0xFFF59E0B); label = 'Pending Approval'; break;
      case 'awaiting_ratings':
        color = const Color(0xFFF59E0B); label = 'Awaiting Ratings'; break;
      case 'approved':
        color = const Color(0xFF3B82F6); label = 'Approved'; break;
      case 'draft':
        color = Colors.grey; label = 'Draft'; break;
      case 'disabled':
        color = const Color(0xFFEF4444); label = 'Disabled'; break;
      case 'completed':
        color = const Color(0xFF22C55E); label = 'Completed'; hasIcon = true; break;
      case 'ongoing':
        color = const Color(0xFF3B82F6); label = 'Ongoing'; break;
      default:
        color = Colors.grey; label = status;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (hasIcon) ...[
          Icon(Icons.check_circle, size: 12, color: color),
          const SizedBox(width: 4),
        ],
        Flexible(
          child: Text(label,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ),
      ]),
    );
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

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator demographics (event evaluations)
// ─────────────────────────────────────────────────────────────────────────────

class _DemographicsDialog extends StatelessWidget {
  final EventForAppraisal event;
  const _DemographicsDialog({required this.event});

  @override
  Widget build(BuildContext context) {
    final d = event.demographics;
    final total = (d['total'] as num?)?.toInt() ?? 0;
    Map<String, int> m(String k) => (d[k] as Map? ?? {})
        .map((key, v) => MapEntry(key.toString(), (v as num).toInt()));
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 720, maxHeight: MediaQuery.of(context).size.height * 0.85),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Evaluator demographics', style: GoogleFonts.plusJakartaSans(
                    fontSize: 18, fontWeight: FontWeight.w700)),
                Text('${event.title} · $total ${total == 1 ? 'evaluation' : 'evaluations'}',
                    style: AppTheme.bodySm),
              ])),
              IconButton(onPressed: () => Navigator.pop(context), tooltip: 'Close',
                  icon: const Icon(Icons.close)),
            ]),
            const SizedBox(height: 16),
            Flexible(
              child: total == 0
                  ? Text('No evaluations yet.', style: AppTheme.bodyMd)
                  : SingleChildScrollView(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        _breakdown('By role', m('by_role'), total),
                        _breakdown('By sex', m('by_sex'), total),
                        _breakdown('By age group', m('by_age_group'), total),
                      ]),
                    ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _breakdown(String title, Map<String, int> counts, int total) => Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          for (final e in counts.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                SizedBox(width: 150, child: Text(
                    e.key.isEmpty ? '—' : e.key[0].toUpperCase() + e.key.substring(1),
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(fontSize: 13,
                        color: e.key == 'Not specified' ? AppTheme.textLight : AppTheme.textPrimary))),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: e.value / total,
                      minHeight: 10,
                      backgroundColor: const Color(0xFFEEF2FA),
                      color: e.key == 'Not specified' ? const Color(0xFFCBD5E1) : AppTheme.accentBlue,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(width: 90, child: Text(
                    '${e.value} · ${(e.value * 100 / total).toStringAsFixed(0)}%',
                    textAlign: TextAlign.right, style: AppTheme.captionMd)),
              ]),
            ),
        ]),
      );
}
// ─────────────────────────────────────────────────────────────────────────────
// Special task dialog helpers (IPCRF-style Q / E / T rating)
// ─────────────────────────────────────────────────────────────────────────────

const _ratingLabels = {
  5: 'Outstanding',
  4: 'Very Satisfactory',
  3: 'Satisfactory',
  2: 'Unsatisfactory',
  1: 'Poor',
};

/// DepEd RPMS rating bands for a 1-5 score.
String _ipcrfRating(double s) {
  if (s >= 4.5) return 'Outstanding';
  if (s >= 3.5) return 'Very Satisfactory';
  if (s >= 2.5) return 'Satisfactory';
  return 'Unsatisfactory';
}

class _RatingDropdownRow extends StatelessWidget {
  final String label;
  final int value; // 0 = not chosen
  final ValueChanged<int> onChanged;
  final String? description;
  const _RatingDropdownRow(this.label, this.value, this.onChanged, {this.description});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.plusJakartaSans(
                      fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                  if (description != null) ...[
                    const SizedBox(height: 3),
                    Text(description!, style: GoogleFonts.plusJakartaSans(
                        fontSize: 11, color: AppTheme.textMuted, height: 1.35)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 16),
            SizedBox(
              width: 250,
              child: DropdownButtonFormField<int>(
                value: value == 0 ? null : value,
                isDense: true,
                hint: Text('Select rating', style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, color: AppTheme.textMuted)),
                items: [
                  for (final e in _ratingLabels.entries)
                    DropdownMenuItem(value: e.key,
                        child: Text('${e.key} - ${e.value}',
                            style: GoogleFonts.plusJakartaSans(fontSize: 13))),
                ],
                onChanged: (v) { if (v != null) onChanged(v); },
                decoration: InputDecoration(
                  filled: true, fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppTheme.borderColor)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppTheme.borderColor)),
                ),
              ),
            ),
          ],
        ),
      );
}

Widget _ScoreReadRow(String label, int score, {String? description}) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
                if (description != null) ...[
                  const SizedBox(height: 2),
                  Text(description, style: GoogleFonts.plusJakartaSans(
                      fontSize: 11, color: AppTheme.textMuted, height: 1.3)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Text('$score / 5', style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF1D4ED8))),
          ),
        ],
      ),
    );

/// "Attached MOVs" list: the files / links attached to the special task.
class _MovList extends StatelessWidget {
  final SpecialTask task;
  const _MovList({required this.task});

  String _resolve(String url) =>
      url.startsWith('http') ? url : '${ApiService.baseUrl}$url';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20, top: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Attached MOVs:', style: GoogleFonts.plusJakartaSans(
            fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
        const SizedBox(height: 10),
        if (task.movs.isEmpty)
          Text('No MOVs uploaded', style: GoogleFonts.plusJakartaSans(
              fontSize: 12, color: AppTheme.textMuted, fontStyle: FontStyle.italic)),
        for (final m in task.movs)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              const Icon(Icons.description, size: 16, color: Color(0xFF3B82F6)),
              const SizedBox(width: 8),
              Expanded(child: Text(
                  ((m['name'] ?? '').toString().isEmpty ? (m['url'] ?? '') : m['name']).toString(),
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13,
                      color: const Color(0xFF2563EB),
                      decoration: TextDecoration.underline))),
              InkWell(
                onTap: () {
                  final url = (m['url'] ?? '').toString();
                  if (url.isNotEmpty) webOpenUrl(_resolve(url));
                },
                child: Text('[View MOV]', style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, color: AppTheme.textMuted)),
              ),
            ]),
          ),
      ]),
    );
  }
}
