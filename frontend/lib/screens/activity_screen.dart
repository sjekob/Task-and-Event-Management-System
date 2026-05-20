import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
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

  @override
  Widget build(BuildContext context) {
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
          Container(
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
                if (_loading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else if (_error != null)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          Icon(Icons.error_outline, color: AppTheme.redColor, size: 36),
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
                          Icon(Icons.event_busy, color: AppTheme.textLight, size: 40),
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
          ),
        ],
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
}

// ── Event Detail Dialog ──────────────────────────────────────────────────────

class _EventDetailDialog extends StatelessWidget {
  final Map<String, dynamic> event;
  const _EventDetailDialog({required this.event});

  @override
  Widget build(BuildContext context) {
    final status = event['status'] as String?;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
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
            // Body
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Basic info grid
                    _SectionLabel('Event Information'),
                    const SizedBox(height: 10),
                    _InfoGrid(items: [
                      _InfoItem('Nature', event['nature']),
                      _InfoItem('Target Date', _formatDate(event['target_date'])),
                      _InfoItem('Venue', event['venue']),
                      _InfoItem('Fund Source', event['fund_source']),
                      _InfoItem('Proposed Budget', event['proposed_budget'] != null
                          ? '₱${event['proposed_budget']}' : null),
                      _InfoItem('Participants', event['participants']),
                    ]),

                    if (_hasVal(event['focal_name'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Focal Person'),
                      const SizedBox(height: 10),
                      _InfoGrid(items: [
                        _InfoItem('Name', event['focal_name']),
                        _InfoItem('Role', event['focal_role']),
                        _InfoItem('Contact', event['focal_contact']),
                      ]),
                    ],

                    if (_hasVal(event['rationale'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Rationale'),
                      const SizedBox(height: 6),
                      _TextBlock(event['rationale'] as String),
                    ],

                    if (_hasVal(event['objectives'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Objectives'),
                      const SizedBox(height: 6),
                      _TextBlock(event['objectives'] as String),
                    ],

                    if (_hasVal(event['expected_outputs'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Expected Outputs'),
                      const SizedBox(height: 6),
                      _TextBlock(event['expected_outputs'] as String),
                    ],

                    if (_hasVal(event['phase1']) || _hasVal(event['phase2']) || _hasVal(event['phase3'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Implementation Phases'),
                      const SizedBox(height: 10),
                      if (_hasVal(event['phase1'])) _PhaseItem('Phase 1 – Pre-Activity', event['phase1'] as String),
                      if (_hasVal(event['phase2'])) _PhaseItem('Phase 2 – During Activity', event['phase2'] as String),
                      if (_hasVal(event['phase3'])) _PhaseItem('Phase 3 – Post-Activity', event['phase3'] as String),
                    ],

                    if (_hasVal(event['activity_matrix'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Activity Matrix'),
                      const SizedBox(height: 6),
                      _TextBlock(event['activity_matrix'] as String),
                    ],

                    if (_hasVal(event['exec_committee'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Executive Committee'),
                      const SizedBox(height: 6),
                      _TextBlock(event['exec_committee'] as String),
                    ],

                    if (_hasVal(event['twg_groups'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('TWG Groups'),
                      const SizedBox(height: 6),
                      _TextBlock(event['twg_groups'] as String),
                    ],

                    if (_hasVal(event['monitoring_criteria'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Monitoring Criteria'),
                      const SizedBox(height: 6),
                      _TextBlock(event['monitoring_criteria'] as String),
                    ],

                    if (_hasVal(event['indicators'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Indicators'),
                      const SizedBox(height: 6),
                      _TextBlock(event['indicators'] as String),
                    ],

                    if (_hasVal(event['comments'])) ...[
                      const SizedBox(height: 16),
                      _SectionLabel('Comments / Notes'),
                      const SizedBox(height: 6),
                      _TextBlock(event['comments'] as String),
                    ],

                    if (_hasVal(event['creator_name'])) ...[
                      const SizedBox(height: 16),
                      const Divider(color: AppTheme.borderColor),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.person_outline, size: 14, color: AppTheme.textLight),
                          const SizedBox(width: 6),
                          Text('Created by ', style: AppTheme.caption),
                          Text(
                            '${event['creator_name']}${_hasVal(event['creator_role']) ? ' (${event['creator_role']})' : ''}',
                            style: AppTheme.captionMd,
                          ),
                          if (_hasVal(event['created_at'])) ...[
                            Text('  ·  ', style: AppTheme.caption),
                            Text(_formatDate(event['created_at'] as String), style: AppTheme.caption),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            // Footer
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

  bool _hasVal(dynamic v) => v != null && v.toString().trim().isNotEmpty;

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
}

// ── Helper widgets ───────────────────────────────────────────────────────────

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

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: AppTheme.labelMd.copyWith(color: AppTheme.accentBlue, fontSize: 12),
  );
}

class _InfoItem {
  final String label;
  final dynamic value;
  const _InfoItem(this.label, this.value);
}

class _InfoGrid extends StatelessWidget {
  final List<_InfoItem> items;
  const _InfoGrid({required this.items});

  @override
  Widget build(BuildContext context) {
    final filtered = items.where((i) => i.value != null && i.value.toString().trim().isNotEmpty).toList();
    if (filtered.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 12,
      runSpacing: 8,
      children: filtered.map((i) => SizedBox(
        width: 200,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(i.label, style: AppTheme.caption),
            const SizedBox(height: 2),
            Text(i.value.toString(), style: AppTheme.labelMd),
          ],
        ),
      )).toList(),
    );
  }
}

class _TextBlock extends StatelessWidget {
  final String text;
  const _TextBlock(this.text);

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: AppTheme.bgColor,
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(text, style: AppTheme.bodyMd),
  );
}

class _PhaseItem extends StatelessWidget {
  final String title;
  final String content;
  const _PhaseItem(this.title, this.content);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTheme.captionMd.copyWith(color: AppTheme.textPrimary)),
        const SizedBox(height: 4),
        _TextBlock(content),
      ],
    ),
  );
}
