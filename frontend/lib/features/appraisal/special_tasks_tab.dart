import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../shared/widgets/shared_widgets.dart';
import '../../core/api_service.dart';
import '../../core/role_service.dart';
import 'models/appraisal_models.dart';

enum _FilterMode { all, byPersonnel, byTask }

class SpecialTasksTab extends StatefulWidget {
  final Widget pageHeader;
  final String role;
  final Map<String, Map<String, dynamic>> evaluations;
  final void Function(String id, Map<String, dynamic> result) onSubmitEvaluation;

  const SpecialTasksTab({
    super.key,
    required this.pageHeader,
    required this.role,
    required this.evaluations,
    required this.onSubmitEvaluation,
  });

  @override
  State<SpecialTasksTab> createState() => _SpecialTasksTabState();
}

class EvaluationDialog extends StatefulWidget {
  final SpecialTask task;
  final Map<String, dynamic>? existing;
  final String role;
  final bool canEdit;
  const EvaluationDialog({super.key, required this.task, this.existing, required this.role, this.canEdit = false});

  @override
  State<EvaluationDialog> createState() => _EvaluationDialogState();
}

class _EvaluationDialogState extends State<EvaluationDialog> {
  int completion = 0;
  int quality = 0;
  int timeliness = 0;
  int coordination = 0;
  String remarks = '';
  int _step = 0;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      final ratings = e['ratings'] as Map<String, dynamic>?;
      completion = ratings?['completion'] ?? 0;
      quality = ratings?['quality'] ?? 0;
      timeliness = ratings?['timeliness'] ?? 0;
      coordination = ratings?['coordination'] ?? 0;
      remarks = e['remarks'] ?? '';
    }
  }

  void _setRating(String key, int value) {
    setState(() {
      switch (key) {
        case 'completion':
          completion = value;
          break;
        case 'quality':
          quality = value;
          break;
        case 'timeliness':
          timeliness = value;
          break;
        case 'coordination':
          coordination = value;
          break;
      }
    });
  }

  int _computeScore() {
    const weights = {
      'completion': 35,
      'quality': 30,
      'timeliness': 20,
      'coordination': 15,
    };
    double total = 0;
    total += (completion / 5.0) * weights['completion']!;
    total += (quality / 5.0) * weights['quality']!;
    total += (timeliness / 5.0) * weights['timeliness']!;
    total += (coordination / 5.0) * weights['coordination']!;
    return total.round();
  }


  String _getLabel(String key) {
    final isTeacher = widget.role == 'dean'; // dean evaluates teachers
    if (isTeacher) {
      if (key == 'completion') { return 'Content Quality'; }
      if (key == 'quality') { return 'Format Compliance'; }
      if (key == 'timeliness') { return 'Completeness'; }
      return '';
    } else {
      if (key == 'completion') { return 'Task Completion Quality'; }
      if (key == 'quality') { return 'Timeliness and Reliability'; }
      if (key == 'timeliness') { return 'Initiative and Problem-Solving'; }
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool readOnly = widget.existing != null || !widget.canEdit;

    return AlertDialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      titlePadding: const EdgeInsets.fromLTRB(20, 18, 12, 8),
      contentPadding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      title: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(readOnly ? 'View Evaluation' : 'Evaluate Special Task', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(widget.task.task, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ]),
        ),
        IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.close, size: 20, color: AppColors.textSecondary),
        ),
      ]),
      content: SizedBox(
        width: 640,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _step == 0 ? _previewContent() : _rubricContent(readOnly),
          const SizedBox(height: 12),
          if (readOnly) _previousEvaluationWidget(),
        ]),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      actions: [
        if (!readOnly) ...[
          if (_step == 1)
            TextButton(onPressed: () => setState(() => _step = 0), child: const Text('Back')),
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.tabActive),
            onPressed: () {
              if (_step == 0) {
                setState(() => _step = 1);
                return;
              }
              final score = _computeScore();
              final result = <String, dynamic>{
                'ratings': <String, dynamic>{
                  'completion': completion,
                  'quality': quality,
                  'timeliness': timeliness,
                  'coordination': coordination,
                },
                'remarks': remarks,
                'score': score,
                'submittedAt': DateTime.now().toIso8601String(),
              };
              Navigator.of(context).pop(result);
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Text(_step == 0 ? 'Start Evaluation →' : 'Submit Evaluation', style: const TextStyle(color: Colors.white)),
            ),
          ),
        ] else ...[
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
        ],
      ],
    );
  }

  Widget _starsRow(int value) {
    return Row(children: List.generate(5, (i) {
      final v = i + 1;
      return Icon(v <= value ? Icons.star : Icons.star_border, color: const Color(0xFFF59E0B), size: 18);
    }));
  }

  Widget _previousEvaluationWidget() {
    final e = widget.existing!;
    final ratings = e['ratings'] as Map<String, dynamic>? ?? {};
    final int score = e['score'] as int? ?? 0;
    final String remarksText = e['remarks'] ?? '';
    final isTeacher = widget.role == 'dean'; // dean evaluates teachers

    Widget line(String label, String pct, int val) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Expanded(child: Text('$label ($pct)', style: const TextStyle(fontSize: 13))),
          _starsRow(val),
        ]),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.cardBg, borderRadius: BorderRadius.circular(8)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Previous Evaluation:', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        line(_getLabel('completion'), isTeacher ? '33%' : '40%', ratings['completion'] ?? 0),
        line(_getLabel('quality'), isTeacher ? '33%' : '30%', ratings['quality'] ?? 0),
        line(_getLabel('timeliness'), isTeacher ? '33%' : '30%', ratings['timeliness'] ?? 0),
        const Divider(),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Total Weighted Score', style: TextStyle(fontWeight: FontWeight.w700)),
          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(6)), child: Text('$score/100', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.tabActive))),
        ]),
        const SizedBox(height: 8),
        if (remarksText.isNotEmpty) ...[
          const Text('Coordinator Remarks:', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(remarksText),
        ],
      ]),
    );
  }

  Widget _previewContent() {
    Widget rowItem(String label, String value) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 6),
            Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          ]),
        );

    return Column(mainAxisSize: MainAxisSize.min, children: [
      // two-column grid of info
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            rowItem('Personnel', widget.task.personnel),
            rowItem('Assigned By', widget.task.assignedBy),
            rowItem('Task', widget.task.task),
            rowItem('Due Date', widget.task.dueDate),
          ]),
        ),
        const SizedBox(width: 32),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            rowItem('Department', widget.task.department),
            rowItem('Supervisor', '—'),
            rowItem('Submitted', widget.task.submittedDate ?? '—'),
          ]),
        ),
      ]),
    ]);
  }

  Widget _rubricContent(bool readOnly) {
    final isTeacher = widget.role == 'dean'; // dean evaluates teachers
    return SingleChildScrollView(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _starRowEditable('${_getLabel("completion")} (${isTeacher ? "33%" : "40%"})', completion, 'completion', readOnly),
        _starRowEditable('${_getLabel("quality")} (${isTeacher ? "33%" : "30%"})', quality, 'quality', readOnly),
        _starRowEditable('${_getLabel("timeliness")} (${isTeacher ? "33%" : "30%"})', timeliness, 'timeliness', readOnly),
        const SizedBox(height: 8),
        const Text('Remarks', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          enabled: !readOnly,
          maxLines: 3,
          onChanged: (v) => setState(() => remarks = v),
          controller: TextEditingController(text: remarks),
          decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Add remarks...'),
        ),
        const SizedBox(height: 12),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Estimated score: ${_computeScore()}/100', style: const TextStyle(fontWeight: FontWeight.w700)),
        ]),
      ]),
    );
  }

  Widget _starRowEditable(String label, int value, String key, bool readOnly) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      Row(children: List.generate(5, (i) {
        final v = i + 1;
        return IconButton(
          onPressed: readOnly ? null : () => _setRating(key, v),
          icon: Icon(v <= value ? Icons.star : Icons.star_border, color: readOnly ? AppColors.textSecondary : AppColors.tabActive),
          iconSize: 22,
          padding: const EdgeInsets.all(0),
        );
      })),
      const SizedBox(height: 8),
    ]);
  }
}

