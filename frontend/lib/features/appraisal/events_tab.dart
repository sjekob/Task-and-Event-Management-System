import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/theme.dart';
import '../../core/api_service.dart';

import 'models/appraisal_models.dart';

// ── Rubric meta ───────────────────────────────────────────────────────────────
const _kCriteria = [
  _Criterion(key: 'planning',    label: 'Event Planning & Organization', icon: Icons.event_note_outlined,     color: Color(0xFF10B981)),
  _Criterion(key: 'objectives',  label: 'Achievement of Objectives',     icon: Icons.flag_outlined,            color: Color(0xFF8B5CF6)),
  _Criterion(key: 'personnel',   label: 'Personnel Performance',         icon: Icons.person_outline,           color: Color(0xFF3B82F6)),
  _Criterion(key: 'timeMgmt',    label: 'Time Management',               icon: Icons.schedule_outlined,        color: Color(0xFFEC4899)),
  _Criterion(key: 'engagement',  label: 'Participant Engagement',        icon: Icons.group_outlined,           color: Color(0xFFF59E0B)),
  _Criterion(key: 'resource',    label: 'Resource Management',           icon: Icons.inventory_2_outlined,     color: Color(0xFF64748B)),
];

class _Criterion {
  final String key;
  final String label;
  final IconData icon;
  final Color color;
  const _Criterion({required this.key, required this.label, required this.icon, required this.color});
}

// ─────────────────────────────────────────────────────────────────────────────
// EventsTab
// ─────────────────────────────────────────────────────────────────────────────

class EventsTab extends StatefulWidget {
  final Widget pageHeader;
  final String username;
  final String role;
  final Map<String, List<AttendeeRating>> newRatings;
  final List<SchoolEvent> backendEvents;
  final void Function(String id, AttendeeRating rating) onSubmitRating;
  final Future<void> Function()? onRefresh;

  const EventsTab({
    super.key,
    required this.pageHeader,
    required this.username,
    required this.role,
    required this.newRatings,
    this.backendEvents = const [],
    required this.onSubmitRating,
    this.onRefresh,
  });

  @override
  State<EventsTab> createState() => _EventsTabState();
}

class _EventsTabState extends State<EventsTab> {
  String _filterMode = 'all';
  String? _selectedEvent;

  @override
  void initState() {
    super.initState();
  }

  @override
  void didUpdateWidget(EventsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Force UI rebuild whenever ratings data changes
    if (oldWidget.newRatings != widget.newRatings) {
      setState(() {});
    }
  }

  List<SchoolEvent> _eventsWithNewRatings(List<SchoolEvent> base) {
    return base.map((e) {
      final extra = widget.newRatings[e.id] ?? [];
      if (extra.isEmpty) return e;
      final newRatings = [...e.ratings, ...extra];
      final newStatus = EventStatus.rated;
      return SchoolEvent(
        id: e.id, name: e.name, date: e.date,
        organizer: e.organizer, department: e.department,
        attendees: e.attendees,
        ratings: newRatings,
        status: newStatus,
      );
    }).toList();
  }

  List<SchoolEvent> get _filtered {
    final baseEvents = widget.backendEvents.isNotEmpty ? widget.backendEvents : sampleEvents;
    final all = _eventsWithNewRatings(baseEvents);
    if (_filterMode == 'event' && _selectedEvent != null) {
      return all.where((e) => e.name == _selectedEvent).toList();
    }
    return all;
  }

  int get _pendingCount  => _filtered.where((e) => e.status == EventStatus.awaitingRatings).length;
  int get _ratedCount    => _filtered.where((e) => e.status == EventStatus.rated || e.status == EventStatus.flagged).length;


  String get _avgEvidencyRate {
    final s = _filtered.where((e) => e.avgRating != null).map((e) => e.avgRating!);
    if (s.isEmpty) return '—';
    final avgScore = s.reduce((a, b) => a + b) / s.length;
    final rate = ((avgScore - 1) / 4.0).clamp(0.0, 1.0) * 100.0;
    return '${rate.toStringAsFixed(0)}%';
  }

  Color get _avgEvidencyColor {
    final s = _filtered.where((e) => e.avgRating != null).map((e) => e.avgRating!);
    if (s.isEmpty) return AppColors.textPrimary;
    final avgScore = s.reduce((a, b) => a + b) / s.length;
    final rate = ((avgScore - 1) / 4.0).clamp(0.0, 1.0) * 100.0;
    if (rate >= 80.0) return const Color(0xFF16A34A);
    if (rate >= 50.0) return const Color(0xFFEA580C);
    return const Color(0xFFEF4444);
  }

  List<String> get _eventNames {
    final baseEvents = widget.backendEvents.isNotEmpty ? widget.backendEvents : sampleEvents;
    return baseEvents.map((e) => e.name).toSet().toList()..sort();
  }

