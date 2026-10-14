import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/utils/responsive.dart';
import '../../../../core/services/api_service.dart';

// ── Public drawer helper ─────────────────────────────────
// Call this from any page's Scaffold.drawer
class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});
  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFFACC2DF),
      child: _SidebarContent(collapsed: false, inDrawer: true),
    );
  }
}

// ── Bottom Nav Bar ───────────────────────────────────────
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    String currentRoute = '/dashboard';
    try {
      currentRoute = GoRouterState.of(context).uri.toString();
    } catch (_) {}

    int currentIndex = 0;
    if (currentRoute.contains('task')) currentIndex = 1;
    if (currentRoute.contains('appraisal')) currentIndex = 2;
    if (currentRoute.contains('calendar')) currentIndex = 3;

    return BottomNavigationBar(
      currentIndex: currentIndex,
      type: BottomNavigationBarType.fixed,
      backgroundColor: const Color(0xFF1E2126),
      selectedItemColor: Colors.white,
      unselectedItemColor: Colors.white54,
      selectedFontSize: 11,
      unselectedFontSize: 11,
      onTap: (i) {
        switch (i) {
          case 0: context.go(AppRoutes.dashboard); break;
          case 1: context.go(AppRoutes.taskManager); break;
          case 2: context.go(AppRoutes.appraisal); break;
          case 3: context.go(AppRoutes.calendar); break;
        }
      },
      items: const [
        BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded), label: 'Dashboard'),
        BottomNavigationBarItem(
            icon: Icon(Icons.edit_outlined), label: 'Tasks'),
        BottomNavigationBarItem(
            icon: Icon(Icons.assignment_outlined), label: 'Appraisal'),
        BottomNavigationBarItem(
            icon: Icon(Icons.list_alt_outlined), label: 'Calendar'),
      ],
    );
  }
}

// ── Sidebar (desktop only) ───────────────────────────────
class SidebarWidget extends StatelessWidget {
  const SidebarWidget({super.key});

  @override
  Widget build(BuildContext context) {
    if (Responsive.isMobile(context)) return const SizedBox.shrink();
    return const _SidebarStateful();
  }
}

class _SidebarStateful extends StatefulWidget {
  const _SidebarStateful();
  @override
  State<_SidebarStateful> createState() => _SidebarStatefulState();
}

class _SidebarStatefulState extends State<_SidebarStateful> {
  bool _collapsed = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      width: _collapsed ? 68 : 242,
      child: _SidebarContent(
        collapsed: _collapsed,
        inDrawer: false,
        onToggleCollapse: () =>
            setState(() => _collapsed = !_collapsed),
      ),
    );
  }
}

// ── Shared sidebar content ───────────────────────────────
class _SidebarContent extends StatefulWidget {
  final bool collapsed;
  final bool inDrawer;
  final VoidCallback? onToggleCollapse;

  const _SidebarContent({
    required this.collapsed,
    required this.inDrawer,
    this.onToggleCollapse,
  });

  @override
  State<_SidebarContent> createState() => _SidebarContentState();
}

class _SidebarContentState extends State<_SidebarContent> {
  bool _taskExpanded = true;

