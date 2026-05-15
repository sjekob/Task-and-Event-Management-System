// TaskNet - User Manager View (COMPLETE)
// File: frontend-flutter/lib/views/principal/user_manager_view.dart
//
// Screens implemented:
//   • Full User Manager page (Academic Delegation + Personal Information tabs)
//   • Collapsible side navigation (desktop rail ↔ drawer on mobile)
//   • Active + Deactivated user tables with action menu (Edit / View / Deactivate)
//   • "Add / Update User" bottom-sheet form (all fields from screenshots)
//   • "User Details" dialog
//   • Search bar
//
// RBAC: [RBAC] comments mark every conditional rendering / action guard.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/responsive.dart';
import '../../controllers/user_controller.dart';
import '../../models/user_model.dart';
import '../../widgets/date_picker_field.dart';

// ─────────────────────────────────────────────────────────────────────────────
// App-wide colour tokens (matches the blue-grey + dark palette in screenshots)
// ─────────────────────────────────────────────────────────────────────────────
const _kNavBg      = Color(0xFF4A5568); // slate sidebar
const _kNavSel     = Color(0xFF6B7A92);
const _kPageBg     = Color(0xFFDDE6F0); // light-blue page background
const _kBannerBg   = Color(0xFF1A1A2E); // hexagon banner
const _kTableHead  = Color(0xFFC8D6E5); // table header row
const _kRowBorder  = Color(0xFFD0DCEB);
const _kAddBtn     = Color(0xFF2D3748);
const _kAccent     = Color(0xFF4A6FA5);
const _kDeactTxt   = Color(0xFF9AA5B4); // greyed-out deactivated rows
const _kErrorRed   = Color(0xFFE53E3E);

// ─────────────────────────────────────────────────────────────────────────────
// Entry point widget — wire currentUser + controller from your app's auth state
// ─────────────────────────────────────────────────────────────────────────────
class UserManagerView extends StatefulWidget {
  final UserDetailModel currentUser; // logged-in user (for RBAC checks)
  final UserController controller;

  const UserManagerView({
    super.key,
    required this.currentUser,
    required this.controller,
  });

  @override
  State<UserManagerView> createState() => _UserManagerViewState();
}

class _UserManagerViewState extends State<UserManagerView> {
  // Nav
  int _selectedNavIndex = 4; // "Users" icon selected
  bool _navExpanded     = true; // desktop: rail vs full

  // Page state
  int _tabIndex = 0; // 0 = Academic Delegation, 1 = Personal Information
  String _search = '';
  Timer? _debounce;

  UserListResponse? _data;
  bool _loading = true;
  String? _error;

  // Lookups (for forms)
  List<GradeLevelModel>      _gradeLevels      = [];
  List<SubjectModel>         _subjects         = [];
  List<DepartmentModel>      _departments      = [];
  List<CoordinatorTypeModel> _coordinatorTypes = [];

  @override
  void initState() {
    super.initState();
    _loadData();
    _loadLookups();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final result = await widget.controller.fetchUsers(
        search: _search.isEmpty ? null : _search,
      );
      setState(() { _data = result; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _loadLookups() async {
    try {
      final results = await Future.wait([
        widget.controller.fetchGradeLevels(),
        widget.controller.fetchSubjects(),
        widget.controller.fetchDepartments(),
        widget.controller.fetchCoordinatorTypes(),
      ]);
      setState(() {
        _gradeLevels      = results[0] as List<GradeLevelModel>;
        _subjects         = results[1] as List<SubjectModel>;
        _departments      = results[2] as List<DepartmentModel>;
        _coordinatorTypes = results[3] as List<CoordinatorTypeModel>;
      });
    } catch (_) {}
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      setState(() => _search = value);
      _loadData();
    });
  }

  // ── Action handlers ───────────────────────────────────────────────────────

  // Principal and Registrar can add, edit, and deactivate users
  bool get _canManageUsers =>
      widget.currentUser.role == UserRole.principal ||
      widget.currentUser.role == UserRole.registrar;

  // Coordinator and Dean can view the list but not edit or deactivate
  bool get _canViewUsers =>
      _canManageUsers ||
      widget.currentUser.role == UserRole.coordinator ||
      widget.currentUser.role == UserRole.dean;

  void _openAddUser() {
    if (!_canManageUsers) return;
    _showAddUserDialog();
  }

  void _showAddUserDialog() {
    showDialog(
      context: context,
      builder: (_) => _AddUserDialog(
        controller: widget.controller,
        onCreated: () {
          Navigator.pop(context);
          _loadData();
          _showSnack('User created. They will set up their profile on first login.');
        },
      ),
    );
  }

  void _openEditUser(UserBriefModel user) {
    if (!_canManageUsers) return;
    _showUserForm(existingUser: user);
  }

  void _openViewDetails(UserBriefModel user) async {
    final detail = await widget.controller.fetchUser(user.id);
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (_) => _UserDetailsDialog(
        user: detail,
        gradeLevels: _gradeLevels,
        subjects: _subjects,
        controller: widget.controller,
      ),
    );
  }