  Widget _buildEvaluationInfoCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC), // Neutral clean background
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.info_outline_rounded, color: Color(0xFF64748B), size: 18),
              const SizedBox(width: 8),
              const Text(
                'Evidency Rate Legend',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF334155),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final bool isMobile = constraints.maxWidth < 600;
              if (isMobile) {
                return Column(
                  children: [
                    _buildColorInfoBadge(const Color(0xFF16A34A), 'Green', 'High (≥ 80%)'),
                    const SizedBox(height: 8),
                    _buildColorInfoBadge(const Color(0xFFEA580C), 'Yellow', 'Mid (50% - 79%)'),
                    const SizedBox(height: 8),
                    _buildColorInfoBadge(const Color(0xFFEF4444), 'Red', 'Low (< 50%)'),
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(child: _buildColorInfoBadge(const Color(0xFF16A34A), 'Green', 'High (≥ 80%)')),
                  const SizedBox(width: 12),
                  Expanded(child: _buildColorInfoBadge(const Color(0xFFEA580C), 'Yellow', 'Mid (50% - 79%)')),
                  const SizedBox(width: 12),
                  Expanded(child: _buildColorInfoBadge(const Color(0xFFEF4444), 'Red', 'Low (< 50%)')),
                ],
              );
            }
          ),
        ],
      ),
    );
  }

  Widget _buildColorInfoBadge(Color color, String label, String description) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE5E7EB), width: 0.8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 3),
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 12, color: Color(0xFF4B5563), height: 1.3, fontFamily: 'Inter'),
                children: [
                  TextSpan(
                    text: '$label: ',
                    style: TextStyle(fontWeight: FontWeight.bold, color: color),
                  ),
                  TextSpan(text: description),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openViewResults(BuildContext ctx, SchoolEvent event) {
    showDialog<void>(
      context: ctx,
      builder: (_) => _EventViewResultsDialog(event: event),
    );
  }

  void _openRateEvent(BuildContext ctx, SchoolEvent event) {
    showDialog<AttendeeRating?>(
      context: ctx,
      builder: (_) => _ObservationToolDialog(event: event, username: widget.username, role: widget.role),
    ).then((rating) {
      if (rating != null) {
        widget.onSubmitRating(event.id, rating);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Evaluation submitted successfully'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    });
  }

  void _openEvaluationOptions(BuildContext ctx, SchoolEvent event) {
    showDialog<void>(
      context: ctx,
      builder: (_) => _EventEvaluationMethodDialog(
        event: event,
        username: widget.username,
        role: widget.role,
        onRefresh: widget.onRefresh,
        onSubmitRating: (id, rating) {
          widget.onSubmitRating(id, rating);
          setState(() {});
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.role == 'coordinator') {
      return SingleChildScrollView(
        child: _buildCoordinatorView(context),
      );
    }

    return SingleChildScrollView(
      child: Column(
        children: [
          widget.pageHeader,
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Stat cards ──────────────────────────────────────────────
                 // ── Stat cards ──────────────────────────────────────────────
                Builder(
                  builder: (context) {
                    final bool isMobile = MediaQuery.of(context).size.width < 640;
                    if (isMobile) {
                      return Column(
                        children: [
                          Row(
                            children: [
                              Expanded(child: _StatCard(
                                label: 'Total Events',
                                value: '${_filtered.length}',
                                valueColor: AppColors.textPrimary,
                                icon: Icons.event_note,
                                iconColor: AppColors.textSecondary,
                                subtitle: '${_filtered.length} total · $_pendingCount awaiting ratings',
                              )),
                              const SizedBox(width: 12),
                              Expanded(child: _StatCard(
                                label: 'Rated Events', 
                                value: '$_ratedCount',
                                valueColor: AppColors.success, 
                                icon: Icons.assignment_turned_in_outlined, 
                                iconColor: AppColors.success,
                              )),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _StatCard(
                            label: 'Avg Evidency Rate', 
                            value: _avgEvidencyRate,
                            valueColor: _avgEvidencyColor, 
                            icon: Icons.percent_rounded, 
                            iconColor: _avgEvidencyColor,
                          ),
                        ],
                      );
                    }
                    return Row(children: [
                      Expanded(child: _StatCard(
                        label: 'Total Events',
                        value: '${_filtered.length}',
                        valueColor: AppColors.textPrimary,
                        icon: Icons.event_note,
                        iconColor: AppColors.textSecondary,
                        subtitle: '${_filtered.length} total · $_pendingCount awaiting ratings',
                      )),
                      const SizedBox(width: 14),
                      Expanded(child: _StatCard(
                        label: 'Rated Events', 
                        value: '$_ratedCount',
                        valueColor: AppColors.success, 
                        icon: Icons.assignment_turned_in_outlined, 
                        iconColor: AppColors.success,
                      )),
                      const SizedBox(width: 14),
                      Expanded(child: _StatCard(
                        label: 'Avg Evidency Rate', 
                        value: _avgEvidencyRate,
                        valueColor: _avgEvidencyColor, 
                        icon: Icons.percent_rounded, 
                        iconColor: _avgEvidencyColor,
                      )),
                    ]);
                  }
                ),

                const SizedBox(height: 18),
                _buildEvaluationInfoCard(),
                const SizedBox(height: 18),

                // ── Table card ───────────────────────────────────────────────
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.cardBorder, width: 0.8),
                  ),
                  child: Column(
                    children: [
                      // Header row
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 16, 0),
                        child: Builder(
                          builder: (context) {
                            final isMobile = MediaQuery.of(context).size.width < 640;
                            if (isMobile) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Event Evaluations', style: AppTextStyles.sectionTitle),
                                  const SizedBox(height: 12),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      _StyledDropdown(
                                        value: _filterMode,
                                        leadingIcon: Icons.tune_rounded,
                                        items: const [
                                          _DropItem(value: 'all',   label: 'Show All'),
                                          _DropItem(value: 'event', label: 'By Event'),
                                        ],
                                        onChanged: (v) => setState(() { _filterMode = v!; _selectedEvent = null; }),
                                      ),
                                      if (_filterMode == 'event')
                                        _StyledDropdown(
                                          value: _selectedEvent,
                                          hint: 'All Events',
                                          items: _eventNames.map((n) => _DropItem(value: n, label: n)).toList(),
                                          onChanged: (v) => setState(() => _selectedEvent = v),
                                        ),
                                    ],
                                  ),
                                ],
                              );
                            }
                            return Row(
                              children: [
                                const Text('Event Evaluations', style: AppTextStyles.sectionTitle),
                                const Spacer(),
                                _StyledDropdown(
                                  value: _filterMode,
                                  leadingIcon: Icons.tune_rounded,
                                  items: const [
                                    _DropItem(value: 'all',   label: 'Show All'),
                                    _DropItem(value: 'event', label: 'By Event'),
                                  ],
                                  onChanged: (v) => setState(() { _filterMode = v!; _selectedEvent = null; }),
                                ),
                                if (_filterMode == 'event') ...[
                                  const SizedBox(width: 8),
                                  _StyledDropdown(
                                    value: _selectedEvent,
                                    hint: 'All Events',
                                    items: _eventNames.map((n) => _DropItem(value: n, label: n)).toList(),
                                    onChanged: (v) => setState(() => _selectedEvent = v),
                                  ),
                                ],
                              ],
                            );
                          }
                        ),
                      ),
                      const SizedBox(height: 14),
                      _EventsTable(
                        events: _filtered,
                        role: widget.role,
                        onViewResults: (e) => _openViewResults(context, e),
                        onRateEvent:   (e) => _openRateEvent(context, e),
                        onShowQr:      (e) => _openEvaluationOptions(context, e),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoordinatorView(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.pageHeader,
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stat cards
              Builder(
                builder: (context) {
                  final bool isMobile = MediaQuery.of(context).size.width < 640;
                  if (isMobile) {
                    return Column(
                      children: [
                        Row(
                          children: [
                            Expanded(child: _CoordinatorStatCard(
                              label: 'Total Events',
                              value: '${_filtered.length}',
                              valueColor: const Color(0xFF475569),
                              icon: Icons.event_note,
                              iconColor: const Color(0xFF94A3B8),
                              subtitle: '${_filtered.length} total · $_pendingCount awaiting ratings',
                            )),
                            const SizedBox(width: 12),
                            Expanded(child: _CoordinatorStatCard(
                              label: 'Rated Events', 
                              value: '$_ratedCount', 
                              valueColor: const Color(0xFF10B981), 
                              icon: Icons.assignment_turned_in_outlined, 
                              iconColor: const Color(0xFF10B981),
                            )),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _CoordinatorStatCard(
                          label: 'Avg Evidency Rate', 
                          value: _avgEvidencyRate, 
                          valueColor: _avgEvidencyColor, 
                          icon: Icons.percent_rounded, 
                          iconColor: _avgEvidencyColor,
                        ),
                      ],
                    );
                  }
                  return Row(children: [
                    Expanded(child: _CoordinatorStatCard(
                      label: 'Total Events',
                      value: '${_filtered.length}',
                      valueColor: const Color(0xFF475569),
                      icon: Icons.event_note,
                      iconColor: const Color(0xFF94A3B8),
                      subtitle: '${_filtered.length} total · $_pendingCount awaiting ratings',
                    )),
                    const SizedBox(width: 14),
                    Expanded(child: _CoordinatorStatCard(
                      label: 'Rated Events', 
                      value: '$_ratedCount', 
                      valueColor: const Color(0xFF10B981), 
                      icon: Icons.assignment_turned_in_outlined, 
                      iconColor: const Color(0xFF10B981),
                    )),
                    const SizedBox(width: 14),
                    Expanded(child: _CoordinatorStatCard(
                      label: 'Avg Evidency Rate', 
                      value: _avgEvidencyRate, 
                      valueColor: _avgEvidencyColor, 
                      icon: Icons.percent_rounded, 
                      iconColor: _avgEvidencyColor,
                    )),
                  ]);
                }
              ),
              const SizedBox(height: 18),
              _buildEvaluationInfoCard(),
              const SizedBox(height: 18),
              
              // School-wide events table
              _buildSchoolWideEventsTable(context),
            ],
          ),
        ),
      ],
    );
  }



  Widget _buildSchoolWideEventsTable(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 0),
            child: Builder(
              builder: (context) {
                final isMobile = MediaQuery.of(context).size.width < 640;
                if (isMobile) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'School-Wide Events',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          _StyledDropdown(
                            value: _filterMode,
                            leadingIcon: Icons.tune_rounded,
                            items: const [
                              _DropItem(value: 'all',   label: 'Show All'),
                              _DropItem(value: 'event', label: 'By Event'),
                            ],
                            onChanged: (v) => setState(() { _filterMode = v!; _selectedEvent = null; }),
                          ),
                          if (_filterMode == 'event')
                            _StyledDropdown(
                              value: _selectedEvent,
                              hint: 'All Events',
                              items: _eventNames.map((n) => _DropItem(value: n, label: n)).toList(),
                              onChanged: (v) => setState(() => _selectedEvent = v),
                            ),
                        ],
                      ),
                    ],
                  );
                }
                return Row(
                  children: [
                    const Text(
                      'School-Wide Events',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    ),
                    const Spacer(),
                    _StyledDropdown(
                      value: _filterMode,
                      leadingIcon: Icons.tune_rounded,
                      items: const [
                        _DropItem(value: 'all',   label: 'Show All'),
                        _DropItem(value: 'event', label: 'By Event'),
                      ],
                      onChanged: (v) => setState(() { _filterMode = v!; _selectedEvent = null; }),
                    ),
                    if (_filterMode == 'event') ...[
                      const SizedBox(width: 8),
                      _StyledDropdown(
                        value: _selectedEvent,
                        hint: 'All Events',
                        items: _eventNames.map((n) => _DropItem(value: n, label: n)).toList(),
                        onChanged: (v) => setState(() => _selectedEvent = v),
                      ),
                    ],
                  ],
                );
              }
            ),
          ),
          const SizedBox(height: 14),
          const Divider(height: 1),
          // Table Columns Header + Rows inside horizontal scroll view
          LayoutBuilder(
            builder: (context, constraints) {
              final double tableWidth = constraints.maxWidth > 1000 ? constraints.maxWidth : 1000;
              return SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: tableWidth,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Table Columns Header
                      Container(
                        color: const Color(0xFFF8FAFC),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        child: const Row(
                          children: [
                            Expanded(flex: 3, child: Text('EVENT NAME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('DATE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('DEPARTMENT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('ORGANIZER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('RESPONSES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('EVIDENCY RATE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('EVALUATION', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                            Expanded(flex: 2, child: Text('ACTION', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                          ],
                        ),
                      ),
                      // Rows
                      ..._filtered.map((e) {
                        final avg = e.avgRating;
                        final rate = avg != null ? ((avg - 1) / 4.0).clamp(0.0, 1.0) * 100.0 : null;
                        final String rateStr = rate != null ? '${rate.toStringAsFixed(0)}%' : '—';
                        final String responsesStr = '${e.responses} / ${e.attendees}';
                        
                        String statusStr = 'Awaiting Ratings';
                        Color statusColor = const Color(0xFFF59E0B);
                        Color statusBg = const Color(0xFFFEF3C7);
                        
                        if (e.status == EventStatus.rated || e.status == EventStatus.flagged) {
                          statusStr = 'Completed';
                          statusColor = const Color(0xFF16A34A);
                          statusBg = const Color(0xFFDCFCE7);
                        }
                        
                        final bool hasData = e.responses > 0;
                        return _buildEventTableRow(
                          context,
                          e,
                          responsesStr,
                          rateStr,
                          statusStr,
                          statusColor,
                          statusBg,
                          hasData,
                        );
                      }),
                    ],
                  ),
                ),
              );
            }
          ),
        ],
      ),
    );
  }

  Widget _buildEventTableRow(
    BuildContext context,
    SchoolEvent event,
    String responses,
    String rating,
    String status,
    Color statusColor,
    Color statusBg,
    bool hasData,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 0.8)),
      ),
      child: Row(
        children: [
          Expanded(flex: 3, child: Text(event.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)))),
          Expanded(flex: 2, child: Text(event.date, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          Expanded(flex: 2, child: Text(event.department, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          Expanded(flex: 2, child: Text(event.organizer, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          Expanded(flex: 2, child: Text(responses, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B), fontWeight: FontWeight.w500))),
          Expanded(
            flex: 2,
            child: Builder(
              builder: (context) {
                if (rating == '—') return const Text('—', style: TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)));
                final rateVal = double.tryParse(rating.replaceAll('%', '')) ?? 0.0;
                final Color color = rateVal >= 80.0 
                    ? const Color(0xFF16A34A) 
                    : (rateVal >= 50.0 ? const Color(0xFFEA580C) : const Color(0xFFEF4444));
                return Text(
                  rating,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                );
              }
            ),
          ),
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(4)),
                child: Text(
                  status,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor),
                ),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Center(
              child: Builder(
                builder: (context) {
                  final bool isAvailable = _isEventDayOrLater(event.date);
                  return IconButton(
                    icon: Icon(
                      Icons.assignment_outlined,
                      color: isAvailable ? const Color(0xFF3B82F6) : Colors.grey.shade400,
                    ),
                    tooltip: isAvailable ? 'Evaluation Options' : 'Locked until ${event.date}',
                    onPressed: () {
                      if (!isAvailable) {
                        _showLockedQrDialog(context, event);
                      } else {
                        showDialog<void>(
                          context: context,
                          builder: (_) => _EventEvaluationMethodDialog(
                            event: event,
                            username: widget.username,
                            role: widget.role,
                            onRefresh: widget.onRefresh,
                            onSubmitRating: (id, rating) {
                              widget.onSubmitRating(id, rating);
                              setState(() {});
                            },
                          ),
                        );
                      }
                    },
                  );
                }
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Center(
              child: ElevatedButton(
                onPressed: !hasData
                    ? null
                    : () {
                        _showEventDetailDialog(context, event.name, event.date, event.department, event.organizer, responses, rating, status);
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: const Size(60, 32),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: Text(
                  hasData ? 'View Results' : 'No Data',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: hasData ? Colors.white : const Color(0xFF94A3B8),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showEventDetailDialog(
    BuildContext context,
    String name,
    String date,
    String dept,
    String organizer,
    String responses,
    String rating,
    String status,
  ) {
    showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            Text('Organizer: $organizer · $dept · $date', style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Divider(),
            const SizedBox(height: 8),
            _dialogRow('Rater Responses', responses),
            _dialogRow('Average Rating', rating),
            _dialogRow('Event Status', status),
            const SizedBox(height: 12),
            const Text(
              'Attendee Feedback Highlights:',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 6),
            Text(
              status == 'Flagged'
                  ? 'Attendance check-in had high delay rates and some segments felt disorganized. Recommended action: Follow up with coordinator on scheduling.'
                  : 'Highly rated! Attendees praised the clear delivery, excellent time management, and interactive activities.',
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _dialogRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
          Text(val, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }
}

class _CoordinatorStatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? subtitle;
  final Color valueColor;
  final IconData icon;
  final Color iconColor;

  const _CoordinatorStatCard({
    required this.label,
    required this.value,
    this.subtitle,
    required this.valueColor,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    color: valueColor,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF64748B),
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Builder(
                    builder: (context) {
                      if (subtitle!.contains('awaiting ratings')) {
                        final parts = subtitle!.split(' · ');
                        if (parts.length == 2) {
                          final totalPart = parts[0];
                          final awaitingPart = parts[1];
                          final hasPending = !awaitingPart.startsWith('0');
                          return RichText(
                            text: TextSpan(
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF94A3B8),
                                fontFamily: 'Inter',
                              ),
                              children: [
                                TextSpan(text: '$totalPart · '),
                                TextSpan(
                                  text: awaitingPart,
                                  style: TextStyle(
                                    color: hasPending ? const Color(0xFFEA580C) : const Color(0xFF94A3B8),
                                    fontWeight: hasPending ? FontWeight.w700 : FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }
                      }
                      return Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF94A3B8),
                        ),
                      );
                    }
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// View Results Dialog  (Image 2)
// ─────────────────────────────────────────────────────────────────────────────

class _EventViewResultsDialog extends StatelessWidget {
  final SchoolEvent event;
  const _EventViewResultsDialog({required this.event});

  @override
  Widget build(BuildContext context) {
    final agg = event.aggregatedScores;
    final avg = event.avgRating ?? 0;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: SizedBox(
        width: 620,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Dialog header ────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 16, 16),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(event.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    const SizedBox(height: 4),
                    Text('${event.organizer} · ${event.department}',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ]),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textSecondary),
                ),
              ]),
            ),

            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Aggregated scores card ──────────────────────────────
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.cardBorder, width: 0.8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Text('Aggregated Evidency (${event.responses} raters)',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            const Spacer(),
                            Builder(
                              builder: (context) {
                                if (avg == 0) return const Text('—', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700));
                                final rate = ((avg - 1) / 4.0).clamp(0.0, 1.0) * 100.0;
                                final color = rate >= 80.0 
                                    ? const Color(0xFF16A34A) 
                                    : (rate >= 50.0 ? const Color(0xFFEA580C) : const Color(0xFFEF4444));
                                return Text(
                                  '${rate.toStringAsFixed(0)}%',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
                                );
                              }
                            ),
                          ]),
                          const SizedBox(height: 8),
                          Builder(
                            builder: (context) {
                              if (avg == 0) return const SizedBox();
                              final rate = ((avg - 1) / 4.0).clamp(0.0, 1.0) * 100.0;
                              final String label = rate >= 80.0 
                                  ? 'High Evidency Rate (Most attendees found indicators evident)' 
                                  : (rate >= 50.0 ? 'Mid Evidency Rate' : 'Low Evidency Rate (Most attendees did not find indicators evident)');
                              final Color color = rate >= 80.0 
                                  ? const Color(0xFF16A34A) 
                                  : (rate >= 50.0 ? const Color(0xFFEA580C) : const Color(0xFFEF4444));
                              return Text(
                                label,
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color),
                              );
                            }
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 18),

                    // ── Attendee ratings ────────────────────────────────────
                    const Text('Attendee Ratings', style: AppTextStyles.sectionTitle),
                    const SizedBox(height: 12),
                    if (event.ratings.isEmpty)
                      const Text('No ratings submitted yet.',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 13))
                    else
                      ...event.ratings.map((r) => _AttendeeRow(rating: r)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttendeeRow extends StatelessWidget {
  final AttendeeRating rating;
  const _AttendeeRow({required this.rating});

  @override
  Widget build(BuildContext context) {
    final initials = rating.name.trim().split(' ')
        .map((p) => p.isNotEmpty ? p[0] : '')
        .take(2).join().toUpperCase();

    final rate = ((rating.overallScore - 1) / 4.0).clamp(0.0, 1.0) * 100.0;
    final color = rate >= 80.0 
        ? const Color(0xFF16A34A) 
        : (rate >= 50.0 ? const Color(0xFFEA580C) : const Color(0xFFEF4444));

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: AppColors.pageBg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.cardBorder, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: AppColors.tabActive, shape: BoxShape.circle),
              child: Center(child: Text(initials,
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(rating.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                Text(rating.role.label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ]),
            ),
            Text(
              '${rate.toStringAsFixed(0)}%',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color),
            ),
          ]),
          if (rating.comments != null && rating.comments!.isNotEmpty) ...[
            const SizedBox(height: 8),
            const Divider(height: 1, thickness: 0.5),
            const SizedBox(height: 8),
            Text(
              rating.comments!,
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.4),
            ),
          ],
        ],
      ),
    );
  }
}

