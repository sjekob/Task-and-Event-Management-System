import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import '../widgets/skeleton_widgets.dart';
import '../utils/date_parse.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];
const _monthsLong = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
const _weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

/// "May 22" this year, "May 22, 2025" otherwise.
String _fmtDate(DateTime d) {
  final base = '${_months[d.month - 1]} ${d.day}';
  return d.year == DateTime.now().year ? base : '$base, ${d.year}';
}

/// Task due label; the stored end-of-day default (11:59 PM) is not shown.
String _fmtDue(Task t) {
  final dl = t.deadline;
  if (dl == null) return 'No deadline';
  final time = (t.dueTime ?? '').trim();
  final showTime = time.isNotEmpty && time.toUpperCase() != '11:59 PM';
  return showTime ? '${_fmtDate(dl)}, $time' : _fmtDate(dl);
}

int _daysUntil(DateTime d) {
  final now = DateTime.now();
  return DateTime(d.year, d.month, d.day)
      .difference(DateTime(now.year, now.month, now.day))
      .inDays;
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardData? _data;
  bool _loading = true;
  DateTime _calDate = DateTime.now();

  // Upcoming events grouped by calendar day → dot markers + hover tooltip.
  Map<DateTime, List<Map<String, dynamic>>> _eventsByDay = {};

  static const _taskCreators = {
    'admin',
    'principal',
    'coordinator',
    'dean',
    'registrar'
  };

  @override
  void initState() {
    super.initState();
    _load();
    _loadEvents();
  }

  Future<void> _load() async {
    try {
      final d = await ApiService.getDashboard();
      if (mounted) {
        setState(() {
          _data = d;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadEvents() async {
    try {
      final events = await ApiService.getEvents();
      final map = <DateTime, List<Map<String, dynamic>>>{};
      for (final e in events) {
        final status = (e['status'] ?? '').toString();
        if (status == 'disabled' || status == 'draft') continue;
        final d = parseEventDate(e['target_date']?.toString());
        if (d == null) continue;
        final key = DateTime(d.year, d.month, d.day);
        (map[key] ??= []).add(e);
      }
      if (mounted) setState(() => _eventsByDay = map);
    } catch (_) {/* best-effort */}
  }

  Future<void> _refresh() => Future.wait([_load(), _loadEvents()]);

  List<Map<String, dynamic>> _eventsFor(int day) =>
      _eventsByDay[DateTime(_calDate.year, _calDate.month, day)] ?? const [];

  String _eventTooltip(List<Map<String, dynamic>> events) => events.map((e) {
        final when = (e['target_date'] ?? '').toString().trim();
        final where = (e['venue'] ?? '').toString().trim();
        final lines = <String>[(e['title'] ?? 'Event').toString()];
        if (when.isNotEmpty) lines.add('When: $when');
        if (where.isNotEmpty) lines.add('Where: $where');
        return lines.join('\n');
      }).join('\n\n');

  // ── Header ──────────────────────────────────────────────────────────────────

  String _greeting(User? user) {
    final h = DateTime.now().hour;
    final part = h < 12
        ? 'Good morning'
        : h < 18
            ? 'Good afternoon'
            : 'Good evening';
    // Some accounts store a role-prefixed full name ("Principal Liza Ramos")
    // and no first name; drop the title before taking the first word.
    final name = ((user?.firstName?.trim().isNotEmpty ?? false)
            ? user!.firstName!
            : user?.fullName ?? '')
        .trim()
        .replaceFirst(
            RegExp(r'^(principal|coordinator|dean|registrar|teacher|admin)\s+',
                caseSensitive: false),
            '');
    final first = name.split(RegExp(r'\s+')).first;
    return first.isEmpty ? part : '$part, $first';
  }

  /// One line on what needs attention, built from the same data as the cards.
  String _summary(bool isApprover) {
    final d = _data;
    if (d == null) return 'Here is what is happening today.';
    final parts = <String>[];
    if (isApprover) {
      if (d.eventsTotal > 0) {
        parts.add(
            '${d.eventsTotal} event ${d.eventsTotal == 1 ? 'proposal' : 'proposals'} awaiting your approval');
      }
      if (d.missing > 0) {
        parts.add(
            '${d.missing} ${d.missing == 1 ? 'assignment' : 'assignments'} past deadline on your tasks');
      }
      return parts.isEmpty
          ? 'Nothing needs your attention right now.'
          : '${parts.join(' · ')}.';
    }
    final dueSoon = d.myTasks.where((t) {
      final dl = t.deadline;
      return dl != null && !t.isOverdue && _daysUntil(dl) <= 7;
    }).length;
    if (d.missing > 0) {
      parts.add('${d.missing} overdue ${d.missing == 1 ? 'task' : 'tasks'}');
    }
    if (dueSoon > 0) parts.add('$dueSoon due this week');
    if (parts.isEmpty) {
      return d.pending > 0
          ? 'No deadlines this week — ${d.pending} ${d.pending == 1 ? 'task' : 'tasks'} still open.'
          : 'You are all caught up.';
    }
    return 'You have ${parts.join(' and ')}.';
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 768;
    final app = context.watch<AppState>();
    final role = app.userRole;
    // Mirrors the sidebar: approvers (principal/admin) have no My Tasks, and
    // only task creators have a Task Manager.
    final isApprover = role == 'principal' || role == 'admin';
    final canCreateTasks = _taskCreators.contains(role);
    if (_loading) return const DashboardSkeleton();

    final now = DateTime.now();
    final sections = <Widget>[
      if (!isApprover) _buildMyTaskSection(),
      if (canCreateTasks) _buildTaskManagerSection(),
      _buildPendingSection(isApprover),
    ];
    final main = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          sections[i],
        ],
      ],
    );
    final side = _buildCalendarCard();

    return RefreshIndicator(
      onRefresh: _refresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding:
            EdgeInsets.fromLTRB(isMobile ? 16 : 24, 8, isMobile ? 16 : 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppBanner(
              title: _greeting(app.currentUser),
              subtitle:
                  '${_weekdays[now.weekday - 1]}, ${_monthsLong[now.month - 1]} ${now.day}'
                  ' — ${_summary(isApprover)}',
            ),
            const SizedBox(height: 16),
            _buildKpis(isApprover, isMobile),
            const SizedBox(height: 16),
            width < 1100
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                        main,
                        const SizedBox(height: 16),
                        side,
                      ])
                : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: main),
                    const SizedBox(width: 16),
                    SizedBox(width: 300, child: side),
                  ]),
          ],
        ),
      ),
    );
  }

  // ── KPI tiles ───────────────────────────────────────────────────────────────

  Widget _buildKpis(bool isApprover, bool isMobile) {
    final d = _data;
    final route = isApprover ? '/tasks' : '/my-tasks';
    final tiles = [
      _KpiTile(
        value: d?.pending ?? 0,
        label: 'Pending',
        caption: isApprover
            ? 'Not yet submitted, still on time'
            : 'Open and still on time',
        icon: Icons.schedule_rounded,
        color: AppTheme.accentBlue,
        tint: AppTheme.blueBg,
        onTap: () => context.go(route),
      ),
      _KpiTile(
        value: d?.submitted ?? 0,
        label: 'Submitted',
        caption: isApprover ? 'Turned in by assignees' : 'Turned in by you',
        icon: Icons.check_circle_rounded,
        color: const Color(0xFF16A34A),
        tint: AppTheme.greenBg,
        onTap: () => context.go(route),
      ),
      _KpiTile(
        value: d?.missing ?? 0,
        label: 'Missing',
        caption: 'Past deadline, not submitted',
        icon: Icons.error_rounded,
        color: AppTheme.redColor,
        tint: AppTheme.redBg,
        alert: (d?.missing ?? 0) > 0,
        onTap: () => context.go(route),
      ),
    ];
    if (isMobile) {
      return Column(children: [
        for (var i = 0; i < tiles.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          tiles[i],
        ],
      ]);
    }
    return Row(children: [
      for (var i = 0; i < tiles.length; i++) ...[
        if (i > 0) const SizedBox(width: 16),
        Expanded(child: tiles[i]),
      ],
    ]);
  }

  // ── Sections ────────────────────────────────────────────────────────────────

  // The user's unsubmitted assigned tasks (My Tasks → Pending), soonest first.
  Widget _buildMyTaskSection() {
    final tasks = _data?.myTasks ?? [];
    return _SectionCard(
      icon: Icons.assignment_outlined,
      title: 'My tasks',
      count: tasks.length,
      actionLabel: 'View all',
      onAction: () => context.go('/my-tasks'),
      empty: tasks.isEmpty
          ? const _EmptyState(
              icon: Icons.task_alt_rounded,
              message: 'Nothing to submit — you are all caught up.')
          : null,
      rows: [
        for (final t in tasks)
          _Row(
            leading: _StatusDot(color: _dueColor(t)),
            title: t.title,
            meta:
                '${t.taskCategory == 'special' ? 'Special task' : 'Task'} · Due ${_fmtDue(t)}',
            trailing: _dueChip(t),
            onTap: () => context.go(t.taskCategory == 'special'
                ? '/my-special-tasks/${t.id}'
                : '/my-tasks/${t.id}'),
          ),
      ],
    );
  }

  Color _dueColor(Task t) {
    if (t.isOverdue) return AppTheme.redColor;
    final dl = t.deadline;
    if (dl != null && _daysUntil(dl) <= 2) return AppTheme.amberColor;
    return AppTheme.accentBlue;
  }

  Widget _dueChip(Task t) {
    final dl = t.deadline;
    if (t.isOverdue) {
      return const _Chip('Overdue', fg: Color(0xFFB91C1C), bg: AppTheme.redBg);
    }
    if (dl == null) {
      return const _Chip('No deadline',
          fg: AppTheme.textMuted, bg: Color(0xFFF1F5F9));
    }
    final days = _daysUntil(dl);
    if (days <= 0) {
      return const _Chip('Due today',
          fg: Color(0xFFB45309), bg: AppTheme.amberBg);
    }
    if (days == 1) {
      return const _Chip('Due tomorrow',
          fg: Color(0xFFB45309), bg: AppTheme.amberBg);
    }
    if (days <= 7) {
      return _Chip('In $days days',
          fg: AppTheme.accentBlue, bg: AppTheme.blueBg);
    }
    return _Chip(_fmtDate(dl),
        fg: AppTheme.textMuted, bg: const Color(0xFFF1F5F9));
  }

  // Tasks the user created (Task Manager), with submission progress.
  Widget _buildTaskManagerSection() {
    final tasks = _data?.taskManagerTasks ?? [];
    return _SectionCard(
      icon: Icons.fact_check_outlined,
      title: 'Task manager',
      count: tasks.length,
      actionLabel: 'View all',
      onAction: () => context.go('/tasks'),
      empty: tasks.isEmpty
          ? const _EmptyState(
              icon: Icons.post_add_rounded,
              message:
                  'You have no active tasks. Tasks you create appear here.')
          : null,
      rows: [
        for (final t in tasks)
          _Row(
            leading: _StatusDot(
                color: t.isOverdue ? AppTheme.redColor : AppTheme.accentBlue),
            title: t.title,
            meta:
                '${t.taskCategory == 'special' ? 'Special task' : 'Task'} · Due ${_fmtDue(t)}'
                '${(t.teamTotal ?? 0) > 0 ? ' · ${t.teamTotal} assigned' : ''}',
            trailing: (t.teamTotal ?? 0) == 0
                ? const _Chip('Not assigned',
                    fg: AppTheme.textMuted, bg: Color(0xFFF1F5F9))
                : _Progress(done: t.teamSubmitted ?? 0, total: t.teamTotal!),
            onTap: () => context.go(t.taskCategory == 'special'
                ? '/special-tasks/${t.id}'
                : '/tasks/${t.id}'),
          ),
      ],
    );
  }

  // Event proposals awaiting approval: the approval queue for approvers,
  // otherwise the user's own proposals.
  Widget _buildPendingSection(bool isApprover) {
    final events = _data?.events ?? [];
    final total = _data?.eventsTotal ?? events.length;
    return _SectionCard(
      icon: Icons.pending_actions_outlined,
      title: isApprover
          ? 'Awaiting your approval'
          : 'My pending proposals',
      count: total,
      actionLabel: 'View events',
      onAction: () => context.go('/events'),
      empty: events.isEmpty
          ? _EmptyState(
              icon: Icons.event_available_rounded,
              message: isApprover
                  ? 'No event proposals are waiting for you.'
                  : 'None of your event proposals are waiting for approval.')
          : null,
      footer: total > events.length
          ? '+${total - events.length} more in Events'
          : null,
      rows: [
        for (final e in events)
          _Row(
            leading: _DateTile(parseEventDate(e['target_date']?.toString())),
            title: (e['title'] ?? 'Untitled event').toString(),
            meta: [
              (e['nature'] ?? '').toString().trim(),
              (e['venue'] ?? '').toString().trim(),
            ].where((s) => s.isNotEmpty).join(' · '),
            trailing: const _Chip('Pending',
                fg: Color(0xFFB45309), bg: AppTheme.amberBg),
            onTap: () => context
                .go(e['id'] != null ? '/events?open=${e['id']}' : '/events'),
          ),
      ],
    );
  }

  // ── Calendar ────────────────────────────────────────────────────────────────

  Widget _buildCalendarCard() {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    final firstDay = DateTime(_calDate.year, _calDate.month, 1).weekday % 7;
    final daysInMonth = DateTime(_calDate.year, _calDate.month + 1, 0).day;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final upcoming =
        (_eventsByDay.entries.where((e) => !e.key.isBefore(today)).toList()
              ..sort((a, b) => a.key.compareTo(b.key)))
            .expand((e) => e.value.map((ev) => MapEntry(e.key, ev)))
            .take(3)
            .toList();

    return _Card(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Text('${_monthsLong[_calDate.month - 1]} ${_calDate.year}',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary)),
          ),
          _IconBtn(
              icon: Icons.chevron_left_rounded,
              tooltip: 'Previous month',
              onTap: () => setState(() =>
                  _calDate = DateTime(_calDate.year, _calDate.month - 1))),
          _IconBtn(
              icon: Icons.chevron_right_rounded,
              tooltip: 'Next month',
              onTap: () => setState(() =>
                  _calDate = DateTime(_calDate.year, _calDate.month + 1))),
        ]),
        const SizedBox(height: 10),
        Row(
            children: days
                .map((d) => Expanded(
                    child: Center(
                        child: Text(d,
                            style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textLight)))))
                .toList()),
        const SizedBox(height: 4),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7, childAspectRatio: 1),
          itemCount: firstDay + daysInMonth,
          itemBuilder: (_, i) {
            if (i < firstDay) return const SizedBox();
            final day = i - firstDay + 1;
            final date = DateTime(_calDate.year, _calDate.month, day);
            final isToday = date == today;
            final hasDeadline = _data?.deadlineDates.contains(date) ?? false;
            final events = _eventsFor(day);
            Widget cell = Container(
              margin: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: isToday ? AppTheme.darkBanner : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('$day',
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight:
                                isToday ? FontWeight.w700 : FontWeight.w500,
                            color:
                                isToday ? Colors.white : AppTheme.textPrimary)),
                    const SizedBox(height: 3),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      if (events.isNotEmpty) const _Dot(AppTheme.accentBlue),
                      if (events.isNotEmpty && hasDeadline)
                        const SizedBox(width: 3),
                      if (hasDeadline) const _Dot(AppTheme.amberColor),
                      if (events.isEmpty && !hasDeadline)
                        const SizedBox(height: 5),
                    ]),
                  ]),
            );
            if (events.isNotEmpty) {
              cell = Tooltip(
                message: _eventTooltip(events),
                waitDuration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                    color: AppTheme.darkBanner,
                    borderRadius: BorderRadius.circular(8)),
                textStyle: const TextStyle(
                    color: Colors.white, fontSize: 11.5, height: 1.4),
                child: cell,
              );
            }
            return cell;
          },
        ),
        const SizedBox(height: 8),
        Row(children: [
          const _Dot(AppTheme.accentBlue),
          const SizedBox(width: 6),
          Text('Event', style: AppTheme.caption),
          const SizedBox(width: 16),
          const _Dot(AppTheme.amberColor),
          const SizedBox(width: 6),
          Text('Task deadline', style: AppTheme.caption),
        ]),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Divider(height: 1, color: AppTheme.borderColor),
        ),
        Text('Upcoming events',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary)),
        const SizedBox(height: 10),
        if (upcoming.isEmpty)
          Text('No upcoming events', style: AppTheme.bodySm)
        else
          for (final u in upcoming)
            InkWell(
                onTap: () => context.go(u.value['id'] != null
                    ? '/events?open=${u.value['id']}'
                    : '/events'),
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(children: [
                    _DateTile(u.key, compact: true),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text((u.value['title'] ?? 'Event').toString(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.textPrimary)),
                          if ((u.value['venue'] ?? '')
                              .toString()
                              .trim()
                              .isNotEmpty)
                            Text(u.value['venue'].toString(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTheme.caption),
                        ])),
                  ]),
                )),
      ]),
    );
  }
}

