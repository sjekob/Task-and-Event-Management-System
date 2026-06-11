import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/event_print_helper.dart';
import '../widgets/skeleton_widgets.dart';

enum _EventStatus { approved, pendingApproval, disabled, draft }

class _CalEvent {
  final int?         id;
  final String       title;
  final String       description;
  final _EventStatus status;
  final DateTime     date;
  final String       creatorName;
  final int?         createdBy;
  final Map<String, dynamic> raw;

  const _CalEvent({
    this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.date,
    this.creatorName = '',
    this.createdBy,
    required this.raw,
  });

  _CalEvent copyWith({_EventStatus? status}) => _CalEvent(
    id: id, title: title, description: description,
    status: status ?? this.status, date: date,
    creatorName: creatorName, createdBy: createdBy, raw: raw,
  );
}

DateTime _parseDate(String? raw) {
  if (raw == null || raw.isEmpty) return DateTime.now();
  final iso = DateTime.tryParse(raw);
  if (iso != null) return iso;
  final parts = raw.split(RegExp(r'[,&]'));
  for (final part in parts) {
    final d = DateTime.tryParse(part.trim());
    if (d != null) return d;
  }
  return DateTime.now();
}

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
          raw: e,
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
      case 'draft':     return _EventStatus.draft;
      default:          return _EventStatus.pendingApproval;
    }
  }

  bool get _canManage {
    final role = context.read<AppState>().userRole;
    return role == 'coordinator' || role == 'dean' || role == 'teacher' ||
        role == 'registrar' || role == 'admin';
  }

  bool get _canApprove {
    final role = context.read<AppState>().userRole;
    return role == 'principal' || role == 'admin';
  }

  bool get _isPrincipal => context.read<AppState>().userRole == 'principal';

  List<_CalEvent> get _activeEvents => _events
      .where((e) => e.status != _EventStatus.disabled && e.status != _EventStatus.draft)
      .toList();

  List<_CalEvent> get _disabledEvents =>
      _events.where((e) => e.status == _EventStatus.disabled).toList();

  List<_CalEvent> get _draftEvents {
    final myId = context.read<AppState>().currentUser?.id;
    return _events
        .where((e) => e.status == _EventStatus.draft && e.createdBy == myId)
        .toList();
  }

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
    if (idx != -1) setState(() => _events[idx] = event.copyWith(status: _EventStatus.disabled));
  }

  Future<void> _enable(_CalEvent event) async {
    if (event.id != null) {
      try { await ApiService.enableEvent(event.id!); } catch (_) {}
    }
    final idx = _events.indexWhere((e) => e.id == event.id);
    if (idx != -1) setState(() => _events[idx] = event.copyWith(status: _EventStatus.pendingApproval));
  }

  Future<void> _approve(_CalEvent event) async {
    if (event.id != null) {
      try { await ApiService.approveEvent(event.id!); } catch (_) {}
    }
    final idx = _events.indexWhere((e) => e.id == event.id);
    if (idx != -1) setState(() => _events[idx] = event.copyWith(status: _EventStatus.approved));
  }

  Future<void> _confirmDisable(BuildContext ctx, _CalEvent event) async {
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (_) => _ConfirmDisableDialog(eventTitle: event.title),
    );
    if (confirmed == true) _disable(event);
  }

  Future<void> _deleteDraft(_CalEvent event) async {
    if (event.id != null) {
      try { await ApiService.deleteEvent(event.id!); } catch (_) {}
    }
    setState(() => _events.removeWhere((e) => e.id == event.id));
  }

  Future<void> _confirmDeleteDraft(BuildContext ctx, _CalEvent event) async {
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (_) => _ConfirmDeleteDialog(eventTitle: event.title),
    );
    if (confirmed == true) _deleteDraft(event);
  }

  void _editEvent(_CalEvent event) {
    context.go('/events/${event.id}/edit', extra: event.raw);
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;

    return Scaffold(
      backgroundColor: AppTheme.bgColor,
      body: _isLoading
          ? const EventManagementSkeleton()
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
                            onDaySelected: (sel, foc) => setState(() {
                              _selectedDay = sel; _focusedDay = foc;
                            }),
                            onPageChanged: (foc) => setState(() => _focusedDay = foc),
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
                        _selectedDay = sel; _focusedDay = foc;
                      }),
                      onPageChanged: (foc) => setState(() => _focusedDay = foc),
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
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13)),
            )
          : null,
    );
  }

  Widget _buildBanner() {
    return Container(
      width: double.infinity,
      height: 148,
      decoration: BoxDecoration(color: const Color(0xFF1E2126), borderRadius: BorderRadius.circular(12)),
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
                        color: Colors.white, fontSize: 32,
                        fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                const SizedBox(height: 6),
                Text('Great things are on the horizon — stay active, stay organized!',
                    style: GoogleFonts.plusJakartaSans(
                        color: Colors.white.withValues(alpha: 0.6), fontSize: 13)),
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
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Tab(label: 'All Events', active: _selectedTab == 0,
                onTap: () => setState(() => _selectedTab = 0)),
            if (!_isPrincipal) ...[
              const SizedBox(width: 8),
              _Tab(label: 'My Events', active: _selectedTab == 1,
                  onTap: () => setState(() => _selectedTab = 1)),
            ],
          ],
        ),
        const SizedBox(height: 20),

        if (_events.isEmpty)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
            child: const Center(
              child: Text('No events yet.', textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: Color(0xFF718096))),
            ),
          ),

        // Approved events — no actions
        if (_forStatus(_EventStatus.approved).isNotEmpty) ...[
          _sectionLabel('Upcoming / Approved Events'),
          const SizedBox(height: 10),
          ..._forStatus(_EventStatus.approved).map((e) => _EventCard(
                event: e,
                canManage: false,
                canApprove: false,
                isPrincipal: _isPrincipal,
                onEdit: () {},
                onDisable: () {},
                onApprove: () {},
                onPrint: () => EventPrintHelper.printEvent(context, e.raw),
                onTap: () => _showEventDetail(context, e,
                    canManage: false,
                    canApprove: false,
                    isPrincipal: _isPrincipal),
              )),
          const SizedBox(height: 20),
        ],

        // Pending approval events
        if (_forStatus(_EventStatus.pendingApproval).isNotEmpty) ...[
          _sectionLabel('Pending Approval'),
          const SizedBox(height: 10),
          ..._forStatus(_EventStatus.pendingApproval).map((e) => _EventCard(
                event: e,
                canManage: _canManage,
                canApprove: _canApprove,
                isPrincipal: _isPrincipal,
                onEdit: () => _editEvent(e),
                onDisable: () => _confirmDisable(context, e),
                onApprove: () => _approve(e),
                onPrint: () => EventPrintHelper.printEvent(context, e.raw),
                onTap: () => _showEventDetail(context, e,
                    canManage: _canManage,
                    canApprove: _canApprove,
                    isPrincipal: _isPrincipal,
                    onApprove: () => _approve(e),
                    onDisable: () => _confirmDisable(context, e)),
              )),
          const SizedBox(height: 20),
        ],

        // Disabled events
        if (_disabledEvents.isNotEmpty && _selectedTab == 0) ...[
          _sectionLabel('Disabled Events'),
          const SizedBox(height: 10),
          ..._disabledEvents.map((e) => _DisabledEventCard(
                event: e,
                canManage: _canManage,
                onEnable: () => _enable(e),
                onPrint: () => EventPrintHelper.printEvent(context, e.raw),
                onTap: () => _showEventDetail(context, e,
                    canManage: _canManage, isPrincipal: _isPrincipal),
              )),
          const SizedBox(height: 20),
        ],

        // Drafts — private to the creator, never shown to other users
        if (_draftEvents.isNotEmpty) ...[
          _sectionLabel('Drafts'),
          const SizedBox(height: 10),
          ..._draftEvents.map((e) => _DraftEventCard(
                event: e,
                onContinue: () => _editEvent(e),
                onDelete: () => _confirmDeleteDraft(context, e),
              )),
        ],
      ],
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child: Text(text,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF718096))),
      );
}