class _MiniStars extends StatelessWidget {
  final double value;
  const _MiniStars({required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        if (i < value.floor()) {
          return const Icon(Icons.star_rounded, color: AppColors.amber, size: 14);
        } else if (i == value.floor() && value % 1 >= 0.4) {
          return const Icon(Icons.star_half_rounded, color: AppColors.amber, size: 14);
        }
        return const Icon(Icons.star_outline_rounded, color: AppColors.amber, size: 14);
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Event Dialog  (Image 3)
// ─────────────────────────────────────────────────────────────────────────────

class _EventRateDialog extends StatefulWidget {
  final SchoolEvent event;
  final String username;
  final String role;
  const _EventRateDialog({required this.event, required this.username, required this.role});

  @override
  State<_EventRateDialog> createState() => _EventRateDialogState();
}

class _EventRateDialogState extends State<_EventRateDialog> {
  late final TextEditingController _nameCtrl;
  late final EvaluatorRole _role;
  final Map<String, int> _scores = {
    'planning': 0, 'objectives': 0, 'personnel': 0,
    'timeMgmt': 0, 'engagement': 0, 'resource': 0,
  };
  final _commentsCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.username);
    if (widget.role == 'teacher') _role = EvaluatorRole.teacher;
    else if (widget.role == 'dean') _role = EvaluatorRole.dean;
    else if (widget.role == 'coordinator') _role = EvaluatorRole.coordinator;
    else if (widget.role == 'principal') _role = EvaluatorRole.principal;
    else _role = EvaluatorRole.student;
  }

  bool get _canSubmit =>
      _nameCtrl.text.trim().isNotEmpty &&
      _scores.values.every((v) => v > 0);

  @override
  void dispose() {
    _nameCtrl.dispose();
    _commentsCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final scores = EventRubricScores(
      planning:    _scores['planning']!.toDouble(),
      objectives:  _scores['objectives']!.toDouble(),
      personnel:   _scores['personnel']!.toDouble(),
      timeMgmt:    _scores['timeMgmt']!.toDouble(),
      engagement:  _scores['engagement']!.toDouble(),
      resource:    _scores['resource']!.toDouble(),
    );
    final now = DateTime.now();
    final rating = AttendeeRating(
      name: _nameCtrl.text.trim(),
      role: _role,
      scores: scores,
      comments: _commentsCtrl.text.trim().isEmpty ? null : _commentsCtrl.text.trim(),
      dateSubmitted:
          '${now.year}-${now.month.toString().padLeft(2,'0')}-${now.day.toString().padLeft(2,'0')} '
          '${now.hour.toString().padLeft(2,'0')}:${now.minute.toString().padLeft(2,'0')}:${now.second.toString().padLeft(2,'0')}',
    );
    Navigator.of(context).pop(rating);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: SizedBox(
        width: 540,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 16, 12),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.event.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text('${widget.event.organizer} · ${widget.event.department}',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                ])),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textSecondary),
                ),
              ]),
            ),

            const Divider(height: 0, thickness: 0.8, color: AppColors.divider),

            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Section title
                    const Text('Submit Your Rating', style: AppTextStyles.sectionTitle),
                    const SizedBox(height: 16),

                    // Name + Role row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            _label('Your Name *'),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _nameCtrl,
                              enabled: false,
                              decoration: _fieldDecor('Enter your name').copyWith(
                                fillColor: AppColors.pageBg,
                                filled: true,
                              ),
                              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                            ),
                          ]),
                        ),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 160,
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            _label('Role *'),
                            const SizedBox(height: 6),
                            DropdownButtonFormField<EvaluatorRole>(
                              value: _role,
                              onChanged: null,
                              decoration: _fieldDecor(null).copyWith(
                                fillColor: AppColors.pageBg,
                                filled: true,
                              ),
                              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                              items: EvaluatorRole.values
                                  .map((r) => DropdownMenuItem(value: r, child: Text(r.label)))
                                  .toList(),
                            ),
                          ]),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    // 6 criterion rows
                    ..._kCriteria.map((c) => _CriterionRatingRow(
                      criterion: c,
                      value: _scores[c.key]!,
                      onChanged: (v) => setState(() => _scores[c.key] = v),
                    )),

                    const SizedBox(height: 8),

                    // Comments
                    _label('Comments (optional)'),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _commentsCtrl,
                      maxLines: 3,
                      decoration: _fieldDecor('Share your feedback...'),
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),

            // Footer buttons
            Container(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.divider, width: 0.8)),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.cardBorder),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  onPressed: _canSubmit ? _submit : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.tabActive,
                    disabledBackgroundColor: AppColors.notSubmittedBg,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: Text('Submit Rating',
                      style: TextStyle(
                        color: _canSubmit ? Colors.white : AppColors.notSubmittedFg,
                        fontSize: 13, fontWeight: FontWeight.w600,
                      )),
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textPrimary));

  InputDecoration _fieldDecor(String? hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 13, color: AppColors.textHint),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.cardBorder, width: 0.8),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.cardBorder, width: 0.8),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.tabActive, width: 1.5),
        ),
      );
}

