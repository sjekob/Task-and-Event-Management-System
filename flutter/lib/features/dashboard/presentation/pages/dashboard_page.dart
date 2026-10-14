import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/responsive.dart';
import '../widgets/sidebar_widget.dart';
import '../widgets/stat_card.dart';
import '../widgets/mini_calendar.dart';
import '../widgets/task_list_card.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);

    return Scaffold(
      backgroundColor: AppTheme.primaryLight,
      drawer: isMobile ? const AppDrawer() : null,
      bottomNavigationBar:
          isMobile ? const AppBottomNav() : null,
      body: Row(
        children: [
          const SidebarWidget(),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Container(
                  color: AppTheme.primaryLight,
                  padding: const EdgeInsets.fromLTRB(
                      24, 20, 24, 16),
                  child: Row(
                    mainAxisAlignment:
                        MainAxisAlignment.spaceBetween,
                    children: [
                      if (isMobile)
                        Builder(builder: (ctx) => IconButton(
                          icon: const Icon(Icons.menu,
                              color: Color(0xFF1A1A2E)),
                          onPressed: () =>
                              Scaffold.of(ctx).openDrawer(),
                        )),
                      Text('Coordinator',
                          style: Theme.of(context)
                              .textTheme
                              .displayMedium!
                              .copyWith(
                                fontSize: isMobile ? 20 : 26,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.textDark,
                              )),
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.primaryMid,
                          border: Border.all(
                              color: Colors.white, width: 2),
                        ),
                        child: const Icon(Icons.person,
                            color: Colors.white, size: 24),
                      ),
                    ],
                  ),
                ),

                // Body
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(
                        24, 0, 24, 24),
                    child: isMobile
                        ? _MobileBody()
                        : _DesktopBody(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Desktop layout ────────────────────────────────────────
class _DesktopBody extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _DashboardBanner(),
              const SizedBox(height: 20),
              _sectionLabel(context, 'To Do Tracker'),
              const SizedBox(height: 10),
              const Row(children: [
                Expanded(child: StatCard(
                    label: 'Pending', value: '6',
                    icon: Icons.notifications_outlined,
                    iconColor: Color(0xFF63B3ED))),
                SizedBox(width: 12),
                Expanded(child: StatCard(
                    label: 'Submitted', value: '3',
                    icon: Icons.check_circle_outline,
                    iconColor: Color(0xFF48BB78))),
                SizedBox(width: 12),
                Expanded(child: StatCard(
                    label: 'Missing', value: '1',
                    icon: Icons.error_outline,
                    iconColor: Color(0xFFE53E3E))),
              ]),
              const SizedBox(height: 20),
              _sectionLabel(context, 'Task Manager'),
              const SizedBox(height: 10),
              const TaskListCard(items: [
                TaskListItem(
                    title: 'Weekly Lesson Plan',
                    subtitle: 'Submit weekly lesson plan for Q1 Week 1'),
                TaskListItem(
                    title: 'Class Activity Photos',
                    subtitle: 'Upload photos from the science experiment'),
              ]),
              const SizedBox(height: 20),
              _sectionLabel(context, 'My Task'),
              const SizedBox(height: 10),
              const TaskListCard(items: [
                TaskListItem(title: 'Market Research'),
                TaskListItem(title: 'Student Assessment'),
              ]),
              const SizedBox(height: 20),
              _sectionLabel(context, 'Pending Approval'),
              const SizedBox(height: 10),
              const TaskListCard(items: [
                TaskListItem(
                    title: 'Intramurals', subtitle: '2024-03-25'),
                TaskListItem(
                    title: 'Science and Math Fair',
                    subtitle: '2024-03-25'),
              ]),
            ],
          ),
        ),
        const SizedBox(width: 20),
        const SizedBox(width: 290, child: MiniCalendar()),
      ],
    );
  }
}