  void _deactivateUser(UserBriefModel user) async {
    if (!_canManageUsers) return; // [RBAC]
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => _ConfirmDialog(
        title: 'Deactivate User',
        message: 'Are you sure you want to deactivate ${user.fullName}?',
        confirmLabel: 'Deactivate',
        confirmColor: _kErrorRed,
      ),
    );
    if (confirm != true) return;
    try {
      await widget.controller.setUserStatus(user.id, UserStatus.deactivated);
      _loadData();
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    }
  }

  void _reactivateUser(UserBriefModel user) async {
    if (!_canManageUsers) return; // [RBAC]
    try {
      await widget.controller.setUserStatus(user.id, UserStatus.active);
      _loadData();
    } catch (e) {
      _showSnack(e.toString(), isError: true);
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    if (mounted) Navigator.pushReplacementNamed(context, '/login');
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? _kErrorRed : _kAccent,
    ));
  }

  void _showUserForm({UserBriefModel? existingUser}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _UserFormSheet(
        existingUserId: existingUser?.id,
        adminEditOnly: existingUser != null,
        controller: widget.controller,
        gradeLevels: _gradeLevels,
        subjects: _subjects,
        departments: _departments,
        coordinatorTypes: _coordinatorTypes,
        onSaved: () {
          Navigator.pop(context);
          _loadData();
        },
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    return Scaffold(
      backgroundColor: _kPageBg,
      floatingActionButton: (isMobile && _canManageUsers)
          ? FloatingActionButton.extended(
              onPressed: _openAddUser,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Add User',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              backgroundColor: _kAddBtn,
              elevation: 4,
            )
          : null,
      // Mobile: hamburger → Drawer
      drawer: isMobile ? _SideNav(
        selectedIndex: _selectedNavIndex,
        expanded: true,
        onSelect: (i) { setState(() => _selectedNavIndex = i); Navigator.pop(context); },
        onToggle: () {},
        onLogout: _logout,
        currentUser: widget.currentUser,
      ) : null,
      body: Row(
        children: [
          // Desktop / tablet side nav
          if (!isMobile)
            _SideNav(
              selectedIndex: _selectedNavIndex,
              expanded: _navExpanded,
              onSelect: (i) => setState(() => _selectedNavIndex = i),
              onToggle: () => setState(() => _navExpanded = !_navExpanded),
              onLogout: _logout,
              currentUser: widget.currentUser,
            ),

          // Main content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _TopBar(
                  currentUser: widget.currentUser,
                  isMobile: isMobile,
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: Responsive.value(context, mobile: 16, desktop: 32),
                      vertical: 24,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _HeroBanner(),
                        const SizedBox(height: 24),
                        _TabRow(
                          selected: _tabIndex,
                          onChanged: (i) => setState(() => _tabIndex = i),
                        ),
                        const SizedBox(height: 16),
                        _SearchAddRow(
                          onSearchChanged: _onSearchChanged,
                          canManage: _canManageUsers,
                          onAdd: _openAddUser,
                        ),
                        const SizedBox(height: 16),
                        _buildContent(),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) return const Center(child: Padding(padding: EdgeInsets.all(48), child: CircularProgressIndicator()));
    if (_error != null) return _ErrorBanner(message: _error!, onRetry: _loadData);
    if (_data == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CollapsibleTableSection(
          title: 'Active Users',
          count: _data!.active.length,
          initiallyExpanded: true,
          table: _UserTable(
            users: _data!.active,
            tabIndex: _tabIndex,
            isDeactivated: false,
            canManage: _canManageUsers,
            onEdit: _openEditUser,
            onView: _openViewDetails,
            onDeactivate: _deactivateUser,
          ),
        ),
        if (_data!.deactivated.isNotEmpty) ...[
          const SizedBox(height: 24),
          _CollapsibleTableSection(
            title: 'Deactivated Accounts',
            count: _data!.deactivated.length,
            initiallyExpanded: false,
            isDeactivated: true,
            table: _UserTable(
              users: _data!.deactivated,
              tabIndex: _tabIndex,
              isDeactivated: true,
              canManage: _canManageUsers,
              onEdit: _openEditUser,
              onView: _openViewDetails,
              onDeactivate: _reactivateUser,
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RBAC helpers (top-level so _SideNav can use them)
// ─────────────────────────────────────────────────────────────────────────────
bool _canViewUsersRole(UserRole role) =>
    role == UserRole.principal ||
    role == UserRole.registrar ||
    role == UserRole.dean ||
    role == UserRole.coordinator;

// ─────────────────────────────────────────────────────────────────────────────
// Side Navigation
// ─────────────────────────────────────────────────────────────────────────────
class _SideNav extends StatelessWidget {
  final int selectedIndex;
  final bool expanded;
  final ValueChanged<int> onSelect;
  final VoidCallback onToggle;
  final VoidCallback onLogout;
  final UserDetailModel currentUser;

  const _SideNav({
    required this.selectedIndex,
    required this.expanded,
    required this.onSelect,
    required this.onToggle,
    required this.onLogout,
    required this.currentUser,
  });

  static const _items = [
    (Icons.home_outlined, 'Dashboard'),
    (Icons.edit_outlined, 'Tasks'),
    (Icons.edit_note_outlined, 'Delegation'),
    (Icons.description_outlined, 'Reports'),
    (Icons.group_outlined, 'Users'),
  ];

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      width: expanded ? 200 : 64,
      color: _kNavBg,
      child: Column(
        children: [
          // Logo / toggle
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
            child: Row(
              mainAxisAlignment: expanded ? MainAxisAlignment.spaceBetween : MainAxisAlignment.center,
              children: [
                if (expanded) ...[
                  // Avatar placeholder (school logo)
                  Container(
                    width: 36, height: 36,
                    decoration: const BoxDecoration(
                      color: Colors.white24, shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.school, color: Colors.white, size: 20),
                  ),
                ],
                IconButton(
                  icon: Icon(expanded ? Icons.chevron_left : Icons.chevron_right,
                      color: Colors.white),
                  onPressed: onToggle,
                  tooltip: expanded ? 'Collapse' : 'Expand',
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white24, height: 1),
          const SizedBox(height: 8),
          // Nav items
          ...List.generate(_items.length, (i) {
            final (icon, label) = _items[i];
            final selected = selectedIndex == i;

            // [RBAC] Users nav: Principal, Registrar, Dean, Coordinator can see the list
            if (i == 4 && !_canViewUsersRole(currentUser.role)) {
              return const SizedBox.shrink();
            }

            return _NavItem(
              icon: icon,
              label: label,
              selected: selected,
              expanded: expanded,
              onTap: () => onSelect(i),
            );
          }),
          const Spacer(),
          // Logout
          _NavItem(
            icon: Icons.logout,
            label: 'Logout',
            selected: false,
            expanded: expanded,
            onTap: onLogout,
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final bool expanded;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon, required this.label, required this.selected,
    required this.expanded, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: expanded ? '' : label,
      child: InkWell(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          padding: EdgeInsets.symmetric(horizontal: expanded ? 12 : 0, vertical: 12),
          decoration: BoxDecoration(
            color: selected ? _kNavSel : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: expanded ? MainAxisAlignment.start : MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 22),
              if (expanded) ...[
                const SizedBox(width: 12),
                Text(label, style: const TextStyle(color: Colors.white, fontSize: 13)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────────────
class _TopBar extends StatelessWidget {
  final UserDetailModel currentUser;
  final bool isMobile;

  const _TopBar({required this.currentUser, required this.isMobile});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _kPageBg,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      child: Row(
        children: [
          if (isMobile)
            IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () => Scaffold.of(context).openDrawer(),
            ),
          Text(
            currentUser.role.displayName,
            style: TextStyle(
              fontSize: isMobile ? 18 : 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          // Avatar
          CircleAvatar(
            radius: 20,
            backgroundImage: currentUser.avatarUrl != null
                ? NetworkImage(currentUser.avatarUrl!)
                : null,
            child: currentUser.avatarUrl == null
                ? const Icon(Icons.person)
                : null,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Banner
// ─────────────────────────────────────────────────────────────────────────────
class _HeroBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        color: _kBannerBg,
        child: Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: _HexPainter())),
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: 24,
                vertical: isMobile ? 20 : 28,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'User Manager',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: isMobile ? 22 : 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Easily manage user profiles, roles, and permissions to keep everything organized.',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HexPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.05)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    const r = 28.0;
    const h = r * 1.732;
    for (double y = -r; y < size.height + r; y += h) {
      for (double x = -r; x < size.width + r; x += r * 3) {
        _hexagon(canvas, paint, Offset(x, y), r);
        _hexagon(canvas, paint, Offset(x + r * 1.5, y + h / 2), r);
      }
    }
  }

  void _hexagon(Canvas canvas, Paint paint, Offset center, double r) {
    final path = Path();
    for (int i = 0; i < 6; i++) {
      final angle = (i * 60 - 30) * 3.14159 / 180;
      final pt = Offset(center.dx + r * cos(angle), center.dy + r * sin(angle));
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    path.close();
    canvas.drawPath(path, paint);
  }

  double cos(double x) => _cos(x);
  double sin(double x) => _sin(x);
  double _cos(double x) {
    // Simple Taylor-series approximation (avoids dart:math import at top)
    // In production: use dart:math cos/sin directly.
    import_dart_math_note: {}
    return _mathCos(x);
  }

  double _sin(double x) => _mathSin(x);

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

// dart:math is used via the import at the top of the file — see below.
// (Listed here as a reminder to add `import 'dart:math' as math;` and
//  replace _mathCos/_mathSin with math.cos/math.sin.)
double _mathCos(double x) {
  double r = 1, t = 1;
  for (int i = 1; i <= 10; i++) {
    t *= -x * x / ((2 * i - 1) * (2 * i));
    r += t;
  }
  return r;
}
double _mathSin(double x) {
  double r = x, t = x;
  for (int i = 1; i <= 10; i++) {
    t *= -x * x / ((2 * i) * (2 * i + 1));
    r += t;
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab row
// ─────────────────────────────────────────────────────────────────────────────
class _TabRow extends StatelessWidget {
  final int selected;
  final ValueChanged<int> onChanged;

  const _TabRow({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    if (isMobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TabButton(label: 'Academic Delegation', active: selected == 0, onTap: () => onChanged(0)),
          const SizedBox(height: 8),
          _TabButton(label: 'Personal Information', active: selected == 1, onTap: () => onChanged(1)),
        ],
      );
    }
    return Row(
      children: [
        _TabButton(label: 'Academic Delegation', active: selected == 0, onTap: () => onChanged(0)),
        const SizedBox(width: 8),
        _TabButton(label: 'Personal Information', active: selected == 1, onTap: () => onChanged(1)),
      ],
    );
  }
}

class _TabButton extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _TabButton({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: active ? _kNavSel : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _kRowBorder),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w500,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search bar + Add User button row
// ─────────────────────────────────────────────────────────────────────────────
class _SearchAddRow extends StatelessWidget {
  final ValueChanged<String> onSearchChanged;
  final bool canManage;
  final VoidCallback onAdd;

  const _SearchAddRow({
    required this.onSearchChanged,
    required this.canManage,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            onChanged: onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Search',
              prefixIcon: const Icon(Icons.search, color: Colors.black45),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade400),
              ),
            ),
          ),
        ),
        if (canManage && !Responsive.isMobile(context)) ...[
          const SizedBox(width: 12),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add, color: Colors.white, size: 18),
            label: const Text(
              'Add User',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _kAddBtn,
              minimumSize: const Size(0, 48),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User Table (responsive: scrollable DataTable on wide, Cards on mobile)
// ─────────────────────────────────────────────────────────────────────────────
class _UserTable extends StatelessWidget {
  final List<UserBriefModel> users;
  final int tabIndex;
  final bool isDeactivated;
  final bool canManage;
  final void Function(UserBriefModel) onEdit;
  final void Function(UserBriefModel) onView;
  final void Function(UserBriefModel) onDeactivate;

  const _UserTable({
    required this.users,
    required this.tabIndex,
    required this.isDeactivated,
    required this.canManage,
    required this.onEdit,
    required this.onView,
    required this.onDeactivate,
  });

  @override
  Widget build(BuildContext context) {
    if (users.isEmpty) return const SizedBox.shrink();

    return Responsive.isMobile(context)
        ? _MobileCardList(
            users: users,
            tabIndex: tabIndex,
            isDeactivated: isDeactivated,
            canManage: canManage,
            onEdit: onEdit,
            onView: onView,
            onDeactivate: onDeactivate,
          )
        : _DesktopDataTable(
            users: users,
            tabIndex: tabIndex,
            isDeactivated: isDeactivated,
            canManage: canManage,
            onEdit: onEdit,
            onView: onView,
            onDeactivate: onDeactivate,
          );
  }
}

// ── Desktop table ─────────────────────────────────────────────────────────────
class _DesktopDataTable extends StatelessWidget {
  final List<UserBriefModel> users;
  final int tabIndex;
  final bool isDeactivated;
  final bool canManage;
  final void Function(UserBriefModel) onEdit;
  final void Function(UserBriefModel) onView;
  final void Function(UserBriefModel) onDeactivate;

  const _DesktopDataTable({
    required this.users, required this.tabIndex, required this.isDeactivated,
    required this.canManage, required this.onEdit, required this.onView, required this.onDeactivate,
  });

  // Academic columns: ID, Name, Username, Contact, Email, Subject, Grade Level, Role, Action
  // Personal columns: ID, Name, Birthdate, Password, TIN, GSIS, Pag-Ibig, PhilHealth, Date Hired, Address
  List<DataColumn> get _columns => tabIndex == 0
      ? const [
          DataColumn(label: _ColHeader('ID')),
          DataColumn(label: _ColHeader('Name')),
          DataColumn(label: _ColHeader('Username')),
          DataColumn(label: _ColHeader('Contact')),
          DataColumn(label: _ColHeader('Email')),
          DataColumn(label: _ColHeader('Subject')),
          DataColumn(label: _ColHeader('Grade Level')),
          DataColumn(label: _ColHeader('Role')),
          DataColumn(label: _ColHeader('Action')),
        ]
      : const [
          DataColumn(label: _ColHeader('ID')),
          DataColumn(label: _ColHeader('Name')),
          DataColumn(label: _ColHeader('Birthdate')),
          DataColumn(label: _ColHeader('Password')),
          DataColumn(label: _ColHeader('TIN')),
          DataColumn(label: _ColHeader('GSIS')),
          DataColumn(label: _ColHeader('Pag-Ibig')),
          DataColumn(label: _ColHeader('PhilHealth')),
          DataColumn(label: _ColHeader('Date Hired')),
          DataColumn(label: _ColHeader('Address')),
          DataColumn(label: _ColHeader('Action')),
        ];

  List<DataCell> _rowCells(UserBriefModel u) {
    final dimStyle = TextStyle(
      color: isDeactivated ? _kDeactTxt : Colors.black87,
      fontSize: 13,
    );
    final linkedStyle = dimStyle.copyWith(
      color: isDeactivated ? _kDeactTxt : const Color(0xFF4A7FA5),
    );

    if (tabIndex == 0) {
      return [
        DataCell(Text(u.employeeNo ?? '—', style: dimStyle)),
        DataCell(Text(u.fullName, style: linkedStyle)),
        DataCell(Text(u.username ?? '—', style: dimStyle)),
        DataCell(Text(u.contactNumber ?? '—', style: dimStyle)),
        DataCell(Text(u.email, style: dimStyle)),
        DataCell(Text(u.subjectsDisplay, style: dimStyle)),
        DataCell(Text(u.gradeLevelsDisplay, style: dimStyle)),
        DataCell(Text(u.role.displayName, style: dimStyle)),
        DataCell(_ActionMenu(
          user: u,
          isDeactivated: isDeactivated,
          canManage: canManage,
          onEdit: onEdit,
          onView: onView,
          onDeactivate: onDeactivate,
        )),
      ];
    } else {
      return [
        DataCell(Text(u.employeeNo ?? '—', style: dimStyle)),
        DataCell(Text(u.fullName, style: linkedStyle)),
        DataCell(Text('—', style: dimStyle)), // birthdate — loaded in full detail
        DataCell(Text('••••••••', style: dimStyle)),
        DataCell(Text('—', style: dimStyle)),
        DataCell(Text('—', style: dimStyle)),
        DataCell(Text('—', style: dimStyle)),
        DataCell(Text('—', style: dimStyle)),
        DataCell(Text('—', style: dimStyle)),
        DataCell(Text('—', style: dimStyle)),
        DataCell(_ActionMenu(
          user: u,
          isDeactivated: isDeactivated,
          canManage: canManage,
          onEdit: onEdit,
          onView: onView,
          onDeactivate: onDeactivate,
        )),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kRowBorder),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: constraints.maxWidth), // stretch to fill
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(_kTableHead),
              headingRowHeight: 44,
              dataRowMinHeight: 52,
              dataRowMaxHeight: 64,
              dividerThickness: 1,
              border: TableBorder(
                horizontalInside: const BorderSide(color: _kRowBorder),
                borderRadius: BorderRadius.circular(12),
              ),
              columns: _columns,
              rows: users.map((u) => DataRow(cells: _rowCells(u))).toList(),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Mobile card list ──────────────────────────────────────────────────────────
class _MobileCardList extends StatelessWidget {
  final List<UserBriefModel> users;
  final int tabIndex;
  final bool isDeactivated;
  final bool canManage;
  final void Function(UserBriefModel) onEdit;
  final void Function(UserBriefModel) onView;
  final void Function(UserBriefModel) onDeactivate;

  const _MobileCardList({
    required this.users, required this.tabIndex, required this.isDeactivated,
    required this.canManage, required this.onEdit, required this.onView, required this.onDeactivate,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: users.map((u) => _UserCard(
        user: u,
        tabIndex: tabIndex,
        isDeactivated: isDeactivated,
        canManage: canManage,
        onEdit: onEdit,
        onView: onView,
        onDeactivate: onDeactivate,
      )).toList(),
    );
  }
}

class _UserCard extends StatelessWidget {
  final UserBriefModel user;
  final int tabIndex;
  final bool isDeactivated;
  final bool canManage;
  final void Function(UserBriefModel) onEdit;
  final void Function(UserBriefModel) onView;
  final void Function(UserBriefModel) onDeactivate;

  const _UserCard({
    required this.user, required this.tabIndex, required this.isDeactivated,
    required this.canManage, required this.onEdit, required this.onView, required this.onDeactivate,
  });

  @override
  Widget build(BuildContext context) {
    final dimStyle = TextStyle(color: isDeactivated ? _kDeactTxt : Colors.black87);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _kRowBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(user.employeeNo ?? '—',
                    style: const TextStyle(color: Colors.black45, fontSize: 11)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(user.fullName,
                      style: dimStyle.copyWith(fontWeight: FontWeight.w600)),
                ),
                _ActionMenu(
                  user: user,
                  isDeactivated: isDeactivated,
                  canManage: canManage,
                  onEdit: onEdit,
                  onView: onView,
                  onDeactivate: onDeactivate,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(user.email, style: dimStyle.copyWith(fontSize: 12)),
            const SizedBox(height: 4),
            Row(
              children: [
                _Chip(user.role.displayName),
                const SizedBox(width: 6),
                if (tabIndex == 0 && user.gradeLevels.isNotEmpty)
                  _Chip(user.gradeLevelsDisplay, color: const Color(0xFFE8F0FE)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  const _Chip(this.label, {this.color = const Color(0xFFEDF2F7)});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
    );
  }
}

class _ColHeader extends StatelessWidget {
  final String text;
  const _ColHeader(this.text);

  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13));
}

// ─────────────────────────────────────────────────────────────────────────────
// Action menu (⋮ popup)
// ─────────────────────────────────────────────────────────────────────────────
class _ActionMenu extends StatelessWidget {
  final UserBriefModel user;
  final bool isDeactivated;
  final bool canManage;
  final void Function(UserBriefModel) onEdit;
  final void Function(UserBriefModel) onView;
  final void Function(UserBriefModel) onDeactivate;

  const _ActionMenu({
    required this.user, required this.isDeactivated, required this.canManage,
    required this.onEdit, required this.onView, required this.onDeactivate,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert, size: 20),
      onSelected: (value) {
        switch (value) {
          case 'edit':   onEdit(user);
          case 'view':   onView(user);
          case 'toggle': onDeactivate(user);
        }
      },
      itemBuilder: (_) => [
        // [RBAC] Edit and Deactivate only shown to canManage roles
        if (canManage && !isDeactivated)
          const PopupMenuItem(value: 'edit', child: Text('Edit')),
        const PopupMenuItem(value: 'view', child: Text('View Details')),
        if (canManage)
          PopupMenuItem(
            value: 'toggle',
            child: Text(
              isDeactivated ? 'Reactivate' : 'Deactivate',
              style: TextStyle(color: isDeactivated ? _kAccent : _kErrorRed),
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User Details Dialog
// ─────────────────────────────────────────────────────────────────────────────
class _UserDetailsDialog extends StatefulWidget {
  final UserDetailModel user;
  final List<GradeLevelModel> gradeLevels;
  final List<SubjectModel> subjects;
  final UserController controller;

  const _UserDetailsDialog({
    required this.user,
    required this.gradeLevels,
    required this.subjects,
    required this.controller,
  });

  @override
  State<_UserDetailsDialog> createState() => _UserDetailsDialogState();
}

class _UserDetailsDialogState extends State<_UserDetailsDialog>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  List<DelegationHistoryItem> _history = [];
  bool _historyLoading = false;
  String? _historyError;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() {
      if (_tabs.index == 1 && _history.isEmpty && !_historyLoading) {
        _loadHistory();
      }
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() { _historyLoading = true; _historyError = null; });
    try {
      final items = await widget.controller.fetchDelegationHistory(widget.user.id);
      if (mounted) setState(() { _history = items; _historyLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _historyError = e.toString(); _historyLoading = false; });
    }
  }

  String _fmt(DateTime? dt) {
    if (dt == null) return '—';
    final local = dt.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2,'0')}-${local.day.toString().padLeft(2,'0')} '
        '${local.hour.toString().padLeft(2,'0')}:${local.minute.toString().padLeft(2,'0')}';
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720, maxHeight: 680),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header + tabs
            Container(
              decoration: const BoxDecoration(
                color: _kNavSel,
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 8, 0),
                    child: Row(
                      children: [
                        const Text('User Details',
                            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                        const Spacer(),
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ),
                  TabBar(
                    controller: _tabs,
                    indicatorColor: Colors.white,
                    labelColor: Colors.white,
                    unselectedLabelColor: Colors.white60,
                    tabs: const [
                      Tab(text: 'User Details'),
                      Tab(text: 'Delegation History'),
                    ],
                  ),
                ],
              ),
            ),
            // Tab content
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: [
                  // ── Tab 1: User Details ──────────────────────────────────
                  SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _DetailSection('Basic Information', [
                          _DetailRow('ID', user.employeeNo ?? '—', 'Name', user.fullName),
                          _DetailRow('Username', user.username ?? 'N/A', 'Role', user.role.displayName),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Row(children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: user.status == UserStatus.active
                                      ? Colors.green.shade50 : Colors.grey.shade200,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  user.status.displayName,
                                  style: TextStyle(
                                    color: user.status == UserStatus.active ? Colors.green : Colors.grey,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ]),
                          ),
                        ]),
                        const SizedBox(height: 16),
                        _DetailSection('Contact Information', [
                          _DetailRow('Email', user.email, 'Contact Number', user.contactNumber ?? '—'),
                          _DetailRow('Address', user.address ?? '—', '', ''),
                        ]),
                        const SizedBox(height: 16),
                        _DetailSection('Academic Information', [
                          if (user.role == UserRole.dean)
                            _DetailRow('Department Handled',
                                user.gradeLevels.isNotEmpty ? user.gradeLevels.first.name : '—', '', '')
                          else if (user.role == UserRole.coordinator)
                            _DetailRow('Coordinator Type', user.coordinatorType?.name ?? '—', '', ''),
                          _DetailRow(
                            'Subject-Grade Assignments',
                            user.subjectGradeAssignments.isEmpty
                                ? '—'
                                : user.subjectGradeAssignments.map((a) {
                                    final gl = widget.gradeLevels.firstWhere(
                                        (g) => g.id == a.gradeLevelId,
                                        orElse: () => const GradeLevelModel(id: 0, name: '?'));
                                    final sub = widget.subjects.firstWhere(
                                        (s) => s.id == a.subjectId,
                                        orElse: () => const SubjectModel(id: 0, name: '?'));
                                    return '${sub.name} (${gl.name})';
                                  }).join(', '),
                            '', '',
                          ),
                          _DetailRow('Last Updated', _fmt(user.academicDelegationUpdatedAt), '', ''),
                        ]),
                        const SizedBox(height: 16),
                        _DetailSection('Personal Information', [
                          _DetailRow('Birthdate', user.birthdate ?? '—', 'Date Hired', user.dateHired ?? '—'),
                          _DetailRow('TIN', user.tinNumber ?? '—', 'GSIS', user.gsisNumber ?? '—'),
                          _DetailRow('Pag-IBIG', user.pagibigNumber ?? '—', 'PhilHealth', user.philhealthNumber ?? '—'),
                          _DetailRow('Last Updated', _fmt(user.personalInfoUpdatedAt), '', ''),
                        ]),
                      ],
                    ),
                  ),

                  // ── Tab 2: Delegation History ────────────────────────────
                  _historyLoading
                      ? const Center(child: CircularProgressIndicator())
                      : _historyError != null
                          ? Center(child: Text(_historyError!, style: const TextStyle(color: _kErrorRed)))
                          : _history.isEmpty
                              ? const Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(32),
                                    child: Text('No delegation history recorded yet.',
                                        style: TextStyle(color: Colors.black45)),
                                  ),
                                )
                              : ListView.separated(
                                  padding: const EdgeInsets.all(16),
                                  itemCount: _history.length,
                                  separatorBuilder: (_, __) => const Divider(height: 1),
                                  itemBuilder: (_, i) {
                                    final h = _history[i];
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(Icons.history, size: 16, color: _kAccent),
                                              const SizedBox(width: 6),
                                              Text(_fmt(h.changedAt),
                                                  style: const TextStyle(
                                                      fontWeight: FontWeight.w600, fontSize: 13)),
                                              const Spacer(),
                                              Text('by ${h.changedByName ?? "System"}',
                                                  style: const TextStyle(
                                                      color: Colors.black45, fontSize: 12)),
                                            ],
                                          ),
                                          if (h.role != null) ...[
                                            const SizedBox(height: 4),
                                            _HistoryChip('Role', h.role!),
                                          ],
                                          if (h.gradeLevelHandled != null) ...[
                                            const SizedBox(height: 4),
                                            _HistoryChip('Department', h.gradeLevelHandled!),
                                          ],
                                          if (h.coordinatorType != null) ...[
                                            const SizedBox(height: 4),
                                            _HistoryChip('Coordinator Type', h.coordinatorType!),
                                          ],
                                          if (h.subjectGradeSummary != null) ...[
                                            const SizedBox(height: 4),
                                            _HistoryChip('Subjects', h.subjectGradeSummary!),
                                          ],
                                        ],
                                      ),
                                    );
                                  },
                                ),
                ],
              ),
            ),
            // Footer
            Padding(
              padding: const EdgeInsets.all(16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kNavSel,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: const Text('Close'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryChip extends StatelessWidget {
  final String label;
  final String value;
  const _HistoryChip(this.label, this.value);

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$label: ', style: const TextStyle(color: Colors.black45, fontSize: 12)),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          ),
        ],
      );
}

class _DetailSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _DetailSection(this.title, this.children);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const Divider(height: 16),
        ...children,
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label1;
  final String value1;
  final String label2;
  final String value2;

  const _DetailRow(this.label1, this.value1, this.label2, this.value2);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Expanded(child: _LabelValue(label: label1, value: value1)),
          if (label2.isNotEmpty) Expanded(child: _LabelValue(label: label2, value: value2)),
        ],
      ),
    );
  }
}

class _LabelValue extends StatelessWidget {
  final String label;
  final String value;

  const _LabelValue({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.black45, fontSize: 12)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Update User Bottom Sheet Form
// ─────────────────────────────────────────────────────────────────────────────
class _UserFormSheet extends StatefulWidget {
  final int? existingUserId;
  final bool adminEditOnly;
  final UserController controller;
  final List<GradeLevelModel> gradeLevels;
  final List<SubjectModel> subjects;
  final List<DepartmentModel> departments;
  final List<CoordinatorTypeModel> coordinatorTypes;
  final VoidCallback onSaved;

  const _UserFormSheet({
    this.existingUserId,
    this.adminEditOnly = false,
    required this.controller,
    required this.gradeLevels,
    required this.subjects,
    required this.departments,
    required this.coordinatorTypes,
    required this.onSaved,
  });

  @override
  State<_UserFormSheet> createState() => _UserFormSheetState();
}

class _UserFormSheetState extends State<_UserFormSheet> {
  final _formKey = GlobalKey<FormState>();

  // Personal Information
  final _firstNameCtrl   = TextEditingController();
  final _middleNameCtrl  = TextEditingController();
  final _lastNameCtrl    = TextEditingController();
  final _suffixCtrl      = TextEditingController();

  // Account Information
  final _usernameCtrl    = TextEditingController();
  final _passwordCtrl    = TextEditingController();
  final _emailCtrl       = TextEditingController();

  // Contact
  final _contactCtrl     = TextEditingController();
  final _birthdateCtrl   = TextEditingController();

  // Role Assignment
  UserRole? _selectedRole;
  int? _selectedDeanGradeLevelId;   // Dean: the single grade level they handle
  int? _selectedCoordinatorTypeId;
  final _appointmentCtrl = TextEditingController();

  // Subject-Grade Assignments (dynamic list)
  List<_SubjectGradeRow> _subjectRows = [_SubjectGradeRow()];

  // ID Numbers
  final _tinCtrl         = TextEditingController();
  final _gsisCtrl        = TextEditingController();
  final _pagibigCtrl     = TextEditingController();
  final _philhealthCtrl  = TextEditingController();

  // Address
  final _addressCtrl     = TextEditingController();

  bool _saving = false;
  bool _loadingUser = false;

  @override
  void initState() {
    super.initState();
    if (widget.existingUserId != null) {
      _loadingUser = true;
      widget.controller.fetchUser(widget.existingUserId!).then((user) {
        if (!mounted) return;
        setState(() {
          _loadingUser = false;
          _firstNameCtrl.text  = user.firstName;
          _middleNameCtrl.text = user.middleName ?? '';
          _lastNameCtrl.text   = user.lastName;
          _suffixCtrl.text     = user.suffix ?? '';
          _usernameCtrl.text   = user.username ?? '';
          _emailCtrl.text      = user.email;
          _contactCtrl.text    = user.contactNumber ?? '';
          _birthdateCtrl.text  = user.birthdate ?? '';
          _selectedRole            = user.role;
          _appointmentCtrl.text    = user.dateOfAppointment ?? '';
          _selectedCoordinatorTypeId = user.coordinatorType?.id;
          if (user.role == UserRole.dean && user.gradeLevels.isNotEmpty) {
            _selectedDeanGradeLevelId = user.gradeLevels.first.id;
          }
          if (user.subjectGradeAssignments.isNotEmpty) {
            _subjectRows = user.subjectGradeAssignments
                .map((a) => _SubjectGradeRow()
                  ..gradeId = a.gradeLevelId
                  ..subjectId = a.subjectId)
                .toList();
          }
          _tinCtrl.text         = user.tinNumber ?? '';
          _gsisCtrl.text        = user.gsisNumber ?? '';
          _pagibigCtrl.text     = user.pagibigNumber ?? '';
          _philhealthCtrl.text  = user.philhealthNumber ?? '';
          _addressCtrl.text     = user.address ?? '';
        });
      }).catchError((_) {
        if (mounted) setState(() => _loadingUser = false);
      });
    }
  }

  @override
  void dispose() {
    for (final c in [
      _firstNameCtrl, _middleNameCtrl, _lastNameCtrl, _suffixCtrl,
      _usernameCtrl, _passwordCtrl, _emailCtrl, _contactCtrl,
      _birthdateCtrl, _appointmentCtrl, _tinCtrl, _gsisCtrl,
      _pagibigCtrl, _philhealthCtrl, _addressCtrl,
    ]) { c.dispose(); }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final assignments = _subjectRows
        .where((r) => r.gradeId != null && r.subjectId != null)
        .map((r) => {'grade_level_id': r.gradeId!, 'subject_id': r.subjectId!})
        .toList();

    final Map<String, dynamic> payload;

    if (widget.adminEditOnly) {
      payload = {
        if (_selectedRole != null) 'role': _selectedRole!.name,
        if (_appointmentCtrl.text.trim().isNotEmpty)
          'date_of_appointment': _appointmentCtrl.text.trim(),
        // Dean stores their single handled grade level in grade_level_ids
        'grade_level_ids': (_selectedRole == UserRole.dean && _selectedDeanGradeLevelId != null)
            ? [_selectedDeanGradeLevelId!]
            : [],
        'subject_grade_assignments': assignments,
        'coordinator_type_id':      _selectedCoordinatorTypeId,
      };
    } else {
      payload = {
        'first_name':   _firstNameCtrl.text.trim(),
        'middle_name':  _middleNameCtrl.text.trim().isEmpty ? null : _middleNameCtrl.text.trim(),
        'last_name':    _lastNameCtrl.text.trim(),
        'suffix':       _suffixCtrl.text.trim().isEmpty ? null : _suffixCtrl.text.trim(),
        'username':     _usernameCtrl.text.trim().isEmpty ? null : _usernameCtrl.text.trim(),
        'email':        _emailCtrl.text.trim(),
        'contact_number': _contactCtrl.text.trim().isEmpty ? null : _contactCtrl.text.trim(),
        'birthdate':    _birthdateCtrl.text.trim().isEmpty ? null : _birthdateCtrl.text.trim(),
        'role':         _selectedRole?.name,
        'date_of_appointment': _appointmentCtrl.text.trim().isEmpty ? null : _appointmentCtrl.text.trim(),
        'grade_level_ids': (_selectedRole == UserRole.dean && _selectedDeanGradeLevelId != null)
            ? [_selectedDeanGradeLevelId!]
            : [],
        'subject_grade_assignments': assignments,
        'coordinator_type_id':      _selectedCoordinatorTypeId,
        'tin_number':   _tinCtrl.text.trim().isEmpty ? null : _tinCtrl.text.trim(),
        'gsis_number':  _gsisCtrl.text.trim().isEmpty ? null : _gsisCtrl.text.trim(),
        'pagibig_number': _pagibigCtrl.text.trim().isEmpty ? null : _pagibigCtrl.text.trim(),
        'philhealth_number': _philhealthCtrl.text.trim().isEmpty ? null : _philhealthCtrl.text.trim(),
        'address':      _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
      };

      if (widget.existingUserId == null) {
        payload['password'] = _passwordCtrl.text;
      } else if (_passwordCtrl.text.isNotEmpty) {
        payload['new_password'] = _passwordCtrl.text;
      }
    }

    try {
      if (widget.existingUserId == null) {
        await widget.controller.createUser(payload);
      } else {
        await widget.controller.updateUser(widget.existingUserId!, payload);
      }
      widget.onSaved();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: _kErrorRed),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existingUserId != null;
    return Container(
      margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 40),
      decoration: const BoxDecoration(
        color: Color(0xFFEEF4FB),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 12),
            decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(2)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                Text(
                  widget.adminEditOnly
                      ? 'Edit Role & Assignment'
                      : (isEdit ? 'Update Personnel' : 'Add Personnel'),
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loadingUser
                ? const Center(child: Padding(padding: EdgeInsets.all(48), child: CircularProgressIndicator()))
                : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Personal / Account / Contact — hidden in adminEditOnly mode ──
                    if (!widget.adminEditOnly) ...[
                      const _FormSectionHeader('Personal Information'),
                      _FormRow(children: [
                        _FormField('First Name', _firstNameCtrl, required: true),
                        _FormField('Middle Name', _middleNameCtrl),
                        _FormField('Last Name', _lastNameCtrl, required: true),
                        _FormField('Suffix', _suffixCtrl),
                      ]),
                      const SizedBox(height: 20),

                      const _FormSectionHeader('Account Information'),
                      _FormRow(children: [
                        _FormField('Username', _usernameCtrl),
                        _FormField(
                          isEdit ? 'New Password (leave blank to keep current)' : 'Password',
                          _passwordCtrl,
                          obscure: true,
                          required: !isEdit,
                        ),
                        _FormField('Email', _emailCtrl, required: true),
                      ]),
                      const SizedBox(height: 20),

                      const _FormSectionHeader('Contact Information'),
                      _FormRow(children: [
                        _FormField('Contact Number', _contactCtrl),
                        DatePickerField('Birthdate', _birthdateCtrl),
                      ]),
                      const SizedBox(height: 20),
                    ],

                    // ── Role Assignment ──────────────────────────────────
                    const _FormSectionHeader('Role Assignment'),
                    _FormRow(children: [
                      _RoleDropdown(
                        value: _selectedRole,
                        onChanged: (r) => setState(() {
                          _selectedRole = r;
                          _selectedDeanGradeLevelId  = null;
                          _selectedCoordinatorTypeId = null;
                        }),
                      ),
                      DatePickerField('Date of Appointment', _appointmentCtrl),
                    ]),
                    // Dean → single grade level = "department handled"
                    if (_selectedRole == UserRole.dean) ...[
                      const SizedBox(height: 12),
                      _DropdownField<int>(
                        label: 'Department Handled',
                        value: _selectedDeanGradeLevelId,
                        items: widget.gradeLevels
                            .map((g) => DropdownMenuItem(value: g.id, child: Text(g.name)))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedDeanGradeLevelId = v),
                      ),
                    ],
                    // Coordinator → coordinator type picker
                    if (_selectedRole == UserRole.coordinator) ...[
                      const SizedBox(height: 12),
                      _DropdownField<int>(
                        label: 'Coordinator Type',
                        value: _selectedCoordinatorTypeId,
                        items: widget.coordinatorTypes
                            .map((ct) => DropdownMenuItem(
                                  value: ct.id,
                                  child: Text(ct.name),
                                ))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedCoordinatorTypeId = v),
                      ),
                    ],
                    const SizedBox(height: 20),

                    // ── Subject-Grade Assignment ─────────────────────────
                    const _FormSectionHeader('Subject-Grade Assignment'),
                    ..._subjectRows.asMap().entries.map((e) => _SubjectGradeRowWidget(
                      row: e.value,
                      index: e.key,
                      gradeLevels: widget.gradeLevels,
                      subjects: widget.subjects,
                      isLast: e.key == _subjectRows.length - 1,
                      onRemove: _subjectRows.length > 1
                          ? () => setState(() => _subjectRows.removeAt(e.key))
                          : () {},
                      onAdd: () => setState(() => _subjectRows.add(_SubjectGradeRow())),
                      onChanged: () => setState(() {}),
                    )),
                    const SizedBox(height: 20),

                    // ── ID Numbers / Address — hidden in adminEditOnly mode ──
                    if (!widget.adminEditOnly) ...[
                      const _FormSectionHeader('ID Numbers'),
                      _FormRow(children: [
                        _FormField('TIN Number', _tinCtrl),
                        _FormField('GSIS Number', _gsisCtrl),
                        _FormField('PHIC Number', _philhealthCtrl),
                        _FormField('HDMF Number', _pagibigCtrl),
                      ]),
                      const SizedBox(height: 20),

                      const _FormSectionHeader('Address'),
                      _FormField('Address', _addressCtrl, maxLines: 3),
                      const SizedBox(height: 20),
                    ],

                    // Action buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _saving ? null : () => Navigator.pop(context),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(double.infinity, 50),
                              side: const BorderSide(color: _kNavSel),
                              foregroundColor: _kNavSel,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _saving ? null : _save,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _kAddBtn,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(double.infinity, 50),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: _saving
                                ? const SizedBox(
                                    width: 20, height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : Text(isEdit ? 'Save Changes' : 'Create User',
                                    style: const TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Form sub-widgets
// ─────────────────────────────────────────────────────────────────────────────
class _FormSectionHeader extends StatelessWidget {
  final String title;
  const _FormSectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      );
}

class _FormRow extends StatelessWidget {
  final List<Widget> children;
  const _FormRow({required this.children});

  @override
  Widget build(BuildContext context) {
    if (Responsive.isMobile(context)) {
      return Column(children: children.map((c) => Padding(
        padding: const EdgeInsets.only(bottom: 10), child: c)).toList());
    }
    return Wrap(
      spacing: 12, runSpacing: 12,
      children: children.map((c) => SizedBox(width: 240, child: c)).toList(),
    );
  }
}

class _FormField extends StatelessWidget {
  final String label;
  final TextEditingController ctrl;
  final bool obscure;
  final bool required;
  final int maxLines;

  const _FormField(this.label, this.ctrl, {
    this.obscure = false, this.required = false, this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.black54, fontSize: 11)),
        const SizedBox(height: 4),
        TextFormField(
          controller: ctrl,
          obscureText: obscure,
          maxLines: maxLines,
          validator: required
              ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
              : null,
          decoration: InputDecoration(
            hintText: label,
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
          ),
        ),
      ],
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  final String label;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.black54, fontSize: 11)),
        const SizedBox(height: 4),
        DropdownButtonFormField<T>(
          initialValue: value,
          hint: Text('Select $label'),
          decoration: InputDecoration(
            filled: true, fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.shade300)),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.shade300)),
          ),
          items: items,
          onChanged: onChanged,
        ),
      ],
    );
  }
}

class _RoleDropdown extends StatelessWidget {
  final UserRole? value;
  final ValueChanged<UserRole?> onChanged;

  const _RoleDropdown({this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Administrative Role', style: TextStyle(color: Colors.black54, fontSize: 11)),
        const SizedBox(height: 4),
        DropdownButtonFormField<UserRole>(
          initialValue: value,
          hint: const Text('Select role'),
          decoration: InputDecoration(
            filled: true, fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.shade300)),
          ),
          items: UserRole.values
              .map((r) => DropdownMenuItem(value: r, child: Text(r.displayName)))
              .toList(),
          onChanged: onChanged,
          validator: (v) => v == null ? 'Required' : null,
        ),
      ],
    );
  }
}