class _CriterionRatingRow extends StatelessWidget {
  final _Criterion criterion;
  final int value;
  final ValueChanged<int> onChanged;

  const _CriterionRatingRow({required this.criterion, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: AppColors.pageBg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.cardBorder, width: 0.8),
      ),
      child: Row(children: [
        Container(
          width: 30, height: 30,
          decoration: BoxDecoration(color: criterion.color.withOpacity(0.12), borderRadius: BorderRadius.circular(7)),
          child: Icon(criterion.icon, color: criterion.color, size: 15),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(criterion.label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textPrimary))),
        // Interactive stars
        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(5, (i) {
            final v = i + 1;
            return GestureDetector(
              onTap: () => onChanged(v),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1),
                child: Icon(
                  v <= value ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: AppColors.amber,
                  size: 24,
                ),
              ),
            );
          }),
        ),
        const SizedBox(width: 6),
        Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textHint, size: 18),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar Chart
// ─────────────────────────────────────────────────────────────────────────────

class _RadarChart extends StatelessWidget {
  final List<double> values;
  final double size;
  final Color color;
  final List<String> labels;

  const _RadarChart({
    required this.values,
    required this.size,
    required this.color,
    required this.labels,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _RadarPainter(values: values, color: color, labels: labels),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  final List<double> values;
  final Color color;
  final List<String> labels;
  static const int _n = 6;

  const _RadarPainter({required this.values, required this.color, required this.labels});

  Offset _point(Offset center, double r, int i) {
    final angle = (i * 2 * pi / _n) - pi / 2;
    return Offset(center.dx + r * cos(angle), center.dy + r * sin(angle));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxR = size.width * 0.34;

    // Grid rings
    final gridPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;

    for (int lvl = 1; lvl <= 5; lvl++) {
      final r = maxR * lvl / 5;
      final path = Path();
      for (int i = 0; i < _n; i++) {
        final pt = _point(center, r, i);
        i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
      }
      path.close();
      canvas.drawPath(path, gridPaint);
    }

    // Axis lines
    for (int i = 0; i < _n; i++) {
      canvas.drawLine(center, _point(center, maxR, i), gridPaint);
    }

    // Filled data polygon
    final fillPaint = Paint()
      ..color = color.withOpacity(0.18)
      ..style = PaintingStyle.fill;
    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final dotPaint = Paint()..color = color;

    final path = Path();
    for (int i = 0; i < _n; i++) {
      final r = maxR * (values[i] / 5.0).clamp(0.0, 1.0);
      final pt = _point(center, r, i);
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    path.close();
    canvas.drawPath(path, fillPaint);
    canvas.drawPath(path, strokePaint);

    // Data dots
    for (int i = 0; i < _n; i++) {
      final r = maxR * (values[i] / 5.0).clamp(0.0, 1.0);
      canvas.drawCircle(_point(center, r, i), 4, dotPaint);
    }

    // Labels
    const labelR = 1.22;
    for (int i = 0; i < _n; i++) {
      final labelPt = _point(center, maxR * labelR, i);
      final tp = TextPainter(
        text: TextSpan(
          text: labels[i],
          style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
        ),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
      )..layout(maxWidth: 70);

      tp.paint(canvas, Offset(labelPt.dx - tp.width / 2, labelPt.dy - tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(_RadarPainter old) => old.values != values;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events Table
// ─────────────────────────────────────────────────────────────────────────────

class _EventsTable extends StatelessWidget {
  final List<SchoolEvent> events;
  final String role;
  final void Function(SchoolEvent) onViewResults;
  final void Function(SchoolEvent) onRateEvent;
  final void Function(SchoolEvent) onShowQr;

  const _EventsTable({
    required this.events,
    required this.role,
    required this.onViewResults,
    required this.onRateEvent,
    required this.onShowQr,
  });

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: Text('No events match the selected filter.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13))),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        final double tableWidth = constraints.maxWidth > 1100 ? constraints.maxWidth : 1100;
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: tableWidth,
            child: Column(children: [
              _TableHeader(),
              const Divider(height: 0, thickness: 0.8, color: AppColors.divider),
              ...events.asMap().entries.map((e) => _EventRow(
                event: e.value, index: e.key, role: role,
                onViewResults: onViewResults, onRateEvent: onRateEvent,
                onShowQr: onShowQr,
              )),
            ]),
          ),
        );
      },
    );
  }
}

class _TableHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.tableHeaderBg,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: const Row(children: [
        SizedBox(width: 72,  child: _Th('EVENT ID')),
        Expanded(            child: _Th('EVENT NAME')),
        SizedBox(width: 92,  child: _Th('DATE')),
        SizedBox(width: 120, child: _Th('ORGANIZER')),
        SizedBox(width: 90,  child: _Th('ATTENDEES')),
        SizedBox(width: 110, child: _Th('RESPONSES')),
        SizedBox(width: 110, child: _Th('EVIDENCY RATE')),
        SizedBox(width: 115, child: _Th('STATUS')),
        SizedBox(width: 80,  child: _Th('EVALUATION')),
        SizedBox(width: 130, child: _Th('ACTION')),
      ]),
    );
  }
}

class _Th extends StatelessWidget {
  final String text;
  const _Th(this.text);
  @override
  Widget build(BuildContext context) =>
      Text(text, style: AppTextStyles.tableHeader);
}

class _EventRow extends StatelessWidget {
  final SchoolEvent event;
  final int index;
  final String role;
  final void Function(SchoolEvent) onViewResults;
  final void Function(SchoolEvent) onRateEvent;
  final void Function(SchoolEvent) onShowQr;