// ── Mobile layout ─────────────────────────────────────────
class _MobileBody extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _DashboardBanner(),
        const SizedBox(height: 16),
        _sectionLabel(context, 'To Do Tracker'),
        const SizedBox(height: 10),
        // Stats in 3-col row on mobile too
        const Row(children: [
          Expanded(child: StatCard(
              label: 'Pending', value: '6',
              icon: Icons.notifications_outlined,
              iconColor: Color(0xFF63B3ED))),
          SizedBox(width: 8),
          Expanded(child: StatCard(
              label: 'Submitted', value: '3',
              icon: Icons.check_circle_outline,
              iconColor: Color(0xFF48BB78))),
          SizedBox(width: 8),
          Expanded(child: StatCard(
              label: 'Missing', value: '1',
              icon: Icons.error_outline,
              iconColor: Color(0xFFE53E3E))),
        ]),
        const SizedBox(height: 16),
        _sectionLabel(context, 'Task Manager'),
        const SizedBox(height: 10),
        const TaskListCard(items: [
          TaskListItem(
              title: 'Weekly Lesson Plan',
              subtitle: 'Submit weekly lesson plan for Q1 Week 1'),
          TaskListItem(
              title: 'Class Activity Photos',
              subtitle: 'Upload photos from the science experiment'),
        ]),
        const SizedBox(height: 16),
        _sectionLabel(context, 'My Task'),
        const SizedBox(height: 10),
        const TaskListCard(items: [
          TaskListItem(title: 'Market Research'),
          TaskListItem(title: 'Student Assessment'),
        ]),
        const SizedBox(height: 16),
        _sectionLabel(context, 'Pending Approval'),
        const SizedBox(height: 10),
        const TaskListCard(items: [
          TaskListItem(
              title: 'Intramurals', subtitle: '2024-03-25'),
          TaskListItem(
              title: 'Science and Math Fair',
              subtitle: '2024-03-25'),
        ]),
        const SizedBox(height: 16),
        // Calendar at bottom on mobile
        _sectionLabel(context, 'Calendar'),
        const SizedBox(height: 10),
        const MiniCalendar(),
      ],
    );
  }
}

Widget _sectionLabel(BuildContext context, String text) {
  return Text(text,
      style: Theme.of(context).textTheme.bodyMedium!.copyWith(
          color: AppTheme.textMedium,
          fontWeight: FontWeight.w500,
          fontSize: 14));
}

// ── Dashboard Banner ──────────────────────────────────────
class _DashboardBanner extends StatelessWidget {
  const _DashboardBanner();

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(isMobile ? 16 : 24),
      decoration: BoxDecoration(
        color: const Color(0xFF1E2126),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Stack(children: [
        Positioned.fill(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CustomPaint(painter: _HexPainter()),
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Dashboard',
                style: Theme.of(context)
                    .textTheme
                    .displayMedium!
                    .copyWith(
                        color: Colors.white,
                        fontSize: isMobile ? 24 : 32,
                        fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
                'Everything you need in one place — manage tasks, track progress, and stay organized.',
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.65),
                    fontSize: 12,
                    height: 1.5)),
          ],
        ),
      ]),
    );
  }
}

class _HexPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    const double r = 20.0;
    const double w = r * 2;
    const double h = r * 1.732;
    for (double row = -1; row < size.height / h + 1; row++) {
      for (double col = -1; col < size.width / w + 1; col++) {
        final double offsetX = (row % 2 == 0) ? 0 : r;
        final double cx = col * w + offsetX + r;
        final double cy = row * h + r;
        final path = Path();
        for (int i = 0; i < 6; i++) {
          final angle = (i * 60 - 30) * 3.14159265 / 180;
          final px = cx + r * _cos(angle);
          final py = cy + r * _sin(angle);
          if (i == 0) path.moveTo(px, py);
          else path.lineTo(px, py);
        }
        path.close();
        canvas.drawPath(path, paint);
      }
    }
  }
  double _cos(double r) => r < 0 ? -_cosR(-r) : _cosR(r);
  double _cosR(double r) {
    final n = r % 6.28318;
    return 1 - n*n/2 + n*n*n*n/24 - n*n*n*n*n*n/720;
  }
  double _sin(double r) => _cos(r - 1.5708);
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}