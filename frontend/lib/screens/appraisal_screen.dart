import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../services/app_state.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

// ── Appraisal Screen Shell ────────────────────────────────────────────────────

enum _AppraisalTab { specialTasks, events, analytics }

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

  @override
  void initState() {
    super.initState();
    final role = context.read<AppState>().userRole;
    _initTabs(role);
    _loadData();
  }

  void _initTabs(String role) {
    if (role == 'principal') {
      _availableTabs = [
        _AppraisalTab.specialTasks,
        _AppraisalTab.events,
        _AppraisalTab.analytics,
      ];
    } else if (role == 'coordinator') {
      _availableTabs = [
        _AppraisalTab.specialTasks,
        _AppraisalTab.events,
        _AppraisalTab.analytics,
      ];
    } else {
      // dean
      _availableTabs = [_AppraisalTab.specialTasks, _AppraisalTab.events];
    }
    _activeTab = _availableTabs.first;
  }

  Future<void> _loadData() async {
    _loadTasks();
    _loadEvents();
  }

  Future<void> _loadTasks() async {
    setState(() => _loadingTasks = true);
    try {
      final tasks = await ApiService.getSpecialTasks();
      if (mounted) setState(() => _tasks = tasks);
    } catch (_) {}
    if (mounted) setState(() => _loadingTasks = false);
  }

  Future<void> _loadEvents() async {
    setState(() => _loadingEvents = true);
    try {
      final events = await ApiService.getSchoolEvents();
      if (mounted) setState(() => _events = events);
    } catch (_) {}
    if (mounted) setState(() => _loadingEvents = false);
  }

  String _tabLabel(_AppraisalTab t) {
    switch (t) {
      case _AppraisalTab.specialTasks: return 'Special Tasks';
      case _AppraisalTab.events:       return 'Events';
      case _AppraisalTab.analytics:    return 'Analytics';
    }
  }

  IconData _tabIcon(_AppraisalTab t) {
    switch (t) {
      case _AppraisalTab.specialTasks: return Icons.assignment_outlined;
      case _AppraisalTab.events:       return Icons.calendar_month_outlined;
      case _AppraisalTab.analytics:    return Icons.bar_chart_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 20),
          _buildTabBar(),
          const SizedBox(height: 16),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Home',
                style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6),
              child:
                  Icon(Icons.chevron_right, size: 14, color: AppTheme.textMuted),
            ),
            Text('Appraisal',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.w500)),
          ],
        ),
        const SizedBox(height: 10),
        Text('Performance Appraisal',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary)),
        Text('Evaluate special tasks and events · Track faculty performance',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, color: AppTheme.textMuted)),
      ],
    );
  }

  Widget _buildTabBar() {
    return Row(
      children: _availableTabs.map((tab) {
        final active = tab == _activeTab;
        return Padding(
          padding: const EdgeInsets.only(right: 8),
          child: GestureDetector(
            onTap: () => setState(() => _activeTab = tab),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: active ? AppTheme.darkBanner : Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: active
                        ? AppTheme.darkBanner
                        : Colors.grey.shade300),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(_tabIcon(tab),
                      size: 15,
                      color: active ? Colors.white : AppTheme.textMuted),
                  const SizedBox(width: 6),
                  Text(_tabLabel(tab),
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: active
                              ? Colors.white
                              : AppTheme.textMuted)),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildBody() {
    switch (_activeTab) {
      case _AppraisalTab.specialTasks:
        return _SpecialTasksTab(
          tasks: _tasks,
          loading: _loadingTasks,
          onRefresh: _loadTasks,
          onEvaluated: (updated) {
            setState(() {
              final idx = _tasks.indexWhere((t) => t.id == updated.id);
              if (idx >= 0) _tasks[idx] = updated;
            });
          },
        );
      case _AppraisalTab.events:
        return _EventsTab(
          events: _events,
          loading: _loadingEvents,
          onRefresh: _loadEvents,
          onEvaluated: (updated) {
            setState(() {
              final idx = _events.indexWhere((e) => e.id == updated.id);
              if (idx >= 0) _events[idx] = updated;
            });
          },
        );
      case _AppraisalTab.analytics:
        return _AnalyticsTab(tasks: _tasks, events: _events);
    }
  }
}

// ── Special Tasks Tab ─────────────────────────────────────────────────────────

class _SpecialTasksTab extends StatelessWidget {
  final List<SpecialTask> tasks;
  final bool loading;
  final VoidCallback onRefresh;
  final ValueChanged<SpecialTask> onEvaluated;

  const _SpecialTasksTab({
    required this.tasks,
    required this.loading,
    required this.onRefresh,
    required this.onEvaluated,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (tasks.isEmpty) {
      return Center(
          child: Text('No special tasks found.',
              style: GoogleFonts.plusJakartaSans(
                  color: AppTheme.textMuted)));
    }
    return ListView.separated(
      itemCount: tasks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (ctx, i) => _SpecialTaskCard(
        task: tasks[i],
        onEvaluated: onEvaluated,
      ),
    );
  }
}

class _SpecialTaskCard extends StatelessWidget {
  final SpecialTask task;
  final ValueChanged<SpecialTask> onEvaluated;

  const _SpecialTaskCard(
      {required this.task, required this.onEvaluated});

  Color get _statusColor {
    switch (task.status) {
      case 'evaluated': return Colors.green;
      case 'submitted': return Colors.blue;
      case 'flagged':   return Colors.orange;
      default:          return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ev = task.evaluation;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(task.title,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 15, fontWeight: FontWeight.w700)),
              ),
              _StatusBadge(label: task.status, color: _statusColor),
            ],
          ),
          if (task.description != null) ...[
            const SizedBox(height: 4),
            Text(task.description!,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, color: AppTheme.textMuted)),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              if (task.assigneeName != null)
                _InfoChip(
                    icon: Icons.person_outline,
                    label: task.assigneeName!),
              if (task.dueDate != null) ...[
                const SizedBox(width: 8),
                _InfoChip(
                    icon: Icons.calendar_today_outlined,
                    label: 'Due: ${task.dueDate}'),
              ],
            ],
          ),
          if (ev != null) ...[
            const SizedBox(height: 10),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Row(
              children: [
                _ScorePill('Completion', ev.completionScore),
                const SizedBox(width: 6),
                _ScorePill('Timeliness', ev.timelinessScore),
                const SizedBox(width: 6),
                _ScorePill('Initiative', ev.initiativeScore),
                const SizedBox(width: 6),
                _ScorePill('Coordination', ev.coordinationScore),
                const Spacer(),
                if (ev.weightedAverage != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Score: ${(ev.weightedAverage! * 20).toStringAsFixed(0)}%',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Colors.green.shade700),
                    ),
                  ),
              ],
            ),
            if (ev.remarks != null && ev.remarks!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Remarks: ${ev.remarks}',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      color: AppTheme.textMuted,
                      fontStyle: FontStyle.italic)),
            ],
          ],
          if (task.status != 'evaluated') ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton.icon(
                onPressed: () => _openEvalDialog(context),
                icon: const Icon(Icons.rate_review_outlined, size: 15),
                label: const Text('Evaluate'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.darkBanner,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  textStyle: GoogleFonts.plusJakartaSans(
                      fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _openEvalDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => _SpecialTaskEvalDialog(
        task: task,
        onSubmitted: onEvaluated,
      ),
    );
  }
}

