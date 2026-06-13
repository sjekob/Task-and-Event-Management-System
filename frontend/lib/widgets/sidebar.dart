import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../widgets/common_widgets.dart';

enum NavPage { dashboard, taskManager, myTasks, activity, personnelManagement, appraisal, eventManagement }

// ── Shared dark sidebar palette ───────────────────────────────────────────────
const Color _kSidebarBg       = Color(0xFF1A1A2E);
const Color _kActiveBg        = Color(0x1AFFFFFF); // white 10%
const Color _kHoverBg         = Color(0x0DFFFFFF); // white 5%
const Color _kMuted           = Color(0xFF8892A4);
const Color _kDivider         = Color(0x1FFFFFFF);

// ── Desktop Sidebar ───────────────────────────────────────────────────────────

class AppSidebar extends StatefulWidget {
  final NavPage currentPage;
  final String userName;
  final String userRole;
  final ValueChanged<NavPage> onNavigate;
  final VoidCallback onLogout;
  final VoidCallback? onCreateTask;
  final bool showCreateTask;

  const AppSidebar({
    super.key,
    required this.currentPage,
    required this.userName,
    required this.userRole,
    required this.onNavigate,
    required this.onLogout,
    this.onCreateTask,
    this.showCreateTask = false,
  });

  @override
  State<AppSidebar> createState() => _AppSidebarState();
}

