import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/app_state.dart';
import '../widgets/sidebar.dart';

class MainShell extends StatefulWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  NavPage _locationToPage(String loc) {
    if (loc.startsWith('/my-special-tasks')) return NavPage.mySpecialTasks;
    if (loc.startsWith('/special-tasks')) return NavPage.specialTasks;
    if (loc.startsWith('/tasks')) return NavPage.taskManager;
    if (loc.startsWith('/my-tasks')) return NavPage.myTasks;
    if (loc.startsWith('/activity')) return NavPage.activity;
    if (loc.startsWith('/personnel')) return NavPage.personnelManagement;
    if (loc.startsWith('/appraisal')) return NavPage.appraisal;
    if (loc.startsWith('/events')) return NavPage.eventManagement;
    return NavPage.dashboard;
  }

  void _onNavigate(NavPage page) {
    switch (page) {
      case NavPage.dashboard:         context.go('/dashboard'); break;
      case NavPage.taskManager:       context.go('/tasks'); break;
      case NavPage.myTasks:           context.go('/my-tasks'); break;
      case NavPage.specialTasks:      context.go('/special-tasks'); break;
      case NavPage.mySpecialTasks:    context.go('/my-special-tasks'); break;
      case NavPage.activity:          context.go('/activity'); break;
      case NavPage.personnelManagement: context.go('/personnel'); break;
      case NavPage.appraisal:         context.go('/appraisal'); break;
      case NavPage.eventManagement:   context.go('/events'); break;
    }
  }

  Future<void> _logout() async {
    await context.read<AppState>().logout();
    // GoRouter's refreshListenable redirects to /login automatically
  }

  bool _showCreateBtn(String loc, String role) =>
      (loc == '/tasks' || loc == '/special-tasks') &&
      (role == 'admin' || role == 'principal' ||
       role == 'coordinator' || role == 'dean' || role == 'registrar');

  // The create target depends on which task screen we're on.
  String _createPath(String loc) =>
      loc.startsWith('/special-tasks') ? '/special-tasks/new' : '/tasks/new';

  bool _showTemplateBtn(String loc, String role) =>
      loc == '/tasks' && (role == 'admin' || role == 'principal');

  String _stripRolePrefix(String name, String role) {
    if (name.isEmpty || role.isEmpty) return name;
    final prefix = role.toLowerCase();
    if (name.toLowerCase().startsWith('$prefix ')) {
      return name.substring(role.length + 1).trim();
    }
    return name;
  }

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AppState>().userRole;
    final user = context.read<AppState>().currentUser;
    final loc = GoRouterState.of(context).matchedLocation;
    final currentPage = _locationToPage(loc);
    final isMobile = MediaQuery.of(context).size.width < 768;
    final rawName = (user != null && (user.firstName?.isNotEmpty ?? false))
        ? '${user.firstName}${user.lastName != null ? ' ${user.lastName}' : ''}'
        : user?.fullName ?? 'User';
    final displayName = _stripRolePrefix(rawName, role);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppTheme.bgColor,
      drawer: isMobile
          ? MobileNavDrawer(
              currentPage: currentPage,
              userName: displayName,
              userRole: role,
              userInitials: user?.initials ?? 'U',
              onNavigate: _onNavigate,
              onLogout: _logout,
            )
          : null,
      body: Row(
        children: [
          if (!isMobile)
            AppSidebar(
              currentPage: currentPage,
              userName: displayName,
              userRole: role,
              onNavigate: _onNavigate,
              onLogout: _logout,
              showCreateTask: _showCreateBtn(loc, role),
              onCreateTask: () => context.go(_createPath(loc)),
            ),
          Expanded(
            child: Column(
              children: [
                _buildTopBar(isMobile, loc, role, displayName, user?.initials ?? 'U'),
                Expanded(child: widget.child),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar(bool isMobile, String loc, String role, String displayName, String initials) {
    return Container(
      padding: EdgeInsets.fromLTRB(isMobile ? 12 : 24, 16, isMobile ? 12 : 24, 16),
      color: AppTheme.bgColor,
      child: Row(
        children: [
          if (isMobile)
            GestureDetector(
              onTap: () => _scaffoldKey.currentState?.openDrawer(),
              child: Container(
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.menu_rounded, size: 20, color: Colors.white),
              ),
            )
          else
            Text(displayName,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary)),
          const Spacer(),
          if (!isMobile && _showTemplateBtn(loc, role)) ...[
            OutlinedButton.icon(
              onPressed: () => context.go('/tasks/template'),
              icon: const Icon(Icons.library_add_outlined, size: 15),
              label: Text('Create Template',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600, fontSize: 13)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.accentBlue,
                side: const BorderSide(color: AppTheme.accentBlue),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(width: 8),
          ],
          if (_showCreateBtn(loc, role))
            ElevatedButton(
              onPressed: () => context.go(_createPath(loc)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.darkBanner,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text(loc.startsWith('/special-tasks') ? 'Create Special Task' : 'Create Task',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600, fontSize: 13)),
            ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () => context.go('/profile'),
            child: CircleAvatar(
              radius: 20,
              backgroundColor: AppTheme.sidebarActive,
              child: Text(initials,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 16)),
            ),
          ),
        ],
      ),
    );
  }
}