// ─── Cube painter ─────────────────────────────────────────────────────────────

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
    final tp = Path()..moveTo(cx, cy)..lineTo(cx + w/2, cy + h/2)..lineTo(cx, cy + h)..lineTo(cx - w/2, cy + h/2)..close();
    canvas.drawPath(tp, top); canvas.drawPath(tp, stroke);
    final lp = Path()..moveTo(cx - w/2, cy + h/2)..lineTo(cx, cy + h)..lineTo(cx, cy + h*1.6)..lineTo(cx - w/2, cy + h*1.1)..close();
    canvas.drawPath(lp, left); canvas.drawPath(lp, stroke);
    final rp = Path()..moveTo(cx + w/2, cy + h/2)..lineTo(cx, cy + h)..lineTo(cx, cy + h*1.6)..lineTo(cx + w/2, cy + h*1.1)..close();
    canvas.drawPath(rp, right); canvas.drawPath(rp, stroke);
  }
  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

class _Tab extends StatelessWidget {
  final String label; final bool active; final VoidCallback onTap;
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
          border: Border.all(color: active ? const Color(0xFF1E2126) : const Color(0xFFDDE3ED)),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
            color: active ? Colors.white : const Color(0xFF4A5568))),
      ),
    );
  }
}

// ─── Event Detail Sheet ───────────────────────────────────────────────────────

