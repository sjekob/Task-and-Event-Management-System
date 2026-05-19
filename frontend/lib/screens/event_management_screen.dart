import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../theme/app_theme.dart';

// ─── Data Models ──────────────────────────────────────────────────────────────

enum _EventStatus { approved, pendingApproval, disabled }

class _CalEvent {
  final int?         id;
  final String       title;
  final String       description;
  final _EventStatus status;
  final DateTime     date;
  final String       creatorName;
  final int?         createdBy;

  const _CalEvent({
    this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.date,
    this.creatorName = '',
    this.createdBy,
  });

  _CalEvent copyWith({_EventStatus? status}) => _CalEvent(
    id: id, title: title, description: description,
    status: status ?? this.status, date: date,
    creatorName: creatorName, createdBy: createdBy,
  );
}

DateTime _parseDate(String? raw) {
  if (raw == null || raw.isEmpty) return DateTime.now();
  final iso = DateTime.tryParse(raw);
  if (iso != null) return iso;
  // Try common formats like "October 23, 24 & 28, 2024"
  final parts = raw.split(RegExp(r'[,&]'));
  for (final part in parts) {
    final d = DateTime.tryParse(part.trim());
    if (d != null) return d;
  }
  return DateTime.now();
}

// ─── Screen ───────────────────────────────────────────────────────────────────

class EventManagementScreen extends StatefulWidget {
  final VoidCallback onAddEvent;

  const EventManagementScreen({super.key, required this.onAddEvent});

  @override
  State<EventManagementScreen> createState() => _EventManagementScreenState();
}