class _SpecialTaskEvalDialog extends StatefulWidget {
  final SpecialTask task;
  final ValueChanged<SpecialTask> onSubmitted;
  const _SpecialTaskEvalDialog(
      {required this.task, required this.onSubmitted});

  @override
  State<_SpecialTaskEvalDialog> createState() =>
      _SpecialTaskEvalDialogState();
}

class _SpecialTaskEvalDialogState extends State<_SpecialTaskEvalDialog> {
  int _completion = 0;
  int _timeliness = 0;
  int _initiative = 0;
  int _coordination = 0;
  final _remarksCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _remarksCtrl.dispose();
    super.dispose();
  }

  double get _score {
    return (_completion * 35 +
            _timeliness * 30 +
            _initiative * 20 +
            _coordination * 15) /
        5.0;
  }

  Future<void> _submit() async {
    if (_completion == 0 || _timeliness == 0 ||
        _initiative == 0 || _coordination == 0) {
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
        'coordination_score': _coordination,
        'remarks': _remarksCtrl.text.trim(),
      });
      widget.onSubmitted(updated);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Evaluate: ${widget.task.title}',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text('Rate each criterion from 1 (lowest) to 5 (highest)',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 12, color: AppTheme.textMuted)),
              const SizedBox(height: 16),
              _StarRow('Completion Quality (35%)', _completion,
                  (v) => setState(() => _completion = v)),
              _StarRow('Timeliness (30%)', _timeliness,
                  (v) => setState(() => _timeliness = v)),
              _StarRow('Initiative (20%)', _initiative,
                  (v) => setState(() => _initiative = v)),
              _StarRow('Coordination (15%)', _coordination,
                  (v) => setState(() => _coordination = v)),
              const SizedBox(height: 12),
              if (_completion > 0)
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(children: [
                    const Icon(Icons.info_outline,
                        size: 15, color: Colors.blue),
                    const SizedBox(width: 6),
                    Text(
                      'Computed Score: ${_score.toStringAsFixed(1)}%',
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.blue),
                    ),
                  ]),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: _remarksCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'Remarks (optional)',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
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
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Submit'),
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

