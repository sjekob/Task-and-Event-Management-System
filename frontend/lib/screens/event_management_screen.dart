import 'dart:convert';

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

  // Active events grouped by calendar day — powers the dot markers and the
  // hover tooltip (title / when / where) on the side calendar.
  Map<DateTime, List<_CalEvent>> get _eventsByDay {
    final map = <DateTime, List<_CalEvent>>{};
    for (final e in _activeEvents) {
      final key = DateTime(e.date.year, e.date.month, e.date.day);
      (map[key] ??= []).add(e);
    }
    return map;
  }

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
                            eventsByDay: _eventsByDay,
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
                      eventsByDay: _eventsByDay,
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
  final raw = event.raw;
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => DraggableScrollableSheet(
      initialChildSize: 0.88, minChildSize: 0.5, maxChildSize: 0.97,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4,
              decoration: BoxDecoration(color: const Color(0xFFDDE3ED), borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text(event.title,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E)))),
              const SizedBox(width: 10),
              _StatusBadge(status: event.status),
            ]),
          ),
          const Divider(height: 1, color: Color(0xFFEEF0F4)),
          Expanded(
            child: ListView(controller: controller,
              padding: const EdgeInsets.fromLTRB(24, 18, 24, 32),
              children: [
                // Creator & date meta
                if (event.creatorName.isNotEmpty)
                  _PropMeta(Icons.person_outline, 'Proposed by ${event.creatorName}'),
                if ((raw['target_date'] ?? '').toString().isNotEmpty)
                  _PropMeta(Icons.calendar_today_outlined, raw['target_date'].toString()),
                const SizedBox(height: 16),

                // I. Proposal Brief
                _ProposalSection(title: 'I. Proposal Brief', children: [
                  _PropField('Nature', raw['nature']),
                  _PropField('Venue', raw['venue']),
                  _PropField('Proposed Budget', raw['proposed_budget']),
                  _PropField('Fund Source', raw['fund_source']),
                  if (_notEmpty(raw['focal_name'])) ...[
                    const SizedBox(height: 6),
                    const Text('Focal Person',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                    const SizedBox(height: 4),
                    _PropField('Name', raw['focal_name']),
                    _PropField('Role', raw['focal_role']),
                    _PropField('Contact', raw['focal_contact']),
                  ],
                  if (_notEmpty(raw['expected_outputs'])) ...[
                    const SizedBox(height: 6),
                    _PropField('Expected Outputs', raw['expected_outputs']),
                  ],
                  if (_notEmpty(raw['participants'])) ...[
                    const SizedBox(height: 6),
                    _buildParticipantsWidget(raw['participants'].toString()),
                  ],
                ]),

                // II. Rationale
                if (_notEmpty(raw['rationale']))
                  _ProposalSection(title: 'II. Rationale', children: [
                    _PropBody(raw['rationale'].toString()),
                  ]),

                // III. Objectives
                if (_notEmpty(raw['objectives']))
                  _ProposalSection(title: 'III. Objectives', children: [
                    _PropBullets(raw['objectives'].toString()),
                  ]),

                // IV. Methodology
                if (_notEmpty(raw['phase1']) || _notEmpty(raw['phase2']) || _notEmpty(raw['phase3']))
                  _ProposalSection(title: 'IV. Methodology / Work Plan', children: [
                    _PropField('Phase 1 – Pre-Implementation', raw['phase1']),
                    _PropField('Phase 2 – Implementation', raw['phase2']),
                    _PropField('Phase 3 – Post-Implementation', raw['phase3']),
                  ]),

                // V. Activity Matrix
                if (_notEmpty(raw['activity_matrix']))
                  _ProposalSection(title: 'V. Activity Matrix', children: [
                    _buildActivityMatrix(raw['activity_matrix'].toString()),
                  ]),

                // VI. Budget
                if (_notEmpty(raw['training_materials']) || _notEmpty(raw['snacks']))
                  _ProposalSection(title: 'VI. Budget', children: [
                    if (_notEmpty(raw['training_materials'])) ...[
                      const Text('Training Materials',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildBudgetTable(raw['training_materials'].toString(),
                          ['item', 'quantity', 'cost', 'total']),
                    ],
                    if (_notEmpty(raw['snacks'])) ...[
                      const SizedBox(height: 12),
                      const Text('Meals / Snacks',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildBudgetTable(raw['snacks'].toString(),
                          ['item', 'participants', 'cost_per_day', 'total']),
                    ],
                  ]),

                // VII. Committees
                if (_notEmpty(raw['exec_committee']) || _notEmpty(raw['twg_groups']))
                  _ProposalSection(title: 'VII. Committees', children: [
                    if (_notEmpty(raw['exec_committee'])) ...[
                      const Text('Executive Committee',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildCommitteeList(raw['exec_committee'].toString()),
                    ],
                    if (_notEmpty(raw['twg_groups'])) ...[
                      const SizedBox(height: 12),
                      const Text('Technical Working Groups',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildTwgGroups(raw['twg_groups'].toString()),
                    ],
                  ]),

                // VIII. Monitoring & Evaluation
                if (_notEmpty(raw['monitoring_criteria']) || _notEmpty(raw['indicators']))
                  _ProposalSection(title: 'VIII. Monitoring & Evaluation', children: [
                    if (_notEmpty(raw['monitoring_criteria']))
                      _PropBody(raw['monitoring_criteria'].toString()),
                    if (_notEmpty(raw['indicators'])) ...[
                      const Text('Indicators',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF718096))),
                      const SizedBox(height: 4),
                      _buildIndicators(raw['indicators'].toString()),
                    ],
                  ]),

                // Comments
                if (_notEmpty(raw['comments']))
                  _ProposalSection(title: 'Comments', children: [
                    _PropBody(raw['comments'].toString()),
                  ]),

                // Action buttons — principal approving/rejecting pending events
                if (canApprove && event.status == _EventStatus.pendingApproval) ...[
                  const SizedBox(height: 20),
                  SizedBox(width: double.infinity, height: 44,
                    child: ElevatedButton(
                      onPressed: () { Navigator.pop(context); onApprove?.call(); },
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF48BB78),
                          foregroundColor: Colors.white, elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                      child: const Text('Approve Event',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                  ),
                ],
                if (isPrincipal && event.status == _EventStatus.pendingApproval) ...[
                  const SizedBox(height: 10),
                  SizedBox(width: double.infinity, height: 44,
                    child: OutlinedButton(
                      onPressed: () { Navigator.pop(context); onDisable?.call(); },
                      style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFE53E3E),
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

// ── Detail helpers ────────────────────────────────────────────────────────────

bool _notEmpty(dynamic v) => v != null && v.toString().trim().isNotEmpty;

Widget _buildParticipantsWidget(String raw) {
  try {
    final data = jsonDecode(raw) as Map<String, dynamic>;
    final rows  = (data['rows'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final tots  = data['totals'] as Map<String, dynamic>?;
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Target Participants',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
      const SizedBox(height: 6),
      Table(
        border: TableBorder.all(color: const Color(0xFFDDE3ED), width: 0.8),
        columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(1), 2: FlexColumnWidth(1), 3: FlexColumnWidth(1)},
        children: [
          TableRow(decoration: const BoxDecoration(color: Color(0xFFF8F9FA)), children: [
            _tc('Category', bold: true), _tc('M', bold: true), _tc('F', bold: true), _tc('Total', bold: true),
          ]),
          for (final r in rows)
            TableRow(children: [
              _tc(r['category']?.toString() ?? ''),
              _tc(r['male']?.toString() ?? ''),
              _tc(r['female']?.toString() ?? ''),
              _tc(r['total']?.toString() ?? ''),
            ]),
          if (tots != null)
            TableRow(decoration: const BoxDecoration(color: Color(0xFFF0F4FF)), children: [
              _tc('TOTAL', bold: true),
              _tc(tots['male']?.toString() ?? '', bold: true),
              _tc(tots['female']?.toString() ?? '', bold: true),
              _tc(tots['total']?.toString() ?? '', bold: true),
            ]),
        ],
      ),
    ]);
  } catch (_) {
    return _PropField('Participants', raw);
  }
}

Widget _buildActivityMatrix(String raw) {
  try {
    final rows = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return const SizedBox.shrink();
    return Table(
      border: TableBorder.all(color: const Color(0xFFDDE3ED), width: 0.8),
      columnWidths: const {0: FixedColumnWidth(56), 1: FixedColumnWidth(72), 2: FlexColumnWidth(2), 3: FlexColumnWidth(2)},
      children: [
        TableRow(decoration: const BoxDecoration(color: Color(0xFFF8F9FA)), children: [
          _tc('Day', bold: true), _tc('Time', bold: true), _tc('Activity', bold: true), _tc('Speaker/Facilitator', bold: true),
        ]),
        for (final r in rows)
          TableRow(children: [
            _tc(r['day']?.toString() ?? ''),
            _tc(r['time']?.toString() ?? ''),
            _tc(r['event']?.toString() ?? ''),
            _tc(r['speaker']?.toString() ?? ''),
          ]),
      ],
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildBudgetTable(String raw, List<String> keys) {
  try {
    final rows = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return const SizedBox.shrink();
    final labels = <String, String>{
      'item': 'Item', 'quantity': 'Qty', 'cost': 'Cost',
      'total': 'Total', 'participants': 'Participants', 'cost_per_day': 'Cost/Day',
    };
    return Table(
      border: TableBorder.all(color: const Color(0xFFDDE3ED), width: 0.8),
      defaultColumnWidth: const FlexColumnWidth(1),
      children: [
        TableRow(decoration: const BoxDecoration(color: Color(0xFFF8F9FA)), children: [
          for (final k in keys) _tc(labels[k] ?? k, bold: true),
        ]),
        for (final r in rows)
          TableRow(children: [
            for (final k in keys) _tc(r[k]?.toString() ?? ''),
          ]),
      ],
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildCommitteeList(String raw) {
  try {
    final members = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: members.map((m) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('• ', style: TextStyle(fontSize: 12, color: Color(0xFF718096))),
          Expanded(child: Text(
            '${m['name'] ?? ''}'
            '${(m['designation'] ?? '').toString().isNotEmpty ? ' — ${m['designation']}' : ''}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)),
          )),
        ]),
      )).toList(),
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildTwgGroups(String raw) {
  try {
    final list = jsonDecode(raw) as List;
    final sections = <Widget>[];
    for (final group in list) {
      final g = group as Map<String, dynamic>;
      final title = g['title']?.toString() ?? '';
      final members = (g['members'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (title.isNotEmpty) {
        sections.add(Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 4),
          child: Text(title,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                  color: Color(0xFF718096), letterSpacing: 0.3)),
        ));
      }
      for (final m in members) {
        final name  = m['name']?.toString() ?? '';
        final desig = m['designation']?.toString() ?? '';
        sections.add(Padding(
          padding: const EdgeInsets.only(bottom: 3, left: 8),
          child: Text('• $name${desig.isNotEmpty ? ' — $desig' : ''}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568))),
        ));
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: sections);
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildIndicators(String raw) {
  try {
    final list = jsonDecode(raw) as List;
    final items = list
        .asMap()
        .entries
        .map((e) {
          final label = (e.value as Map<String, dynamic>)['label']?.toString() ?? '';
          return '${e.key + 1}. $label';
        })
        .where((s) => s.trim().length > 3)
        .toList();
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: items.map((s) => Padding(
        padding: const EdgeInsets.only(bottom: 3),
        child: Text(s, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568))),
      )).toList(),
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _tc(String text, {bool bold = false}) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: Text(text,
          style: TextStyle(
              fontSize: 11,
              fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
              color: bold ? const Color(0xFF1A1A2E) : const Color(0xFF4A5568))),
    );

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

// ─── Proposal Detail Widgets ──────────────────────────────────────────────────

class _PropMeta extends StatelessWidget {
  final IconData icon;
  final String   text;
  const _PropMeta(this.icon, this.text);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(children: [
      Icon(icon, size: 14, color: const Color(0xFF718096)),
      const SizedBox(width: 6),
      Expanded(child: Text(text,
          style: const TextStyle(fontSize: 12, color: Color(0xFF718096)))),
    ]),
  );
}

class _ProposalSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _ProposalSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
        decoration: BoxDecoration(
            color: const Color(0xFF1E2126),
            borderRadius: BorderRadius.circular(6)),
        child: Text(title,
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: Colors.white, letterSpacing: 0.4)),
      ),
      ...children,
      const SizedBox(height: 16),
    ]);
  }
}

class _PropField extends StatelessWidget {
  final String  label;
  final dynamic value;
  const _PropField(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final v = value?.toString() ?? '';
    if (v.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                color: Color(0xFF718096))),
        const SizedBox(height: 2),
        Text(v, style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E), height: 1.45)),
      ]),
    );
  }
}

class _PropBody extends StatelessWidget {
  final String text;
  const _PropBody(this.text);

  @override
  Widget build(BuildContext context) {
    if (text.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E), height: 1.55)),
    );
  }
}