class _SpecialTasksTabState extends State<SpecialTasksTab> {
  _FilterMode _filterMode = _FilterMode.all;
  String? _selectedPersonnel;
  String? _selectedTask;

  late RolePermissions _rolePerms;

  @override
  void initState() {
    super.initState();
    _rolePerms = RolePermissions(widget.role);
  }

  @override
  void didUpdateWidget(SpecialTasksTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Force UI rebuild whenever the evaluations map changes
    if (oldWidget.evaluations != widget.evaluations) {
      setState(() {});
    }
  }

  List<SpecialTask> get _baseTasks {
    // TEACHER: Cannot see special tasks at all
    if (widget.role == 'teacher') { return []; }

    // DEAN: See only their own tasks
    if (widget.role == 'dean') {
      return sampleTasks
          .where((t) => _rolePerms.canViewTask(t.personnel, null))
          .toList();
    }

    // COORDINATOR & PRINCIPAL: See all tasks
    if (widget.role == 'coordinator' || widget.role == 'principal') {
      return sampleTasks;
    }

    return [];
  }

  List<String> get _personnelList =>
      _baseTasks.map((t) => t.personnel).toSet().toList()..sort();

  List<String> get _taskList =>
      _baseTasks.map((t) => t.task).toSet().toList()..sort();