  const _EventRow({
    required this.event,
    required this.index,
    required this.role,
    required this.onViewResults,
    required this.onRateEvent,
    required this.onShowQr,
  });

  @override
  Widget build(BuildContext context) {
    final avg = event.avgRating;
    final int pct = event.attendees > 0
        ? ((event.responses / event.attendees) * 100).round() : 0;

    // Rating widget (Evidency Rate, color-coded, no stars)
    Widget ratingWidget;
    if (avg != null) {
      final rate = ((avg - 1) / 4.0).clamp(0.0, 1.0) * 100.0;
      final color = rate >= 80.0 
          ? const Color(0xFF16A34A) 
          : (rate >= 50.0 ? const Color(0xFFEA580C) : const Color(0xFFEF4444));
      ratingWidget = Text(
        '${rate.toStringAsFixed(0)}%',
        style: TextStyle(
          fontSize: 13, 
          fontWeight: FontWeight.bold,
          color: color,
        ),
      );
    } else {
      ratingWidget = const Text('—', style: TextStyle(fontSize: 14, color: AppColors.textHint));
    }

    // Status + action based on role
    Widget statusChip;
    String actionLabel;
    VoidCallback? onAction;

    switch (event.status) {
      case EventStatus.awaitingRatings:
        statusChip  = _pill('Awaiting Ratings', AppColors.statusAmberBg, AppColors.statusAmberFg);
        if (role == 'principal') {
          // Principals can only view, never rate
          actionLabel = 'View Results';
          onAction    = () => onViewResults(event);
        } else if (role == 'teacher' || role == 'dean' || role == 'coordinator') {
          // Teachers, Deans, Coordinators can rate
          actionLabel = 'Rate Event';
          onAction    = () => onRateEvent(event);
        } else {
          actionLabel = 'View Results';
          onAction    = () => onViewResults(event);
        }
      case EventStatus.rated:
      case EventStatus.flagged:
        statusChip  = _pill('Completed', AppColors.statusGreenBg, AppColors.statusGreenFg);
        actionLabel = 'View Results';
        onAction    = () => onViewResults(event);
    }

    return Container(
      decoration: BoxDecoration(
        color: index.isOdd ? const Color(0xFFFAFAFB) : Colors.white,
        border: const Border(bottom: BorderSide(color: AppColors.divider, width: 0.5)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        SizedBox(width: 72, child: Text(event.id, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textSecondary))),
        Expanded(child: Padding(padding: const EdgeInsets.only(right: 12),
          child: Text(event.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textPrimary)))),
        SizedBox(width: 92,  child: Text(event.date, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
        SizedBox(width: 120, child: Text(event.organizer, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), overflow: TextOverflow.ellipsis)),
        SizedBox(width: 90,  child: Text('${event.attendees}', style: const TextStyle(fontSize: 13, color: AppColors.textPrimary))),
        SizedBox(width: 110, child: Text('${event.responses} ($pct%)', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
        SizedBox(width: 110, child: ratingWidget),
        SizedBox(width: 115, child: statusChip),
        SizedBox(
          width: 80,
          child: Center(
            child: Builder(
              builder: (context) {
                final bool isAvailable = _isEventDayOrLater(event.date);
                return IconButton(
                  icon: Icon(
                    Icons.assignment_outlined,
                    color: isAvailable ? AppColors.textSecondary : Colors.grey.shade300,
                  ),
                  tooltip: isAvailable ? 'Evaluation Options' : 'Locked until ${event.date}',
                  onPressed: () {
                    if (!isAvailable) {
                      _showLockedQrDialog(context, event);
                    } else {
                      onShowQr(event);
                    }
                  },
                );
              }
            ),
          ),
        ),
        SizedBox(
          width: 130,
          child: ElevatedButton(
            onPressed: onAction,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.tabActive,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
              minimumSize: const Size(1, 34),
            ),
            child: Text(actionLabel, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ),
      ]),
    );
  }

  Widget _pill(String label, Color bg, Color fg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
    child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600)),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared widgets (local to this file)
// ─────────────────────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label, value;
  final String? subtitle;
  final Color valueColor, iconColor;
  final IconData icon;
  const _StatCard({required this.label, required this.value, required this.valueColor, required this.icon, required this.iconColor, this.subtitle});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    decoration: BoxDecoration(color: AppColors.cardBg, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.cardBorder, width: 0.8)),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: AppTextStyles.statLabel),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: valueColor, letterSpacing: -0.3)),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Builder(
            builder: (context) {
              if (subtitle!.contains('awaiting ratings')) {
                final parts = subtitle!.split(' · ');
                if (parts.length == 2) {
                  final totalPart = parts[0];
                  final awaitingPart = parts[1];
                  final hasPending = !awaitingPart.startsWith('0');
                  return RichText(
                    text: TextSpan(
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                        fontFamily: 'Inter',
                      ),
                      children: [
                        TextSpan(text: '$totalPart · '),
                        TextSpan(
                          text: awaitingPart,
                          style: TextStyle(
                            color: hasPending ? const Color(0xFFEA580C) : AppColors.textSecondary,
                            fontWeight: hasPending ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  );
                }
              }
              return Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              );
            }
          ),
        ],
      ])),
      Icon(icon, color: iconColor, size: 22),
    ]),
  );
}