class _SubjectGradeRow {
  int? gradeId;
  int? subjectId;
}

class _SubjectGradeRowWidget extends StatelessWidget {
  final _SubjectGradeRow row;
  final int index;
  final List<GradeLevelModel> gradeLevels;
  final List<SubjectModel> subjects;
  final bool isLast;
  final VoidCallback onRemove;
  final VoidCallback onAdd;
  final VoidCallback onChanged;

  const _SubjectGradeRowWidget({
    required this.row, required this.index, required this.gradeLevels,
    required this.subjects, required this.isLast,
    required this.onRemove, required this.onAdd, required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Grade Level', style: TextStyle(color: Colors.black54, fontSize: 11)),
              const SizedBox(height: 4),
              DropdownButtonFormField<int>(
                initialValue: row.gradeId,
                hint: const Text('Grade Level'),
                decoration: InputDecoration(
                  filled: true, fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: Colors.grey.shade300)),
                ),
                items: gradeLevels.map((g) => DropdownMenuItem(value: g.id, child: Text(g.name))).toList(),
                onChanged: (v) { row.gradeId = v; onChanged(); },
              ),
            ]),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Subject', style: TextStyle(color: Colors.black54, fontSize: 11)),
              const SizedBox(height: 4),
              DropdownButtonFormField<int>(
                initialValue: row.subjectId,
                hint: const Text('Select subject'),
                decoration: InputDecoration(
                  filled: true, fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: Colors.grey.shade300)),
                ),
                items: subjects.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
                onChanged: (v) { row.subjectId = v; onChanged(); },
              ),
            ]),
          ),
          const SizedBox(width: 8),
          IconButton(icon: const Icon(Icons.close, color: _kErrorRed), onPressed: onRemove),
          if (isLast)
            IconButton(icon: const Icon(Icons.add, color: _kAccent), onPressed: onAdd),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible table section