class _EventManagementScreenState extends State<EventManagementScreen> {
  int       _selectedTab = 0;
  DateTime  _focusedDay  = DateTime.now();
  DateTime? _selectedDay;
  bool      _isLoading   = true;
  List<_CalEvent> _events = [];

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    try {
      final data = await ApiService.getEvents();
      setState(() {
        _events = data.map((e) => _CalEvent(
          id: e['id'] as int?,
          title: e['title'] ?? '',
          description: e['rationale'] ?? e['title'] ?? '',
          status: _mapStatus(e['status'] as String?),
          date: _parseDate(e['target_date'] as String?),
          creatorName: e['creator_name'] ?? '',
          createdBy: e['created_by'] as int?,
        )).toList();
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  _EventStatus _mapStatus(String? s) {
    switch (s) {
      case 'approved':  return _EventStatus.approved;
      case 'disabled':  return _EventStatus.disabled;
      default:          return _EventStatus.pendingApproval;
    }
  }

  bool get _canManage {
    final role = context.read<AppState>().userRole;
    return role == 'principal' || role == 'coordinator' ||
           role == 'dean'      || role == 'admin';
  }

  bool get _canApprove {
    final role = context.read<AppState>().userRole;
    return role == 'principal' || role == 'admin';
  }

  List<_CalEvent> get _activeEvents =>
      _events.where((e) => e.status != _EventStatus.disabled).toList();

  List<_CalEvent> get _disabledEvents =>
      _events.where((e) => e.status == _EventStatus.disabled).toList();

  List<_CalEvent> get _filteredActive {
    if (_selectedTab == 1) {
      final myId = context.read<AppState>().currentUser?.id;
      return _activeEvents.where((e) => e.createdBy == myId).toList();
    }
    return _activeEvents;
  }

  List<_CalEvent> _forStatus(_EventStatus s) =>
      _filteredActive.where((e) => e.status == s).toList();

  Set<DateTime> get _eventDays => _activeEvents
      .map((e) => DateTime(e.date.year, e.date.month, e.date.day))
      .toSet();

  Future<void> _disable(_CalEvent event) async {
    if (event.id != null) {
      try { await ApiService.disableEvent(event.id!); } catch (_) {}
    }
    final idx = _events.indexWhere((e) => e.id == event.id);
    if (idx != -1) {
      setState(() => _events[idx] = event.copyWith(status: _EventStatus.disabled));
    }
  }

  Future<void> _enable(_CalEvent event) async {
    if (event.id != null) {
      try { await ApiService.enableEvent(event.id!); } catch (_) {}
    }
    final idx = _events.indexWhere((e) => e.id == event.id);
    if (idx != -1) {
      setState(() => _events[idx] = event.copyWith(status: _EventStatus.pendingApproval));
    }
  }

  Future<void> _approve(_CalEvent event) async {
    if (event.id != null) {
      try { await ApiService.approveEvent(event.id!); } catch (_) {}
    }
    final idx = _events.indexWhere((e) => e.id == event.id);
    if (idx != -1) {
      setState(() => _events[idx] = event.copyWith(status: _EventStatus.approved));
    }
  }

  Future<void> _confirmDisable(BuildContext ctx, _CalEvent event) async {
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (_) => _ConfirmDisableDialog(eventTitle: event.title),
    );
    if (confirmed == true) _disable(event);
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;

    return Scaffold(
      backgroundColor: AppTheme.bgColor,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildBanner(),
                  const SizedBox(height: 20),
                  if (isMobile)
                    _buildEventList(context)
                  else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: _buildEventList(context)),
                        const SizedBox(width: 20),
                        SizedBox(
                          width: 290,
                          child: _SideCalendar(
                            focusedDay: _focusedDay,
                            selectedDay: _selectedDay,
                            eventDays: _eventDays,
                            onDaySelected: (sel, foc) =>
                                setState(() {
                              _selectedDay = sel;
                              _focusedDay = foc;
                            }),
                            onPageChanged: (foc) =>
                                setState(() => _focusedDay = foc),
                          ),
                        ),
                      ],
                    ),
                  if (isMobile) ...[
                    const SizedBox(height: 20),
                    _sectionLabel('Calendar'),
                    const SizedBox(height: 10),
                    _SideCalendar(
                      focusedDay: _focusedDay,
                      selectedDay: _selectedDay,
                      eventDays: _eventDays,
                      onDaySelected: (sel, foc) => setState(() {
                        _selectedDay = sel;
                        _focusedDay = foc;
                      }),
                      onPageChanged: (foc) =>
                          setState(() => _focusedDay = foc),
                    ),
                  ],
                ],
              ),
            ),
      floatingActionButton: _canManage
          ? FloatingActionButton.extended(
              onPressed: widget.onAddEvent,
              backgroundColor: const Color(0xFF1E2126),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add, size: 20),
              label: Text('Add Event',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600, fontSize: 13)),
            )
          : null,
    );
  }

  Widget _buildBanner() {
    return Container(
      width: double.infinity,
      height: 148,
      decoration: BoxDecoration(
        color: const Color(0xFF1E2126),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CustomPaint(painter: _CubePatternPainter()),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Event Calendar',
                    style: GoogleFonts.plusJakartaSans(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3)),
                const SizedBox(height: 6),
                Text(
                  'Great things are on the horizon — stay active, stay organized!',
                  style: GoogleFonts.plusJakartaSans(
                      color: Colors.white.withValues(alpha: 0.6),
                      fontSize: 13)),
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
        // Tab switcher
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Tab(label: 'All Events', active: _selectedTab == 0,
                onTap: () => setState(() => _selectedTab = 0)),
            const SizedBox(width: 8),
            _Tab(label: 'My Events', active: _selectedTab == 1,
                onTap: () => setState(() => _selectedTab = 1)),
          ],
        ),
        const SizedBox(height: 20),

        if (_events.isEmpty)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
                color: Colors.white, borderRadius: BorderRadius.circular(12)),
            child: const Center(
              child: Text(
                'No events yet. Tap "Add Event" to create one.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF718096)),
              ),
            ),
          ),

        if (_forStatus(_EventStatus.approved).isNotEmpty) ...[
          _sectionLabel('Upcoming / Approved Events'),
          const SizedBox(height: 10),
          ..._forStatus(_EventStatus.approved).map((e) => _EventCard(
                event: e,
                canManage: _canManage,
                canApprove: false,
                onDisable: () => _confirmDisable(context, e),
                onApprove: () {},
              )),
          const SizedBox(height: 20),
        ],

        if (_forStatus(_EventStatus.pendingApproval).isNotEmpty) ...[
          _sectionLabel('Pending Approval'),
          const SizedBox(height: 10),
          ..._forStatus(_EventStatus.pendingApproval).map((e) => _EventCard(
                event: e,
                canManage: _canManage,
                canApprove: _canApprove,
                onDisable: () => _confirmDisable(context, e),
                onApprove: () => _approve(e),
              )),
          const SizedBox(height: 20),
        ],

        if (_disabledEvents.isNotEmpty && _selectedTab == 0) ...[
          _sectionLabel('Disabled Events'),
          const SizedBox(height: 10),
          ..._disabledEvents.map((e) => _DisabledEventCard(
                event: e,
                canManage: _canManage,
                onEnable: () => _enable(e),
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

// ─── Cube pattern painter ─────────────────────────────────────────────────────

class _CubePatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final topPaint   = Paint()..color = Colors.white.withValues(alpha: 0.07)..style = PaintingStyle.fill;
    final leftPaint  = Paint()..color = Colors.white.withValues(alpha: 0.04)..style = PaintingStyle.fill;
    final rightPaint = Paint()..color = Colors.white.withValues(alpha: 0.02)..style = PaintingStyle.fill;
    final stroke     = Paint()..color = Colors.white.withValues(alpha: 0.06)..style = PaintingStyle.stroke..strokeWidth = 0.5;
    const double w = 40.0, h = 22.0;
    for (double row = -1; row < size.height / h + 2; row++) {
      for (double col = -1; col < size.width / w + 2; col++) {
        final ox = col * w + (row % 2 == 0 ? 0 : w / 2);
        final oy = row * h * 0.75;
        _drawCube(canvas, Offset(ox, oy), w, h, topPaint, leftPaint, rightPaint, stroke);
      }
    }
  }

  void _drawCube(Canvas canvas, Offset o, double w, double h,
      Paint top, Paint left, Paint right, Paint stroke) {
    final cx = o.dx + w / 2, cy = o.dy;
    final topPath = Path()
      ..moveTo(cx, cy)..lineTo(cx + w / 2, cy + h / 2)
      ..lineTo(cx, cy + h)..lineTo(cx - w / 2, cy + h / 2)..close();
    canvas.drawPath(topPath, top); canvas.drawPath(topPath, stroke);
    final leftPath = Path()
      ..moveTo(cx - w / 2, cy + h / 2)..lineTo(cx, cy + h)
      ..lineTo(cx, cy + h * 1.6)..lineTo(cx - w / 2, cy + h * 1.1)..close();
    canvas.drawPath(leftPath, left); canvas.drawPath(leftPath, stroke);
    final rightPath = Path()
      ..moveTo(cx + w / 2, cy + h / 2)..lineTo(cx, cy + h)
      ..lineTo(cx, cy + h * 1.6)..lineTo(cx + w / 2, cy + h * 1.1)..close();
    canvas.drawPath(rightPath, right); canvas.drawPath(rightPath, stroke);
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

class _Tab extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _Tab({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF1E2126) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: active ? const Color(0xFF1E2126) : const Color(0xFFDDE3ED)),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: active ? Colors.white : const Color(0xFF4A5568))),
      ),
    );
  }
}

