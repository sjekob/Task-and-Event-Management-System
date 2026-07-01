import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../shared/widgets/shared_widgets.dart';
import 'special_tasks_tab.dart';
import 'events_tab.dart';
import 'analytics_tab.dart';
import 'personal_dashboard_tab.dart';
import 'timing_points_tab.dart';
import 'models/appraisal_models.dart';
import 'models/notification_model.dart';
import '../../core/api_service.dart';
import 'notifications_screen.dart';

enum _AppraisalTab { timingPoints, specialTasks, events, analytics, personalDashboard }

class AppraisalScreen extends StatefulWidget {
  final String? username;
  final String? role;

  const AppraisalScreen({super.key, this.username, this.role});

  @override
  State<AppraisalScreen> createState() => _AppraisalScreenState();
}

class _AppraisalScreenState extends State<AppraisalScreen> {
  int _activeSidebarIndex = 0; // Default to Dashboard navbar item (index 0)
  late _AppraisalTab _activeTab;
  late List<_AppraisalTab> _availableTabs;

  // Hoisted state — always reassigned to a NEW map so child widgets
  // detect the reference change in didUpdateWidget and rebuild.
  var _taskEvaluations = <String, Map<String, dynamic>>{};
  var _eventRatings = <String, List<AttendeeRating>>{};
  List<SchoolEvent> _backendEvents = [];
  bool _eventsLoading = false;

  bool _matchesName(String nameA, String nameB) {
    String clean(String s) {
      return s.toLowerCase()
          .replaceAll(RegExp(r'\b(dr|prof|dean|coord|principal|teacher|mr|ms|mrs)\b\.?'), '')
          .replaceAll(RegExp(r'[^\w\s]'), ' ')
          .trim();
    }
    
    final a = clean(nameA);
    final b = clean(nameB);
    
    if (a.isEmpty || b.isEmpty) return false;
    if (a == b) return true;
    
    final partsA = a.split(RegExp(r'\s+'));
    final partsB = b.split(RegExp(r'\s+'));
    
    for (final pA in partsA) {
      if (pA.length > 2 && partsB.contains(pA)) return true;
    }
    return false;
  }

  int get _pendingTasksCount {
    final activeRole = (widget.role ?? 'coordinator').toLowerCase();
    
    // Choose which tasks to evaluate/check based on role
    final List<SpecialTask> roleTasks;
    if (activeRole == 'teacher') {
      roleTasks = sampleTasks.where((t) => _matchesName(t.personnel, widget.username ?? '')).toList();
    } else if (activeRole == 'dean') {
      roleTasks = sampleTasks.where((t) => _matchesName(t.personnel, widget.username ?? '')).toList();
    } else {
      // coordinator & principal see all tasks
      roleTasks = sampleTasks;
    }

    int pendingCount = 0;
    for (final t in roleTasks) {
      final hasEval = _taskEvaluations.containsKey(t.id);
      if (hasEval) continue;
      if (t.status == TaskStatus.pending) {
        pendingCount++;
      }
    }
    return pendingCount;
  }

  int get _pendingEventsCount {
    final events = _backendEvents.isNotEmpty ? _backendEvents : sampleEvents;
    final enriched = events.map((e) {
      final extra = _eventRatings[e.id] ?? [];
      if (extra.isEmpty) return e;
      final newRatings = [...e.ratings, ...extra];
      double? avg;
      if (newRatings.isNotEmpty) {
        avg = newRatings.map((r) => r.overallScore).reduce((a, b) => a + b) / newRatings.length;
      }
      final newStatus = (avg != null && avg < 3.0) ? EventStatus.flagged : EventStatus.rated;
      return SchoolEvent(
        id: e.id, name: e.name, date: e.date,
        organizer: e.organizer, department: e.department,
        attendees: e.attendees, ratings: newRatings,
        status: newStatus,
        approvalStatus: e.approvalStatus,
        revisionComment: e.revisionComment,
        assignedPersonnel: e.assignedPersonnel,
      );
    }).toList();
    return enriched.where((e) => e.status == EventStatus.awaitingRatings).length;
  }

  @override
  void initState() {
    super.initState();
    _initializeTabs();
    _loadBackendData();
  }

  void _initializeTabs() {
    final role = widget.role ?? 'coordinator';
    if (role == 'teacher') {
      _availableTabs = [_AppraisalTab.timingPoints, _AppraisalTab.specialTasks, _AppraisalTab.events, _AppraisalTab.analytics];
    } else if (role == 'dean') {
      _availableTabs = [_AppraisalTab.timingPoints, _AppraisalTab.specialTasks, _AppraisalTab.events, _AppraisalTab.analytics];
    } else if (role == 'principal' || role == 'registrar') {
      _availableTabs = [_AppraisalTab.analytics, _AppraisalTab.timingPoints, _AppraisalTab.specialTasks, _AppraisalTab.events];
    } else {
      // coordinator
      _availableTabs = [_AppraisalTab.timingPoints, _AppraisalTab.specialTasks, _AppraisalTab.events, _AppraisalTab.analytics];
    }
    _activeTab = _availableTabs.first;
  }