class _AppSidebarState extends State<AppSidebar> {
  bool _collapsed = false;
  int  _unreadCount = 0;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _fetchUnread();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _fetchUnread());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchUnread() async {
    try {
      final count = await ApiService.getUnreadNotificationCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {}
  }

  Future<void> _openNotifications() async {
    await ApiService.markAllNotificationsRead();
    if (mounted) setState(() => _unreadCount = 0);
    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (_) => const _NotificationPanel(),
    );
  }

  bool get _isTopManager =>
      widget.userRole == 'admin' || widget.userRole == 'principal';
  bool get _canReassign =>
      widget.userRole == 'coordinator' || widget.userRole == 'dean' ||
      widget.userRole == 'registrar';
  bool get _isLeaf =>
      widget.userRole == 'teacher' || widget.userRole == 'registrar';
  bool get _canManagePersonnel =>
      widget.userRole == 'principal' || widget.userRole == 'registrar' ||
      widget.userRole == 'admin';
  bool get _hasAppraisalAccess =>
      widget.userRole == 'principal' || widget.userRole == 'coordinator' ||
      widget.userRole == 'dean' || widget.userRole == 'admin';

  String get _roleLabel => _roleLabelFor(widget.userRole);

  @override
  Widget build(BuildContext context) {
    final w = _collapsed ? 60.0 : 220.0;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      width: w,
      color: _kSidebarBg,
      child: Column(
        children: [
          // ── Header ──
          _buildHeader(),

          // ── Nav items ──
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!_collapsed) _sectionLabel('MAIN MENU'),
                  _NavItem(
                    icon: Icons.dashboard_outlined,
                    label: 'Dashboard',
                    isActive: widget.currentPage == NavPage.dashboard,
                    collapsed: _collapsed,
                    onTap: () => widget.onNavigate(NavPage.dashboard),
                  ),
                  if (_canReassign || _isLeaf)
                    _NavItem(
                      icon: Icons.assignment_outlined,
                      label: 'My Tasks',
                      isActive: widget.currentPage == NavPage.myTasks,
                      collapsed: _collapsed,
                      onTap: () => widget.onNavigate(NavPage.myTasks),
                    ),
                  _NavItem(
                    icon: Icons.calendar_today_outlined,
                    label: 'Activity',
                    isActive: widget.currentPage == NavPage.activity,
                    collapsed: _collapsed,
                    onTap: () => widget.onNavigate(NavPage.activity),
                  ),
                  if (!_collapsed) _sectionLabel('MANAGEMENT'),
                  if (_isTopManager || _canReassign)
                    _NavItem(
                      icon: Icons.check_box_outlined,
                      label: 'Task Manager',
                      isActive: widget.currentPage == NavPage.taskManager,
                      collapsed: _collapsed,
                      onTap: () => widget.onNavigate(NavPage.taskManager),
                    ),
                  if (_canManagePersonnel)
                    _NavItem(
                      icon: Icons.people_outlined,
                      label: 'Personnel',
                      isActive: widget.currentPage == NavPage.personnelManagement,
                      collapsed: _collapsed,
                      onTap: () => widget.onNavigate(NavPage.personnelManagement),
                    ),
                  if (_hasAppraisalAccess)
                    _NavItem(
                      icon: Icons.star_border_outlined,
                      label: 'Appraisal',
                      isActive: widget.currentPage == NavPage.appraisal,
                      collapsed: _collapsed,
                      onTap: () => widget.onNavigate(NavPage.appraisal),
                    ),
                  _NavItem(
                    icon: Icons.event_outlined,
                    label: 'Events',
                    isActive: widget.currentPage == NavPage.eventManagement,
                    collapsed: _collapsed,
                    onTap: () => widget.onNavigate(NavPage.eventManagement),
                  ),
                ],
              ),
            ),
          ),

          // ── Footer ──
          _buildFooter(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      height: 62,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _kDivider)),
      ),
      child: _collapsed
          ? Center(
              child: GestureDetector(
                onTap: () => setState(() => _collapsed = false),
                child: const Icon(Icons.chevron_right, color: _kMuted, size: 18),
              ),
            )
          : Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const TaskNetLogo(size: 30),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('TaskNet',
                            style: GoogleFonts.plusJakartaSans(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.2)),
                        Text('Management System',
                            style: GoogleFonts.plusJakartaSans(
                                color: Colors.white.withOpacity(0.55),
                                fontSize: 10)),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _collapsed = true),
                    child: const Icon(Icons.chevron_left, color: _kMuted, size: 18),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: _kDivider)),
      ),
      child: _collapsed
          ? GestureDetector(
              onTap: widget.onLogout,
              child: const Center(
                child: Icon(Icons.logout_rounded, color: _kMuted, size: 18),
              ),
            )
          : Column(
              children: [
                Row(children: [
                  CircleAvatar(
                    radius: 17,
                    backgroundColor: Colors.white.withOpacity(0.15),
                    child: Text(
                      widget.userName.isNotEmpty
                          ? widget.userName[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.userName,
                            style: GoogleFonts.plusJakartaSans(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        Text(_roleLabel,
                            style: GoogleFonts.plusJakartaSans(
                                color: Colors.white.withOpacity(0.6),
                                fontSize: 11)),
                      ],
                    ),
                  ),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  // Notification bell
                  GestureDetector(
                    onTap: _openNotifications,
                    child: Stack(clipBehavior: Clip.none, children: [
                      Container(
                        width: 34, height: 34,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(7),
                        ),
                        child: const Icon(Icons.notifications_outlined,
                            color: Color(0xCCFFFFFF), size: 17),
                      ),
                      if (_unreadCount > 0)
                        Positioned(
                          top: -4, right: -4,
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(
                              color: Color(0xFFE53E3E),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              _unreadCount > 9 ? '9+' : '$_unreadCount',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  // Logout
                  Expanded(
                    child: GestureDetector(
                      onTap: widget.onLogout,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(7),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.logout_rounded,
                                color: Color(0xCCFFFFFF), size: 15),
                            const SizedBox(width: 7),
                            Text('Logout',
                                style: GoogleFonts.plusJakartaSans(
                                    color: const Color(0xCCFFFFFF),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ]),
              ],
            ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: Text(text,
            style: TextStyle(
                color: _kMuted.withOpacity(0.7),
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8)),
      );
}

// ── Nav Item (shared by desktop + mobile drawer) ──────────────────────────────

class _NavItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final bool collapsed;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
    this.collapsed = false,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          margin: const EdgeInsets.only(bottom: 2),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: widget.isActive
                ? _kActiveBg
                : _hovered
                    ? _kHoverBg
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              // Active indicator bar
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 3,
                height: 16,
                margin: EdgeInsets.only(
                    left: widget.collapsed ? 10 : 10, right: 8),
                decoration: BoxDecoration(
                  color:
                      widget.isActive ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Icon(
                widget.icon,
                size: 17,
                color: (widget.isActive || _hovered)
                    ? Colors.white
                    : _kMuted,
              ),
              if (!widget.collapsed) ...[
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    widget.label,
                    style: TextStyle(
                      color: (widget.isActive || _hovered)
                          ? Colors.white
                          : _kMuted,
                      fontSize: 13,
                      fontWeight: widget.isActive
                          ? FontWeight.w600
                          : FontWeight.w400,
                      letterSpacing: 0.1,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Mobile Hamburger Drawer ───────────────────────────────────────────────────

class MobileNavDrawer extends StatelessWidget {
  final NavPage currentPage;
  final String userName;
  final String userRole;
  final String userInitials;
  final ValueChanged<NavPage> onNavigate;
  final VoidCallback onLogout;

  const MobileNavDrawer({
    super.key,
    required this.currentPage,
    required this.userName,
    required this.userRole,
    required this.userInitials,
    required this.onNavigate,
    required this.onLogout,
  });

  bool get _isTopManager => userRole == 'admin' || userRole == 'principal';
  bool get _canReassign =>
      userRole == 'coordinator' || userRole == 'dean' ||
      userRole == 'registrar';
  bool get _isLeaf => userRole == 'teacher' || userRole == 'registrar';
  bool get _canManagePersonnel =>
      userRole == 'principal' || userRole == 'registrar' || userRole == 'admin';
  bool get _hasAppraisalAccess =>
      userRole == 'principal' || userRole == 'coordinator' ||
      userRole == 'dean' || userRole == 'admin';

  void _navigate(BuildContext context, NavPage page) {
    Navigator.of(context).pop();
    onNavigate(page);
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: 240,
      backgroundColor: _kSidebarBg,
      child: SafeArea(
        child: Column(
          children: [
            // ── Header ──
            Container(
              height: 62,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: _kDivider)),
              ),
              child: Row(children: [
                const TaskNetLogo(size: 30),
                const SizedBox(width: 10),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('TaskNet',
                        style: GoogleFonts.plusJakartaSans(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700)),
                    Text('Management System',
                        style: GoogleFonts.plusJakartaSans(
                            color: Colors.white.withOpacity(0.55),
                            fontSize: 10)),
                  ],
                ),
              ]),
            ),

            // ── Nav items ──
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _drawerSectionLabel('MAIN MENU'),
                    _NavItem(
                      icon: Icons.dashboard_outlined,
                      label: 'Dashboard',
                      isActive: currentPage == NavPage.dashboard,
                      onTap: () => _navigate(context, NavPage.dashboard),
                    ),
                    if (_canReassign || _isLeaf)
                      _NavItem(
                        icon: Icons.assignment_outlined,
                        label: 'My Tasks',
                        isActive: currentPage == NavPage.myTasks,
                        onTap: () => _navigate(context, NavPage.myTasks),
                      ),
                    _NavItem(
                      icon: Icons.calendar_today_outlined,
                      label: 'Activity',
                      isActive: currentPage == NavPage.activity,
                      onTap: () => _navigate(context, NavPage.activity),
                    ),
                    _drawerSectionLabel('MANAGEMENT'),
                    if (_isTopManager || _canReassign)
                      _NavItem(
                        icon: Icons.check_box_outlined,
                        label: 'Task Manager',
                        isActive: currentPage == NavPage.taskManager,
                        onTap: () => _navigate(context, NavPage.taskManager),
                      ),
                    if (_canManagePersonnel)
                      _NavItem(
                        icon: Icons.people_outlined,
                        label: 'Personnel',
                        isActive: currentPage == NavPage.personnelManagement,
                        onTap: () => _navigate(context, NavPage.personnelManagement),
                      ),
                    if (_hasAppraisalAccess)
                      _NavItem(
                        icon: Icons.star_border_outlined,
                        label: 'Appraisal',
                        isActive: currentPage == NavPage.appraisal,
                        onTap: () => _navigate(context, NavPage.appraisal),
                      ),
                    _NavItem(
                      icon: Icons.event_outlined,
                      label: 'Events',
                      isActive: currentPage == NavPage.eventManagement,
                      onTap: () => _navigate(context, NavPage.eventManagement),
                    ),
                  ],
                ),
              ),
            ),

            // ── Footer ──
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: _kDivider)),
              ),
              child: Column(
                children: [
                  Row(children: [
                    CircleAvatar(
                      radius: 17,
                      backgroundColor: Colors.white.withOpacity(0.15),
                      child: Text(userInitials,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(userName,
                              style: GoogleFonts.plusJakartaSans(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                          Text(_roleLabelFor(userRole),
                              style: GoogleFonts.plusJakartaSans(
                                  color: Colors.white.withOpacity(0.6),
                                  fontSize: 11)),
                        ],
                      ),
                    ),
                  ]),
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).pop();
                      onLogout();
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.logout_rounded,
                              color: Color(0xCCFFFFFF), size: 15),
                          const SizedBox(width: 7),
                          Text('Logout',
                              style: GoogleFonts.plusJakartaSans(
                                  color: const Color(0xCCFFFFFF),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerSectionLabel(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
        child: Text(text,
            style: TextStyle(
                color: _kMuted.withOpacity(0.7),
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8)),
      );
}

// ── Shared helper ─────────────────────────────────────────────────────────────

String _roleLabelFor(String role) {
  switch (role) {
    case 'admin':       return 'Administrator';
    case 'principal':   return 'Principal';
    case 'coordinator': return 'Coordinator';
    case 'dean':        return 'Dean';
    case 'teacher':     return 'Teacher';
    case 'registrar':   return 'Registrar';
    default:            return role;
  }
}

// ── Notification Panel ────────────────────────────────────────────────────────

class _NotificationPanel extends StatefulWidget {
  const _NotificationPanel();

  @override
  State<_NotificationPanel> createState() => _NotificationPanelState();
}

class _NotificationPanelState extends State<_NotificationPanel> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService.getNotifications();
      if (mounted) setState(() { _items = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(int id) async {
    await ApiService.deleteNotification(id);
    setState(() => _items.removeWhere((n) => n['id'] == id));
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        width: 360,
        height: 480,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 0),
            child: Row(children: [
              const Icon(Icons.notifications_outlined, size: 18, color: Color(0xFF1A1A2E)),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Notifications',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1A2E))),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 18),
                onPressed: () => Navigator.pop(context),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
            ]),
          ),
          const Divider(height: 16),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : _items.isEmpty
                    ? const Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.notifications_none_outlined,
                              size: 40, color: Color(0xFFB0B7C3)),
                          SizedBox(height: 10),
                          Text('No notifications yet',
                              style: TextStyle(fontSize: 13, color: Color(0xFF718096))),
                        ]),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, i) {
                          final n = _items[i];
                          final isRead = (n['is_read'] as int?) == 1;
                          final type = n['type']?.toString() ?? 'general';
                          final icon = type == 'task'
                              ? Icons.task_alt_outlined
                              : type == 'event'
                                  ? Icons.event_outlined
                                  : Icons.info_outline;
                          final iconColor = type == 'task'
                              ? const Color(0xFF60A5FA)
                              : type == 'event'
                                  ? const Color(0xFF48BB78)
                                  : const Color(0xFFED8936);
                          return ListTile(
                            dense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            leading: CircleAvatar(
                              radius: 16,
                              backgroundColor: iconColor.withValues(alpha: 0.12),
                              child: Icon(icon, size: 16, color: iconColor),
                            ),
                            title: Text(n['title']?.toString() ?? '',
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isRead
                                        ? FontWeight.w400
                                        : FontWeight.w600,
                                    color: const Color(0xFF1A1A2E))),
                            subtitle: (n['body']?.toString() ?? '').isNotEmpty
                                ? Text(n['body'].toString(),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 11, color: Color(0xFF718096)))
                                : null,
                            trailing: IconButton(
                              icon: const Icon(Icons.close,
                                  size: 14, color: Color(0xFFB0B7C3)),
                              onPressed: () => _delete(n['id'] as int),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(
                                  minWidth: 24, minHeight: 24),
                            ),
                          );
                        },
                      ),
          ),
        ]),
      ),
    );
  }
}