  List<SpecialTask> get _filteredTasks {
    switch (_filterMode) {
      case _FilterMode.byPersonnel:
        if (_selectedPersonnel == null) { return _baseTasks; }
        return _baseTasks
            .where((t) => t.personnel == _selectedPersonnel)
            .toList();
      case _FilterMode.byTask:
        if (_selectedTask == null) { return _baseTasks; }
        return _baseTasks.where((t) => t.task == _selectedTask).toList();
      case _FilterMode.all:
        return _baseTasks;
    }
  }

  int get _pendingCount {
    int count = 0;
    for (final t in _filteredTasks) {
      final hasEval = widget.evaluations.containsKey(t.id);
      if (hasEval) { continue; }
      if (t.status == TaskStatus.pending) { count++; }
    }
    return count;
  }

  int get _evaluatedCount {
    int count = 0;
    for (final t in _filteredTasks) {
      final eval = widget.evaluations[t.id];
      if (eval != null) {
        final raw = eval['score'];
        final int score = raw is num ? raw.round() : 0;
        if (score >= 60) { count++; }
      } else if (t.status == TaskStatus.evaluated) {
        count++;
      }
    }
    return count;
  }

  int get _flaggedCount {
    int count = 0;
    for (final t in _filteredTasks) {
      final eval = widget.evaluations[t.id];
      if (eval != null) {
        final raw = eval['score'];
        final int score = raw is num ? raw.round() : 0;
        if (score < 60) { count++; }
      } else if (t.status == TaskStatus.flagged) {
        count++;
      }
    }
    return count;
  }

  String get _avgScore {
    final List<int> scores = [];
    for (final t in _filteredTasks) {
      final eval = widget.evaluations[t.id];
      if (eval != null) {
        final raw = eval['score'];
        final int s = raw is num ? raw.round() : 0;
        if (s > 0) { scores.add(s); }
      } else {
        final sc = t.getScore();
        if (sc > 0) { scores.add(sc); }
      }
    }
    if (scores.isEmpty) { return '—'; }
    return '${(scores.reduce((a, b) => a + b) / scores.length).round()}/100';
  }

  String get _filterModeValue {
    switch (_filterMode) {
      case _FilterMode.all:         return 'all';
      case _FilterMode.byPersonnel: return 'personnel';
      case _FilterMode.byTask:      return 'task';
    }
  }

  