void _showEventDetail(BuildContext context, _CalEvent event, {
  bool canApprove = false, bool canManage = false, bool isPrincipal = false,
  VoidCallback? onApprove, VoidCallback? onDisable,
}) {
  final dateStr = '${_monthName(event.date.month)} ${event.date.day}, ${event.date.year}';
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => DraggableScrollableSheet(
      initialChildSize: 0.55, minChildSize: 0.4, maxChildSize: 0.85,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4,
              decoration: BoxDecoration(color: const Color(0xFFDDE3ED), borderRadius: BorderRadius.circular(2))),
          Expanded(
            child: ListView(controller: controller,
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
              children: [
                Row(children: [
                  Expanded(child: Text(event.title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E)))),
                  const SizedBox(width: 10),
                  _StatusBadge(status: event.status),
                ]),
                const SizedBox(height: 16),
                _DetailRow(icon: Icons.calendar_today_outlined, label: 'Date', value: dateStr),
                if (event.creatorName.isNotEmpty)
                  _DetailRow(icon: Icons.person_outline, label: 'Created by', value: event.creatorName),
                const SizedBox(height: 12),
                const Text('Description',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                const SizedBox(height: 6),
                Text(event.description,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF718096), height: 1.5)),
                // Approve button — principal/admin only
                if (canApprove && event.status == _EventStatus.pendingApproval) ...[
                  const SizedBox(height: 24),
                  SizedBox(width: double.infinity, height: 44,
                    child: ElevatedButton(
                      onPressed: () { Navigator.pop(context); onApprove?.call(); },
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF48BB78),
                          foregroundColor: Colors.white, elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                      child: const Text('Approve Event',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                  ),
                ],
                // Disable button — principal only for pending events
                if (isPrincipal && event.status == _EventStatus.pendingApproval) ...[
                  const SizedBox(height: 10),
                  SizedBox(width: double.infinity, height: 44,
                    child: OutlinedButton(
                      onPressed: () { Navigator.pop(context); onDisable?.call(); },
                      style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFE53E3E),
                          side: const BorderSide(color: Color(0xFFE53E3E)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                      child: const Text('Disable Event',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ]),
      ),
    ),
  );
}

String _monthName(int month) {
  const months = ['','January','February','March','April','May','June',
      'July','August','September','October','November','December'];
  return months[month];
}

class _StatusBadge extends StatelessWidget {
  final _EventStatus status;
  const _StatusBadge({required this.status});
  @override
  Widget build(BuildContext context) {
    final isApproved = status == _EventStatus.approved;
    final isDisabled = status == _EventStatus.disabled;
    final isDraft    = status == _EventStatus.draft;
    final color = isDisabled ? const Color(0xFFE53E3E)
        : isDraft ? const Color(0xFF718096)
        : isApproved ? const Color(0xFF48BB78) : const Color(0xFFED8936);
    final label = isDisabled ? 'Disabled' : isDraft ? 'Draft' : isApproved ? 'Approved' : 'Pending';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon; final String label; final String value;
  const _DetailRow({required this.icon, required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    return Padding(padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Icon(icon, size: 16, color: const Color(0xFF718096)),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
        Expanded(child: Text(value, style: const TextStyle(
            fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF1A1A2E)))),
      ]));
  }
}

// ─── Event Card ───────────────────────────────────────────────────────────────

class _EventCard extends StatelessWidget {
  final _CalEvent    event;
  final bool         canManage;
  final bool         canApprove;
  final bool         isPrincipal;
  final VoidCallback onEdit;
  final VoidCallback onDisable;
  final VoidCallback onApprove;
  final VoidCallback? onPrint;
  final VoidCallback? onTap;