// ── Building blocks ───────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const _Card({required this.child, this.padding = const EdgeInsets.all(18)});

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE3E9F3)),
          boxShadow: [
            BoxShadow(
                color: const Color(0xFF1A1A2E).withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2))
          ],
        ),
        child: child,
      );
}

class _KpiTile extends StatelessWidget {
  final int value;
  final String label;
  final String caption;
  final IconData icon;
  final Color color;
  final Color tint;
  final bool alert;
  final VoidCallback onTap;
  const _KpiTile(
      {required this.value,
      required this.label,
      required this.caption,
      required this.icon,
      required this.color,
      required this.tint,
      this.alert = false,
      required this.onTap});

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: _Card(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            child: Row(children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                    color: tint, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text('$value',
                              style: GoogleFonts.plusJakartaSans(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  height: 1.1,
                                  color: alert ? color : AppTheme.textPrimary)),
                          const SizedBox(width: 8),
                          Flexible(
                              child: Text(label,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.plusJakartaSans(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.textPrimary))),
                        ]),
                    const SizedBox(height: 2),
                    Text(caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.caption),
                  ])),
              const Icon(Icons.chevron_right_rounded,
                  color: AppTheme.textLight, size: 20),
            ]),
          ),
        ),
      );
}

class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final int count;
  final String actionLabel;
  final VoidCallback onAction;
  final List<Widget> rows;
  final Widget? empty;
  final String? footer;
  const _SectionCard(
      {required this.icon,
      required this.title,
      required this.count,
      required this.actionLabel,
      required this.onAction,
      required this.rows,
      this.empty,
      this.footer});

  @override
  Widget build(BuildContext context) => _Card(
        padding: EdgeInsets.zero,
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 10, 12),
            child: Row(children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FA),
                    borderRadius: BorderRadius.circular(9)),
                child: Icon(icon, size: 18, color: AppTheme.darkBanner),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Row(children: [
                  Flexible(
                      child: Text(title,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary))),
                  if (count > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FA),
                          borderRadius: BorderRadius.circular(20)),
                      child: Text('$count',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textMuted)),
                    ),
                  ],
                ]),
              ),
              TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.accentBlue,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  textStyle: GoogleFonts.plusJakartaSans(
                      fontSize: 13, fontWeight: FontWeight.w600),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(actionLabel),
                  const SizedBox(width: 2),
                  const Icon(Icons.arrow_forward_rounded, size: 16),
                ]),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppTheme.borderColor),
          if (empty != null)
            empty!
          else
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0)
                const Divider(
                    height: 1,
                    indent: 18,
                    endIndent: 18,
                    color: Color(0xFFF0F2F6)),
              rows[i],
            ],
          if (footer != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 14),
              child: Text(footer!, style: AppTheme.caption),
            ),
          if (empty == null && footer == null) const SizedBox(height: 4),
        ]),
      );
}