// ─── Event Card ───────────────────────────────────────────────────────────────

class _EventCard extends StatelessWidget {
  final _CalEvent  event;
  final bool       canManage;
  final bool       canApprove;
  final VoidCallback onDisable;
  final VoidCallback onApprove;

  const _EventCard({
    required this.event,
    required this.canManage,
    required this.canApprove,
    required this.onDisable,
    required this.onApprove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12)),
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
                            color: Color(0xFF1A1A2E))),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                        color: event.status == _EventStatus.approved
                            ? const Color(0xFF48BB78).withValues(alpha: 0.12)
                            : const Color(0xFFED8936).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4)),
                    child: Text(
                        event.status == _EventStatus.approved
                            ? 'Approved'
                            : 'Pending',
                        style: TextStyle(
                            fontSize: 11,
                            color: event.status == _EventStatus.approved
                                ? const Color(0xFF48BB78)
                                : const Color(0xFFED8936),
                            fontWeight: FontWeight.w500)),
                  ),
                ]),
                const SizedBox(height: 3),
                Text(event.description,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF718096)),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
                if (event.creatorName.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('By ${event.creatorName}',
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFFB0B7C3))),
                ],
              ],
            ),
          ),
          if (canManage)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF718096)),
              offset: const Offset(0, 30),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: EdgeInsets.zero,
              onSelected: (v) {
                if (v == 'approve') onApprove();
                if (v == 'disable') onDisable();
              },
              itemBuilder: (_) => [
                if (canApprove && event.status == _EventStatus.pendingApproval)
                  const PopupMenuItem<String>(
                    value: 'approve',
                    height: 40,
                    child: Text('Approve',
                        style: TextStyle(fontSize: 13, color: Color(0xFF48BB78))),
                  ),
                PopupMenuItem<String>(
                  value: 'disable',
                  height: 40,
                  padding: EdgeInsets.zero,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                        color: const Color(0xFFE53E3E),
                        borderRadius: BorderRadius.vertical(
                            bottom: Radius.circular(
                                canApprove && event.status == _EventStatus.pendingApproval ? 8 : 8),
                            top: Radius.circular(
                                canApprove && event.status == _EventStatus.pendingApproval ? 0 : 8))),
                    child: const Text('Disable',
                        style: TextStyle(
                            fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500)),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

// ─── Disabled Event Card ──────────────────────────────────────────────────────

class _DisabledEventCard extends StatelessWidget {
  final _CalEvent  event;
  final bool       canManage;
  final VoidCallback onEnable;

  const _DisabledEventCard({
    required this.event,
    required this.canManage,
    required this.onEnable,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE53E3E).withValues(alpha: 0.3))),
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
                            decoration: TextDecoration.lineThrough)),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                        color: const Color(0xFFE53E3E).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4)),
                    child: const Text('Disabled',
                        style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFFE53E3E),
                            fontWeight: FontWeight.w500)),
                  ),
                ]),
                const SizedBox(height: 3),
                Text(event.description,
                    style: const TextStyle(fontSize: 12, color: Color(0xFFB0B7C3))),
              ],
            ),
          ),
          if (canManage)
            TextButton(
              onPressed: onEnable,
              style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF48BB78),
                  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              child: const Text('Enable'),
            ),
        ],
      ),
    );
  }
}

