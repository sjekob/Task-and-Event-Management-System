import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../shared/widgets/shared_widgets.dart';
import 'special_tasks_tab.dart';
import 'events_tab.dart';
import 'analytics_tab.dart';
import 'models/appraisal_models.dart';
import '../../core/api_service.dart';

enum _AppraisalTab { specialTasks, events, analytics }

class AppraisalScreen extends StatefulWidget {
  const AppraisalScreen({super.key});

  @override
  State<AppraisalScreen> createState() => _AppraisalScreenState();
}

class _AppraisalScreenState extends State<AppraisalScreen> {
  _AppraisalTab _activeTab = _AppraisalTab.specialTasks;

  // Hoisted state for real-time synchronization
  final Map<String, Map<String, dynamic>> _taskEvaluations = {};
  final Map<String, List<AttendeeRating>> _eventRatings = {};

  @override
  void initState() {
    super.initState();
    _loadBackendData();
  }

  Future<void> _loadBackendData() async {
    try {
      final taskApi = SpecialTasksApi();
      final eventApi = EventsApi();

      // 1. Fetch tasks
      final tasks = await taskApi.listTasks();
      for (final t in tasks) {
        final id = t['id'] as String;
        final status = t['status'] as String;
        if (status == 'evaluated' || status == 'flagged') {
          // Fetch evaluation details
          final details = await taskApi.getTaskDetails(id);
          final eval = details['evaluation'];
          if (eval != null) {
            _taskEvaluations[id] = <String, dynamic>{
              'ratings': <String, dynamic>{
                'completion': eval['completion_quality_score'] ?? 0,
                'quality': eval['initiative_score'] ?? 0,
                'timeliness': eval['timeliness_score'] ?? 0,
                'coordination': eval['coordination_score'] ?? 0,
              },
              'remarks': eval['remarks'] ?? '',
              'score': eval['weighted_average'] != null ? (eval['weighted_average'] * 20).round() : 0,
            };
          }
        }
      }

      // 2. Fetch events
      final events = await eventApi.listEvents();
      for (final e in events) {
        final id = e['id'] as String;
        final details = await eventApi.getEventDetails(id);
        final evals = details['evaluations'] as List<dynamic>? ?? [];
        if (evals.isNotEmpty) {
          final List<AttendeeRating> ratingsList = [];
          for (final ev in evals) {
            ratingsList.add(AttendeeRating(
              name: ev['evaluator_name'] ?? '',
              role: _parseEvaluatorRole(ev['evaluator_role']),
              scores: EventRubricScores(
                planning: (ev['planning_score'] ?? 0).toDouble(),
                objectives: (ev['objectives_score'] ?? 0).toDouble(),
                personnel: (ev['personnel_score'] ?? 0).toDouble(),
                timeMgmt: (ev['time_mgmt_score'] ?? 0).toDouble(),
                engagement: (ev['engagement_score'] ?? 0).toDouble(),
                resource: (ev['resource_score'] ?? 0).toDouble(),
              ),
              comments: ev['feedback_comments'],
              dateSubmitted: ev['date_submitted'] ?? '',
            ));
          }
          _eventRatings[id] = ratingsList;
        }
      }

      if (mounted) {
        setState(() {});
      }
    } catch (e) {
      debugPrint('Error loading backend data: $e');
    }
  }

  EvaluatorRole _parseEvaluatorRole(String? role) {
    switch (role?.toLowerCase()) {
      case 'teacher':
        return EvaluatorRole.teacher;
      case 'student':
        return EvaluatorRole.student;
      case 'coordinator':
        return EvaluatorRole.coordinator;
      case 'dean':
        return EvaluatorRole.dean;
      case 'principal':
        return EvaluatorRole.principal;
      default:
        return EvaluatorRole.student;
    }
  }

