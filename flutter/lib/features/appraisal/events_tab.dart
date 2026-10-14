import 'dart:math';
import 'package:flutter/material.dart';
import '../../core/theme.dart';
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
  final void Function(String id, AttendeeRating rating) onSubmitRating;

  const EventsTab({
    super.key,
    required this.pageHeader,
    required this.username,
    required this.role,
    required this.newRatings,
    required this.onSubmitRating,
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
      if (extra.isEmpty) { return e; }
      return SchoolEvent(
        id: e.id, name: e.name, date: e.date,
        organizer: e.organizer, department: e.department,
        attendees: e.attendees,
        ratings: [...e.ratings, ...extra],
        status: extra.isNotEmpty ? EventStatus.rated : e.status,
      );
    }).toList();
  }

  List<SchoolEvent> get _filtered {
    final all = _eventsWithNewRatings(sampleEvents);
    if (_filterMode == 'event' && _selectedEvent != null) {
      return all.where((e) => e.name == _selectedEvent).toList();
    }
    return all;
  }

  int get _pendingCount  => _filtered.where((e) => e.status == EventStatus.awaitingRatings).length;
  int get _ratedCount    => _filtered.where((e) => e.status == EventStatus.rated).length;
  int get _lowCount      => _filtered.where((e) => e.avgRating != null && e.avgRating! < 3.0).length;
  String get _avgRating {
    final s = _filtered.where((e) => e.avgRating != null).map((e) => e.avgRating!);
    if (s.isEmpty) return '—';
    return '${(s.reduce((a, b) => a + b) / s.length).toStringAsFixed(1)}/5';
  }

  List<String> get _eventNames => sampleEvents.map((e) => e.name).toSet().toList()..sort();

  void _openViewResults(BuildContext ctx, SchoolEvent event) {
    showDialog<void>(
      context: ctx,
      builder: (_) => _EventViewResultsDialog(event: event),
    );
  }

  void _openRateEvent(BuildContext ctx, SchoolEvent event) {
    showDialog<AttendeeRating?>(
      context: ctx,
      builder: (_) => _EventRateDialog(event: event, username: widget.username, role: widget.role),
    ).then((rating) {
      if (rating != null) {
        widget.onSubmitRating(event.id, rating);
        if (!mounted) return;
        ScaffoldMessenger.of(ctx).showSnackBar(
          const SnackBar(
            content: Text('Rating submitted successfully'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    });
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
                Row(children: [
                  Expanded(child: _StatCard(label: 'Pending Review', value: '$_pendingCount',
                      valueColor: AppColors.warning, icon: Icons.assignment_outlined, iconColor: AppColors.warning)),
                  const SizedBox(width: 14),
                  Expanded(child: _StatCard(label: 'Evaluated', value: '$_ratedCount',
                      valueColor: AppColors.success, icon: Icons.star_border_outlined, iconColor: AppColors.success)),
                  const SizedBox(width: 14),
                  Expanded(child: _StatCard(label: 'Low Rating', value: '$_lowCount',
                      valueColor: AppColors.danger, icon: Icons.warning_amber_outlined, iconColor: AppColors.danger)),
                  const SizedBox(width: 14),
                  Expanded(child: _StatCard(label: 'Avg Rating', value: _avgRating,
                      valueColor: AppColors.amber, icon: Icons.star_border_outlined, iconColor: AppColors.amber)),
                ]),

                const SizedBox(height: 18),

                // ── Rubric card ──────────────────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.cardBorder, width: 0.8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Event Evaluation Rubric (5-Point Scale)', style: AppTextStyles.sectionTitle),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 20,
                        runSpacing: 12,
                        children: _kCriteria.map((c) => _RubricItem(criterion: c)).toList(),
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                        decoration: BoxDecoration(
                          color: AppColors.infoBannerBg,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.infoBannerBdr, width: 0.8),
                        ),
                        child: const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Icon(Icons.info_outline, color: AppColors.infoBannerIcon, size: 15),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Events are rated by attendees (faculty and students) through a standardized rubric form. Ratings below 3.0/5 are automatically flagged for review.',
                              style: TextStyle(color: AppColors.infoBannerFg, fontSize: 12, height: 1.5),
                            ),
                          ),
                        ]),
                      ),
                    ],
                  ),
                ),

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
                        child: Row(
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
                        ),
                      ),
                      const SizedBox(height: 14),
                      _EventsTable(
                        events: _filtered,
                        role: widget.role,
                        onViewResults: (e) => _openViewResults(context, e),
                        onRateEvent:   (e) => _openRateEvent(context, e),
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
              Row(children: [
                Expanded(child: _CoordinatorStatCard(label: 'Pending Review', value: '1', valueColor: const Color(0xFFF59E0B), icon: Icons.calendar_today_outlined, iconColor: const Color(0xFFF59E0B))),
                const SizedBox(width: 14),
                Expanded(child: _CoordinatorStatCard(label: 'Evaluated', value: '2', valueColor: const Color(0xFF10B981), icon: Icons.star_border_outlined, iconColor: const Color(0xFF10B981))),
                const SizedBox(width: 14),
                Expanded(child: _CoordinatorStatCard(label: 'Flagged Alerts', value: '1', valueColor: const Color(0xFFEF4444), icon: Icons.error_outline, iconColor: const Color(0xFFEF4444))),
                const SizedBox(width: 14),
                Expanded(child: _CoordinatorStatCard(label: 'Avg Rating', value: '3.5/5', valueColor: const Color(0xFF475569), icon: Icons.star_border_outlined, iconColor: const Color(0xFF94A3B8))),
              ]),
              const SizedBox(height: 18),
              
              // Rubric breakdown card
              _buildEventRubricCard(),
              const SizedBox(height: 18),
              
              // School-wide events table
              _buildSchoolWideEventsTable(context),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEventRubricCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Event Evaluation Rubric (5-Point Scale)',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: _buildRubricMetricItem(
                icon: Icons.calendar_today_outlined,
                iconColor: const Color(0xFF10B981),
                title: 'Organization',
                weight: '20%',
              )),
              Expanded(child: _buildRubricMetricItem(
                icon: Icons.group_outlined,
                iconColor: const Color(0xFFF59E0B),
                title: 'Engagement',
                weight: '25%',
              )),
              Expanded(child: _buildRubricMetricItem(
                icon: Icons.check_circle_outline,
                iconColor: const Color(0xFF8B5CF6),
                title: 'Content Quality',
                weight: '30%',
              )),
              Expanded(child: _buildRubricMetricItem(
                icon: Icons.schedule_outlined,
                iconColor: const Color(0xFFEC4899),
                title: 'Time Management',
                weight: '15%',
              )),
              Expanded(child: _buildRubricMetricItem(
                icon: Icons.sentiment_satisfied_alt_outlined,
                iconColor: const Color(0xFF3B82F6),
                title: 'Overall Experience',
                weight: '10%',
              )),
            ],
          ),
          const SizedBox(height: 20),
          // Blue banner below
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(8),
              border: const Border(
                left: BorderSide(color: Color(0xFF3B82F6), width: 4),
                top: BorderSide(color: Color(0xFFDBEAFE), width: 0.8),
                right: BorderSide(color: Color(0xFFDBEAFE), width: 0.8),
                bottom: BorderSide(color: Color(0xFFDBEAFE), width: 0.8),
              ),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Color(0xFF3B82F6), size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Events are rated by attendees (faculty and students) through a standardized rubric form. Ratings below 3.0/5 are automatically flagged for review.',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF1E40AF),
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

  Widget _buildRubricMetricItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String weight,
  }) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: iconColor, size: 24),
        ),
        const SizedBox(height: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1E293B),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          weight,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: iconColor,
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
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Text(
              'School-Wide Events',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
            ),
          ),
          const Divider(height: 1),
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
                Expanded(flex: 2, child: Text('AVG RATING', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                Expanded(flex: 2, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                Expanded(flex: 2, child: Text('ACTION', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
              ],
            ),
          ),
          const Divider(height: 1),
          // Rows
          _buildEventTableRow(context, 'Science Fair 2025', '4/20/2025', 'Sciences', 'Dr. Santos', '210 / 250', '★ 4.5/5', 'Completed', const Color(0xFF16A34A), const Color(0xFFDCFCE7), true),
          _buildEventTableRow(context, 'Faculty Development Workshop', '4/15/2025', 'Business', 'Dr. Cruz', '38 / 45', '★ 3.8/5', 'Completed', const Color(0xFF16A34A), const Color(0xFFDCFCE7), true),
          _buildEventTableRow(context, 'Research Symposium', '4/5/2025', 'Humanities', 'Dr. Reyes', '12 / 80', '★ 2.3/5', 'Flagged', const Color(0xFFEF4444), const Color(0xFFFEE2E2), true),
          _buildEventTableRow(context, 'Community Outreach Program', '4/25/2025', 'Arts', 'Dr. Lopez', '0 / 150', '—', 'Pending', const Color(0xFFF59E0B), const Color(0xFFFEF3C7), false),
        ],
      ),
    );
  }

  Widget _buildEventTableRow(
    BuildContext context,
    String name,
    String date,
    String dept,
    String organizer,
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
          Expanded(flex: 3, child: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)))),
          Expanded(flex: 2, child: Text(date, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          Expanded(flex: 2, child: Text(dept, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          Expanded(flex: 2, child: Text(organizer, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          Expanded(flex: 2, child: Text(responses, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B), fontWeight: FontWeight.w500))),
          Expanded(
            flex: 2,
            child: Row(
              children: [
                if (rating != '—') const Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 14),
                const SizedBox(width: 2),
                Text(
                  rating,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: rating.contains('2.3') ? const Color(0xFFEF4444) : const Color(0xFF1E293B),
                  ),
                ),
              ],
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
              child: ElevatedButton(
                onPressed: !hasData
                    ? null
                    : () {
                        _showEventDetailDialog(context, name, date, dept, organizer, responses, rating, status);
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
  final Color valueColor;
  final IconData icon;
  final Color iconColor;

  const _CoordinatorStatCard({
    required this.label,
    required this.value,
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
            color: Colors.black.withValues(alpha: 0.03),
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
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
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
                            Text('Aggregated Scores (${event.responses} raters)',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            const Spacer(),
                            const Icon(Icons.star_rounded, color: AppColors.amber, size: 18),
                            const SizedBox(width: 4),
                            Text('${avg.toStringAsFixed(2)}/5',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                          ]),
                          const SizedBox(height: 20),

                          // Radar chart
                          Center(
                            child: _RadarChart(
                              values: agg.asList,
                              size: 200,
                              color: AppColors.tabActive,
                              labels: const ['Event Planning', 'Achievement of', 'Personnel Performance', 'Time Management', 'Participant Engagement', 'Resource Management'],
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Criterion score grid (2 columns)
                          _criterionGrid(agg),
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

  Widget _criterionGrid(EventRubricScores agg) {
    final scores = [agg.planning, agg.objectives, agg.personnel, agg.timeMgmt, agg.engagement, agg.resource];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, mainAxisExtent: 40, crossAxisSpacing: 12, mainAxisSpacing: 8,
      ),
      itemCount: 6,
      itemBuilder: (_, i) {
        final c = _kCriteria[i];
        return Row(children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(color: c.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Icon(c.icon, color: c.color, size: 14),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(c.label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 8),
          _MiniStars(value: scores[i]),
        ]);
      },
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
        const Icon(Icons.star_rounded, color: AppColors.amber, size: 15),
        const SizedBox(width: 4),
        Text(rating.overallScore.toStringAsFixed(1),
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const Text('/5', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ]),
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
    if (widget.role == 'teacher') { _role = EvaluatorRole.teacher; }
    else if (widget.role == 'dean') { _role = EvaluatorRole.dean; }
    else if (widget.role == 'coordinator') { _role = EvaluatorRole.coordinator; }
    else if (widget.role == 'principal') { _role = EvaluatorRole.principal; }
    else { _role = EvaluatorRole.student; }
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
          decoration: BoxDecoration(color: criterion.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(7)),
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
      ..color = color.withValues(alpha: 0.18)
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

  const _EventsTable({required this.events, required this.role, required this.onViewResults, required this.onRateEvent});

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
        final double tableWidth = constraints.maxWidth > 1000 ? constraints.maxWidth : 1000;
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
        SizedBox(width: 110, child: _Th('AVG RATING')),
        SizedBox(width: 115, child: _Th('STATUS')),
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

  const _EventRow({required this.event, required this.index, required this.role, required this.onViewResults, required this.onRateEvent});

  @override
  Widget build(BuildContext context) {
    final avg = event.avgRating;
    final int pct = event.attendees > 0
        ? ((event.responses / event.attendees) * 100).round() : 0;

    // Rating widget
    Widget ratingWidget = avg != null
        ? Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.star_rounded, color: AppColors.amber, size: 14),
            const SizedBox(width: 4),
            Text('${avg.toStringAsFixed(1)}/5',
                style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600,
                  color: avg < 3.0 ? AppColors.danger : AppColors.textPrimary,
                )),
          ])
        : const Text('—', style: TextStyle(fontSize: 14, color: AppColors.textHint));

    // Status + action based on role
    Widget statusChip;
    String actionLabel;
    VoidCallback? onAction;

    switch (event.status) {
      case EventStatus.awaitingRatings:
        statusChip  = _pill('Pending', AppColors.statusAmberBg, AppColors.statusAmberFg);
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
        statusChip  = _pill('Completed', AppColors.statusGreenBg, AppColors.statusGreenFg);
        actionLabel = 'View Results';
        onAction    = () => onViewResults(event);
      case EventStatus.flagged:
        statusChip  = _pill('Flagged', AppColors.statusRedBg, AppColors.statusRedFg);
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
  final Color valueColor, iconColor;
  final IconData icon;
  const _StatCard({required this.label, required this.value, required this.valueColor, required this.icon, required this.iconColor});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    decoration: BoxDecoration(color: AppColors.cardBg, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.cardBorder, width: 0.8)),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: AppTextStyles.statLabel),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: valueColor, letterSpacing: -0.3)),
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
      decoration: BoxDecoration(color: criterion.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(7)),
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
    final Color ic = isDark ? Colors.white.withValues(alpha: 0.8) : AppColors.textSecondary;
    String display = hint ?? 'Select…';
    if (value != null) {
      final m = items.where((i) => i.value == value);
      if (m.isNotEmpty) { display = m.first.label; }
    }
    return PopupMenuButton<String?>(
      onSelected: onChanged,
      offset: const Offset(0, 42),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: AppColors.cardBorder.withValues(alpha: 0.8), width: 0.8)),
      color: Colors.white, elevation: 8,
      constraints: const BoxConstraints(minWidth: 180, maxWidth: 280),
      itemBuilder: (_) => items.map((item) => PopupMenuItem<String?>(
        value: item.value, height: 38,
        child: Row(children: [
          if (item.value == value) ...[
            const Icon(Icons.check_rounded, size: 14, color: AppColors.tabActive),
            const SizedBox(width: 6),
          ] else const SizedBox(width: 20),
          Text(item.label, style: TextStyle(fontSize: 13, color: item.value == value ? AppColors.tabActive : AppColors.textPrimary, fontWeight: item.value == value ? FontWeight.w600 : FontWeight.w400)),
        ]),
      )).toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8), border: Border.all(color: border, width: 1)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (leadingIcon != null) ...[Icon(leadingIcon, size: 14, color: ic), const SizedBox(width: 6)],
          Text(display, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: fg)),
          const SizedBox(width: 6),
          Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: ic),
        ]),
      ),
    );
  }
}