  @override
  Widget build(BuildContext context) {
    String currentRoute = '/dashboard';
    try {
      currentRoute = GoRouterState.of(context).uri.toString();
    } catch (_) {}

    return Container(
      decoration: const BoxDecoration(color: Color(0xFFACC2DF)),
      child: Column(
        children: [
          // Logo
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 12, 16),
            child: Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.grid_view_rounded,
                      color: Colors.white, size: 20),
                ),
                if (!widget.collapsed) ...[
                  const SizedBox(width: 10),
                  const Text('TaskNet',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700)),
                ],
                const Spacer(),
                if (!widget.inDrawer)
                  GestureDetector(
                    onTap: widget.onToggleCollapse,
                    child: Container(
                      width: 24, height: 24,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(
                          widget.collapsed
                              ? Icons.chevron_right
                              : Icons.chevron_left,
                          color: Colors.white,
                          size: 18),
                    ),
                  ),
              ],
            ),
          ),

          // Nav items
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _NavTile(
                  icon: Icons.home_rounded,
                  label: 'Dashboard',
                  route: AppRoutes.dashboard,
                  currentRoute: currentRoute,
                  collapsed: widget.collapsed,
                  isActive: currentRoute == AppRoutes.dashboard ||
                      currentRoute == '/dashboard',
                ),
                _buildTaskSection(context, currentRoute),
                _NavTile(
                  icon: Icons.assignment_outlined,
                  label: 'Appraisal',
                  route: AppRoutes.appraisal,
                  currentRoute: currentRoute,
                  collapsed: widget.collapsed,
                  isActive: currentRoute.contains('appraisal'),
                ),
                _NavTile(
                  icon: Icons.list_alt_outlined,
                  label: 'Activity Calendar',
                  route: AppRoutes.calendar,
                  currentRoute: currentRoute,
                  collapsed: widget.collapsed,
                  isActive: currentRoute.contains('calendar'),
                ),
              ],
            ),
          ),

          // Logout
          Container(
            color: const Color(0xFF1E2126),
            child: ListTile(
              contentPadding: EdgeInsets.symmetric(
                  horizontal: widget.collapsed ? 16 : 20,
                  vertical: 4),
              leading: const Icon(Icons.logout_rounded,
                  color: Colors.white, size: 20),
              title: widget.collapsed
                  ? null
                  : const Text('Logout',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w500)),
              onTap: () async {
                await ApiService.logout();
                if (context.mounted) context.go(AppRoutes.login);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskSection(BuildContext context, String currentRoute) {
    final isChildActive = currentRoute.contains('task');

    if (widget.collapsed) {
      return ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        leading: const Icon(Icons.edit_outlined,
            color: Colors.white, size: 20),
        onTap: () => context.go(AppRoutes.taskManager),
      );
    }

    return Column(children: [
      InkWell(
        onTap: () =>
            setState(() => _taskExpanded = !_taskExpanded),
        child: Container(
          color: isChildActive
              ? Colors.black.withValues(alpha: 0.12)
              : null,
          padding: const EdgeInsets.symmetric(
              horizontal: 20, vertical: 12),
          child: Row(children: [
            const Icon(Icons.edit_outlined,
                color: Colors.white, size: 20),
            const SizedBox(width: 14),
            const Expanded(
                child: Text('Task',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w500))),
            Icon(
                _taskExpanded
                    ? Icons.keyboard_arrow_down
                    : Icons.keyboard_arrow_right,
                color: Colors.white,
                size: 18),
          ]),
        ),
      ),
      if (_taskExpanded) ...[
        _SubNavTile(
            label: 'Task Manager',
            route: AppRoutes.taskManager,
            currentRoute: currentRoute),
        _SubNavTile(
            label: 'My Tasks',
            route: AppRoutes.myTasks,
            currentRoute: currentRoute),
      ],
    ]);
  }
}

// ── Nav tile ─────────────────────────────────────────────
class _NavTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? route;
  final String currentRoute;
  final bool collapsed;
  final bool isActive;

  const _NavTile({
    required this.icon,
    required this.label,
    required this.currentRoute,
    required this.collapsed,
    required this.isActive,
    this.route,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: isActive ? Colors.black.withValues(alpha: 0.15) : null,
      child: ListTile(
        contentPadding: EdgeInsets.symmetric(
            horizontal: collapsed ? 16 : 20, vertical: 2),
        leading: Icon(icon, color: Colors.white, size: 20),
        title: collapsed
            ? null
            : Text(label,
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: isActive
                        ? FontWeight.w700
                        : FontWeight.w400)),
        onTap: route != null ? () => context.go(route!) : null,
      ),
    );
  }
}

// ── Sub nav tile ─────────────────────────────────────────
class _SubNavTile extends StatelessWidget {
  final String label;
  final String route;
  final String currentRoute;

  const _SubNavTile({
    required this.label,
    required this.route,
    required this.currentRoute,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = currentRoute == route;
    return InkWell(
      onTap: () => context.go(route),
      child: Container(
        color: isActive ? Colors.black.withValues(alpha: 0.12) : null,
        padding: const EdgeInsets.fromLTRB(54, 10, 20, 10),
        child: Text(label,
            style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight:
                    isActive ? FontWeight.w600 : FontWeight.w400)),
      ),
    );
  }
}