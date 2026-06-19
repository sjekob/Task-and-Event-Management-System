import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../core/api_service.dart';

const Map<int, String> _reportNames = {
  101: "Monthly Compliance Report",
  102: "Lesson Plan Submission",
  103: "Grades Submission",
  104: "Faculty Attendance Sheet",
  105: "Department Budget Report",
};

class TimingPointsTab extends StatefulWidget {
  final Widget pageHeader;
  final String username;
  final String role;

  const TimingPointsTab({
    super.key,
    required this.pageHeader,
    required this.username,
    required this.role,
  });

  @override
  State<TimingPointsTab> createState() => _TimingPointsTabState();
}

class _TimingPointsTabState extends State<TimingPointsTab> {
  final List<Map<String, dynamic>> _localSubmissions = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _filterMode = 'all';
  String? _selectedPersonnel;
  int? _selectedTask;

  List<String> get _personnelList {
    return _localSubmissions
        .map((s) => s['personnel_name'] as String? ?? 'Unknown Teacher')
        .toSet()
        .toList()
      ..sort();
  }

  List<Map<String, dynamic>> get _taskList {
    final seen = <int>{};
    final List<Map<String, dynamic>> list = [];
    for (final s in _localSubmissions) {
      final id = s['report_id'] as int?;
      if (id != null && !seen.contains(id)) {
        seen.add(id);
        list.add({
          'id': id,
          'name': _reportNames[id] ?? 'Report RPT-$id',
        });
      }
    }
    list.sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
    return list;
  }

  List<Map<String, dynamic>> get _filteredSubmissions {
    if (_filterMode == 'personnel' && _selectedPersonnel != null) {
      return _localSubmissions.where((s) => s['personnel_name'] == _selectedPersonnel).toList();
    }
    if (_filterMode == 'task' && _selectedTask != null) {
      return _localSubmissions.where((s) => s['report_id'] == _selectedTask).toList();
    }
    return _localSubmissions;
  }

  @override
  void initState() {
    super.initState();
    _fetchSubmissions();
  }

  Future<void> _fetchSubmissions() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final api = ReportsApi();
      final List<dynamic> raw = await api.listSubmissions();
      
      final List<Map<String, dynamic>> loaded = [];
      for (final item in raw) {
        loaded.add(Map<String, dynamic>.from(item));
      }

      setState(() {
        _localSubmissions.clear();
        _localSubmissions.addAll(loaded);
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error fetching report submissions: $e');
      setState(() {
        _errorMessage = 'Failed to load report submissions from backend server.';
        _isLoading = false;
      });
    }
  }



  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSubmissions;
    // Basic stats computed from filtered submissions
    final totalSubmissions = filtered.length;
    final totalTimingPoints = filtered.isEmpty
        ? 0
        : filtered.map((s) => (s['timing_points'] as num).toInt()).fold(0, (a, b) => a + b);
    
    final onTimeCount = filtered.where((s) => s['timing_status'] == 'Early' || s['timing_status'] == 'On Time').length;
    final complianceRate = totalSubmissions > 0 ? (onTimeCount / totalSubmissions) * 100 : 0.0;

    // Group submissions by teacher name
    final Map<String, List<Map<String, dynamic>>> groupedByTeacher = {};
    for (final sub in filtered) {
      final name = sub['personnel_name'] ?? 'Unknown Teacher';
      groupedByTeacher.putIfAbsent(name, () => []).add(sub);
    }
    final teacherNames = groupedByTeacher.keys.toList()..sort();

