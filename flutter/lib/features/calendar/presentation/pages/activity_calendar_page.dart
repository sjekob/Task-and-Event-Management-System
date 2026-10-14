import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/api_service.dart';
import '../../../../core/utils/responsive.dart';
import '../../../dashboard/presentation/widgets/sidebar_widget.dart';
import '../../../../core/router/app_router.dart';

// ─── Data Models ──────────────────────────────────────────
enum EventStatus { upcoming, pendingApproval, createdByMe, disabled }

class CalendarEvent {
  final int?        id;
  final String      title;
  final String      description;
  final EventStatus status;
  final DateTime    date;
  final bool        isDisabled;

  const CalendarEvent({
    this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.date,
    this.isDisabled = false,
  });

  CalendarEvent copyWith({bool? isDisabled, EventStatus? status}) {
    return CalendarEvent(
      id: id,
      title: title,
      description: description,
      status: status ?? this.status,
      date: date,
      isDisabled: isDisabled ?? this.isDisabled,
    );
  }
}

DateTime _parseDate(String? raw) {
  if (raw == null || raw.isEmpty) return DateTime.now();
  final iso = DateTime.tryParse(raw);
  if (iso != null) return iso;
  return DateTime.now();
}

// ─── Page ─────────────────────────────────────────────────
class ActivityCalendarPage extends StatefulWidget {
  const ActivityCalendarPage({super.key});

  @override
  State<ActivityCalendarPage> createState() =>
      _ActivityCalendarPageState();
}