Widget _StarRow(String label, int value, ValueChanged<int> onChanged) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Row(
          children: List.generate(5, (i) {
            final v = i + 1;
            return GestureDetector(
              onTap: () => onChanged(v),
              child: Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Icon(
                  v <= value ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: v <= value ? Colors.amber : Colors.grey.shade400,
                  size: 26,
                ),
              ),
            );
          }),
        ),
      ],
    ),
  );
}

// ── Events Tab ────────────────────────────────────────────────────────────────

class _EventsTab extends StatelessWidget {
  final List<SchoolEvent> events;
  final bool loading;
  final VoidCallback onRefresh;
  final ValueChanged<SchoolEvent> onEvaluated;

  const _EventsTab({
    required this.events,
    required this.loading,
    required this.onRefresh,
    required this.onEvaluated,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (events.isEmpty) {
      return Center(
          child: Text('No events found.',
              style: GoogleFonts.plusJakartaSans(
                  color: AppTheme.textMuted)));
    }
    return ListView.separated(
      itemCount: events.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (ctx, i) =>
          _EventCard(event: events[i], onEvaluated: onEvaluated),
    );
  }
}

class _EventCard extends StatelessWidget {
  final SchoolEvent event;
  final ValueChanged<SchoolEvent> onEvaluated;

  const _EventCard({required this.event, required this.onEvaluated});

  Color get _statusColor {
    switch (event.status) {
      case 'completed':  return Colors.green;
      case 'ongoing':    return Colors.blue;
      case 'cancelled':  return Colors.red;
      default:           return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(event.title,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 15, fontWeight: FontWeight.w700)),
              ),
              _StatusBadge(label: event.status, color: _statusColor),
            ],
          ),
          if (event.description != null) ...[
            const SizedBox(height: 4),
            Text(event.description!,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, color: AppTheme.textMuted)),
          ],
          if (event.eventDate != null) ...[
            const SizedBox(height: 6),
            _InfoChip(
                icon: Icons.calendar_today_outlined,
                label: event.eventDate!),
          ],
          if (event.evaluations.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Text('${event.evaluations.length} Evaluation(s)',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textMuted)),
            const SizedBox(height: 6),
            ...event.evaluations.take(2).map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    Expanded(
                        child: Text(e.evaluatorName,
                            style: GoogleFonts.plusJakartaSans(fontSize: 13))),
                    Text('Avg: ${e.average.toStringAsFixed(1)}/5',
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.green.shade700)),
                  ]),
                )),
          ],
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton.icon(
              onPressed: () => _openEvalDialog(context),
              icon: const Icon(Icons.rate_review_outlined, size: 15),
              label: const Text('Submit Evaluation'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.darkBanner,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
                textStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openEvalDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => _EventEvalDialog(
        event: event,
        onSubmitted: onEvaluated,
      ),
    );
  }
}