  @override
  Widget build(BuildContext context) {
    // ── TEACHER: Cannot access special tasks ────────────────────────────────
    if (widget.role == 'teacher') {
      return SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            widget.pageHeader,
            Padding(
              padding: const EdgeInsets.all(24),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F9FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFC7E9FF), width: 0.8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(children: [
                      Icon(Icons.lock_outline, color: AppColors.tabActive, size: 20),
                      SizedBox(width: 12),
                      Text(
                        'Special Tasks',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                    ]),
                    const SizedBox(height: 12),
                    const Text(
                      'You do not have permission to view special task evaluations. Only Deans, Coordinators, and Principals can access this section.',
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.5),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    // ── DEAN, COORDINATOR, PRINCIPAL: Can view special tasks ────────────────
    if (widget.role == 'coordinator') {
      return SingleChildScrollView(
        child: _buildCoordinatorView(context),
      );
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          widget.pageHeader,
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Stat cards ──────────────────────────────────────────────
                Row(children: [
                  Expanded(child: _StatCard(label: 'Pending Review', value: '$_pendingCount', valueColor: AppColors.warning, icon: Icons.assignment_outlined, iconColor: AppColors.warning)),
                  const SizedBox(width: 14),
                  Expanded(child: _StatCard(label: 'Evaluated', value: '$_evaluatedCount', valueColor: AppColors.success, icon: Icons.check_circle_outline, iconColor: AppColors.success)),
                  const SizedBox(width: 14),
                  Expanded(child: _StatCard(label: 'Flagged', value: '$_flaggedCount', valueColor: AppColors.danger, icon: Icons.flag, iconColor: AppColors.danger)),
                  const SizedBox(width: 14),
                  Expanded(child: _StatCard(label: 'Avg Score', value: _avgScore, valueColor: AppColors.amber, icon: Icons.bar_chart, iconColor: AppColors.amber)),
                ]),
                const SizedBox(height: 18),

                // ── Weighted scoring breakdown ───────────────────────────────
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.cardBorder, width: 0.8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Weighted Scoring Breakdown (Total: 100 pts)',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 16),
                      if (widget.role == 'dean') ...[
                         const Row(children: [
                          Expanded(child: _WeightItem(emoji: '📝', label: 'Content Quality',             pct: '33.3%')),
                          Expanded(child: _WeightItem(emoji: '📋', label: 'Format Compliance',           pct: '33.3%')),
                          Expanded(child: _WeightItem(emoji: '✅', label: 'Completeness',                pct: '33.3%')),
                        ]),
                      ] else ...[
                         const Row(children: [
                          Expanded(child: _WeightItem(emoji: '✅', label: 'Task Completion',             pct: '40%')),
                          Expanded(child: _WeightItem(emoji: '⏰', label: 'Timeliness',                  pct: '30%')),
                          Expanded(child: _WeightItem(emoji: '💡', label: 'Initiative & Problem',        pct: '30%')),
                        ]),
                      ],
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF1F1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                              color: const Color(0xFFFECACA), width: 0.8),
                        ),
                        child: const Row(children: [
                          Icon(Icons.flag, color: AppColors.danger, size: 14),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Personnel rated below 3 stars are automatically flagged and coordinators are alerted immediately.',
                              style: TextStyle(
                                  color: AppColors.danger, fontSize: 12.5),
                            ),
                          ),
                        ]),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // ── Table card ───────────────────────────────────────────────
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.cardBorder, width: 0.8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Card header with improved dropdowns
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 16, 0),
                        child: Row(
                          children: [
                            const Text('Special Task Evaluations',
                                style: AppTextStyles.sectionTitle),
                            const Spacer(),

                            // ── Filter mode ──────────────────────────────────
                            _StyledDropdown(
                              value: _filterModeValue,
                              leadingIcon: Icons.tune_rounded,
                              items: const [
                                _DropItem(value: 'all',       label: 'Show All'),
                                _DropItem(value: 'personnel', label: 'By Personnel'),
                                _DropItem(value: 'task',      label: 'By Task'),
                              ],
                              onChanged: (v) => setState(() {
                                _filterMode = v == 'personnel'
                                    ? _FilterMode.byPersonnel
                                    : v == 'task'
                                        ? _FilterMode.byTask
                                        : _FilterMode.all;
                                _selectedPersonnel = null;
                                _selectedTask = null;
                              }),
                            ),

                            // ── Personnel picker ─────────────────────────────
                            if (_filterMode == _FilterMode.byPersonnel) ...[
                              const SizedBox(width: 8),
                              _StyledDropdown(
                                value: _selectedPersonnel,
                                hint: 'All Personnel',
                                items: _personnelList
                                    .map((p) => _DropItem(value: p, label: p))
                                    .toList(),
                                onChanged: (v) =>
                                    setState(() => _selectedPersonnel = v),
                              ),
                            ],

                            // ── Task picker ──────────────────────────────────
                            if (_filterMode == _FilterMode.byTask) ...[
                              const SizedBox(width: 8),
                              _StyledDropdown(
                                value: _selectedTask,
                                hint: 'All Tasks',
                                items: _taskList
                                    .map((t) => _DropItem(value: t, label: t))
                                    .toList(),
                                onChanged: (v) =>
                                    setState(() => _selectedTask = v),
                              ),
                            ],
                          ],
                        ),
                      ),

                      const SizedBox(height: 14),
                      _SpecialTaskTable(
                        tasks: _filteredTasks,
                        evaluations: widget.evaluations,
                        onSubmitEvaluation: (id, result) async {
                          // Try to persist to backend first; fallback to local store
                          try {
                            final api = SpecialTasksApi();
                            final payload = {
                              'personnel_id': null,
                              'coordinator_id': null,
                              'completion_quality_score': result['ratings']['completion'],
                              'timeliness_score': result['ratings']['timeliness'],
                              'initiative_score': result['ratings']['quality'],
                              'coordination_score': result['ratings']['coordination'],
                              'remarks': result['remarks'],
                            };
                            await api.evaluateTask(id, payload);
                          } catch (err) {
                            debugPrint('Failed to persist task evaluation to backend: $err');
                          }
                          // Always update local memory state to keep UI synchronized in real-time
                          widget.onSubmitEvaluation(id, result);
                        },
                        role: widget.role,
                      ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoordinatorView(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.pageHeader,
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stat cards
              Row(children: [
                Expanded(child: _CoordinatorStatCard(label: 'Total Faculty Evaluated', value: '4', valueColor: const Color(0xFF10B981), icon: Icons.check_circle_outline, iconColor: const Color(0xFF10B981))),
                const SizedBox(width: 14),
                Expanded(child: _CoordinatorStatCard(label: 'Flagged Personnel', value: '1', valueColor: const Color(0xFFEF4444), icon: Icons.error_outline, iconColor: const Color(0xFFEF4444))),
                const SizedBox(width: 14),
                Expanded(child: _CoordinatorStatCard(label: 'Departments Monitored', value: '4', valueColor: const Color(0xFF8B5CF6), icon: Icons.group_outlined, iconColor: const Color(0xFF8B5CF6))),
                const SizedBox(width: 14),
                Expanded(child: _CoordinatorStatCard(label: 'School Avg Compliance / 100', value: '273', valueColor: const Color(0xFF475569), icon: Icons.emoji_events_outlined, iconColor: const Color(0xFF94A3B8))),
              ]),
              const SizedBox(height: 18),
              
              // Appraisal Coverage breakdown
              _buildCoverageCard(),
              const SizedBox(height: 18),

              // ── Task Evaluation Table (For Deans) ──────────────────────
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.cardBorder, width: 0.8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Card header with improved dropdowns
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 16, 0),
                      child: Row(
                        children: [
                          const Text('Dean Special Task Submissions', style: AppTextStyles.sectionTitle),
                          const Spacer(),
                          // ── Filter mode ──────────────────────────────────
                          _StyledDropdown(
                            value: _filterModeValue,
                            leadingIcon: Icons.tune_rounded,
                            items: const [
                              _DropItem(value: 'all',       label: 'Show All'),
                              _DropItem(value: 'personnel', label: 'By Personnel'),
                              _DropItem(value: 'task',      label: 'By Task'),
                            ],
                            onChanged: (v) => setState(() {
                              _filterMode = v == 'personnel'
                                  ? _FilterMode.byPersonnel
                                  : v == 'task'
                                      ? _FilterMode.byTask
                                      : _FilterMode.all;
                              _selectedPersonnel = null;
                              _selectedTask = null;
                            }),
                          ),
                          // ── Personnel picker ─────────────────────────────
                          if (_filterMode == _FilterMode.byPersonnel) ...[
                            const SizedBox(width: 8),
                            _StyledDropdown(
                              value: _selectedPersonnel,
                              hint: 'All Personnel',
                              items: _personnelList.map((p) => _DropItem(value: p, label: p)).toList(),
                              onChanged: (v) => setState(() => _selectedPersonnel = v),
                            ),
                          ],
                          // ── Task picker ──────────────────────────────────
                          if (_filterMode == _FilterMode.byTask) ...[
                            const SizedBox(width: 8),
                            _StyledDropdown(
                              value: _selectedTask,
                              hint: 'All Tasks',
                              items: _taskList.map((t) => _DropItem(value: t, label: t)).toList(),
                              onChanged: (v) => setState(() => _selectedTask = v),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    _SpecialTaskTable(
                      tasks: _filteredTasks,
                      evaluations: widget.evaluations,
                      onSubmitEvaluation: (id, result) async {
                        try {
                          final api = SpecialTasksApi();
                          final payload = {
                            'personnel_id': null,
                            'coordinator_id': null,
                            'completion_quality_score': result['ratings']['completion'],
                            'timeliness_score': result['ratings']['timeliness'],
                            'initiative_score': result['ratings']['quality'],
                            'coordination_score': result['ratings']['coordination'],
                            'remarks': result['remarks'],
                          };
                          await api.evaluateTask(id, payload);
                        } catch (err) {
                          debugPrint('Failed to persist task evaluation to backend: $err');
                        }
                        widget.onSubmitEvaluation(id, result);
                      },
                      role: widget.role,
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              
              // Faculty overview table removed as requested to avoid duplicates
              
              // Bottom summary banner
              _buildBottomSummaryBanner(context),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCoverageCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Appraisal Coverage — All Evaluation Types',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: _buildCoverageItem(
                icon: Icons.description_outlined,
                iconColor: const Color(0xFF2563EB),
                title: 'Special Task Timing',
                subtitle: 'Task completion and timeline',
              )),
              Expanded(child: _buildCoverageItem(
                icon: Icons.calendar_today_outlined,
                iconColor: const Color(0xFF10B981),
                title: 'Event Evaluation',
                subtitle: 'Multi-stakeholder',
              )),
              Expanded(child: _buildCoverageItem(
                icon: Icons.assignment_outlined,
                iconColor: const Color(0xFF8B5CF6),
                title: 'Special Task Ratings',
                subtitle: 'Weighted rubric',
              )),
              Expanded(child: _buildCoverageItem(
                icon: Icons.error_outline_outlined,
                iconColor: const Color(0xFFEF4444),
                title: 'Escalation Threshold',
                subtitle: 'Below 3 stars auto-flags',
              )),
            ],
          ),
          const SizedBox(height: 20),
          // Red warning banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(8),
              border: const Border(
                left: BorderSide(color: Color(0xFFEF4444), width: 4),
                top: BorderSide(color: Color(0xFFFEE2E2), width: 0.8),
                right: BorderSide(color: Color(0xFFFEE2E2), width: 0.8),
                bottom: BorderSide(color: Color(0xFFFEE2E2), width: 0.8),
              ),
            ),
            child: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Personnel rated below 3 stars are automatically flagged and coordinators are alerted immediately.',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF991B1B),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoverageItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }



  Widget _buildBottomSummaryBanner(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBFDBFE), width: 0.8),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Annual Faculty Performance Summary',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1E3A8A)),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Aggregated from all event and special task appraisals. Ready for DepEd Annual Faculty Performance Evaluation.',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF1E40AF)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 24),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Performance Summary exported successfully!')),
                  );
                },
                icon: const Icon(Icons.download, size: 16, color: Colors.white),
                label: const Text('Export Performance Summary', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3A8A),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Last exported: March 15, 2025',
                style: TextStyle(fontSize: 11, color: Color(0xFF60A5FA)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Improved styled dropdown
// ─────────────────────────────────────────────────────────────────────────────

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
    // Dark variant when a real filter is active (not 'all' or null)
    final bool isDark = value != null && value != 'all';
    final Color bg          = isDark ? AppColors.tabActive : Colors.white;
    final Color fg          = isDark ? Colors.white : AppColors.textPrimary;
    final Color borderColor = isDark ? AppColors.tabActive : AppColors.cardBorder;
    final Color iconColor   = isDark
        ? Colors.white.withValues(alpha: 0.8)
        : AppColors.textSecondary;

    // Resolve display label
    String displayLabel = hint ?? 'Select…';
    if (value != null) {
      final match = items.where((i) => i.value == value);
      if (match.isNotEmpty) { displayLabel = match.first.label; }
    }

    return PopupMenuButton<String?>(
      onSelected: onChanged,
      offset: const Offset(0, 42),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: AppColors.cardBorder.withValues(alpha: 0.8), width: 0.8),
      ),
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      constraints: const BoxConstraints(minWidth: 180, maxWidth: 280),
      itemBuilder: (_) => items
          .map((item) => PopupMenuItem<String?>(
                value: item.value,
                height: 38,
                child: Row(children: [
                  if (item.value == value) ...[
                    const Icon(Icons.check_rounded,
                        size: 14, color: AppColors.tabActive),
                    const SizedBox(width: 6),
                  ] else
                    const SizedBox(width: 20),
                  Text(item.label,
                      style: TextStyle(
                        fontSize: 13,
                        color: item.value == value
                            ? AppColors.tabActive
                            : AppColors.textPrimary,
                        fontWeight: item.value == value
                            ? FontWeight.w600
                            : FontWeight.w400,
                      )),
                ]),
              ))
          .toList(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: borderColor, width: 1),
          boxShadow: isDark
              ? [BoxShadow(
                  color: AppColors.tabActive.withValues(alpha: 0.15),
                  blurRadius: 6, offset: const Offset(0, 2))]
              : [BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
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
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;
  final IconData icon;
  final Color iconColor;

  const _StatCard({
    required this.label, required this.value,
    required this.valueColor, required this.icon, required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.cardBorder, width: 0.8),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: AppTextStyles.statLabel),
            const SizedBox(height: 10),
            Text(value,
                style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w700,
                    color: valueColor,
                    letterSpacing: -0.5)),
          ]),
        ),
        Icon(icon, color: iconColor, size: 26),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Weight item