class _ActivityCalendarPageState
    extends State<ActivityCalendarPage> {
  int       _selectedTab = 0;
  DateTime  _focusedDay  = DateTime.now();
  DateTime? _selectedDay;
  bool      _isLoading   = true;
  List<CalendarEvent> _events = [];

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    try {
      final data = await ApiService.getEvents();
      setState(() {
        _events = data.map((e) => CalendarEvent(
          id: e['id'],
          title: e['title'] ?? '',
          description: e['rationale'] ?? e['title'] ?? '',
          status: _mapStatus(e['status']),
          date: _parseDate(e['target_date']),
          isDisabled: e['status'] == 'disabled',
        )).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  EventStatus _mapStatus(String? status) {
    switch (status) {
      case 'upcoming':      return EventStatus.upcoming;
      case 'created_by_me': return EventStatus.createdByMe;
      case 'disabled':      return EventStatus.upcoming;
      default:              return EventStatus.pendingApproval;
    }
  }

  List<CalendarEvent> get _activeEvents =>
      _events.where((e) => !e.isDisabled).toList();

  List<CalendarEvent> get _disabledEvents =>
      _events.where((e) => e.isDisabled).toList();

  List<CalendarEvent> get _filteredEvents {
    if (_selectedTab == 1) {
      return _activeEvents
          .where((e) => e.status == EventStatus.createdByMe)
          .toList();
    }
    return _activeEvents;
  }

  List<CalendarEvent> _eventsForSection(EventStatus status) =>
      _filteredEvents.where((e) => e.status == status).toList();

  Set<DateTime> get _eventDays => _events
      .where((e) => !e.isDisabled)
      .map((e) =>
          DateTime(e.date.year, e.date.month, e.date.day))
      .toSet();

  Future<void> _disableEvent(CalendarEvent event) async {
    if (event.id != null) {
      await ApiService.disableEvent(event.id!);
    }
    final idx = _events.indexOf(event);
    if (idx != -1) {
      setState(
          () => _events[idx] = event.copyWith(isDisabled: true));
    }
  }

  Future<void> _enableEvent(CalendarEvent event) async {
    if (event.id != null) {
      await ApiService.enableEvent(event.id!);
    }
    final idx = _events.indexOf(event);
    if (idx != -1) {
      setState(
          () => _events[idx] = event.copyWith(isDisabled: false));
    }
  }

  Future<void> _confirmDisable(
      BuildContext context, CalendarEvent event) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => const _ConfirmDisableDialog(),
    );
    if (confirmed == true) _disableEvent(event);
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);

    return Scaffold(
      backgroundColor: AppTheme.primaryLight,
      drawer: isMobile ? const AppDrawer() : null,
      bottomNavigationBar:
          isMobile ? const AppBottomNav() : null,
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SidebarWidget(),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header ──────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      24, 20, 24, 0),
                  child: Row(
                    mainAxisAlignment:
                        MainAxisAlignment.spaceBetween,
                    children: [
                      Row(children: [
                        if (isMobile)
                          Builder(
                            builder: (ctx) => IconButton(
                              icon: const Icon(Icons.menu,
                                  color: Color(0xFF1A1A2E)),
                              onPressed: () =>
                                  Scaffold.of(ctx).openDrawer(),
                            ),
                          ),
                        Text('Coordinator',
                            style: TextStyle(
                                fontSize: isMobile ? 20 : 26,
                                fontWeight: FontWeight.w700,
                                color:
                                    const Color(0xFF1A1A2E))),
                      ]),
                      Row(children: [
                        SizedBox(
                          width: isMobile ? 110 : 130,
                          height: 42,
                          child: ElevatedButton(
                            onPressed: () =>
                                context.go(AppRoutes.addEvent),
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  const Color(0xFF1E2126),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(8)),
                              elevation: 0,
                            ),
                            child: Text(
                                isMobile
                                    ? 'Add Event'
                                    : 'Add Event',
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight:
                                        FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppTheme.primaryMid,
                              border: Border.all(
                                  color: Colors.white,
                                  width: 2)),
                          child: const Icon(Icons.person,
                              color: Colors.white, size: 24),
                        ),
                      ]),
                    ],
                  ),
                ),

                // ── Scrollable body ──────────────────────
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                              color: Color(0xFF1E2126)))
                      : SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(
                              24, 16, 24, 24),
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              const _EventCalendarBanner(),
                              const SizedBox(height: 20),

                              // ── Main content + side calendar
                              if (isMobile)
                                _buildEventList(context)
                              else
                                Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                        child: _buildEventList(
                                            context)),
                                    const SizedBox(width: 20),
                                    SizedBox(
                                      width: 290,
                                      child: _SideCalendar(
                                        focusedDay: _focusedDay,
                                        selectedDay: _selectedDay,
                                        eventDays: _eventDays,
                                        onDaySelected:
                                            (sel, foc) =>
                                                setState(() {
                                          _selectedDay = sel;
                                          _focusedDay = foc;
                                        }),
                                        onPageChanged: (foc) =>
                                            setState(() =>
                                                _focusedDay =
                                                    foc),
                                      ),
                                    ),
                                  ],
                                ),

                              // Calendar at bottom on mobile
                              if (isMobile) ...[
                                const SizedBox(height: 20),
                                _sectionLabel('Calendar'),
                                const SizedBox(height: 10),
                                _SideCalendar(
                                  focusedDay: _focusedDay,
                                  selectedDay: _selectedDay,
                                  eventDays: _eventDays,
                                  onDaySelected: (sel, foc) =>
                                      setState(() {
                                    _selectedDay = sel;
                                    _focusedDay = foc;
                                  }),
                                  onPageChanged: (foc) =>
                                      setState(() =>
                                          _focusedDay = foc),
                                ),
                              ],
                            ],
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

  Widget _buildEventList(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _TabSwitcher(
          selected: _selectedTab,
          onChanged: (v) => setState(() => _selectedTab = v),
        ),
        const SizedBox(height: 20),

        if (_events.isEmpty)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12)),
            child: const Center(
              child: Text(
                'No events yet. Click "Add Event" to create one.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 14, color: Color(0xFF718096)),
              ),
            ),
          ),

        if (_eventsForSection(EventStatus.upcoming)
            .isNotEmpty) ...[
          _sectionLabel('Upcoming Activities'),
          const SizedBox(height: 10),
          ..._eventsForSection(EventStatus.upcoming)
              .map((e) => _EventCard(
                    event: e,
                    onEdit: () {},
                    onDisable: () =>
                        _confirmDisable(context, e),
                  )),
          const SizedBox(height: 20),
        ],

        if (_eventsForSection(EventStatus.pendingApproval)
            .isNotEmpty) ...[
          _sectionLabel('Pending Approval'),
          const SizedBox(height: 10),
          ..._eventsForSection(EventStatus.pendingApproval)
              .map((e) => _EventCard(
                    event: e,
                    onEdit: () {},
                    onDisable: () =>
                        _confirmDisable(context, e),
                  )),
          const SizedBox(height: 20),
        ],

        if (_eventsForSection(EventStatus.createdByMe)
            .isNotEmpty) ...[
          _sectionLabel('Events Created by Me'),
          const SizedBox(height: 10),
          ..._eventsForSection(EventStatus.createdByMe)
              .map((e) => _EventCard(
                    event: e,
                    onEdit: () {},
                    onDisable: () =>
                        _confirmDisable(context, e),
                  )),
          const SizedBox(height: 20),
        ],

        if (_disabledEvents.isNotEmpty) ...[
          _sectionLabel('Disabled Events'),
          const SizedBox(height: 10),
          ..._disabledEvents.map((e) => _DisabledEventCard(
                event: e,
                onEnable: () => _enableEvent(e),
              )),
        ],
      ],
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child: Text(text,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF718096))),
      );
}