  Future<void> _loadBackendData() async {
    if (_eventsLoading) return;
    _eventsLoading = true;
    try {
      final taskApi = SpecialTasksApi();
      final eventApi = EventsApi();

      // Build fresh local maps — assign atomically so reference always changes
      final newTaskEvals = <String, Map<String, dynamic>>{};
      final newEventRatings = <String, List<AttendeeRating>>{};
      final newBackendEvents = <SchoolEvent>[];

      // 1. Fetch tasks
      final tasks = await taskApi.listTasks();
      for (final t in tasks) {
        final id = t['id'] as String;
        final status = t['status'] as String;
        if (status == 'evaluated' || status == 'flagged') {
          final details = await taskApi.getTaskDetails(id);
          final eval = details['evaluation'];
          if (eval != null) {
            newTaskEvals[id] = <String, dynamic>{
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

      // 2. Fetch events from backend
      final events = await eventApi.listEvents();
      for (final e in events) {
        final id = e['id'] as String;
        final details = await eventApi.getEventDetails(id);
        final evals = details['evaluations'] as List<dynamic>? ?? [];
        final ratings = evals.map((ev) => AttendeeRating(
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
        )).toList();

        if (ratings.isNotEmpty) {
          newEventRatings[id] = ratings;
        }
        newBackendEvents.add(SchoolEvent.fromJson(e, ratings: ratings));
      }

      if (mounted) {
        setState(() {
          _taskEvaluations = newTaskEvals;
          _eventRatings = newEventRatings;
          _backendEvents = newBackendEvents;
        });
      }
    } catch (e) {
      debugPrint('Error loading backend data: $e');
    } finally {
      _eventsLoading = false;
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
      case 'registrar':
        return EvaluatorRole.registrar;
      case 'parent':
        return EvaluatorRole.parent;
      case 'other':
      case 'others':
        return EvaluatorRole.other;
      default:
        return EvaluatorRole.student;
    }
  }

  // Build the header once and pass it into the active tab so it scrolls
  // together with the tab content. Only the sidebar stays fixed.
  Widget _buildHeader() => _PageHeader(
        activeTab: _activeTab,
        availableTabs: _availableTabs,
        onTabChanged: (t) {
          setState(() => _activeTab = t);
          _loadBackendData();
        },
        pendingTasksCount: _pendingTasksCount,
        pendingEventsCount: _pendingEventsCount,
        onNotificationTap: () {
          setState(() {
            _activeSidebarIndex = 5;
          });
        },
      );

  @override
  Widget build(BuildContext context) {
    final double screenWidth = MediaQuery.of(context).size.width;
    final bool isMobile = screenWidth < 640;

    final sidebar = AppSidebar(
      activeIndex: _activeSidebarIndex, 
      onNavTap: (index) {
        setState(() {
          _activeSidebarIndex = index;
        });
        if (isMobile && Navigator.canPop(context)) {
          Navigator.pop(context); // Close the drawer on menu selection
        }
      },
      username: widget.username ?? 'Guest User',
      role: widget.role ?? 'coordinator',
    );

    return Scaffold(
      backgroundColor: AppColors.pageBg,
      appBar: isMobile
          ? AppBar(
              title: const Text(
                'TaskNet',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              backgroundColor: AppColors.sidebarBg,
              foregroundColor: Colors.white,
              elevation: 0,
            )
          : null,
      drawer: isMobile ? Drawer(child: sidebar) : null,
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Sidebar — never scrolls (hidden on mobile, drawer is used instead) ──
          if (!isMobile) sidebar,

          // ── Content area — fully scrollable ─────────────────────────────
          Expanded(child: _mainBodyContent()),
        ],
      ),
    );
  }

  Widget _mainBodyContent() {
    switch (_activeSidebarIndex) {
      case 0:
        return PersonalDashboardTab(
          pageHeader: const SizedBox.shrink(),
          username: widget.username ?? '',
          role: widget.role ?? 'teacher',
          evaluations: _taskEvaluations,
          newRatings: _eventRatings,
        );
      case 2:
        return _tabBody();
      case 1:
        return _buildPlaceholderScreen('Task');
      case 3:
        return _buildPlaceholderScreen('Activity Calendar');
      case 4:
        return _buildPlaceholderScreen('Personnel');
      case 5:
        return NotificationsScreen(
          username: widget.username ?? '',
          role: widget.role ?? 'teacher',
        );
      case 6:
        return _buildPlaceholderScreen('Settings');
      default:
        return _buildPlaceholderScreen('Main Menu');
    }
  }

  Widget _buildPlaceholderScreen(String title) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 12,
                ),
              ],
            ),
            child: const Icon(
              Icons.construction_outlined,
              color: Color(0xFF8B5CF6),
              size: 48,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            '$title Module',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'We are actively preparing this space. Check back soon!',
            style: TextStyle(
              fontSize: 13,
              color: Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabBody() {
    // Pass the pre-built header widget into each tab.
    // The tab places it at the top of its SingleChildScrollView so the title,
    // subtitle, breadcrumb, and tab buttons all scroll with the content.
    final header = _buildHeader();

    return Align(
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
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
          _AppraisalTab.timingPoints => TimingPointsTab(
              pageHeader: header,
              username: widget.username ?? '',
              role: widget.role ?? 'teacher',
            ),
          _AppraisalTab.personalDashboard => PersonalDashboardTab(
              pageHeader: header,
              username: widget.username ?? '',
              role: widget.role ?? 'teacher',
              evaluations: _taskEvaluations,
              newRatings: _eventRatings,
            ),
          _AppraisalTab.specialTasks => SpecialTasksTab(
              pageHeader: header,
              role: widget.role ?? 'dean',
              evaluations: _taskEvaluations,
              onSubmitEvaluation: (id, result) {
                setState(() {
                  // Create a NEW map so reference changes, triggering didUpdateWidget
                  _taskEvaluations = {..._taskEvaluations, id: result};
                });
                NotificationStore().pushLocal(
                  title: 'Special Task Evaluated',
                  message: 'A special task evaluation was submitted successfully.',
                  type: NotificationType.evaluationSubmitted,
                  relatedId: id,
                );
              },
            ),
          _AppraisalTab.events => EventsTab(
              pageHeader: header,
              username: widget.username ?? '',
              role: widget.role ?? 'teacher',
              newRatings: _eventRatings,
              backendEvents: _backendEvents,
              onRefresh: _loadBackendData,
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
                  
                  NotificationStore().pushLocal(
                    title: 'Event Evaluation Submitted',
                    message: 'Your evaluation for this event has been successfully submitted.',
                    type: NotificationType.evaluationSubmitted,
                    relatedId: id,
                  );
                } catch (e) {
                  debugPrint('Failed to persist event evaluation to backend: $e');
                }
                // Create a NEW map so reference changes, triggering didUpdateWidget
                setState(() {
                  final updated = List<AttendeeRating>.from(_eventRatings[id] ?? [])..add(rating);
                  _eventRatings = {..._eventRatings, id: updated};
                });
                // Refresh backend events to reflect any status changes
                await _loadBackendData();
              },
            ),
          _AppraisalTab.analytics => AnalyticsTab(
              pageHeader: header,
              role: widget.role ?? 'principal',
              username: widget.username ?? '',
              evaluations: _taskEvaluations,
              newRatings: _eventRatings,
            ),
        },
      ),
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
  final List<_AppraisalTab> availableTabs;
  final ValueChanged<_AppraisalTab> onTabChanged;
  final int pendingTasksCount;
  final int pendingEventsCount;
  final VoidCallback onNotificationTap;

