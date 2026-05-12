import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';
import 'task_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardData? _data;
  bool _loading = true;
  DateTime _calDate = DateTime.now();

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final d = await ApiService.getDashboard();
      if (mounted) setState(() { _data = d; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppTheme.accentBlue));

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(isMobile ? 14 : 24, 8, isMobile ? 14 : 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppBanner(
              title: 'Dashboard',
              subtitle: 'Everything you need in one place — manage tasks, track progress, and stay organized.',
            ),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: StatCard(count: '${_data?.pending ?? 0}', label: 'Pending', iconBg: const Color(0xFFEFF6FF), iconColor: const Color(0xFF60A5FA), icon: Icons.notifications_outlined)),
              const SizedBox(width: 12),
              Expanded(child: StatCard(count: '${_data?.submitted ?? 0}', label: 'Submitted', iconBg: AppTheme.greenBg, iconColor: AppTheme.greenColor, icon: Icons.check_circle_outline)),
              const SizedBox(width: 12),
              Expanded(child: StatCard(count: '${_data?.missing ?? 0}', label: 'Missing', iconBg: AppTheme.redBg, iconColor: AppTheme.redColor, icon: Icons.cancel_outlined)),
            ]),
            const SizedBox(height: 20),
            isMobile
                ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _buildTaskManagerSection(),
                    const SizedBox(height: 14),
                    _buildMyTaskSection(),
                    const SizedBox(height: 14),
                    _buildPendingSection(),
                  ])
                : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        _buildTaskManagerSection(),
                        const SizedBox(height: 14),
                        _buildMyTaskSection(),
                        const SizedBox(height: 14),
                        _buildPendingSection(),
                      ]),
                    ),
                    const SizedBox(width: 20),
                    SizedBox(width: 260, child: _buildCalendar()),
                  ]),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskManagerSection() {
    final tasks = _data?.taskManagerTasks ?? [];
    return _DashSection(title: 'TASK MANAGER', children: tasks.isEmpty
        ? [Text('No tasks', style: AppTheme.bodyMd)]
        : tasks.take(3).map((t) => _DashTaskItem(
              title: t.title,
              subtitle: t.instructions != null
                  ? t.instructions!.replaceAll('\n', ' ').substring(0, t.instructions!.length > 70 ? 70 : t.instructions!.length)
                  : '',
              onTap: () => _openDetail(t.id),
            )).toList());
  }

  Widget _buildMyTaskSection() {
    final tasks = _data?.myTasks ?? [];
    return _DashSection(title: 'MY TASK', children: tasks.isEmpty
        ? [Text('No tasks assigned', style: AppTheme.bodyMd)]
        : tasks.take(3).map((t) => _DashTaskItem(title: t.title, subtitle: '', onTap: () => _openDetail(t.id))).toList());
  }

  Widget _buildPendingSection() {
    final events = _data?.events ?? [];
    return _DashSection(title: 'PENDING APPROVAL', children: events.isEmpty
        ? [Text('No pending approvals', style: AppTheme.bodyMd)]
        : events.map((e) => _DashTaskItem(title: e['title'] ?? '', subtitle: e['event_date'] ?? '', onTap: () {})).toList());
  }

  Widget _buildCalendar() {
    final months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    final days = ['S','M','T','W','T','F','S'];
    final firstDay = DateTime(_calDate.year, _calDate.month, 1).weekday % 7;
    final daysInMonth = DateTime(_calDate.year, _calDate.month + 1, 0).day;
    final now = DateTime.now();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppTheme.cardColor, borderRadius: BorderRadius.circular(12), boxShadow: AppTheme.cardShadow),
      child: Column(children: [
        Row(children: [
          GestureDetector(
            onTap: () => setState(() => _calDate = DateTime(_calDate.year, _calDate.month - 1)),
            child: const Icon(Icons.chevron_left, size: 22, color: AppTheme.textMuted)),
          Expanded(child: Column(children: [
            Text(months[_calDate.month - 1], style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700), textAlign: TextAlign.center),
            Text('${_calDate.year}', style: AppTheme.bodySm, textAlign: TextAlign.center),
          ])),
          GestureDetector(
            onTap: () => setState(() => _calDate = DateTime(_calDate.year, _calDate.month + 1)),
            child: const Icon(Icons.chevron_right, size: 22, color: AppTheme.textMuted)),
        ]),
        const SizedBox(height: 10),
        Row(children: days.map((d) => Expanded(child: Center(child: Text(d, style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textMuted))))).toList()),
        const SizedBox(height: 4),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 1.1),
          itemCount: firstDay + daysInMonth,
          itemBuilder: (_, i) {
            if (i < firstDay) return const SizedBox();
            final day = i - firstDay + 1;
            final isToday = day == now.day && _calDate.month == now.month && _calDate.year == now.year;
            final hasDeadline = (_data?.taskManagerTasks ?? []).any((t) {
              if (t.endDate == null) return false;
              try { final d = DateTime.parse(t.endDate!); return d.day == day && d.month == _calDate.month && d.year == _calDate.year; }
              catch (_) { return false; }
            });
            return Container(
              margin: const EdgeInsets.all(1),
              decoration: BoxDecoration(color: isToday ? AppTheme.darkBanner : Colors.transparent, borderRadius: BorderRadius.circular(5)),
              child: Stack(alignment: Alignment.center, children: [
                Center(child: Text('$day', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: isToday ? FontWeight.w700 : FontWeight.w400, color: isToday ? Colors.white : AppTheme.textPrimary))),
                if (hasDeadline && !isToday)
                  Positioned(bottom: 2, child: Container(width: 4, height: 4, decoration: const BoxDecoration(color: AppTheme.greenColor, shape: BoxShape.circle))),
              ]),
            );
          },
        ),
      ]),
    );
  }

  void _openDetail(int id) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: id)));
}

class _DashTaskItem extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  const _DashTaskItem({required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.borderColor))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(subtitle, style: AppTheme.bodyMd, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ]),
    ),
  );
}

class _DashSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _DashSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(color: AppTheme.cardColor, borderRadius: BorderRadius.circular(12), boxShadow: AppTheme.cardShadow),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted, letterSpacing: 0.6)),
      const SizedBox(height: 8),
      ...children,
    ]),
  );
}