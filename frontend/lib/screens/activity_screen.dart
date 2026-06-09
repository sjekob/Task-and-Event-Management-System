import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../widgets/skeleton_widgets.dart';
import '../services/api_service.dart';

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;
  String? _error;
  DateTime _focusedDay  = DateTime.now();
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.getEvents();
      if (mounted) setState(() { _events = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _viewEvent(Map<String, dynamic> ev) {
    showDialog(
      context: context,
      builder: (_) => _EventDetailDialog(event: ev),
    );
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'approved': return const Color(0xFF15803D);
      case 'disabled': return const Color(0xFF6B7280);
      default: return const Color(0xFF92400E);
    }
  }

  Color _statusBg(String? status) {
    switch (status) {
      case 'approved': return AppTheme.greenBg;
      case 'disabled': return AppTheme.borderColor;
      default: return AppTheme.amberBg;
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'approved': return 'Approved';
      case 'disabled': return 'Disabled';
      case 'pending_approval': return 'Pending Approval';
      default: return status ?? 'Unknown';
    }
  }

  Set<DateTime> get _eventDays => _events
      .map((e) {
        try {
          final d = DateTime.parse(e['target_date'].toString());
          return DateTime(d.year, d.month, d.day);
        } catch (_) {
          return DateTime.now();
        }
      })
      .toSet();

  @override
  Widget build(BuildContext context) {
    if (_loading) return const ActivitySkeleton();
    final isMobile = MediaQuery.of(context).size.width < 768;

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(isMobile ? 14 : 24, 0, isMobile ? 14 : 24, 24),
      child: Column(
        children: [
          const SizedBox(height: 4),
          const AppBanner(
            title: 'Activity Calendar',
            subtitle: 'View all scheduled events and activities.',
          ),
          const SizedBox(height: 20),

          // ── Main content + side calendar (desktop) ──
          if (!isMobile)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _buildEventList()),
                const SizedBox(width: 20),
                SizedBox(
                  width: 290,
                  child: _buildCalendar(),
                ),
              ],
            )
          else ...[
            _buildEventList(),
            const SizedBox(height: 20),
            _buildCalendar(),
          ],
        ],
      ),
    );
  }

  Widget _buildEventList() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Upcoming Events', style: AppTheme.heading3),
              const Spacer(),
              IconButton(
                onPressed: _load,
                icon: const Icon(Icons.refresh, size: 18),
                tooltip: 'Refresh',
                color: AppTheme.textMuted,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_error != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline, color: AppTheme.redColor, size: 36),
                    const SizedBox(height: 8),
                    Text('Failed to load events', style: AppTheme.labelMd),
                    const SizedBox(height: 4),
                    Text(_error!, style: AppTheme.bodyMd, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          else if (_events.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    const Icon(Icons.event_busy, color: AppTheme.textLight, size: 40),
                    const SizedBox(height: 8),
                    Text('No events yet', style: AppTheme.bodyMd),
                  ],
                ),
              ),
            )
          else
            ...(_events.map((e) {
              final status = e['status'] as String?;
              return InkWell(
                onTap: () => _viewEvent(e),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: AppTheme.borderColor)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.event_note, size: 16, color: AppTheme.textLight),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e['title'] as String? ?? 'Untitled',
                              style: AppTheme.labelMd,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                if (e['target_date'] != null) ...[
                                  const Icon(Icons.calendar_today, size: 11, color: AppTheme.textLight),
                                  const SizedBox(width: 3),
                                  Text(
                                    _formatDate(e['target_date'] as String),
                                    style: AppTheme.bodySm,
                                  ),
                                ],
                                if (e['venue'] != null && e['venue'].toString().isNotEmpty) ...[
                                  const SizedBox(width: 8),
                                  const Icon(Icons.location_on, size: 11, color: AppTheme.textLight),
                                  const SizedBox(width: 3),
                                  Flexible(
                                    child: Text(
                                      e['venue'] as String,
                                      style: AppTheme.bodySm,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _statusBg(status),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              _statusLabel(status),
                              style: AppTheme.labelSm.copyWith(color: _statusColor(status)),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.chevron_right, size: 14, color: AppTheme.textLight),
                              Text('View details', style: AppTheme.caption),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            })),
        ],
      ),
    );
  }

  Widget _buildCalendar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppTheme.cardShadow,
      ),
      padding: const EdgeInsets.only(bottom: 8),
      child: TableCalendar(
        firstDay: DateTime(2020),
        lastDay: DateTime(2030),
        focusedDay: _focusedDay,
        selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
        eventLoader: (day) =>
            _eventDays.any((e) => isSameDay(e, day)) ? [Object()] : [],
        onDaySelected: (sel, foc) => setState(() {
          _selectedDay = sel;
          _focusedDay = foc;
        }),
        onPageChanged: (foc) => setState(() => _focusedDay = foc),
        availableCalendarFormats: const {CalendarFormat.month: 'Month'},
        calendarStyle: const CalendarStyle(
          todayDecoration: BoxDecoration(
              color: Color(0xFFACC2DF), shape: BoxShape.circle),
          todayTextStyle: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          selectedDecoration: BoxDecoration(
              color: Color(0xFF1E2126), shape: BoxShape.circle),
          selectedTextStyle: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          defaultTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          weekendTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          outsideDaysVisible: false,
          markerDecoration: BoxDecoration(
              color: Color(0xFF48BB78), shape: BoxShape.circle),
          markerSize: 5,
          markersMaxCount: 1,
          cellMargin: EdgeInsets.all(4),
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: false,
          titleCentered: true,
          headerPadding: const EdgeInsets.symmetric(vertical: 12),
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

  String _formatDate(String raw) {
    try {
      final d = DateTime.parse(raw);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return raw;
    }
  }

  String _monthName(int month) {
    const months = ['','January','February','March','April','May','June',
        'July','August','September','October','November','December'];
    return months[month];
  }
}

// ── Event Detail Dialog ──────────────────────────────────────────────────────

class _EventDetailDialog extends StatelessWidget {
  final Map<String, dynamic> event;
  const _EventDetailDialog({required this.event});

  List<String> _parseCommittee(dynamic val) {
    if (val == null) return [];
    try {
      final decoded = jsonDecode(val.toString());
      if (decoded is List) {
        if (decoded.isEmpty) return [];
        return decoded.map((e) {
          if (e is Map) {
            final name = e['name'] ?? '';
            final pos = e['position'] ?? e['role'] ?? '';
            return pos.toString().isNotEmpty ? '$name – $pos' : name.toString();
          }
          return e.toString();
        }).where((s) => s.isNotEmpty).toList();
      }
    } catch (_) {}
    final s = val.toString().trim();
    return s.isEmpty || s == '[]' ? [] : [s];
  }

  bool _hasVal(dynamic v) {
    if (v == null) return false;
    final s = v.toString().trim();
    return s.isNotEmpty && s != '[]' && s != '{}';
  }

  String _formatDate(dynamic raw) {
    if (raw == null) return '';
    try {
      final d = DateTime.parse(raw.toString());
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return raw.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = event['status'] as String?;
    final execCommittee = _parseCommittee(event['exec_committee']);
    final twgGroups = _parseCommittee(event['twg_groups']);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Header ──
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
              decoration: const BoxDecoration(
                color: AppTheme.darkBanner,
                borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.event, color: Colors.white70, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      event['title'] as String? ?? 'Event Details',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _StatusChip(status: status),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Colors.white70, size: 18),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
            // ── Body ──
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_hasVal(event['target_date'])) ...[
                      _DetailRow(
                        icon: Icons.calendar_today,
                        label: 'Date',
                        value: _formatDate(event['target_date']),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_hasVal(event['venue'])) ...[
                      _DetailRow(
                        icon: Icons.location_on_outlined,
                        label: 'Place',
                        value: event['venue'] as String,
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (execCommittee.isNotEmpty) ...[
                      const Divider(color: AppTheme.borderColor, height: 24),
                      _ListSection(
                        icon: Icons.supervised_user_circle_outlined,
                        label: 'Supervising Committee',
                        items: execCommittee,
                      ),
                    ],
                    if (twgGroups.isNotEmpty) ...[
                      const Divider(color: AppTheme.borderColor, height: 24),
                      _ListSection(
                        icon: Icons.groups_outlined,
                        label: 'Program Implementation Committee',
                        items: twgGroups,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            // ── Footer ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppTheme.borderColor)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Close'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Helper Widgets ───────────────────────────────────────────────────────────

class _StatusChip extends StatelessWidget {
  final String? status;
  const _StatusChip({this.status});

  @override
  Widget build(BuildContext context) {
    Color bg, fg;
    String label;
    switch (status) {
      case 'approved':
        bg = AppTheme.greenBg; fg = const Color(0xFF15803D); label = 'Approved';
        break;
      case 'disabled':
        bg = AppTheme.borderColor; fg = AppTheme.textMuted; label = 'Disabled';
        break;
      default:
        bg = AppTheme.amberBg; fg = const Color(0xFF92400E); label = 'Pending Approval';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: AppTheme.labelSm.copyWith(color: fg, fontSize: 11)),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _DetailRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 16, color: AppTheme.textLight),
      const SizedBox(width: 10),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTheme.caption),
          const SizedBox(height: 2),
          Text(value, style: AppTheme.labelMd),
        ],
      ),
    ],
  );
}

class _ListSection extends StatelessWidget {
  final IconData icon;
  final String label;
  final List<String> items;
  const _ListSection({required this.icon, required this.label, required this.items});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Icon(icon, size: 16, color: AppTheme.textLight),
          const SizedBox(width: 8),
          Text(label, style: AppTheme.caption),
        ],
      ),
      const SizedBox(height: 8),
      ...items.map((item) => Padding(
        padding: const EdgeInsets.only(left: 24, bottom: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('• ', style: TextStyle(fontSize: 13)),
            Expanded(child: Text(item, style: AppTheme.labelMd)),
          ],
        ),
      )),
    ],
  );
}