class _EventEvalDialog extends StatefulWidget {
  final SchoolEvent event;
  final ValueChanged<SchoolEvent> onSubmitted;
  const _EventEvalDialog(
      {required this.event, required this.onSubmitted});

  @override
  State<_EventEvalDialog> createState() => _EventEvalDialogState();
}

class _EventEvalDialogState extends State<_EventEvalDialog> {
  final _nameCtrl = TextEditingController();
  String _role = 'Teacher';
  int _planning = 0;
  int _objectives = 0;
  int _personnel = 0;
  int _timeMgmt = 0;
  int _engagement = 0;
  int _resource = 0;
  final _commentsCtrl = TextEditingController();
  bool _submitting = false;

  static const _roles = [
    'Principal', 'Coordinator', 'Dean', 'Teacher', 'Registrar'
  ];

  @override
  void dispose() {
    _nameCtrl.dispose();
    _commentsCtrl.dispose();
    super.dispose();
  }

  double get _average =>
      (_planning + _objectives + _personnel + _timeMgmt + _engagement + _resource) /
      6.0;

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Please enter your name.')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final updated = await ApiService.evaluateSchoolEvent(widget.event.id, {
        'evaluator_name': _nameCtrl.text.trim(),
        'evaluator_role': _role,
        'planning_score': _planning,
        'objectives_score': _objectives,
        'personnel_score': _personnel,
        'time_mgmt_score': _timeMgmt,
        'engagement_score': _engagement,
        'resource_score': _resource,
        'feedback_comments': _commentsCtrl.text.trim(),
      });
      widget.onSubmitted(updated);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500, maxHeight: 660),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.darkBanner,
                borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(12),
                    topRight: Radius.circular(12)),
              ),
              child: Row(children: [
                const Icon(Icons.rate_review_outlined,
                    color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Evaluate: ${widget.event.title}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700)),
                ),
                IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close,
                        color: Colors.white, size: 18)),
              ]),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: _nameCtrl,
                      decoration: InputDecoration(
                        labelText: 'Your Name *',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _role,
                      decoration: InputDecoration(
                        labelText: 'Your Role',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      items: _roles
                          .map((r) => DropdownMenuItem(
                              value: r, child: Text(r)))
                          .toList(),
                      onChanged: (v) => setState(() => _role = v!),
                    ),
                    const SizedBox(height: 14),
                    Text('Rating Criteria',
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.darkBanner)),
                    const SizedBox(height: 10),
                    _StarRow('Planning & Preparation', _planning,
                        (v) => setState(() => _planning = v)),
                    _StarRow('Achievement of Objectives', _objectives,
                        (v) => setState(() => _objectives = v)),
                    _StarRow('Personnel Management', _personnel,
                        (v) => setState(() => _personnel = v)),
                    _StarRow('Time Management', _timeMgmt,
                        (v) => setState(() => _timeMgmt = v)),
                    _StarRow('Audience Engagement', _engagement,
                        (v) => setState(() => _engagement = v)),
                    _StarRow('Resource Management', _resource,
                        (v) => setState(() => _resource = v)),
                    if (_planning > 0) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Average Score: ${_average.toStringAsFixed(2)} / 5',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.blue),
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    TextField(
                      controller: _commentsCtrl,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'Comments (optional)',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8)),
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
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Submit'),
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

// ── Analytics Tab ─────────────────────────────────────────────────────────────

class _AnalyticsTab extends StatelessWidget {
  final List<SpecialTask> tasks;
  final List<SchoolEvent> events;

  const _AnalyticsTab({required this.tasks, required this.events});

