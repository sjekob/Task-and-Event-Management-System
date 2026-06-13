import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/app_state.dart';
import '../widgets/sidebar.dart';
import 'profile_screen.dart';

/// The persistent shell that wraps all authenticated pages.
///
/// Receives [location] (the current full URL path, e.g. /task-manager/create)
/// and [child] (the matched sub-route's widget) from GoRouter's ShellRoute.
///
/// The sidebar and top-bar remain stable while only the [child] area changes.
class MainShell extends StatefulWidget {
  final String location;
  final Widget child;

  const MainShell({super.key, required this.location, required this.child});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  // ── Paths where the top-bar (title + create buttons) should be visible ──────
  static const _topBarPaths = {
    '/dashboard',
    '/task-manager',
    '/my-tasks',
    '/activity',
    '/personnel',
    '/appraisal',
    '/events',
  };

  /// Which sidebar item is currently active, derived from the URL path.
  NavPage get _currentPage {
    final p = widget.location;
    if (p.startsWith('/task-manager')) return NavPage.taskManager;
    if (p.startsWith('/my-tasks'))     return NavPage.myTasks;
    if (p.startsWith('/activity'))     return NavPage.activity;
    if (p.startsWith('/personnel'))    return NavPage.personnelManagement;
    if (p.startsWith('/appraisal'))    return NavPage.appraisal;
    if (p.startsWith('/events'))       return NavPage.eventManagement;
    return NavPage.dashboard;
  }

  /// Maps a sidebar NavPage to its canonical route path.
  String _pathFor(NavPage page) {
    switch (page) {
      case NavPage.dashboard:            return '/dashboard';
      case NavPage.taskManager:          return '/task-manager';
      case NavPage.myTasks:              return '/my-tasks';
      case NavPage.activity:             return '/activity';
      case NavPage.personnelManagement:  return '/personnel';
      case NavPage.appraisal:            return '/appraisal';
      case NavPage.eventManagement:      return '/events';
    }
  }

  /// Navigate to a top-level section via the sidebar.
  void _onNavigate(NavPage page) => context.go(_pathFor(page));

  /// Display the logged-in user's first name in the top-bar.
  String get _pageTitle {
    final user = context.read<AppState>().currentUser;
    return user?.fullName.split(' ').first ?? 'User';
  }

  /// Show the "Create Task" button only on the task manager list view.
  bool get _showCreateBtn {
    final role = context.read<AppState>().userRole;
    return widget.location == '/task-manager' &&
        (role == 'admin' || role == 'principal' ||
         role == 'coordinator' || role == 'dean' || role == 'registrar');
  }

  /// Show the "Create Template" button only on the task manager list view
  /// and only for admin / principal.
  bool get _showTemplateBtn {
    final role = context.read<AppState>().userRole;
    return widget.location == '/task-manager' &&
        (role == 'admin' || role == 'principal');
  }

  /// Logout: clear auth then let GoRouter's redirect send to /login.
  Future<void> _logout() async {
    await context.read<AppState>().logout();
    // refreshListenable triggers the GoRouter redirect → /login automatically.
  }

  Widget _buildTopBar(bool isMobile) {
    return Container(
      padding: EdgeInsets.fromLTRB(isMobile ? 12 : 24, 16, isMobile ? 12 : 24, 16),
      color: AppTheme.bgColor,
      child: Row(
        children: [
          if (isMobile)
            GestureDetector(
              onTap: () => _scaffoldKey.currentState?.openDrawer(),
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.menu_rounded, size: 20, color: Colors.white),
              ),
            )
          else
            Text(_pageTitle,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary)),

          const Spacer(),

          // "Create Template" button — task manager, admin/principal only
          if (!isMobile && _showTemplateBtn) ...[
            OutlinedButton.icon(
              onPressed: () => context.go('/task-manager/template'),
              icon: const Icon(Icons.library_add_outlined, size: 15),
              label: Text('Create Template',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600, fontSize: 13)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.accentBlue,
                side: const BorderSide(color: AppTheme.accentBlue),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(width: 8),
          ],

          // "Create Task" button — task manager, all manager roles
          if (_showCreateBtn)
            ElevatedButton(
              onPressed: () => context.go('/task-manager/create'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.darkBanner,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('Create Task',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600, fontSize: 13)),
            ),

          const SizedBox(width: 12),

          // Profile avatar
          GestureDetector(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            ),
            child: CircleAvatar(
              radius: 20,
              backgroundColor: AppTheme.sidebarActive,
              child: Text(
                context.read<AppState>().currentUser?.initials ?? 'U',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AppState>().userRole;
    final isMobile = MediaQuery.of(context).size.width < 768;
    final user = context.read<AppState>().currentUser;
    final showTopBar = _topBarPaths.contains(widget.location);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppTheme.bgColor,
      drawer: isMobile
          ? MobileNavDrawer(
              currentPage: _currentPage,
              userName: _pageTitle,
              userRole: role,
              userInitials: user?.initials ?? 'U',
              onNavigate: _onNavigate,
              onLogout: _logout,
            )
          : null,
      body: Row(
        children: [
          // Desktop sidebar — always visible
          if (!isMobile)
            AppSidebar(
              currentPage: _currentPage,
              userName: _pageTitle,
              userRole: role,
              onNavigate: _onNavigate,
              onLogout: _logout,
            ),

          // Main content area
          Expanded(
            child: showTopBar
                // Regular pages: show top-bar above the route content
                ? Column(
                    children: [
                      _buildTopBar(isMobile),
                      Expanded(child: widget.child),
                    ],
                  )
                // Detail / form pages: route content fills the full area
                //   (CreateTaskScreen / TaskDetailScreen / AddEventScreen
                //    each have their own back button and header)
                : widget.child,
          ),
        ],
      ),
    );
  }
}