class _PropBullets extends StatelessWidget {
  final String text;
  const _PropBullets(this.text);

  @override
  Widget build(BuildContext context) {
    final lines = text.split('\n').where((l) => l.trim().isNotEmpty).toList();
    if (lines.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.map((l) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('• ', style: TextStyle(fontSize: 13, color: Color(0xFF718096))),
          Expanded(child: Text(l.trim(),
              style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E), height: 1.45))),
        ]),
      )).toList(),
    );
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

class _Dot extends StatelessWidget {
  const _Dot();
  @override
  Widget build(BuildContext context) => Container(
        width: 5, height: 5,
        decoration: const BoxDecoration(color: Color(0xFF48BB78), shape: BoxShape.circle),
      );
}

class _SideCalendar extends StatelessWidget {
  final DateTime focusedDay; final DateTime? selectedDay;
  final Map<DateTime, List<_CalEvent>> eventsByDay;
  final Function(DateTime, DateTime) onDaySelected;
  final Function(DateTime) onPageChanged;
  const _SideCalendar({required this.focusedDay, required this.selectedDay,
      required this.eventsByDay, required this.onDaySelected, required this.onPageChanged});

  List<_CalEvent> _eventsFor(DateTime day) =>
      eventsByDay[DateTime(day.year, day.month, day.day)] ?? const [];