class _Row extends StatelessWidget {
  final Widget leading;
  final String title;
  final String meta;
  final Widget trailing;
  final VoidCallback onTap;
  const _Row(
      {required this.leading,
      required this.title,
      required this.meta,
      required this.trailing,
      required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        hoverColor: const Color(0xFFF6F8FC),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Row(children: [
            leading,
            const SizedBox(width: 14),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary)),
                  if (meta.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(meta,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.caption),
                  ],
                ])),
            const SizedBox(width: 12),
            trailing,
          ]),
        ),
      );
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  const _EmptyState({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
        child: Row(children: [
          Icon(icon, size: 20, color: AppTheme.textLight),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: AppTheme.bodyMd)),
        ]),
      );
}

class _Chip extends StatelessWidget {
  final String text;
  final Color fg;
  final Color bg;
  const _Chip(this.text, {required this.fg, required this.bg});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        child: Text(text,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
      );
}

class _Progress extends StatelessWidget {
  final int done;
  final int total;
  const _Progress({required this.done, required this.total});

  @override
  Widget build(BuildContext context) {
    final complete = done >= total;
    return SizedBox(
      width: 120,
      child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Text('$done/$total submitted',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color:
                    complete ? const Color(0xFF16A34A) : AppTheme.textMuted)),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : done / total,
            minHeight: 6,
            backgroundColor: const Color(0xFFEEF2FA),
            color: complete ? AppTheme.greenColor : AppTheme.accentBlue,
          ),
        ),
      ]),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final Color color;
  const _StatusDot({required this.color});

  @override
  Widget build(BuildContext context) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
                color: color.withValues(alpha: 0.25),
                blurRadius: 0,
                spreadRadius: 3)
          ],
        ),
      );
}