// ─────────────────────────────────────────────────────────────────────────────

class _WeightItem extends StatelessWidget {
  final String emoji;
  final String label;
  final String pct;
  const _WeightItem({required this.emoji, required this.label, required this.pct});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(emoji, style: const TextStyle(fontSize: 16)),
      const SizedBox(width: 7),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
          Text(pct,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        ]),
      ),
    ]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-width special tasks table
// ─────────────────────────────────────────────────────────────────────────────

class _SpecialTaskTable extends StatelessWidget {
  final List<SpecialTask> tasks;
  final Map<String, Map<String, dynamic>> evaluations;
  final void Function(String id, Map<String, dynamic> result) onSubmitEvaluation;
  final String role;

  const _SpecialTaskTable({required this.tasks, required this.evaluations, required this.onSubmitEvaluation, required this.role});

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Text('No tasks match the selected filter.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        final double tableWidth = constraints.maxWidth > 1100 ? constraints.maxWidth : 1100;
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: tableWidth,
            child: Column(children: [
              _TableHeader(),
              const Divider(height: 0, thickness: 0.8, color: AppColors.divider),
              ...tasks.asMap().entries.map((e) => _TaskRow(task: e.value, index: e.key, evaluation: evaluations[e.value.id], onSubmit: onSubmitEvaluation, role: role)),
            ]),
          ),
        );
      },
    );
  }
}



