import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../services/api_service.dart';

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

  // ── Notification state ──
  int _unreadCount = 0;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _fetchUnreadCount();
    // Poll for new notifications every 30 seconds.
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _fetchUnreadCount();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchUnreadCount() async {
    try {
      final count = await ApiService.getUnreadNotificationCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {
      // Silently ignore — network may not be ready yet.
    }
  }

  void _openNotificationPanel(BuildContext context) {
    showDialog(
      context: context,
      barrierColor: Colors.black54,
      builder: (_) => _NotificationPanel(
        onDismiss: () {
          _fetchUnreadCount(); // refresh badge after panel is closed
        },
      ),
    ).then((_) => _fetchUnreadCount());
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
                  // ── Notifications nav item ──
                  _NotifNavItem(
                    count: _unreadCount,
                    collapsed: _collapsed,
                    onTap: () => _openNotificationPanel(context),
                  ),
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
                GestureDetector(
                  onTap: widget.onLogout,
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

class MobileNavDrawer extends StatefulWidget {
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

  @override
  State<MobileNavDrawer> createState() => _MobileNavDrawerState();
}

class _MobileNavDrawerState extends State<MobileNavDrawer> {
  int _unreadCount = 0;

  bool get _isTopManager => widget.userRole == 'admin' || widget.userRole == 'principal';
  bool get _canReassign =>
      widget.userRole == 'coordinator' || widget.userRole == 'dean' ||
      widget.userRole == 'registrar';
  bool get _isLeaf => widget.userRole == 'teacher' || widget.userRole == 'registrar';
  bool get _canManagePersonnel =>
      widget.userRole == 'principal' || widget.userRole == 'registrar' || widget.userRole == 'admin';
  bool get _hasAppraisalAccess =>
      widget.userRole == 'principal' || widget.userRole == 'coordinator' ||
      widget.userRole == 'dean' || widget.userRole == 'admin';

  @override
  void initState() {
    super.initState();
    _fetchUnreadCount();
  }

  Future<void> _fetchUnreadCount() async {
    try {
      final count = await ApiService.getUnreadNotificationCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {}
  }

  void _navigate(BuildContext context, NavPage page) {
    Navigator.of(context).pop();
    widget.onNavigate(page);
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
                      isActive: widget.currentPage == NavPage.dashboard,
                      onTap: () => _navigate(context, NavPage.dashboard),
                    ),
                    if (_canReassign || _isLeaf)
                      _NavItem(
                        icon: Icons.assignment_outlined,
                        label: 'My Tasks',
                        isActive: widget.currentPage == NavPage.myTasks,
                        onTap: () => _navigate(context, NavPage.myTasks),
                      ),
                    _NavItem(
                      icon: Icons.calendar_today_outlined,
                      label: 'Activity',
                      isActive: widget.currentPage == NavPage.activity,
                      onTap: () => _navigate(context, NavPage.activity),
                    ),
                    _drawerSectionLabel('MANAGEMENT'),
                    // ── Notifications nav item ──
                    _NotifNavItem(
                      count: _unreadCount,
                      onTap: () {
                        Navigator.of(context).pop();
                        showDialog(
                          context: context,
                          barrierColor: Colors.black54,
                          builder: (_) => _NotificationPanel(
                            onDismiss: _fetchUnreadCount,
                          ),
                        ).then((_) => _fetchUnreadCount());
                      },
                    ),
                    if (_isTopManager || _canReassign)
                      _NavItem(
                        icon: Icons.check_box_outlined,
                        label: 'Task Manager',
                        isActive: widget.currentPage == NavPage.taskManager,
                        onTap: () => _navigate(context, NavPage.taskManager),
                      ),
                    if (_canManagePersonnel)
                      _NavItem(
                        icon: Icons.people_outlined,
                        label: 'Personnel',
                        isActive: widget.currentPage == NavPage.personnelManagement,
                        onTap: () => _navigate(context, NavPage.personnelManagement),
                      ),
                    if (_hasAppraisalAccess)
                      _NavItem(
                        icon: Icons.star_border_outlined,
                        label: 'Appraisal',
                        isActive: widget.currentPage == NavPage.appraisal,
                        onTap: () => _navigate(context, NavPage.appraisal),
                      ),
                    _NavItem(
                      icon: Icons.event_outlined,
                      label: 'Events',
                      isActive: widget.currentPage == NavPage.eventManagement,
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
                      child: Text(widget.userInitials,
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
                          Text(widget.userName,
                              style: GoogleFonts.plusJakartaSans(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                          Text(_roleLabelFor(widget.userRole),
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
                      widget.onLogout();
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

// ── Notification Nav Item ─────────────────────────────────────────────────────

/// A nav-row styled like the other sidebar items but with a badge for unread count.
class _NotifNavItem extends StatefulWidget {
  final int count;
  final bool collapsed;
  final VoidCallback onTap;

  const _NotifNavItem({
    required this.count,
    required this.onTap,
    this.collapsed = false,
  });

  @override
  State<_NotifNavItem> createState() => _NotifNavItemState();
}

class _NotifNavItemState extends State<_NotifNavItem> {
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
            color: _hovered ? _kHoverBg : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              // Left indicator bar placeholder (no active state for notifications)
              Container(width: 3, height: 16, margin: const EdgeInsets.only(left: 10, right: 8)),
              // Bell icon with badge
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(
                    widget.count > 0
                        ? Icons.notifications_rounded
                        : Icons.notifications_none_rounded,
                    size: 17,
                    color: widget.count > 0
                        ? const Color(0xFFFFD60A)
                        : _kMuted,
                  ),
                  if (widget.count > 0)
                    Positioned(
                      top: -5,
                      right: -5,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                        decoration: const BoxDecoration(
                          color: Color(0xFFE53935),
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          widget.count > 99 ? '99+' : '${widget.count}',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.w700),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              if (!widget.collapsed) ...[
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    'Notifications',
                    style: TextStyle(
                      color: _hovered ? Colors.white : _kMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
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


// ── Notification Panel ────────────────────────────────────────────────────────

class _NotificationPanel extends StatefulWidget {
  final VoidCallback? onDismiss;

  const _NotificationPanel({this.onDismiss});

  @override
  State<_NotificationPanel> createState() => _NotificationPanelState();
}

class _NotificationPanelState extends State<_NotificationPanel> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;
  bool _markingAll = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ApiService.getNotifications();
      if (mounted) setState(() { _notifications = list; _loading = false; });
      // Auto-mark all as read when panel opens.
      await ApiService.markAllNotificationsRead();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(int id) async {
    await ApiService.deleteNotification(id);
    if (mounted) {
      setState(() => _notifications.removeWhere((n) => n['id'] == id));
    }
  }

  String _timeAgo(String? createdAt) {
    if (createdAt == null) return '';
    try {
      final dt = DateTime.parse(createdAt);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) {
      return '';
    }
  }

  IconData _iconFor(String? type) {
    switch (type) {
      case 'task':    return Icons.assignment_outlined;
      case 'event':   return Icons.event_outlined;
      case 'comment': return Icons.chat_bubble_outline;
      default:        return Icons.notifications_none_rounded;
    }
  }

  Color _colorFor(String? type) {
    switch (type) {
      case 'task':    return const Color(0xFF4F8EF7);
      case 'event':   return const Color(0xFF43C6AC);
      case 'comment': return const Color(0xFFFF9F43);
      default:        return const Color(0xFF8892A4);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(0),
      child: Builder(builder: (ctx) {
        final screenW = MediaQuery.of(ctx).size.width;
        final isMobile = screenW < 700;
        return Align(
          alignment: isMobile ? Alignment.center : Alignment.topLeft,
          child: Padding(
            // On desktop: anchor to the right of the sidebar.
            // On mobile: show centred with top padding.
            padding: isMobile
                ? const EdgeInsets.symmetric(horizontal: 16, vertical: 80)
                : const EdgeInsets.only(left: 232, top: 62),
            child: Material(
              color: const Color(0xFF1E2235),
              borderRadius: BorderRadius.circular(14),
              elevation: 12,
              child: Container(
                width: 340,
                constraints: const BoxConstraints(maxHeight: 480),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ── Header ──
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 12, 10),
                      child: Row(
                        children: [
                          const Icon(Icons.notifications_rounded,
                              color: Color(0xFFFFD60A), size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text('Notifications',
                                style: GoogleFonts.plusJakartaSans(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700)),
                          ),
                          if (_notifications.isNotEmpty)
                            TextButton(
                              onPressed: _markingAll ? null : () async {
                                setState(() => _markingAll = true);
                                await ApiService.markAllNotificationsRead();
                                if (mounted) setState(() {
                                  for (final n in _notifications) {
                                    n['is_read'] = 1;
                                  }
                                  _markingAll = false;
                                });
                              },
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: Text('Mark all read',
                                  style: GoogleFonts.plusJakartaSans(
                                      color: const Color(0xFF4F8EF7), fontSize: 11)),
                            ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Color(0xFF8892A4), size: 18),
                            onPressed: () => Navigator.of(context).pop(),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                          ),
                        ],
                      ),
                    ),

                    const Divider(color: Color(0x1FFFFFFF), height: 1),

                    // ── Body ──
                    Flexible(
                      child: _loading
                          ? const Padding(
                              padding: EdgeInsets.all(32),
                              child: Center(
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : _notifications.isEmpty
                              ? Padding(
                                  padding: const EdgeInsets.all(32),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.notifications_off_outlined,
                                          color: Color(0xFF8892A4), size: 40),
                                      const SizedBox(height: 10),
                                      Text('No notifications yet',
                                          style: GoogleFonts.plusJakartaSans(
                                              color: const Color(0xFF8892A4),
                                              fontSize: 13)),
                                    ],
                                  ),
                                )
                              : ListView.separated(
                                  shrinkWrap: true,
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  itemCount: _notifications.length,
                                  separatorBuilder: (_, __) =>
                                      const Divider(color: Color(0x0FFFFFFF), height: 1),
                                  itemBuilder: (context, i) {
                                    final n = _notifications[i];
                                    final isUnread = (n['is_read'] as int? ?? 0) == 0;
                                    return _NotifTile(
                                      icon: _iconFor(n['type'] as String?),
                                      iconColor: _colorFor(n['type'] as String?),
                                      title: n['title'] as String? ?? '',
                                      body: n['body'] as String? ?? '',
                                      timeAgo: _timeAgo(n['created_at'] as String?),
                                      isUnread: isUnread,
                                      onDelete: () => _delete(n['id'] as int),
                                    );
                                  },
                                ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}


class _NotifTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String body;
  final String timeAgo;
  final bool isUnread;
  final VoidCallback onDelete;

  const _NotifTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.body,
    required this.timeAgo,
    required this.isUnread,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: isUnread ? Colors.white.withOpacity(0.04) : Colors.transparent,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type icon
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 16),
            ),
            const SizedBox(width: 10),

            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(title,
                            style: GoogleFonts.plusJakartaSans(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: isUnread
                                    ? FontWeight.w600
                                    : FontWeight.w400),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis),
                      ),
                      if (isUnread)
                        Container(
                          width: 7,
                          height: 7,
                          margin: const EdgeInsets.only(left: 6, top: 3),
                          decoration: const BoxDecoration(
                            color: Color(0xFF4F8EF7),
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  if (body.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(body,
                        style: GoogleFonts.plusJakartaSans(
                            color: const Color(0xFF8892A4), fontSize: 11),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 4),
                  Text(timeAgo,
                      style: GoogleFonts.plusJakartaSans(
                          color: const Color(0xFF8892A4).withOpacity(0.7),
                          fontSize: 10)),
                ],
              ),
            ),
            const SizedBox(width: 4),

            // Delete button
            GestureDetector(
              onTap: onDelete,
              child: const Icon(Icons.close, color: Color(0xFF8892A4), size: 15),
            ),
          ],
        ),
      ),
    );
  }
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