class _RubricItem extends StatelessWidget {
  final _Criterion criterion;
  const _RubricItem({required this.criterion});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Container(
      width: 30, height: 30,
      decoration: BoxDecoration(color: criterion.color.withOpacity(0.12), borderRadius: BorderRadius.circular(7)),
      child: Icon(criterion.icon, color: criterion.color, size: 15),
    ),
    const SizedBox(width: 8),
    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(criterion.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
    ]),
  ]);
}

class _DropItem {
  final String? value;
  final String label;
  const _DropItem({required this.value, required this.label});
}

class _StyledDropdown extends StatelessWidget {
  final String? value, hint;
  final List<_DropItem> items;
  final ValueChanged<String?> onChanged;
  final IconData? leadingIcon;
  const _StyledDropdown({required this.value, required this.items, required this.onChanged, this.hint, this.leadingIcon});

  @override
  Widget build(BuildContext context) {
    final bool isDark = value != null && value != 'all';
    final Color bg = isDark ? AppColors.tabActive : Colors.white;
    final Color fg = isDark ? Colors.white : AppColors.textPrimary;
    final Color border = isDark ? AppColors.tabActive : AppColors.cardBorder;
    final Color ic = isDark ? Colors.white.withOpacity(0.8) : AppColors.textSecondary;
    String display = hint ?? 'Select…';
    if (value != null) {
      final m = items.where((i) => i.value == value);
      if (m.isNotEmpty) display = m.first.label;
    }
    return GestureDetector(
      onTap: () {
        final RenderBox? renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox == null) return;

        final size = renderBox.size;
        final position = renderBox.localToGlobal(Offset.zero);

        const double menuWidth = 200;
        final double x = position.dx + (size.width - menuWidth) / 2;
        final double y = position.dy + size.height + 4;
 
        showMenu<String?>(
          context: context,
          position: RelativeRect.fromLTRB(x, y, x + menuWidth, y + 300),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: AppColors.cardBorder.withOpacity(0.8), width: 0.8),
          ),
          color: Colors.white,
          elevation: 8,
          shadowColor: Colors.black.withOpacity(0.08),
          constraints: const BoxConstraints(minWidth: menuWidth, maxWidth: 340),
          items: items.map((item) => PopupMenuItem<String?>(
            value: item.value,
            height: 38,
            child: Row(children: [
              if (item.value == value) ...[
                const Icon(Icons.check_rounded, size: 14, color: AppColors.tabActive),
                const SizedBox(width: 6),
              ] else
                const SizedBox(width: 20),
              Expanded(
                child: Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 13,
                    color: item.value == value ? AppColors.tabActive : AppColors.textPrimary,
                    fontWeight: item.value == value ? FontWeight.w600 : FontWeight.w400,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ),
            ]),
          )).toList(),
        ).then((selectedValue) {
          if (selectedValue != null) {
            onChanged(selectedValue);
          }
        });
      },
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: border, width: 1),
            boxShadow: isDark
                ? [BoxShadow(color: AppColors.tabActive.withOpacity(0.15), blurRadius: 6, offset: const Offset(0, 2))]
                : [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1))],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (leadingIcon != null) ...[
                Icon(leadingIcon, size: 14, color: ic),
                const SizedBox(width: 6),
              ],
              Text(display, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: fg)),
              const SizedBox(width: 6),
              Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: ic),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Evaluation QR Code Dialog & Painter