class _CoordinatorStatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;
  final IconData icon;
  final Color iconColor;

  const _CoordinatorStatCard({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    color: valueColor,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
        ],
      ),
    );
  }
}

class _TableHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.tableHeaderBg,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: const Row(children: [
        SizedBox(width: 60,  child: _Th('ID')),
        SizedBox(width: 160, child: _Th('PERSONNEL')),
        SizedBox(width: 140, child: _Th('DEPARTMENT')),
        Expanded(child: _Th('TASK')),
        SizedBox(width: 120, child: _Th('ASSIGNED BY')),
        SizedBox(width: 90,  child: _Th('DUE DATE')),
        SizedBox(width: 110, child: _Th('SUBMITTED')),
        SizedBox(width: 90,  child: _Th('SCORE')),
        SizedBox(width: 110, child: _Th('STATUS')),
        SizedBox(width: 90,  child: _Th('ACTION')),
      ]),
    );
  }
}

class _Th extends StatelessWidget {
  final String text;
  const _Th(this.text);
  @override
  Widget build(BuildContext context) =>
      Text(text, style: AppTextStyles.tableHeader);
}

class _TaskRow extends StatelessWidget {
  final SpecialTask task;
  final int index;
  final Map<String, dynamic>? evaluation;
  final void Function(String id, Map<String, dynamic> result) onSubmit;
  final String role;