  const _PageHeader({
    required this.activeTab,
    required this.availableTabs,
    required this.onTabChanged,
    required this.pendingTasksCount,
    required this.pendingEventsCount,
    required this.onNotificationTap,
  });

  String _getTabLabel(_AppraisalTab tab) {
    switch (tab) {
      case _AppraisalTab.timingPoints:
        return 'Timing Points';
      case _AppraisalTab.personalDashboard:
        return 'Dashboard';
      case _AppraisalTab.specialTasks:
        return 'Special Tasks';
      case _AppraisalTab.events:
        return 'Events';
      case _AppraisalTab.analytics:
        return 'Analytics';
    }
  }

  IconData _getTabIcon(_AppraisalTab tab) {
    switch (tab) {
      case _AppraisalTab.timingPoints:
        return Icons.timer_outlined;
      case _AppraisalTab.personalDashboard:
        return Icons.person_outline;
      case _AppraisalTab.specialTasks:
        return Icons.assignment_outlined;
      case _AppraisalTab.events:
        return Icons.calendar_today_outlined;
      case _AppraisalTab.analytics:
        return Icons.bar_chart_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 10, 24, 16),
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
              NotificationBellButton(onTap: onNotificationTap),
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
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: availableTabs.map((tab) {
                return Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: _PillTab(
                    icon: _getTabIcon(tab),
                    label: _getTabLabel(tab),
                    badge: tab == _AppraisalTab.specialTasks
                        ? pendingTasksCount
                        : (tab == _AppraisalTab.events ? pendingEventsCount : 0),
                    active: activeTab == tab,
                    onTap: () => onTabChanged(tab),
                  ),
                );
              }).toList(),
            ),
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