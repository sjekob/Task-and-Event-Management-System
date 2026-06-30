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
import '../utils/date_parse.dart';
import '../widgets/skeleton_widgets.dart';

part 'event_management_screen_widgets.dart';

enum _EventStatus { approved, pendingApproval, disabled, draft }

class _CalEvent {
  final int?         id;
  final String       title;
  final String       description;
  final _EventStatus status;
  final DateTime?    date;   // null when target_date can't be parsed
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

// Returns null (not "today") when the date can't be parsed, so undated events
// don't get a calendar dot on the current day.
DateTime? _parseDate(String? raw) => parseEventDate(raw);

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
      final d = e.date;
      if (d == null) continue; // undated → no calendar marker
      final key = DateTime(d.year, d.month, d.day);
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