  // Hover tooltip text: title · when · where for each event on the day.
  String _tooltipText(List<_CalEvent> events) => events.map((e) {
        final when = (e.raw['target_date'] ?? '').toString().trim();
        final where = (e.raw['venue'] ?? '').toString().trim();
        final lines = <String>[e.title];
        if (when.isNotEmpty) lines.add('When: $when');
        if (where.isNotEmpty) lines.add('Where: $where');
        return lines.join('\n');
      }).join('\n\n');

  // A single day cell rendered to match the original calendarStyle, wrapped in
  // a hover Tooltip when the day has events.
  Widget _dayCell(DateTime day, {Color? bg, required Color textColor, bool bold = false}) {
    final events = _eventsFor(day);
    Widget cell = Container(
      margin: const EdgeInsets.all(4),
      alignment: Alignment.center,
      decoration: bg != null ? BoxDecoration(color: bg, shape: BoxShape.circle) : null,
      child: Stack(alignment: Alignment.center, children: [
        Text('${day.day}',
            style: TextStyle(fontSize: 13, color: textColor,
                fontWeight: bold ? FontWeight.w600 : FontWeight.w400)),
        if (events.isNotEmpty)
          const Positioned(bottom: 1, child: _Dot()),
      ]),
    );
    if (events.isEmpty) return cell;
    return Tooltip(
      message: _tooltipText(events),
      waitDuration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      margin: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(8),
      ),
      textStyle: const TextStyle(color: Colors.white, fontSize: 11.5, height: 1.4),
      child: cell,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.only(bottom: 8),
      child: TableCalendar(
        firstDay: DateTime(2020), lastDay: DateTime(2030), focusedDay: focusedDay,
        selectedDayPredicate: (day) => isSameDay(selectedDay, day),
        onDaySelected: onDaySelected, onPageChanged: onPageChanged,
        availableCalendarFormats: const {CalendarFormat.month: 'Month'},
        calendarBuilders: CalendarBuilders(
          defaultBuilder: (_, day, __) =>
              _dayCell(day, textColor: const Color(0xFF1A1A2E)),
          todayBuilder: (_, day, __) => _dayCell(day,
              bg: const Color(0xFFACC2DF), textColor: Colors.white, bold: true),
          selectedBuilder: (_, day, __) => _dayCell(day,
              bg: const Color(0xFF1E2126), textColor: Colors.white, bold: true),
        ),
        calendarStyle: const CalendarStyle(
          todayDecoration: BoxDecoration(color: Color(0xFFACC2DF), shape: BoxShape.circle),
          todayTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          selectedDecoration: BoxDecoration(color: Color(0xFF1E2126), shape: BoxShape.circle),
          selectedTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          defaultTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          weekendTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          outsideDaysVisible: false,
          cellMargin: EdgeInsets.all(4),
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