  const _EventCard({
    required this.event, required this.canManage, required this.canApprove,
    required this.isPrincipal, required this.onEdit, required this.onDisable,
    required this.onApprove, this.onPrint, this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(event.title,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E)))),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: event.status == _EventStatus.approved
                          ? const Color(0xFF48BB78).withValues(alpha: 0.12)
                          : const Color(0xFFED8936).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4)),
                  child: Text(
                      event.status == _EventStatus.approved ? 'Approved' : 'Pending',
                      style: TextStyle(fontSize: 11,
                          color: event.status == _EventStatus.approved
                              ? const Color(0xFF48BB78) : const Color(0xFFED8936),
                          fontWeight: FontWeight.w500)),
                ),
              ]),
              const SizedBox(height: 3),
              Text(event.description,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF718096)),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              if (event.creatorName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('By ${event.creatorName}',
                    style: const TextStyle(fontSize: 11, color: Color(0xFFB0B7C3))),
              ],
            ]),
          ),

          // Print / Save as PDF — available to all roles for all statuses
          if (onPrint != null)
            IconButton(
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18, color: Color(0xFF718096)),
              onPressed: onPrint,
              tooltip: 'Print / Save as PDF',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),

          // Principal: Approve + Disable for pending events
          if (isPrincipal && canApprove && event.status == _EventStatus.pendingApproval)
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
                const PopupMenuItem<String>(value: 'approve', height: 40,
                    child: Text('Approve',
                        style: TextStyle(fontSize: 13, color: Color(0xFF48BB78)))),
                PopupMenuItem<String>(value: 'disable', height: 40, padding: EdgeInsets.zero,
                  child: Container(width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: const BoxDecoration(color: Color(0xFFE53E3E),
                        borderRadius: BorderRadius.vertical(
                            top: Radius.circular(0), bottom: Radius.circular(8))),
                    child: const Text('Disable',
                        style: TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500))),
                ),
              ],
            )

          // Coordinator/Dean/Admin: Edit only for pending events (no disable)
          else if (canManage && event.status == _EventStatus.pendingApproval)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF718096)),
              offset: const Offset(0, 30),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: EdgeInsets.zero,
              onSelected: (v) {
                if (v == 'edit') onEdit();
              },
              itemBuilder: (_) => [
                const PopupMenuItem<String>(value: 'edit', height: 40,
                    child: Text('Edit',
                        style: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)))),
              ],
            ),
        ]),
      ),
    );
  }
}

// ─── Disabled Event Card ──────────────────────────────────────────────────────

class _DisabledEventCard extends StatelessWidget {
  final _CalEvent event; final bool canManage;
  final VoidCallback onEnable; final VoidCallback? onPrint; final VoidCallback? onTap;
  const _DisabledEventCard({required this.event, required this.canManage,
      required this.onEnable, this.onPrint, this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE53E3E).withValues(alpha: 0.3))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(event.title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
                      color: Color(0xFF9CA3AF), decoration: TextDecoration.lineThrough))),
              const SizedBox(width: 8),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFE53E3E).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4)),
                child: const Text('Disabled',
                    style: TextStyle(fontSize: 11, color: Color(0xFFE53E3E), fontWeight: FontWeight.w500))),
            ]),
            const SizedBox(height: 3),
            Text(event.description, style: const TextStyle(fontSize: 12, color: Color(0xFFB0B7C3))),
          ])),
          if (onPrint != null)
            IconButton(
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18, color: Color(0xFF718096)),
              onPressed: onPrint,
              tooltip: 'Print / Save as PDF',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
          if (canManage)
            TextButton(onPressed: onEnable,
              style: TextButton.styleFrom(foregroundColor: const Color(0xFF48BB78),
                  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              child: const Text('Enable')),
        ]),
      ),
    );
  }
}

// ─── Draft Event Card ─────────────────────────────────────────────────────────

