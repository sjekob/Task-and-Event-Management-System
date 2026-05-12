import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../widgets/common_widgets.dart';

class DeanSubmissionsScreen extends StatefulWidget {
  const DeanSubmissionsScreen({super.key});

  @override
  State<DeanSubmissionsScreen> createState() => _DeanSubmissionsScreenState();
}

class _DeanSubmissionsScreenState extends State<DeanSubmissionsScreen> {
  List<Map<String, dynamic>> _log = [];
  bool _loading = true;
  String _filterStatus = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final log = await ApiService.getSubmissionLog();
      if (mounted) setState(() { _log = log; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filterStatus.isEmpty) return _log;
    return _log.where((e) => e['status'] == _filterStatus).toList();
  }

  Future<void> _updateStatus(int reportId, String status) async {
    try {
      await ApiService.updateReportStatus(reportId, status);
      _load();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Status updated to $status'),
        backgroundColor: AppTheme.darkBanner,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(e.toString()),
        backgroundColor: AppTheme.redColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(isMobile ? 14 : 24, 8, isMobile ? 14 : 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppBanner(
              title: 'Team Submissions',
              subtitle: 'Review teacher reports submitted to you. Mark completed or flag missing.',
            ),
            const SizedBox(height: 20),

            // Status filter chips
            Row(children: [
              _FilterChip(
                label: 'All',
                selected: _filterStatus.isEmpty,
                onTap: () => setState(() => _filterStatus = ''),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'Pending',
                selected: _filterStatus == 'Pending',
                color: AppTheme.amberBg,
                onTap: () => setState(() => _filterStatus = 'Pending'),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'Completed',
                selected: _filterStatus == 'Completed',
                color: AppTheme.greenBg,
                onTap: () => setState(() => _filterStatus = 'Completed'),
              ),
              const SizedBox(width: 8),
              _FilterChip(
                label: 'Missing',
                selected: _filterStatus == 'Missing',
                color: AppTheme.redBg,
                onTap: () => setState(() => _filterStatus = 'Missing'),
              ),
            ]),
            const SizedBox(height: 16),

            if (_loading)
              const Center(child: Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(color: AppTheme.accentBlue),
              ))
            else if (_filtered.isEmpty)
              Center(child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(children: [
                  Icon(Icons.inbox_outlined, size: 48, color: AppTheme.textLight),
                  const SizedBox(height: 12),
                  Text('No submissions yet', style: AppTheme.bodyMd),
                ]),
              ))
            else
              ..._filtered.map((e) => _SubmissionCard(
                    entry: e,
                    onComplete: () => _updateStatus(e['report_id'] as int, 'Completed'),
                    onMissing: () => _updateStatus(e['report_id'] as int, 'Missing'),
                  )),
          ],
        ),
      ),
    );
  }
}

class _SubmissionCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onComplete;
  final VoidCallback onMissing;

  const _SubmissionCard({
    required this.entry,
    required this.onComplete,
    required this.onMissing,
  });

  String _fmtDate(String? d) {
    if (d == null || d.isEmpty) return '';
    try {
      final dt = DateTime.parse(d);
      const months = ['Jan','Feb','Mar','Apr','May','Jun',
          'Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) { return d; }
  }

  @override
  Widget build(BuildContext context) {
    final status = entry['status'] as String? ?? 'Pending';
    Color statusBg, statusFg;
    switch (status) {
      case 'Completed':
        statusBg = AppTheme.greenBg; statusFg = AppTheme.greenColor; break;
      case 'Missing':
        statusBg = AppTheme.redBg; statusFg = AppTheme.redColor; break;
      default:
        statusBg = AppTheme.amberBg; statusFg = const Color(0xFF92400E);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: AppTheme.sidebarActive,
              child: Text(
                ((entry['sender_name'] as String? ?? '?')[0]).toUpperCase(),
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(entry['sender_name'] as String? ?? '', style: AppTheme.labelMd),
                if (entry['grade_level'] != null)
                  Text(entry['grade_level'] as String, style: AppTheme.bodySm),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(20)),
              child: Text(status,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 11, fontWeight: FontWeight.w600, color: statusFg)),
            ),
          ]),
          const SizedBox(height: 10),
          Text(entry['task_title'] as String? ?? '', style: AppTheme.heading3),
          if (entry['report_title'] != null) ...[
            const SizedBox(height: 4),
            Text(entry['report_title'] as String, style: AppTheme.bodyMd),
          ],
          const SizedBox(height: 4),
          Text(
            'Submitted: ${_fmtDate(entry['date_of_submission'] as String?)}',
            style: AppTheme.bodySm,
          ),
          const SizedBox(height: 12),
          Row(children: [
            OutlinedButton(
              onPressed: onComplete,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.greenColor,
                side: const BorderSide(color: AppTheme.greenColor),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('Completed',
                  style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: onMissing,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.redColor,
                side: const BorderSide(color: AppTheme.redColor),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('Missing',
                  style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ]),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: selected
                ? AppTheme.darkBanner
                : (color ?? AppTheme.cardColor),
            borderRadius: BorderRadius.circular(20),
            boxShadow: selected ? null : AppTheme.cardShadow,
          ),
          child: Text(label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AppTheme.textMuted)),
        ),
      );
}