class _Dot extends StatelessWidget {
  final Color color;
  const _Dot(this.color);

  @override
  Widget build(BuildContext context) => Container(
        width: 5,
        height: 5,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

/// Month/day tile for an event date ("OCT / 2"); a calendar icon if unknown.
class _DateTile extends StatelessWidget {
  final DateTime? date;
  final bool compact;
  const _DateTile(this.date, {this.compact = false});

  @override
  Widget build(BuildContext context) {
    final size = compact ? 38.0 : 44.0;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFEEF2FA),
        borderRadius: BorderRadius.circular(10),
      ),
      child: date == null
          ? const Icon(Icons.event_rounded, size: 18, color: AppTheme.textMuted)
          : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(_months[date!.month - 1].toUpperCase(),
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: compact ? 9 : 10,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.accentBlue,
                      letterSpacing: 0.4,
                      height: 1.1)),
              Text('${date!.day}',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: compact ? 14 : 16,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                      height: 1.15)),
            ]),
    );
  }
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  const _IconBtn(
      {required this.icon, required this.tooltip, required this.onTap});

  @override
  Widget build(BuildContext context) => IconButton(
        onPressed: onTap,
        tooltip: tooltip,
        icon: Icon(icon, size: 20, color: AppTheme.textMuted),
        visualDensity: VisualDensity.compact,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      );
}