    // Group submissions by report/task id
    final Map<int, List<Map<String, dynamic>>> groupedByReport = {};
    for (final sub in filtered) {
      final reportId = sub['report_id'] as int;
      groupedByReport.putIfAbsent(reportId, () => []).add(sub);
    }
    final reportIds = groupedByReport.keys.toList()..sort();

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          widget.pageHeader,
          
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                
                // Stat Cards Row
                Builder(
                  builder: (context) {
                    final bool isMobile = MediaQuery.of(context).size.width < 640;
                    if (isMobile) {
                      return Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: _buildStatCard(
                                  title: 'Total Reports Submitted',
                                  value: '$totalSubmissions',
                                  subtitle: 'Period: Apr 2025',
                                  icon: Icons.assignment_turned_in_outlined,
                                  color: const Color(0xFF3B82F6),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildStatCard(
                                  title: 'Total Timing Points',
                                  value: '$totalTimingPoints pts',
                                  subtitle: 'Earned from all submissions',
                                  icon: Icons.monetization_on_outlined,
                                  color: const Color(0xFF10B981),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _buildStatCard(
                                  title: 'Compliance Rate',
                                  value: '${complianceRate.toStringAsFixed(1)}%',
                                  subtitle: 'Early + On-Time submissions',
                                  icon: Icons.trending_up,
                                  color: const Color(0xFF8B5CF6),
                                ),
                              ),
                            ],
                          ),
                        ],
                      );
                    }
                    return Row(
                      children: [
                        Expanded(
                          child: _buildStatCard(
                            title: 'Total Reports Submitted',
                            value: '$totalSubmissions',
                            subtitle: 'Period: Apr 2025',
                            icon: Icons.assignment_turned_in_outlined,
                            color: const Color(0xFF3B82F6),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildStatCard(
                            title: 'Total Timing Points',
                            value: '$totalTimingPoints pts',
                            subtitle: 'Earned from all submissions',
                            icon: Icons.monetization_on_outlined,
                            color: const Color(0xFF10B981),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildStatCard(
                            title: 'Compliance Rate',
                            value: '${complianceRate.toStringAsFixed(1)}%',
                            subtitle: 'Early + On-Time submissions',
                            icon: Icons.trending_up,
                            color: const Color(0xFF8B5CF6),
                          ),
                        ),
                      ],
                    );
                  }
                ),
                
                const SizedBox(height: 24),
                
                // Rules reference banner
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Points System Rules',
                        style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(child: _buildRuleCard('Early', '150 pts', const Color(0xFF10B981))),
                          const SizedBox(width: 8),
                          Expanded(child: _buildRuleCard('On Time', '100 pts', const Color(0xFF06B6D4))),
                          const SizedBox(width: 8),
                          Expanded(child: _buildRuleCard('Late ≤ 24h', '50 pts', const Color(0xFFF59E0B))),
                          const SizedBox(width: 8),
                          Expanded(child: _buildRuleCard('Late > 24h', '0 pts', const Color(0xFFEF4444))),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Submissions are automatically computed using the server timestamp compared to the report deadline.',
                        style: TextStyle(color: Colors.white54, fontSize: 11, height: 1.4),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 24),
                
                // Table title + actions
                Builder(
                  builder: (context) {
                    final isMobile = MediaQuery.of(context).size.width < 640;
                    if (isMobile) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Teacher Submissions & Compliance',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              _StyledDropdown(
                                value: _filterMode,
                                leadingIcon: Icons.tune_rounded,
                                items: const [
                                  _DropItem(value: 'all',       label: 'Show All'),
                                  _DropItem(value: 'personnel', label: 'By Personnel'),
                                  _DropItem(value: 'task',      label: 'By Task'),
                                ],
                                onChanged: (v) => setState(() {
                                  _filterMode = v!;
                                  _selectedPersonnel = null;
                                  _selectedTask = null;
                                }),
                              ),
                              if (_filterMode == 'personnel')
                                _StyledDropdown(
                                  value: _selectedPersonnel,
                                  hint: 'All Personnel',
                                  items: _personnelList
                                      .map((p) => _DropItem(value: p, label: p))
                                      .toList(),
                                  onChanged: (v) => setState(() => _selectedPersonnel = v),
                                ),
                              if (_filterMode == 'task')
                                _StyledDropdown(
                                  value: _selectedTask?.toString(),
                                  hint: 'All Tasks',
                                  items: _taskList
                                      .map((t) => _DropItem(value: t['id'].toString(), label: t['name'] as String))
                                      .toList(),
                                  onChanged: (v) => setState(() => _selectedTask = v != null ? int.tryParse(v) : null),
                                ),
                              IconButton(
                                icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
                                onPressed: _fetchSubmissions,
                              ),
                            ],
                          ),
                        ],
                      );
                    }
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Teacher Submissions & Compliance',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        Row(
                          children: [
                            _StyledDropdown(
                              value: _filterMode,
                              leadingIcon: Icons.tune_rounded,
                              items: const [
                                _DropItem(value: 'all',       label: 'Show All'),
                                _DropItem(value: 'personnel', label: 'By Personnel'),
                                _DropItem(value: 'task',      label: 'By Task'),
                              ],
                              onChanged: (v) => setState(() {
                                _filterMode = v!;
                                _selectedPersonnel = null;
                                _selectedTask = null;
                              }),
                            ),
                            if (_filterMode == 'personnel') ...[
                              const SizedBox(width: 8),
                              _StyledDropdown(
                                value: _selectedPersonnel,
                                hint: 'All Personnel',
                                items: _personnelList
                                    .map((p) => _DropItem(value: p, label: p))
                                    .toList(),
                                onChanged: (v) => setState(() => _selectedPersonnel = v),
                              ),
                            ],
                            if (_filterMode == 'task') ...[
                              const SizedBox(width: 8),
                              _StyledDropdown(
                                value: _selectedTask?.toString(),
                                hint: 'All Tasks',
                                items: _taskList
                                    .map((t) => _DropItem(value: t['id'].toString(), label: t['name'] as String))
                                    .toList(),
                                onChanged: (v) => setState(() => _selectedTask = v != null ? int.tryParse(v) : null),
                              ),
                            ],
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
                              onPressed: _fetchSubmissions,
                            ),
                          ],
                        ),
                      ],
                    );
                  }
                ),
                const SizedBox(height: 12),
                
                // Content Card/List
                _isLoading
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(40),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    : _errorMessage != null
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(
                                children: [
                                  const Icon(Icons.error_outline, color: Colors.redAccent, size: 36),
                                  const SizedBox(height: 12),
                                  Text(_errorMessage!, style: const TextStyle(color: Colors.black54, fontSize: 13)),
                                ],
                              ),
                            ),
                          )
                        : _localSubmissions.isEmpty
                            ? const Center(
                                child: Padding(
                                  padding: EdgeInsets.all(48),
                                  child: Text(
                                    'No report submissions recorded yet. Click "Submit Report" to record a submission.',
                                    style: TextStyle(color: Colors.black45, fontSize: 13),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              )
                            : Column(
                                children: _filterMode != 'task'
                                    ? teacherNames.map((name) {
                                        final subs = groupedByTeacher[name]!;
                                        return _buildTeacherSection(name, subs);
                                      }).toList()
                                    : reportIds.map((reportId) {
                                        final subs = groupedByReport[reportId]!;
                                        return _buildTaskSection(reportId, subs);
                                      }).toList(),
                              ),
                const SizedBox(height: 40),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                const SizedBox(height: 4),
                Text(value, style: const TextStyle(fontSize: 20, color: Color(0xFF0F172A), fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTable(List<Map<String, dynamic>> submissions) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: 800,
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(2.2), // Task Name
            1: FlexColumnWidth(1.8), // Deadline
            2: FlexColumnWidth(1.8), // Submitted At
            3: FlexColumnWidth(1.6), // Timing Status
            4: FlexColumnWidth(1.2), // Timing Points
            5: FlexColumnWidth(2.6), // Rubric Scores
          },
          defaultVerticalAlignment: TableCellVerticalAlignment.middle,
          children: [
        // Table Header
        TableRow(
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Colors.black12, width: 1)),
          ),
          children: [
            _tableHeaderCell('Task Name'),
            _tableHeaderCell('Deadline'),
            _tableHeaderCell('Submitted At'),
            _tableHeaderCell('Timing Status'),
            _tableHeaderCell('Timing Points'),
            _tableHeaderCell('Rubric Scores'),
          ],
        ),
        
        // Table Rows
        ...submissions.map((sub) {
          final timingPoints = sub['timing_points'] as int;
          final status = sub['timing_status'] as String;
          
          Color badgeBg = Colors.black12;
          Color badgeFg = Colors.black54;
          if (status == 'Early') {
            badgeBg = const Color(0xFFD1E7DD);
            badgeFg = const Color(0xFF0F5132);
          } else if (status == 'On Time') {
            badgeBg = const Color(0xFFCFF4FC);
            badgeFg = const Color(0xFF055160);
          } else if (status.contains('within 24 hours')) {
            badgeBg = const Color(0xFFFFF3CD);
            badgeFg = const Color(0xFF664D03);
          } else {
            badgeBg = const Color(0xFFF8D7DA);
            badgeFg = const Color(0xFF842029);
          }

          final qScore = sub['content_quality_score'] ?? 0;
          final fScore = sub['format_compliance_score'] ?? 0;
          final cScore = sub['completeness_score'] ?? 0;
          final rubricAvg = (qScore + fScore + cScore) / 3.0;

          return TableRow(
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.black12, width: 0.5)),
            ),
            children: [
              _tableCell(_reportNames[sub['report_id']] ?? 'Report RPT-${sub['report_id']}', isBold: true),
              _tableCell(sub['deadline']),
              _tableCell(sub['submitted_at']),
              
              // Status Badge
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(6)),
                  child: Text(
                    status,
                    style: TextStyle(color: badgeFg, fontSize: 11, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),

              _tableCell('$timingPoints pts', isBold: true, color: timingPoints == 150 ? Colors.green : (timingPoints == 100 ? Colors.teal : (timingPoints == 50 ? Colors.orange : Colors.red))),
              
              // Rubric breakdown
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Avg: ${rubricAvg.toStringAsFixed(1)} / 5.0', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                    const SizedBox(height: 4),
                    Text('Content Quality: $qScore\nFormat Compliance: $fScore\nCompleteness: $cScore', style: const TextStyle(fontSize: 10, color: Colors.black54, height: 1.3)),
                  ],
                ),
              ),
            ],
          );
        }),
      ],
    ),
      ),
    );
  }

  Widget _buildTeacherSection(String teacherName, List<Map<String, dynamic>> submissions) {
    // Compute stats for this teacher
    final total = submissions.length;
    final avgPoints = total > 0
        ? submissions.map((s) => (s['timing_points'] as num).toDouble()).reduce((a, b) => a + b) / total
        : 0.0;
    final onTime = submissions.where((s) => s['timing_status'] == 'Early' || s['timing_status'] == 'On Time').length;
    final compliance = total > 0 ? (onTime / total) * 100 : 0.0;
    final dept = submissions.isNotEmpty ? (submissions.first['personnel_department'] ?? 'General') : 'General';

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.cardBorder),
      ),
      elevation: 0,
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(
          dividerColor: Colors.transparent,
          hoverColor: Colors.transparent,
          splashColor: Colors.transparent,
        ),
        child: ExpansionTile(
          title: Row(
            children: [
              CircleAvatar(
                backgroundColor: const Color(0xFFEFF6FF),
                radius: 18,
                child: Text(
                  teacherName.isNotEmpty ? teacherName[0].toUpperCase() : 'T',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF3B82F6), fontSize: 14),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      teacherName,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dept,
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              _buildMiniBadge('Subs: $total', const Color(0xFFEFF6FF), const Color(0xFF1D4ED8)),
              const SizedBox(width: 8),
              _buildMiniBadge(
                '${compliance.toStringAsFixed(0)}% Compliant',
                compliance >= 80
                    ? const Color(0xFFD1FAE5)
                    : (compliance >= 50 ? const Color(0xFFFEF3C7) : const Color(0xFFFEE2E2)),
                compliance >= 80
                    ? const Color(0xFF065F46)
                    : (compliance >= 50 ? const Color(0xFF92400E) : const Color(0xFF7F1D1D)),
              ),
            ],
          ),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Divider(color: AppColors.cardBorder, height: 1),
                  const SizedBox(height: 16),
                  
                  // Teacher Specific Summary row
                  Row(
                    children: [
                      Expanded(
                        child: _buildTeacherMiniStat(
                          'Total Submissions',
                          '$total',
                          Icons.assignment_outlined,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildTeacherMiniStat(
                          'Avg Timing Points',
                          '${avgPoints.toStringAsFixed(1)} / 150',
                          Icons.timer_outlined,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildTeacherMiniStat(
                          'Compliance Rate',
                          '${compliance.toStringAsFixed(1)}%',
                          Icons.trending_up,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Submission History',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  _buildTable(submissions),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniBadge(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        text,
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildTeacherMiniStat(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.cardBorder, width: 0.8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tableHeaderCell(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Text(
        text,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
      ),
    );
  }

  Widget _tableCell(String text, {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          color: color ?? const Color(0xFF334155),
        ),
      ),
    );
  }

  Widget _buildRuleCard(String label, String points, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.4), width: 1),
      ),
      child: Column(
        children: [
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text(points, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildTaskSection(int reportId, List<Map<String, dynamic>> submissions) {
    final total = submissions.length;
    final deadline = submissions.isNotEmpty ? (submissions.first['deadline'] ?? 'N/A') : 'N/A';
    final onTime = submissions.where((s) => s['timing_status'] == 'Early' || s['timing_status'] == 'On Time').length;
    final compliance = total > 0 ? (onTime / total) * 100 : 0.0;

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.cardBorder),
      ),
      elevation: 0,
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(
          dividerColor: Colors.transparent,
          hoverColor: Colors.transparent,
          splashColor: Colors.transparent,
        ),
        child: ExpansionTile(
          title: Row(
            children: [
              CircleAvatar(
                backgroundColor: const Color(0xFFEFF6FF),
                radius: 18,
                child: const Icon(
                  Icons.assignment_outlined,
                  color: Color(0xFF3B82F6),
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _reportNames[reportId] ?? 'Report RPT-$reportId',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Deadline: $deadline',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              _buildMiniBadge('Subs: $total', const Color(0xFFEFF6FF), const Color(0xFF1D4ED8)),
              const SizedBox(width: 8),
              _buildMiniBadge(
                '${compliance.toStringAsFixed(0)}% Compliant',
                compliance >= 80
                    ? const Color(0xFFD1FAE5)
                    : (compliance >= 50 ? const Color(0xFFFEF3C7) : const Color(0xFFFEE2E2)),
                compliance >= 80
                    ? const Color(0xFF065F46)
                    : (compliance >= 50 ? const Color(0xFF92400E) : const Color(0xFF7F1D1D)),
              ),
            ],
          ),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Divider(color: AppColors.cardBorder, height: 1),
                  const SizedBox(height: 16),
                  const Text(
                    'Submitted By',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  _buildTaskTable(submissions),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskTable(List<Map<String, dynamic>> submissions) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: 800,
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(1.8), // Personnel
            1: FlexColumnWidth(2.0), // Submitted At
            2: FlexColumnWidth(1.8), // Timing Status
            3: FlexColumnWidth(1.4), // Timing Points
            4: FlexColumnWidth(2.2), // Rubric Scores
          },
          defaultVerticalAlignment: TableCellVerticalAlignment.middle,
          children: [
        TableRow(
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Colors.black12, width: 1)),
          ),
          children: [
            _tableHeaderCell('Personnel'),
            _tableHeaderCell('Submitted At'),
            _tableHeaderCell('Timing Status'),
            _tableHeaderCell('Timing Points'),
            _tableHeaderCell('Rubric Scores'),
          ],
        ),
        ...submissions.map((sub) {
          final timingPoints = sub['timing_points'] as int;
          final status = sub['timing_status'] as String;
          final personnelName = sub['personnel_name'] ?? 'Unknown Teacher';
          final dept = sub['personnel_department'] ?? 'General';
          
          Color badgeBg = Colors.black12;
          Color badgeFg = Colors.black54;
          if (status == 'Early') {
            badgeBg = const Color(0xFFD1E7DD);
            badgeFg = const Color(0xFF0F5132);
          } else if (status == 'On Time') {
            badgeBg = const Color(0xFFCFF4FC);
            badgeFg = const Color(0xFF055160);
          } else if (status.contains('within 24 hours')) {
            badgeBg = const Color(0xFFFFF3CD);
            badgeFg = const Color(0xFF664D03);
          } else {
            badgeBg = const Color(0xFFF8D7DA);
            badgeFg = const Color(0xFF842029);
          }

          final qScore = sub['content_quality_score'] ?? 0;
          final fScore = sub['format_compliance_score'] ?? 0;
          final cScore = sub['completeness_score'] ?? 0;
          final rubricAvg = (qScore + fScore + cScore) / 3.0;

          return TableRow(
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.black12, width: 0.5)),
            ),
            children: [
              Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      personnelName,
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                    ),
                    Text(
                      dept,
                      style: const TextStyle(fontSize: 10, color: Colors.black45),
                    ),
                  ],
                ),
              ),
              _tableCell(sub['submitted_at']),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(6)),
                  child: Text(
                    status,
                    style: TextStyle(color: badgeFg, fontSize: 11, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
              _tableCell('$timingPoints pts', isBold: true, color: timingPoints == 150 ? Colors.green : (timingPoints == 100 ? Colors.teal : (timingPoints == 50 ? Colors.orange : Colors.red))),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Avg: ${rubricAvg.toStringAsFixed(1)} / 5.0', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                    const SizedBox(height: 4),
                    Text('Content Quality: $qScore\nFormat Compliance: $fScore\nCompleteness: $cScore', style: const TextStyle(fontSize: 9.5, color: Colors.black54, height: 1.3)),
                  ],
                ),
              ),
            ],
          );
        }),
      ],
    ),
      ),
    );
  }
}