// ─────────────────────────────────────────────────────────────────────────────

class _EventQrCodeDialog extends StatefulWidget {
  final SchoolEvent event;
  final String username;
  final String role;
  final void Function(String id, AttendeeRating rating) onSubmitRating;
  final Future<void> Function()? onRefresh;

  const _EventQrCodeDialog({
    required this.event,
    required this.username,
    required this.role,
    required this.onSubmitRating,
    this.onRefresh,
  });

  @override
  State<_EventQrCodeDialog> createState() => _EventQrCodeDialogState();
}

class _EventQrCodeDialogState extends State<_EventQrCodeDialog> {
  late String _currentUrl;

  @override
  void initState() {
    super.initState();
    final origin = Uri.base.origin;
    _currentUrl = '$origin/?eval=${widget.event.id}';
    _autoDetectIp();
  }

  Future<void> _autoDetectIp() async {
    final origin = Uri.base.origin;
    final isLocalhost = origin.contains('localhost') || origin.contains('127.0.0.1');
    if (isLocalhost) {
      final localIp = await EventsApi().getServerIp();
      if (localIp != '127.0.0.1') {
        setState(() {
          final port = Uri.base.port;
          _currentUrl = 'http://$localIp:$port/?eval=${widget.event.id}';
        });
      }
    }
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 360,
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Event Evaluation QR Code',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 20),
                ),
              ],
            ),
            const Divider(),
            const SizedBox(height: 16),

            // Event Details
            Text(
              widget.event.name,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              'Organizer: ${widget.event.organizer} · ${widget.event.department}',
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),

            // QR Code Container
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: QrImageView(
                data: _currentUrl,
                version: QrVersions.auto,
                size: 200.0,
                gapless: false,
                errorStateBuilder: (cxt, err) {
                  return const Center(
                    child: Text(
                      'Could not load QR Code',
                      textAlign: TextAlign.center,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Event ID: ${widget.event.id}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0),
              child: SelectableText(
                _currentUrl,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF2563EB),
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}



// ─────────────────────────────────────────────────────────────────────────────
// QR Code lock helpers & custom DepEd Observation Tool
// ─────────────────────────────────────────────────────────────────────────────

bool _isEventDayOrLater(String dateStr) {
  try {
    DateTime? eventDate;
    if (dateStr.contains('-')) {
      eventDate = DateTime.tryParse(dateStr);
    } else if (dateStr.contains('/')) {
      final parts = dateStr.split('/');
      if (parts.length == 3) {
        int? month = int.tryParse(parts[0]);
        int? day = int.tryParse(parts[1]);
        int? year = int.tryParse(parts[2]);
        if (month != null && day != null && year != null) {
          if (year < 100) year += 2000;
          eventDate = DateTime(year, month, day);
        }
      }
    }
    if (eventDate == null) return false;
    
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final eventDay = DateTime(eventDate.year, eventDate.month, eventDate.day);
    
    return today.isAtSameMomentAs(eventDay) || today.isAfter(eventDay);
  } catch (_) {
    return false;
  }
}

void _showLockedQrDialog(BuildContext context, SchoolEvent event) {
  showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.lock_outline_rounded, color: Color(0xFFEA580C)),
          SizedBox(width: 8),
          Text('QR Code Locked'),
        ],
      ),
      content: Text(
        'The QR code for "${event.name}" is locked. '
        'It will be automatically generated and available on the day of the event: ${event.date}.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

class _ObservationToolDialog extends StatefulWidget {
  final SchoolEvent event;
  final String username;
  final String role;

  const _ObservationToolDialog({
    required this.event,
    required this.username,
    required this.role,
  });

  @override
  State<_ObservationToolDialog> createState() => _ObservationToolDialogState();
}

class _DialogIndicatorItem {
  final String name;
  bool? isEvident;
  final TextEditingController remarksController;

  _DialogIndicatorItem({
    required this.name,
    this.isEvident,
    required this.remarksController,
  });
}

class _ObservationToolDialogState extends State<_ObservationToolDialog> {
  late final TextEditingController _nameCtrl;
  final _commentsCtrl = TextEditingController();

  final List<_DialogIndicatorItem> _indicators = [];

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.username);
    _indicators.add(_DialogIndicatorItem(name: '1. The special program has an approved proposal.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '2. The training matrix was observed or was completely delivered.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '3. The number of days were maximized as stated in the training design.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '4. The objectives of the special program were met.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '5. The monitoring and evaluation tools were utilized.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '6. Participants were able to submit the required output.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '7. Attendance was systematically monitored.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '8. The venue was conducive.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '9. The Session started and ended on time.', remarksController: TextEditingController()));
    _indicators.add(_DialogIndicatorItem(name: '10. The trainers/facilitators used appropriate resource package (Pretest and post-tests, power point, video presentation, etc.)', remarksController: TextEditingController()));
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _commentsCtrl.dispose();
    for (final ind in _indicators) {
      ind.remarksController.dispose();
    }
    super.dispose();
  }

  bool get _canSubmit => _indicators.every((i) => i.isEvident != null);

  void _addCustomIndicator() {
    final nameCtrl = TextEditingController();
    showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Custom Indicator'),
        content: TextField(
          controller: nameCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Enter indicator description...',
            labelText: 'Indicator Name',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(nameCtrl.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    ).then((val) {
      nameCtrl.dispose();
      if (val != null && val.isNotEmpty) {
        setState(() {
          final nextNum = _indicators.length + 1;
          _indicators.add(_DialogIndicatorItem(
            name: "$nextNum. $val",
            remarksController: TextEditingController(),
          ));
        });
      }
    });
  }

  void _submit() {
    if (!_canSubmit) return;

    final evidentCount = _indicators.where((i) => i.isEvident == true).length;
    final double avgScore = _indicators.isEmpty ? 3.0 : (evidentCount * 5.0 + (_indicators.length - evidentCount) * 1.0) / _indicators.length;

    final scores = EventRubricScores(
      planning: avgScore,
      objectives: avgScore,
      personnel: avgScore,
      timeMgmt: avgScore,
      engagement: avgScore,
      resource: avgScore,
    );

    final List<String> feedbackParts = [];
    for (final ind in _indicators) {
      final status = ind.isEvident! ? 'Evident' : 'Not Evident';
      final remarks = ind.remarksController.text.trim();
      feedbackParts.add('${ind.name}: $status${remarks.isNotEmpty ? " ($remarks)" : ""}');
    }

    if (_commentsCtrl.text.trim().isNotEmpty) {
      feedbackParts.add('Comments: ${_commentsCtrl.text.trim()}');
    }
    
    final commentsStr = feedbackParts.join(' | ');
    final now = DateTime.now();
    
    EvaluatorRole evalRole;
    if (widget.role == 'teacher') evalRole = EvaluatorRole.teacher;
    else if (widget.role == 'dean') evalRole = EvaluatorRole.dean;
    else if (widget.role == 'coordinator') evalRole = EvaluatorRole.coordinator;
    else if (widget.role == 'principal') evalRole = EvaluatorRole.principal;
    else if (widget.role == 'registrar') evalRole = EvaluatorRole.registrar;
    else evalRole = EvaluatorRole.student;

    final rating = AttendeeRating(
      name: _nameCtrl.text.trim().isEmpty ? 'Anonymous' : _nameCtrl.text.trim(),
      role: evalRole,
      scores: scores,
      comments: commentsStr.isEmpty ? null : commentsStr,
      dateSubmitted:
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')} '
          '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}',
    );

    Navigator.of(context).pop(rating);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: SizedBox(
        width: 720,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Close button overlay
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 8, right: 8),
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 20, color: Colors.grey),
                ),
              ),
            ),
            
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(32, 0, 32, 24),
                child: Column(
                  children: [
                    // Official Seal & Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Color(0xFF0F2C59),
                          ),
                          child: const Icon(Icons.account_balance, color: Colors.white, size: 28),
                        ),
                        const SizedBox(width: 16),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Republika ng Pilipinas',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: Color(0xFF334155)),
                            ),
                            Text(
                              'Kagawaran ng Edukasyon',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A), fontFamily: 'Georgia'),
                            ),
                            Text(
                              'REHIYON V - BICOL',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                            ),
                            Text(
                              'TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                            ),
                            Text(
                              'NAGA CENTRAL SCHOOL II',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F2C59)),
                            ),
                            Text(
                              'JACOB ST., PEÑAFRANCIA, NAGA CITY',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w500, color: Color(0xFF64748B)),
                            ),
                          ],
                        )
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Divider(color: Color(0xFF0F172A), thickness: 2),
                    const SizedBox(height: 12),
                    
                    const Text(
                      'OBSERVATION TOOL',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 16),

                    // Event Details Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.event.name,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.event.date,
                            style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Evaluator Metadata Form
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Name (Optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _nameCtrl,
                          decoration: _fieldDecor('Enter name...'),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Directions
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Directions: Please assess the effectiveness of the project/program according to the indicators below. Put a check (✓) under the appropriate column.',
                        style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Color(0xFF475569)),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Observation Tool Table
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Table(
                          columnWidths: const {
                            0: FlexColumnWidth(4),
                            1: FixedColumnWidth(90),
                            2: FixedColumnWidth(110),
                            3: FlexColumnWidth(4),
                          },
                          border: TableBorder.all(color: const Color(0xFFCBD5E1), width: 0.8),
                          children: [
                            // Table Header Row
                            const TableRow(
                              decoration: BoxDecoration(color: Color(0xFFF1F5F9)),
                              children: [
                                Padding(
                                  padding: EdgeInsets.all(12),
                                  child: Text('INDICATORS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                                ),
                                Padding(
                                  padding: EdgeInsets.all(12),
                                  child: Center(child: Text('Evident', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)))),
                                ),
                                Padding(
                                  padding: EdgeInsets.all(12),
                                  child: Center(child: Text('Not Evident', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)))),
                                ),
                                Padding(
                                  padding: EdgeInsets.all(12),
                                  child: Text('Remarks', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                                ),
                              ],
                            ),
                            // Rows mapped dynamically
                            ..._indicators.map((ind) {
                              return TableRow(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                                    child: Text(ind.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                                  ),
                                  Center(
                                    child: Radio<bool>(
                                      value: true,
                                      groupValue: ind.isEvident,
                                      activeColor: const Color(0xFF0F2C59),
                                      onChanged: (val) => setState(() => ind.isEvident = val),
                                    ),
                                  ),
                                  Center(
                                    child: Radio<bool>(
                                      value: false,
                                      groupValue: ind.isEvident,
                                      activeColor: const Color(0xFF0F2C59),
                                      onChanged: (val) => setState(() => ind.isEvident = val),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(8),
                                    child: TextField(
                                      controller: ind.remarksController,
                                      decoration: _tableFieldDecor(),
                                      style: const TextStyle(fontSize: 12.5),
                                    ),
                                  ),
                                ],
                              );
                            }),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Add Indicator Button (Only visible to authorized personnel)
                    if (widget.role != 'student')
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: _addCustomIndicator,
                          icon: const Icon(Icons.add_rounded, color: Color(0xFF0F2C59)),
                          label: const Text(
                            'Add Custom Indicator',
                            style: TextStyle(color: Color(0xFF0F2C59), fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    const SizedBox(height: 20),

                    // Comments and Recommendations Section
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text('COMMENTS AND RECOMMENDATIONS:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _commentsCtrl,
                      maxLines: 4,
                      decoration: _fieldDecor('Write comments or recommendations...'),
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),

            // Dialog Actions Footer
            Container(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 0.8)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Cancel', style: TextStyle(color: Color(0xFF475569), fontSize: 13)),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _canSubmit ? _submit : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F2C59),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: const Color(0xFFE2E8F0),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Submit Evaluation', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _fieldDecor(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 0.8),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 0.8),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF0F2C59), width: 1.5),
        ),
      );

  InputDecoration _tableFieldDecor() => const InputDecoration(
        hintText: 'Enter remarks...',
        hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        border: InputBorder.none,
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Evaluation Method Selection Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _EventEvaluationMethodDialog extends StatelessWidget {
  final SchoolEvent event;
  final String username;
  final String role;
  final void Function(String id, AttendeeRating rating) onSubmitRating;
  final Future<void> Function()? onRefresh;

  const _EventEvaluationMethodDialog({
    required this.event,
    required this.username,
    required this.role,
    required this.onSubmitRating,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 360,
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Evaluation Options',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, size: 20),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Divider(),
            const SizedBox(height: 16),
            Text(
              event.name,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 4),
            Text(
              'Organizer: ${event.organizer} · ${event.department}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            // Option 1: QR Code
            _buildOptionCard(
              context: context,
              icon: Icons.qr_code_2_rounded,
              title: 'Show QR Code',
              subtitle: 'Generate a QR code for attendees to scan on their devices.',
              onTap: () {
                Navigator.of(context).pop();
                showDialog<void>(
                  context: context,
                  builder: (_) => _EventQrCodeDialog(
                    event: event,
                    username: username,
                    role: role,
                    onSubmitRating: onSubmitRating,
                    onRefresh: onRefresh,
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            // Option 2: Copy Link
            _buildOptionCard(
              context: context,
              icon: Icons.link_rounded,
              title: 'Get Evaluation Link',
              subtitle: 'Copy the direct URL link to the evaluation web page.',
              onTap: () {
                Navigator.of(context).pop();
                _showEvaluationLinkDialog(context, event);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOptionCard({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: const Color(0xFF3B82F6), size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
          ],
        ),
      ),
    );
  }

  void _showEvaluationLinkDialog(BuildContext context, SchoolEvent event) {
    final origin = Uri.base.origin;
    final link = '$origin/?eval=${event.id}';
    bool copied = false;

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            title: const Text('Evaluation Link', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Direct evaluation form link for "${event.name}":', style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: copied ? const Color(0xFF10B981) : const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          link,
                          style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: Color(0xFF1E293B)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () async {
                          await Clipboard.setData(ClipboardData(text: link));
                          setS(() => copied = true);
                          await Future<void>.delayed(const Duration(seconds: 2));
                          if (ctx.mounted) setS(() => copied = false);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: copied ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                copied ? Icons.check_rounded : Icons.copy_rounded,
                                size: 14,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                copied ? 'Copied!' : 'Copy',
                                style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Close', style: TextStyle(color: Color(0xFF64748B))),
              ),
            ],
          );
        },
      ),
    );
  }
}