class _DraftEventCard extends StatelessWidget {
  final _CalEvent event;
  final VoidCallback onContinue;
  final VoidCallback onDelete;
  const _DraftEventCard({required this.event, required this.onContinue, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final title = event.title.trim().isEmpty ? 'Untitled Draft' : event.title;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFDDE3ED))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E)))),
              const SizedBox(width: 8),
              const _StatusBadge(status: _EventStatus.draft),
            ]),
            const SizedBox(height: 3),
            const Text('Continue where you left off.',
                style: TextStyle(fontSize: 12, color: Color(0xFF718096))),
          ]),
        ),
        TextButton(onPressed: onContinue,
          style: TextButton.styleFrom(foregroundColor: const Color(0xFF1E2126),
              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          child: const Text('Continue Editing')),
        IconButton(
          icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFE53E3E)),
          onPressed: onDelete,
          tooltip: 'Delete draft',
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
        ),
      ]),
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
      child: SizedBox(width: 320,
        child: Padding(padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Confirm Disable',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))),
            const SizedBox(height: 12),
            Text('Disable "$eventTitle"?', textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(child: SizedBox(height: 44,
                child: ElevatedButton(onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53E3E),
                      foregroundColor: Colors.white, elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Disable', style: TextStyle(fontWeight: FontWeight.w600))))),
              const SizedBox(width: 12),
              Expanded(child: SizedBox(height: 44,
                child: OutlinedButton(onPressed: () => Navigator.pop(context, false),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF4A5568),
                      side: const BorderSide(color: Color(0xFFDDE3ED)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600))))),
            ]),
          ]),
        ),
      ),
    );
  }
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

class _ConfirmDeleteDialog extends StatelessWidget {
  final String eventTitle;
  const _ConfirmDeleteDialog({required this.eventTitle});
  @override
  Widget build(BuildContext context) {
    final title = eventTitle.trim().isEmpty ? 'Untitled Draft' : eventTitle;
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(width: 320,
        child: Padding(padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Delete Draft',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))),
            const SizedBox(height: 12),
            Text('Delete "$title"? This cannot be undone.', textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(child: SizedBox(height: 44,
                child: ElevatedButton(onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53E3E),
                      foregroundColor: Colors.white, elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.w600))))),
              const SizedBox(width: 12),
              Expanded(child: SizedBox(height: 44,
                child: OutlinedButton(onPressed: () => Navigator.pop(context, false),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF4A5568),
                      side: const BorderSide(color: Color(0xFFDDE3ED)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600))))),
            ]),
          ]),
        ),
      ),
    );
  }
}

// ─── Side Calendar ────────────────────────────────────────────────────────────

class _SideCalendar extends StatelessWidget {
  final DateTime focusedDay; final DateTime? selectedDay;
  final Set<DateTime> eventDays;
  final Function(DateTime, DateTime) onDaySelected;
  final Function(DateTime) onPageChanged;
  const _SideCalendar({required this.focusedDay, required this.selectedDay,
      required this.eventDays, required this.onDaySelected, required this.onPageChanged});
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.only(bottom: 8),
      child: TableCalendar(
        firstDay: DateTime(2020), lastDay: DateTime(2030), focusedDay: focusedDay,
        selectedDayPredicate: (day) => isSameDay(selectedDay, day),
        eventLoader: (day) => eventDays.any((e) => isSameDay(e, day)) ? [Object()] : [],
        onDaySelected: onDaySelected, onPageChanged: onPageChanged,
        availableCalendarFormats: const {CalendarFormat.month: 'Month'},
        calendarStyle: const CalendarStyle(
          todayDecoration: BoxDecoration(color: Color(0xFFACC2DF), shape: BoxShape.circle),
          todayTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          selectedDecoration: BoxDecoration(color: Color(0xFF1E2126), shape: BoxShape.circle),
          selectedTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          defaultTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          weekendTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          outsideDaysVisible: false,
          markerDecoration: BoxDecoration(color: Color(0xFF48BB78), shape: BoxShape.circle),
          markerSize: 5, markersMaxCount: 1, cellMargin: EdgeInsets.all(4),
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: false, titleCentered: true,
          headerPadding: const EdgeInsets.symmetric(vertical: 12),
          titleTextFormatter: (date, locale) => '${_monthName(date.month)}\n${date.year}',
          titleTextStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E)),
          leftChevronIcon: const Icon(Icons.chevron_left, size: 20, color: Color(0xFF4A5568)),
          rightChevronIcon: const Icon(Icons.chevron_right, size: 20, color: Color(0xFF4A5568)),
        ),
        daysOfWeekStyle: const DaysOfWeekStyle(
          weekdayStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF718096)),
          weekendStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF718096)),
        ),
        daysOfWeekHeight: 28, rowHeight: 38,
      ),
    );
  }
}