class _DropItem {
  final String? value;
  final String label;
  const _DropItem({required this.value, required this.label});
}

class _StyledDropdown extends StatelessWidget {
  final String? value;
  final String? hint;
  final List<_DropItem> items;
  final ValueChanged<String?> onChanged;
  final IconData? leadingIcon;

  const _StyledDropdown({
    required this.value,
    required this.items,
    required this.onChanged,
    this.hint,
    this.leadingIcon,
  });

  @override
  Widget build(BuildContext context) {
    final bool isDark = value != null && value != 'all';
    final Color bg          = isDark ? AppColors.tabActive : Colors.white;
    final Color fg          = isDark ? Colors.white : AppColors.textPrimary;
    final Color borderColor = isDark ? AppColors.tabActive : AppColors.cardBorder;
    final Color iconColor   = isDark
        ? Colors.white.withOpacity(0.8)
        : AppColors.textSecondary;

    String displayLabel = hint ?? 'Select…';
    if (value != null) {
      final match = items.where((i) => i.value == value);
      if (match.isNotEmpty) displayLabel = match.first.label;
    }

    return GestureDetector(
      onTap: () {
        final RenderBox? renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox == null) return;

        final size = renderBox.size;
        final position = renderBox.localToGlobal(Offset.zero);

        const double menuWidth = 200;
        final double x = position.dx + (size.width - menuWidth) / 2;
        final double y = position.dy + size.height + 4;
 
        showMenu<String?>(
          context: context,
          position: RelativeRect.fromLTRB(x, y, x + menuWidth, y + 300),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: AppColors.cardBorder.withOpacity(0.8), width: 0.8),
          ),
          color: Colors.white,
          elevation: 8,
          shadowColor: Colors.black.withOpacity(0.08),
          constraints: const BoxConstraints(minWidth: menuWidth, maxWidth: 340),
          items: items.map((item) => PopupMenuItem<String?>(
            value: item.value,
            height: 38,
            child: Row(children: [
              if (item.value == value) ...[
                const Icon(Icons.check_rounded, size: 14, color: AppColors.tabActive),
                const SizedBox(width: 6),
              ] else
                const SizedBox(width: 20),
              Expanded(
                child: Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 13,
                    color: item.value == value ? AppColors.tabActive : AppColors.textPrimary,
                    fontWeight: item.value == value ? FontWeight.w600 : FontWeight.w400,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ),
            ]),
          )).toList(),
        ).then((selectedValue) {
          if (selectedValue != null) {
            onChanged(selectedValue);
          }
        });
      },
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderColor, width: 1),
            boxShadow: isDark
                ? [BoxShadow(
                    color: AppColors.tabActive.withOpacity(0.15),
                    blurRadius: 6, offset: const Offset(0, 2))]
                : [BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 4, offset: const Offset(0, 1))],
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (leadingIcon != null) ...[
              Icon(leadingIcon, size: 14, color: iconColor),
              const SizedBox(width: 6),
            ],
            Text(displayLabel,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: fg)),
            const SizedBox(width: 6),
            Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: iconColor),
          ]),
        ),
      ),
    );
  }
}