// ─── Banner ───────────────────────────────────────────────
class _EventCalendarBanner extends StatelessWidget {
  const _EventCalendarBanner();

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    return Container(
      width: double.infinity,
      height: isMobile ? 110 : 148,
      decoration: BoxDecoration(
        color: const Color(0xFF1E2126),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child:
                  CustomPaint(painter: _CubePatternPainter()),
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(
                horizontal: isMobile ? 16 : 28,
                vertical: isMobile ? 16 : 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Event Calendar',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: isMobile ? 22 : 32,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3)),
                const SizedBox(height: 6),
                Text(
                  'Great things are on the horizon — stay active, stay organized!',
                  style: TextStyle(
                      color: Colors.white
                          .withValues(alpha: 0.6),
                      fontSize: isMobile ? 11 : 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Cube pattern painter ─────────────────────────────────
class _CubePatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final topPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.07)
      ..style = PaintingStyle.fill;
    final leftPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..style = PaintingStyle.fill;
    final rightPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.02)
      ..style = PaintingStyle.fill;
    final strokePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.5;
    const double w = 40.0;
    const double h = 22.0;
    for (double row = -1; row < size.height / h + 2; row++) {
      for (double col = -1;
          col < size.width / w + 2;
          col++) {
        final double ox =
            col * w + (row % 2 == 0 ? 0 : w / 2);
        final double oy = row * h * 0.75;
        _drawCube(canvas, Offset(ox, oy), w, h, topPaint,
            leftPaint, rightPaint, strokePaint);
      }
    }
  }

  void _drawCube(Canvas canvas, Offset o, double w,
      double h, Paint top, Paint left, Paint right,
      Paint stroke) {
    final cx = o.dx + w / 2;
    final cy = o.dy;
    final topPath = Path()
      ..moveTo(cx, cy)
      ..lineTo(cx + w / 2, cy + h / 2)
      ..lineTo(cx, cy + h)
      ..lineTo(cx - w / 2, cy + h / 2)
      ..close();
    canvas.drawPath(topPath, top);
    canvas.drawPath(topPath, stroke);
    final leftPath = Path()
      ..moveTo(cx - w / 2, cy + h / 2)
      ..lineTo(cx, cy + h)
      ..lineTo(cx, cy + h * 1.6)
      ..lineTo(cx - w / 2, cy + h * 1.1)
      ..close();
    canvas.drawPath(leftPath, left);
    canvas.drawPath(leftPath, stroke);
    final rightPath = Path()
      ..moveTo(cx + w / 2, cy + h / 2)
      ..lineTo(cx, cy + h)
      ..lineTo(cx, cy + h * 1.6)
      ..lineTo(cx + w / 2, cy + h * 1.1)
      ..close();
    canvas.drawPath(rightPath, right);
    canvas.drawPath(rightPath, stroke);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) =>
      false;
}

// ─── Tab Switcher ─────────────────────────────────────────
class _TabSwitcher extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onChanged;

  const _TabSwitcher(
      {required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _Tab(
            label: 'All Events',
            active: selected == 0,
            onTap: () => onChanged(0)),
        const SizedBox(width: 8),
        _Tab(
            label: 'My Events',
            active: selected == 1,
            onTap: () => onChanged(1)),
      ],
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _Tab(
      {required this.label,
      required this.active,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(
            horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: active
              ? const Color(0xFF1E2126)
              : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: active
                  ? const Color(0xFF1E2126)
                  : const Color(0xFFDDE3ED)),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: active
                    ? Colors.white
                    : const Color(0xFF4A5568))),
      ),
    );
  }
}

// ─── Event Card ───────────────────────────────────────────
class _EventCard extends StatelessWidget {
  final CalendarEvent event;
  final VoidCallback  onEdit;
  final VoidCallback  onDisable;

  const _EventCard({
    required this.event,
    required this.onEdit,
    required this.onDisable,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(
          horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.title,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1A1A2E))),
                const SizedBox(height: 3),
                Text(event.description,
                    style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF718096)),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert,
                size: 20, color: Color(0xFF718096)),
            offset: const Offset(0, 30),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8)),
            padding: EdgeInsets.zero,
            onSelected: (value) {
              if (value == 'edit') onEdit();
              if (value == 'disable') onDisable();
            },
            itemBuilder: (_) => [
              const PopupMenuItem<String>(
                value: 'edit',
                height: 40,
                child: Text('Edit',
                    style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF1A1A2E))),
              ),
              PopupMenuItem<String>(
                value: 'disable',
                height: 40,
                padding: EdgeInsets.zero,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  decoration: const BoxDecoration(
                      color: Color(0xFFE53E3E),
                      borderRadius: BorderRadius.vertical(
                          bottom: Radius.circular(8))),
                  child: const Text('Disable',
                      style: TextStyle(
                          fontSize: 13,
                          color: Colors.white,
                          fontWeight: FontWeight.w500)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Disabled Event Card ──────────────────────────────────
class _DisabledEventCard extends StatelessWidget {
  final CalendarEvent event;
  final VoidCallback  onEnable;

  const _DisabledEventCard(
      {required this.event, required this.onEnable});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(
          horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: const Color(0xFFE53E3E)
                  .withValues(alpha: 0.3))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Flexible(
                    child: Text(event.title,
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF9CA3AF),
                            decoration:
                                TextDecoration.lineThrough)),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                        color: const Color(0xFFE53E3E)
                            .withValues(alpha: 0.1),
                        borderRadius:
                            BorderRadius.circular(4)),
                    child: const Text('Disabled',
                        style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFFE53E3E),
                            fontWeight: FontWeight.w500)),
                  ),
                ]),
                const SizedBox(height: 3),
                Text(event.description,
                    style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFB0B7C3))),
              ],
            ),
          ),
          TextButton(
            onPressed: onEnable,
            style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF48BB78),
                textStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
            child: const Text('Enable'),
          ),
        ],
      ),
    );
  }
}