  const _TaskRow({required this.task, required this.index, this.evaluation, required this.onSubmit, required this.role});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: index.isOdd ? const Color(0xFFFAFAFB) : Colors.white,
        border: const Border(
        bottom: BorderSide(color: AppColors.divider, width: 0.5)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        SizedBox(
            width: 60,
            child: Text(task.id,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary))),
        SizedBox(
          width: 160,
          child: Row(children: [
          PersonAvatar(name: task.personnel),
          const SizedBox(width: 10),
          Expanded(
            child: Text(task.personnel,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary))),
          ]),
        ),
        SizedBox(
          width: 140,
          child: Text(task.department,
            style: const TextStyle(
              fontSize: 12, color: AppColors.textSecondary),
            overflow: TextOverflow.ellipsis)),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Text(task.task,
                style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                    height: 1.4)),
          ),
        ),
        SizedBox(
          width: 120,
          child: Text(task.assignedBy,
            style: const TextStyle(
              fontSize: 12, color: AppColors.textSecondary),
            overflow: TextOverflow.ellipsis)),
        SizedBox(
          width: 90,
          child: Text(task.dueDate,
            style: const TextStyle(
              fontSize: 12, color: AppColors.textSecondary))),
        SizedBox(width: 110, child: _submittedCell()),
        SizedBox(width: 90,  child: _scoreCell()),
        SizedBox(width: 110, child: _statusCell()),
        SizedBox(width: 90,  child: _actionButton(context)),
      ]),
    );
  }

  Widget _submittedCell() {
    if (task.status == TaskStatus.notSubmitted) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
            color: const Color(0xFFFEE2E2),
            borderRadius: BorderRadius.circular(5)),
        child: const Text('Not\nSubmitted',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 11,
                color: AppColors.danger,
                fontWeight: FontWeight.w500,
                height: 1.3)),
      );
    }
    if (task.submittedDate != null) {
      return Text(task.submittedDate!,
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.success));
    }
    return const Text('—',
        style: TextStyle(fontSize: 14, color: AppColors.textHint));
  }

  Widget _scoreCell() {
    final int sc = task.getScore();
    final int? score = evaluation != null ? evaluation!['score'] as int? : (sc > 0 ? sc : null);
    if (score == null) {
      return const Text('—', style: TextStyle(fontSize: 14, color: AppColors.textHint));
    }
    final Color bg = score >= 80
        ? const Color(0xFFDCFCE7)
        : score >= 60
            ? const Color(0xFFFEF3C7)
            : const Color(0xFFFECACA);
    final Color fg = score >= 80
        ? const Color(0xFF15803D)
        : score >= 60
            ? const Color(0xFF92400E)
            : const Color(0xFFDC2626);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text('$score/100', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
    );
  }

  Widget _statusCell() {
    // Prefer in-memory evaluation status when present
    if (evaluation != null) {
      final int score = evaluation!['score'] as int? ?? 0;
      if (score >= 60) {
        return const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.check_circle_outline, color: AppColors.success, size: 14),
          SizedBox(width: 4),
          Text('Evaluated', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.success)),
        ]);
      }
      return const Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.flag, color: AppColors.danger, size: 14),
        SizedBox(width: 4),
        Text('Flagged', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.danger)),
      ]);
    }
    switch (task.status) {
      case TaskStatus.pending:
        return const Text('Pending', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.warning));
      case TaskStatus.evaluated:
        return const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.check_circle_outline, color: AppColors.success, size: 14),
          SizedBox(width: 4),
          Text('Evaluated', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.success)),
        ]);
      case TaskStatus.flagged:
        return const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.flag, color: AppColors.danger, size: 14),
          SizedBox(width: 4),
          Text('Flagged', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.danger)),
        ]);
      case TaskStatus.notSubmitted:
        return const Text('Not Submitted', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.danger));
    }
  }

  Widget _actionButton(BuildContext context) {
    final bool hasEval = evaluation != null || task.status == TaskStatus.evaluated || task.status == TaskStatus.flagged;
    
    // Determine if this user can evaluate
    bool canEvaluate = false;
    if (role == 'dean') {
      canEvaluate = true; // simplified - in real app check if task is from a teacher under this dean
    } else if (role == 'coordinator') {
      canEvaluate = true;
    } else if (role == 'principal') {
      canEvaluate = false;
    }

    final String label = hasEval ? 'View' : (canEvaluate ? 'Evaluate' : 'View');
    final bool isDisabled = !canEvaluate && !hasEval;

    return Center(
      child: ElevatedButton(
        onPressed: isDisabled ? null : () async {
          if (!canEvaluate && !hasEval) { return; }
          
          final messenger = ScaffoldMessenger.of(context);
          final score = task.score ?? 0;
          final existingArg = evaluation ?? (score > 0 ? {'score': score, 'ratings': <String, int>{}, 'remarks': ''} : null);
          final result = await showDialog<Map<String, dynamic>>(
            context: context,
            builder: (c) => EvaluationDialog(task: task, existing: existingArg, role: role, canEdit: canEvaluate && !hasEval),
          );
          if (result != null) {
            onSubmit(task.id, result);
            messenger.showSnackBar(const SnackBar(content: Text('Evaluation submitted')));
          }
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: isDisabled ? AppColors.cardBorder : AppColors.tabActive,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          minimumSize: const Size(64, 34),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDisabled ? AppColors.textSecondary : Colors.white)),
      ),
    );
  }
}