// ─────────────────────────────────────────────────────────────────────────────
class _CollapsibleTableSection extends StatefulWidget {
  final String title;
  final int count;
  final Widget table;
  final bool initiallyExpanded;
  final bool isDeactivated;

  const _CollapsibleTableSection({
    required this.title,
    required this.count,
    required this.table,
    this.initiallyExpanded = true,
    this.isDeactivated = false,
  });

  @override
  State<_CollapsibleTableSection> createState() => _CollapsibleTableSectionState();
}

class _CollapsibleTableSectionState extends State<_CollapsibleTableSection> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    final headerColor = widget.isDeactivated ? const Color(0xFFE8ECF0) : _kTableHead;
    final titleColor  = widget.isDeactivated ? _kDeactTxt : Colors.black87;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: headerColor,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _kRowBorder),
            ),
            child: Row(
              children: [
                Text(
                  '${widget.title} (${widget.count})',
                  style: TextStyle(
                    color: titleColor,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const Spacer(),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  color: titleColor,
                ),
              ],
            ),
          ),
        ),
        if (_expanded) ...[
          const SizedBox(height: 12),
          widget.table,
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error / empty states
// ─────────────────────────────────────────────────────────────────────────────
class _ErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorBanner({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: _kErrorRed, size: 48),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add New User Dialog (email, username, password — admin sets initial password)
// ─────────────────────────────────────────────────────────────────────────────
class _AddUserDialog extends StatefulWidget {
  final UserController controller;
  final VoidCallback onCreated;

  const _AddUserDialog({required this.controller, required this.onCreated});

  @override
  State<_AddUserDialog> createState() => _AddUserDialogState();
}

class _AddUserDialogState extends State<_AddUserDialog> {
  final _emailCtrl    = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _saving = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _emailCtrl.text.trim().isNotEmpty &&
      _usernameCtrl.text.trim().isNotEmpty &&
      _passwordCtrl.text.length >= 6;

  Future<void> _submit() async {
    setState(() { _saving = true; _error = null; });
    try {
      await widget.controller.quickCreateUser(
        email: _emailCtrl.text.trim(),
        username: _usernameCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
      widget.onCreated();
    } catch (e) {
      setState(() { _saving = false; _error = e.toString(); });
    }
  }

  Widget _field(String label, TextEditingController ctrl, {
    bool obscure = false, bool isPassword = false, TextInputType? keyboard,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Colors.black54)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          obscureText: isPassword ? _obscure : obscure,
          keyboardType: keyboard,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: label,
            filled: true,
            fillColor: Colors.grey.shade100,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade300)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade300)),
            suffixIcon: isPassword
                ? IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, size: 18),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  )
                : null,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Add New User',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
      content: SizedBox(
        width: 380,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _field('Email', _emailCtrl, keyboard: TextInputType.emailAddress),
            const SizedBox(height: 16),
            _field('Username', _usernameCtrl),
            const SizedBox(height: 16),
            _field('Password', _passwordCtrl, isPassword: true),
            const SizedBox(height: 4),
            const Text('Min. 6 characters', style: TextStyle(fontSize: 11, color: Colors.black38)),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: _kErrorRed, fontSize: 12)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: Colors.black54)),
        ),
        ElevatedButton(
          onPressed: (_canSubmit && !_saving) ? _submit : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: _kAddBtn,
            foregroundColor: Colors.white,
            disabledBackgroundColor: Colors.grey.shade300,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          ),
          child: _saving
              ? const SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Create User', style: TextStyle(fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}


class _ConfirmDialog extends StatelessWidget {
  final String title;
  final String message;
  final String confirmLabel;
  final Color confirmColor;

  const _ConfirmDialog({
    required this.title, required this.message,
    required this.confirmLabel, required this.confirmColor,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, true),
          style: ElevatedButton.styleFrom(backgroundColor: confirmColor, foregroundColor: Colors.white),
          child: Text(confirmLabel),
        ),
      ],
    );
  }
}