// ─── Confirm Disable Dialog ───────────────────────────────
class _ConfirmDisableDialog extends StatelessWidget {
  const _ConfirmDisableDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        width: 320,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Confirm Disable',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E))),
              const SizedBox(height: 12),
              const Text(
                'Are you sure you want to disable this event?',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF718096))),
              const SizedBox(height: 24),
              Row(children: [
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () =>
                          Navigator.pop(context, true),
                      style: ElevatedButton.styleFrom(
                          backgroundColor:
                              const Color(0xFF63B3ED),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(8)),
                          elevation: 0),
                      child: const Text('Yes',
                          style: TextStyle(
                              fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: OutlinedButton(
                      onPressed: () =>
                          Navigator.pop(context, false),
                      style: OutlinedButton.styleFrom(
                          foregroundColor:
                              const Color(0xFF4A5568),
                          side: const BorderSide(
                              color: Color(0xFFDDE3ED)),
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(8))),
                      child: const Text('No',
                          style: TextStyle(
                              fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Side Calendar ────────────────────────────────────────
class _SideCalendar extends StatelessWidget {
  final DateTime      focusedDay;
  final DateTime?     selectedDay;
  final Set<DateTime> eventDays;
  final Function(DateTime, DateTime) onDaySelected;
  final Function(DateTime)           onPageChanged;

  const _SideCalendar({
    required this.focusedDay,
    required this.selectedDay,
    required this.eventDays,
    required this.onDaySelected,
    required this.onPageChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.only(bottom: 8),
      child: TableCalendar(
        firstDay: DateTime(2020),
        lastDay: DateTime(2030),
        focusedDay: focusedDay,
        selectedDayPredicate: (day) =>
            isSameDay(selectedDay, day),
        eventLoader: (day) =>
            eventDays.any((e) => isSameDay(e, day))
                ? [Object()]
                : [],
        onDaySelected: onDaySelected,
        onPageChanged: onPageChanged,
        availableCalendarFormats: const {
          CalendarFormat.month: 'Month'
        },
        calendarStyle: CalendarStyle(
          todayDecoration: const BoxDecoration(
              color: Color(0xFFACC2DF),
              shape: BoxShape.circle),
          todayTextStyle: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w600,
              fontSize: 13),
          selectedDecoration: const BoxDecoration(
              color: Color(0xFF1E2126),
              shape: BoxShape.circle),
          selectedTextStyle: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w600,
              fontSize: 13),
          defaultTextStyle: const TextStyle(
              fontSize: 13, color: Color(0xFF1A1A2E)),
          weekendTextStyle: const TextStyle(
              fontSize: 13, color: Color(0xFF1A1A2E)),
          outsideDaysVisible: false,
          markerDecoration: const BoxDecoration(
              color: Color(0xFF48BB78),
              shape: BoxShape.circle),
          markerSize: 5,
          markersMaxCount: 1,
          cellMargin: const EdgeInsets.all(4),
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: false,
          titleCentered: true,
          headerPadding:
              const EdgeInsets.symmetric(vertical: 12),
          titleTextFormatter: (date, locale) =>
              '${_monthName(date.month)}\n${date.year}',
          titleTextStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1A1A2E)),
          leftChevronIcon: const Icon(Icons.chevron_left,
              size: 20, color: Color(0xFF4A5568)),
          rightChevronIcon: const Icon(Icons.chevron_right,
              size: 20, color: Color(0xFF4A5568)),
        ),
        daysOfWeekStyle: const DaysOfWeekStyle(
          weekdayStyle: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF718096)),
          weekendStyle: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF718096)),
        ),
        daysOfWeekHeight: 28,
        rowHeight: 38,
      ),
    );
  }

  String _monthName(int month) {
    const months = [
      '', 'January', 'February', 'March', 'April',
      'May', 'June', 'July', 'August', 'September',
      'October', 'November', 'December'
    ];
    return months[month];
  }
}