// ─── Confirm Disable Dialog ───────────────────────────────────────────────────

class _ConfirmDisableDialog extends StatelessWidget {
  final String eventTitle;
  const _ConfirmDisableDialog({required this.eventTitle});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
              Text('Disable "$eventTitle"?',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
              const SizedBox(height: 24),
              Row(children: [
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context, true),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE53E3E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8)),
                          elevation: 0),
                      child: const Text('Disable',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context, false),
                      style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF4A5568),
                          side: const BorderSide(color: Color(0xFFDDE3ED)),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8))),
                      child: const Text('Cancel',
                          style: TextStyle(fontWeight: FontWeight.w600)),
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

// ─── Side Calendar ────────────────────────────────────────────────────────────

class _SideCalendar extends StatelessWidget {
  final DateTime      focusedDay;
  final DateTime?     selectedDay;
  final Set<DateTime> eventDays;
  final Function(DateTime, DateTime) onDaySelected;
  final Function(DateTime) onPageChanged;

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
          color: Colors.white, borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.only(bottom: 8),
      child: TableCalendar(
        firstDay: DateTime(2020),
        lastDay: DateTime(2030),
        focusedDay: focusedDay,
        selectedDayPredicate: (day) => isSameDay(selectedDay, day),
        eventLoader: (day) =>
            eventDays.any((e) => isSameDay(e, day)) ? [Object()] : [],
        onDaySelected: onDaySelected,
        onPageChanged: onPageChanged,
        availableCalendarFormats: const {CalendarFormat.month: 'Month'},
        calendarStyle: CalendarStyle(
          todayDecoration: const BoxDecoration(
              color: Color(0xFFACC2DF), shape: BoxShape.circle),
          todayTextStyle: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          selectedDecoration: const BoxDecoration(
              color: Color(0xFF1E2126), shape: BoxShape.circle),
          selectedTextStyle: const TextStyle(
              color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          defaultTextStyle: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          weekendTextStyle: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          outsideDaysVisible: false,
          markerDecoration: const BoxDecoration(
              color: Color(0xFF48BB78), shape: BoxShape.circle),
          markerSize: 5,
          markersMaxCount: 1,
          cellMargin: const EdgeInsets.all(4),
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: false,
          titleCentered: true,
          headerPadding: const EdgeInsets.symmetric(vertical: 12),
          titleTextFormatter: (date, locale) =>
              '${_monthName(date.month)}\n${date.year}',
          titleTextStyle: const TextStyle(
              fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E)),
          leftChevronIcon: const Icon(Icons.chevron_left, size: 20, color: Color(0xFF4A5568)),
          rightChevronIcon: const Icon(Icons.chevron_right, size: 20, color: Color(0xFF4A5568)),
        ),
        daysOfWeekStyle: const DaysOfWeekStyle(
          weekdayStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF718096)),
          weekendStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF718096)),
        ),
        daysOfWeekHeight: 28,
        rowHeight: 38,
      ),
    );
  }

  String _monthName(int month) {
    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
  }
}