  @override
  Widget build(BuildContext context) {
    final evaluated = tasks.where((t) => t.status == 'evaluated').toList();
    final pending = tasks.where((t) => t.status == 'pending').toList();
    final submitted = tasks.where((t) => t.status == 'submitted').toList();

    double avgScore = 0;
    if (evaluated.isNotEmpty) {
      final scores = evaluated
          .where((t) => t.evaluation?.weightedAverage != null)
          .map((t) => t.evaluation!.weightedAverage! * 20);
      if (scores.isNotEmpty) {
        avgScore = scores.reduce((a, b) => a + b) / scores.length;
      }
    }

    final totalEventEvals =
        events.fold<int>(0, (sum, e) => sum + e.evaluations.length);
    double avgEventScore = 0;
    if (totalEventEvals > 0) {
      final allEvals = events.expand((e) => e.evaluations);
      avgEventScore =
          allEvals.map((e) => e.average).reduce((a, b) => a + b) /
              totalEventEvals;
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Performance Overview',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _StatCard(
                  label: 'Total Special Tasks',
                  value: '${tasks.length}',
                  icon: Icons.assignment_outlined,
                  color: Colors.blue),
              _StatCard(
                  label: 'Evaluated Tasks',
                  value: '${evaluated.length}',
                  icon: Icons.check_circle_outline,
                  color: Colors.green),
              _StatCard(
                  label: 'Pending Tasks',
                  value: '${pending.length}',
                  icon: Icons.hourglass_empty_outlined,
                  color: Colors.orange),
              _StatCard(
                  label: 'Avg Task Score',
                  value: avgScore > 0 ? '${avgScore.toStringAsFixed(1)}%' : '—',
                  icon: Icons.star_outline,
                  color: Colors.purple),
              _StatCard(
                  label: 'Total Events',
                  value: '${events.length}',
                  icon: Icons.calendar_month_outlined,
                  color: Colors.teal),
              _StatCard(
                  label: 'Event Evaluations',
                  value: '$totalEventEvals',
                  icon: Icons.rate_review_outlined,
                  color: Colors.indigo),
              if (totalEventEvals > 0)
                _StatCard(
                    label: 'Avg Event Score',
                    value: '${avgEventScore.toStringAsFixed(2)}/5',
                    icon: Icons.analytics_outlined,
                    color: Colors.deepOrange),
            ],
          ),
          const SizedBox(height: 24),
          if (evaluated.isNotEmpty) ...[
            Text('Task Evaluation Breakdown',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ...evaluated.map((t) => _TaskEvalRow(task: t)),
          ],
        ],
      ),
    );
  }
}

class _TaskEvalRow extends StatelessWidget {
  final SpecialTask task;
  const _TaskEvalRow({required this.task});

  @override
  Widget build(BuildContext context) {
    final ev = task.evaluation!;
    final score = ev.weightedAverage != null
        ? (ev.weightedAverage! * 20).toStringAsFixed(0)
        : '—';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(task.title,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, fontWeight: FontWeight.w600)),
                if (task.assigneeName != null)
                  Text(task.assigneeName!,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 12, color: AppTheme.textMuted)),
              ],
            ),
          ),
          Text('$score%',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: _scoreColor(ev.weightedAverage))),
        ],
      ),
    );
  }

  Color _scoreColor(double? avg) {
    if (avg == null) return Colors.grey;
    final pct = avg * 20;
    if (pct >= 80) return Colors.green;
    if (pct >= 60) return Colors.orange;
    return Colors.red;
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 10),
          Text(value,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 22, fontWeight: FontWeight.w800)),
          Text(label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: AppTheme.textMuted)),
        ],
      ),
    );
  }
}

// ── Shared small widgets ──────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(8)),
      child: Text(label,
          style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color)),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppTheme.textMuted),
        const SizedBox(width: 4),
        Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, color: AppTheme.textMuted)),
      ],
    );
  }
}

class _ScorePill extends StatelessWidget {
  final String label;
  final int score;
  const _ScorePill(this.label, this.score);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(6)),
      child: Text('$label: $score/5',
          style: GoogleFonts.plusJakartaSans(
              fontSize: 11, fontWeight: FontWeight.w500)),
    );
  }
}
