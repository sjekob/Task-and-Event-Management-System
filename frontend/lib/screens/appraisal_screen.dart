import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/skeleton_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/app_state.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

part 'appraisal_screen_widgets.dart';

enum _AppraisalTab { timingPoints, specialTasks, events, analytics }

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
  List<EventForAppraisal> _events = [];
  bool _loadingTasks = true;
  bool _loadingEvents = true;
  String? _taskError;
  String? _eventError;

  List<Map<String, dynamic>> _submissions = [];
  bool _loadingSubmissions = true;
  String? _submissionError;

  @override
  void initState() {
    super.initState();
    final role = context.read<AppState>().userRole;
    if (role == 'dean') {
      _availableTabs = [_AppraisalTab.timingPoints, _AppraisalTab.specialTasks, _AppraisalTab.events];
    } else {
      _availableTabs = [_AppraisalTab.timingPoints, _AppraisalTab.specialTasks, _AppraisalTab.events, _AppraisalTab.analytics];
    }
    _activeTab = _availableTabs.first;
    _loadSubmissions();
    _loadTasks();
    _loadEvents();
  }

  Future<void> _loadSubmissions() async {
    setState(() { _loadingSubmissions = true; _submissionError = null; });
    try {
      final s = await ApiService.getReportSubmissions();
      if (mounted) setState(() => _submissions = s);
    } catch (e) {
      if (mounted) setState(() => _submissionError = e.toString());
    }
    if (mounted) setState(() => _loadingSubmissions = false);
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
      final e = await ApiService.getEventsForAppraisal();
      if (mounted) setState(() => _events = e);
    } catch (e) {
      if (mounted) setState(() => _eventError = e.toString());
    }
    if (mounted) setState(() => _loadingEvents = false);
  }

  String _tabLabel(_AppraisalTab t) => switch (t) {
    _AppraisalTab.timingPoints => 'Timing Points',
    _AppraisalTab.specialTasks => 'Special Tasks',
    _AppraisalTab.events => 'Events',
    _AppraisalTab.analytics => 'Analytics',
  };

  IconData _tabIcon(_AppraisalTab t) => switch (t) {
    _AppraisalTab.timingPoints => Icons.timer_outlined,
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
    _AppraisalTab.timingPoints => _TimingPointsTab(
        submissions: _submissions, loading: _loadingSubmissions, error: _submissionError,
        onRefresh: _loadSubmissions),
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
// Personal Dashboard Tab  (ported from feature/appraisal---Lok, wired to real data)
// ─────────────────────────────────────────────────────────────────────────────