  // Build the header once and pass it into the active tab so it scrolls
  // together with the tab content. Only the sidebar stays fixed.
  Widget _buildHeader() => _PageHeader(
        activeTab: _activeTab,
        onTabChanged: (t) => setState(() => _activeTab = t),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.pageBg,
      body: Row(
        children: [
          // ── Sidebar — never scrolls ──────────────────────────────────────
          AppSidebar(activeIndex: 2, onNavTap: (_) {}),

          // ── Content area — fully scrollable ─────────────────────────────
          Expanded(child: _tabBody()),
        ],
      ),
    );
  }

  Widget _tabBody() {
    // Pass the pre-built header widget into each tab.
    // The tab places it at the top of its SingleChildScrollView so the title,
    // subtitle, breadcrumb, and tab buttons all scroll with the content.
    final header = _buildHeader();

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 180),
      layoutBuilder: (currentChild, previousChildren) => Stack(
        alignment: Alignment.topCenter,
        children: <Widget>[
          ...previousChildren,
          if (currentChild != null) currentChild,
        ],
      ),
      child: KeyedSubtree(
        key: ValueKey(_activeTab),
        child: switch (_activeTab) {
          _AppraisalTab.specialTasks => SpecialTasksTab(
              pageHeader: header,
              evaluations: _taskEvaluations,
              onSubmitEvaluation: (id, result) =>
                  setState(() => _taskEvaluations[id] = result),
            ),
          _AppraisalTab.events => EventsTab(
              pageHeader: header,
              newRatings: _eventRatings,
              onSubmitRating: (id, rating) async {
                try {
                  final api = EventsApi();
                  final payload = {
                    'evaluator_id': null,
                    'evaluator_name': rating.name,
                    'evaluator_role': rating.role.name[0].toUpperCase() + rating.role.name.substring(1),
                    'planning_score': rating.scores.planning.round(),
                    'objectives_score': rating.scores.objectives.round(),
                    'personnel_score': rating.scores.personnel.round(),
                    'time_mgmt_score': rating.scores.timeMgmt.round(),
                    'engagement_score': rating.scores.engagement.round(),
                    'resource_score': rating.scores.resource.round(),
                    'template_used': true,
                    'feedback_comments': rating.comments,
                  };
                  await api.evaluateEvent(id, payload);
                } catch (e) {
                  debugPrint('Failed to persist event evaluation to backend: $e');
                }
                setState(() => _eventRatings.putIfAbsent(id, () => []).add(rating));
              },
            ),
          _AppraisalTab.analytics => AnalyticsTab(
              pageHeader: header,
              evaluations: _taskEvaluations,
              newRatings: _eventRatings,
            ),
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page header  (breadcrumb + title + subtitle + tab pills)
// Kept here so the tab-switching callbacks stay in one place.
// ─────────────────────────────────────────────────────────────────────────────

class _PageHeader extends StatelessWidget {
  final _AppraisalTab activeTab;
  final ValueChanged<_AppraisalTab> onTabChanged;

  const _PageHeader({required this.activeTab, required this.onTabChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      color: AppColors.pageBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Breadcrumb + action buttons ──────────────────────────────────
          Row(
            children: [
              const Text('Home',
                  style: TextStyle(fontSize: 12, color: AppColors.textHint)),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 6),
                child: Icon(Icons.chevron_right, size: 14, color: AppColors.textHint),
              ),
              const Text('Appraisal',
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500)),
              const Spacer(),
              TableActionButton(label: 'Export Report', outlined: true, onTap: () {}),
              const SizedBox(width: 8),
              TableActionButton(label: 'Lock Appraisal', onTap: () {}),
            ],
          ),

          const SizedBox(height: 14),

          // ── Title + subtitle ─────────────────────────────────────────────
          const Text('Performance Appraisal', style: AppTextStyles.pageTitle),
          const SizedBox(height: 4),
          const Text(
            'Evaluate special tasks and events · Track faculty performance · View annual analytics',
            style: AppTextStyles.pageSub,
          ),

          const SizedBox(height: 16),

          // ── Pill-style tab bar ───────────────────────────────────────────
          Row(
            children: [
              _PillTab(
                icon: Icons.assignment_outlined,
                label: 'Special Tasks',
                badge: 1,
                active: activeTab == _AppraisalTab.specialTasks,
                onTap: () => onTabChanged(_AppraisalTab.specialTasks),
              ),
              const SizedBox(width: 10),
              _PillTab(
                icon: Icons.calendar_today_outlined,
                label: 'Events',
                badge: 1,
                active: activeTab == _AppraisalTab.events,
                onTap: () => onTabChanged(_AppraisalTab.events),
              ),
              const SizedBox(width: 10),
              _PillTab(
                icon: Icons.bar_chart_outlined,
                label: 'Analytics',
                badge: 0,
                active: activeTab == _AppraisalTab.analytics,
                onTap: () => onTabChanged(_AppraisalTab.analytics),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill tab button
// ─────────────────────────────────────────────────────────────────────────────

class _PillTab extends StatefulWidget {
  final IconData icon;
  final String label;
  final int badge;
  final bool active;
  final VoidCallback onTap;

  const _PillTab({
    required this.icon,
    required this.label,
    required this.badge,
    required this.active,
    required this.onTap,
  });

  @override
  State<_PillTab> createState() => _PillTabState();
}

class _PillTabState extends State<_PillTab> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: widget.active
                ? AppColors.tabActive
                : _hovered
                    ? AppColors.tableRowHover
                    : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: widget.active ? AppColors.tabActive : AppColors.cardBorder,
              width: 1,
            ),
            boxShadow: widget.active
                ? [
                    BoxShadow(
                      color: AppColors.tabActive.withOpacity(0.18),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    )
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(widget.icon,
                  size: 15,
                  color: widget.active ? Colors.white : AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(
                widget.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: widget.active ? Colors.white : AppColors.textSecondary,
                ),
              ),
              if (widget.badge > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: widget.active
                        ? const Color(0xFFEA580C)
                        : AppColors.danger,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${widget.badge}',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}