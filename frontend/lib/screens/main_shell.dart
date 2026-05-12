import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/app_state.dart';
import '../widgets/sidebar.dart';
import 'dashboard_screen.dart';
import 'task_manager_screen.dart';
import 'my_tasks_screen.dart';
import 'activity_screen.dart';
import 'login_screen.dart';
import 'create_task_screen.dart';
import 'profile_screen.dart';
import 'task_detail_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  NavPage _currentPage = NavPage.dashboard;
  int? _activeTaskId;
  bool _showingCreateTask = false;
  bool _showingCreateTemplate = false;

  void _onNavigate(NavPage page) {
    setState(() {
      _currentPage = page;
      _activeTaskId = null;
      _showingCreateTask = false;
      _showingCreateTemplate = false;
    });
  }

  void _selectTask(int id) => setState(() {
    _activeTaskId = id;
    _showingCreateTask = false;
    _showingCreateTemplate = false;
  });

  void _clearTask() => setState(() => _activeTaskId = null);

  Widget _buildPage() {
    final role = context.read<AppState>().userRole;
    final canReassign = role == 'coordinator' || role == 'dean';

    switch (_currentPage) {
      case NavPage.dashboard:
        return const DashboardScreen();

      case NavPage.taskManager:
        return TaskManagerScreen(
          onCreateTask: () => _showCreateTask(context),
          onCreateTemplate: _showCreateTemplateFn,
          onSelectTask: _selectTask,
        );

      case NavPage.myTasks:
        // Tasks ASSIGNED to the current user (coordinator/dean/teacher/registrar)
        return MyTasksScreen(onSelectTask: _selectTask);


      case NavPage.activity:
        return const ActivityScreen();
    }
  }

  String get _pageTitle {
    final user = context.read<AppState>().currentUser;
    return user?.fullName.split(' ').first ?? 'User';
  }

  bool get _showCreateBtn {
    final role = context.read<AppState>().userRole;
    return _currentPage == NavPage.taskManager &&
        (role == 'admin' || role == 'principal' ||
         role == 'coordinator' || role == 'dean' || role == 'registrar') &&
        _activeTaskId == null &&
        !_showingCreateTask &&
        !_showingCreateTemplate;
  }

  bool get _showTemplateBtn {
    final role = context.read<AppState>().userRole;
    return _currentPage == NavPage.taskManager &&
        (role == 'admin' || role == 'principal') &&
        _activeTaskId == null &&
        !_showingCreateTask &&
        !_showingCreateTemplate;
  }

  void _showCreateTask(BuildContext ctx) {
    setState(() {
      _showingCreateTask = true;
      _showingCreateTemplate = false;
      _activeTaskId = null;
    });
  }

  void _showCreateTemplateFn() {
    setState(() {
      _showingCreateTemplate = true;
      _showingCreateTask = false;
      _activeTaskId = null;
    });
  }

  Future<void> _logout() async {
    await context.read<AppState>().logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
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
                width: 38, height: 38,
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
          if (!isMobile && _showTemplateBtn) ...[
            OutlinedButton.icon(
              onPressed: _showCreateTemplateFn,
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
          if (_showCreateBtn)
            ElevatedButton(
              onPressed: () => _showCreateTask(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.darkBanner,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('Create Task',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600, fontSize: 13)),
            ),
          const SizedBox(width: 12),
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
          // Desktop Sidebar — always visible
          if (!isMobile)
            AppSidebar(
              currentPage: _currentPage,
              userName: _pageTitle,
              userRole: role,
              onNavigate: _onNavigate,
              onLogout: _logout,
              showCreateTask: _showCreateBtn,
              onCreateTask: () => _showCreateTask(context),
            ),

          // Main Content
          Expanded(
            child: _activeTaskId != null
                // ── Task detail inline ──
                ? TaskDetailScreen(
                    taskId: _activeTaskId!,
                    onBack: _clearTask,
                  )
                : _showingCreateTask
                    // ── Create Task inline ──
                    ? CreateTaskScreen(
                        onBack: () => setState(() => _showingCreateTask = false),
                        onCreated: () => setState(() => _showingCreateTask = false),
                      )
                    : _showingCreateTemplate
                        // ── Create Template inline ──
                        ? CreateTaskScreen(
                            isTemplate: true,
                            onBack: () => setState(() => _showingCreateTemplate = false),
                            onCreated: () => setState(() => _showingCreateTemplate = false),
                          )
                        // ── Normal view ──
                        : Column(
                            children: [
                              _buildTopBar(isMobile),
                              Expanded(child: _buildPage()),
                            ],
                          ),
          ),
        ],
      ),
    );
  }
}
