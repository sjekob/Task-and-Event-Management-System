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
    final pending = widget.events.where((e) => e.status == 'pending_approval').length;
    final evaluated = widget.events.where((e) => e.evaluations.isNotEmpty).length;
    final withEvals = widget.events.where((e) => e.evaluations.isNotEmpty).toList();
    final avgPct = withEvals.isEmpty
        ? null
        : withEvals.map((e) => e.evidencyRate).reduce((a, b) => a + b) / withEvals.length;
    final avgColor = avgPct == null ? AppTheme.textMuted : _evidencyColor(avgPct);
    final avgLabel = avgPct == null ? '—' : '${avgPct.toStringAsFixed(0)}%';
    return Row(children: [
      Expanded(child: _AppraisalStatCard(
          value: '${widget.events.length}', label: 'Total Events',
          subtitle: '${widget.events.length} total · $pending awaiting ratings',
          icon: Icons.event_note_outlined, iconColor: AppTheme.textMuted,
          iconBg: const Color(0xFFF3F4F6))),
      const SizedBox(width: 12),
      Expanded(child: _AppraisalStatCard(
          value: '$evaluated', label: 'Rated Events',
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
        SizedBox(width: 100, child: Text('EVALUATION', style: style, textAlign: TextAlign.center)),
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
        SizedBox(width: 100, child: Center(child: IconButton(
          tooltip: 'Evaluation options',
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
          icon: const Icon(Icons.assignment_outlined, size: 20, color: Color(0xFF3B82F6)),
          onPressed: () => _showEvaluationOptions(event),
        ))),
        SizedBox(width: 120, child: Align(
          alignment: Alignment.centerRight,
          child: hasEvals
              ? _ActionBtn(label: 'View Results', dark: true,
                  onTap: () => _showEventEvalDialog(event))
              : Text('No Data', style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: AppTheme.textMuted)),
        )),
      ]),
    );
  }

  void _showEvaluationOptions(EventForAppraisal event) {
    showDialog<void>(context: context, builder: (_) => _EvaluationOptionsDialog(event: event));
  }

  void _showEventEvalDialog(EventForAppraisal event) async {
    final updated = await showDialog<EventForAppraisal>(
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
  final EventForAppraisal event;
  final ValueChanged<EventForAppraisal> onSubmitted;
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
      final updated = await ApiService.evaluateEvent(widget.event.id, {
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
  const _EvaluationOptionsDialog({required this.event});

  @override
  Widget build(BuildContext context) {
    final orgLine = _organizerLine(event);
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 360,
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

class _AnalyticsTab extends StatelessWidget {
  final List<SpecialTask> tasks;
  final List<EventForAppraisal> events;
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
