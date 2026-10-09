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
import '../widgets/school_year_picker.dart';
import '../models/models.dart' show SchoolYearFilter;

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
  /// When set (e.g. from the dashboard: /events?open=12), that event is
  /// scrolled into view, highlighted, and its details opened once loaded.
  final int? openEventId;
  const EventManagementScreen({super.key, required this.onAddEvent, this.openEventId});

  @override
  State<EventManagementScreen> createState() => _EventManagementScreenState();
}

class _EventManagementScreenState extends State<EventManagementScreen> {
  int       _selectedTab = 0;
  DateTime  _focusedDay  = DateTime.now();
  DateTime? _selectedDay;
  bool      _isLoading   = true;
  List<_CalEvent> _events = [];
  int? _highlightId;
  final Map<int, GlobalKey> _cardKeys = {};
  // Current school year by default; earlier years are archived.
  SchoolYearFilter _filter = SchoolYearFilter.current;

  @override
  void initState() {
    super.initState();
    _loadEvents().then((_) => _openRequestedEvent());
  }

  void _openRequestedEvent() {
    final id = widget.openEventId;
    if (id == null || !mounted) return;
    final matches = _events.where((e) => e.id == id);
    if (matches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('That event is no longer available.')));
      return;
    }
    final event = matches.first;
    setState(() { _highlightId = id; _selectedTab = 0; });
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final ctx = _cardKeys[id]?.currentContext;
      if (ctx != null) {
        await Scrollable.ensureVisible(ctx,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOutCubic, alignment: 0.2);
      }
      if (!mounted) return;
      _openDetail(event);
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted && _highlightId == id) setState(() => _highlightId = null);
      });
    });
  }

  /// Details popup with the actions that fit the event's status.
  void _openDetail(_CalEvent e) {
    switch (e.status) {
      case _EventStatus.approved:
        _showEventDetail(context, e,
            canManage: false, canApprove: false, isPrincipal: _isPrincipal);
        break;
      case _EventStatus.disabled:
        _showEventDetail(context, e,
            canManage: _canManage, isPrincipal: _isPrincipal);
        break;
      default:
        _showEventDetail(context, e,
            canManage: _canManage,
            canApprove: _canApprove,
            isPrincipal: _isPrincipal,
            onApprove: () => _approve(e),
            onDisable: () => _confirmDisable(context, e));
    }
  }

  /// Keys the card for scrolling and outlines it while highlighted.
  Widget _trackable(_CalEvent e, Widget card) {
    if (e.id == null) return card;
    final on = e.id == _highlightId;
    return AnimatedContainer(
      key: _cardKeys.putIfAbsent(e.id!, () => GlobalKey()),
      duration: const Duration(milliseconds: 300),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: on ? const Color(0xFF2563EB) : Colors.transparent, width: 2),
        boxShadow: on
            ? [BoxShadow(color: const Color(0xFF2563EB).withValues(alpha: 0.18),
                blurRadius: 12, spreadRadius: 2)]
            : const [],
      ),
      child: card,
    );
  }

  Future<void> _loadEvents() async {
    try {
      final data = await ApiService.getEvents(
          schoolYear: _filter.schoolYear == 'current' ? null : _filter.schoolYear);
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

  // Permissions come from the backend, which enforces them on every action.
  bool get _canManage => context.read<AppState>().can('manage_events');

  bool get _canApprove => context.read<AppState>().can('approve_events');

  // Oversight-only accounts (approve but don't propose events).
  bool get _isPrincipal => _canApprove && !_canManage;

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
        Wrap(
          spacing: 8,
          runSpacing: 10,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _Tab(label: 'All Events', active: _selectedTab == 0,
                onTap: () => setState(() => _selectedTab = 0)),
            if (!_isPrincipal)
              _Tab(label: 'My Events', active: _selectedTab == 1,
                  onTap: () => setState(() => _selectedTab = 1)),
            SchoolYearPicker(
              value: _filter,
              onChanged: (f) { setState(() => _filter = f); _loadEvents(); },
            ),
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
          ..._forStatus(_EventStatus.approved).map((e) => _trackable(e, _EventCard(
                event: e,
                canManage: false,
                canApprove: false,
                isPrincipal: _isPrincipal,
                onEdit: () {},
                onDisable: () {},
                onApprove: () {},
                onPrint: () => EventPrintHelper.printEvent(context, e.raw),
                onTap: () => _openDetail(e),
              ))),
          const SizedBox(height: 20),
        ],

        // Pending approval events
        if (_forStatus(_EventStatus.pendingApproval).isNotEmpty) ...[
          _sectionLabel('Pending Approval'),
          const SizedBox(height: 10),
          ..._forStatus(_EventStatus.pendingApproval).map((e) => _trackable(e, _EventCard(
                event: e,
                canManage: _canManage,
                canApprove: _canApprove,
                isPrincipal: _isPrincipal,
                onEdit: () => _editEvent(e),
                onDisable: () => _confirmDisable(context, e),
                onApprove: () => _approve(e),
                onPrint: () => EventPrintHelper.printEvent(context, e.raw),
                onTap: () => _openDetail(e),
              ))),
          const SizedBox(height: 20),
        ],

        // Disabled events
        if (_disabledEvents.isNotEmpty && _selectedTab == 0) ...[
          _sectionLabel('Disabled Events'),
          const SizedBox(height: 10),
          ..._disabledEvents.map((e) => _trackable(e, _DisabledEventCard(
                event: e,
                canManage: _canManage,
                onEnable: () => _enable(e),
                onPrint: () => EventPrintHelper.printEvent(context, e.raw),
                onTap: () => _openDetail(e),
              ))),
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
