import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';

// ── Design tokens (Alden's palette) ──────────────────────────────────────────
const _kPageBg    = Color(0xFFDDE6F0);
const _kBannerBg  = Color(0xFF1A1A2E);
const _kNavSel    = Color(0xFF6B7A92);
const _kTableHead = Color(0xFFC8D6E5);
const _kRowBorder = Color(0xFFD0DCEB);
const _kAddBtn    = Color(0xFF2D3748);
const _kDeactTxt  = Color(0xFF9AA5B4);
const _kLinkBlue  = Color(0xFF4A7FA5);

class PersonnelManagementScreen extends StatefulWidget {
  const PersonnelManagementScreen({super.key});

  @override
  State<PersonnelManagementScreen> createState() =>
      _PersonnelManagementScreenState();
}

class _PersonnelManagementScreenState
    extends State<PersonnelManagementScreen> {
  List<User> _personnel = [];
  bool _loading = true;
  String _search = '';
  int _tabIndex = 0; // 0 = Academic Delegation, 1 = Personal Information

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await ApiService.getPersonnel(search: _search);
      if (mounted) setState(() => _personnel = list);
    } catch (e) {
      if (mounted) _showSnack('Failed to load personnel: $e', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? Colors.red : const Color(0xFF4A6FA5),
    ));
  }

  List<User> get _active   => _personnel.where((u) => u.isActive).toList();
  List<User> get _inactive => _personnel.where((u) => !u.isActive).toList();

  bool get _canWrite {
    final role = context.read<AppState>().userRole;
    return role == 'principal' || role == 'registrar' || role == 'admin';
  }

  Future<void> _openForm(User? user) async {
    if (user == null) {
      // Simple add dialog
      final result = await showDialog<bool>(
        context: context,
        builder: (_) => const _AddUserDialog(),
      );
      if (result == true) {
        _load();
        _showSnack('Personnel added.');
      }
    } else {
      // Full edit dialog
      final result = await showDialog<bool>(
        context: context,
        builder: (_) => _EditPersonnelDialog(user: user),
      );
      if (result == true) {
        _load();
        _showSnack('Personnel updated.');
      }
    }
  }

  Future<void> _openDetail(User user) async {
    await showDialog(
      context: context,
      builder: (_) => _PersonnelDetailDialog(user: user),
    );
  }

  Future<void> _toggleStatus(User user) async {
    final action = user.isActive ? 'deactivate' : 'reactivate';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Confirm ${action[0].toUpperCase()}${action.substring(1)}'),
        content: Text('Are you sure you want to $action ${user.fullName}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                  backgroundColor: user.isActive ? Colors.red : Colors.green),
              child: Text(
                  '${action[0].toUpperCase()}${action.substring(1)}')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService.togglePersonnelStatus(user.id);
      _load();
      _showSnack('${user.fullName} has been '
          '${user.isActive ? "deactivated" : "reactivated"}.');
    } catch (e) {
      _showSnack('Failed to update status: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _kPageBg,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Hero banner ──────────────────────────────────────────────────
            _HeroBanner(),
            const SizedBox(height: 20),

            // ── Tab row ──────────────────────────────────────────────────────
            Row(
              children: [
                _TabButton(
                  label: 'Academic Delegation',
                  active: _tabIndex == 0,
                  onTap: () => setState(() => _tabIndex = 0),
                ),
                const SizedBox(width: 8),
                _TabButton(
                  label: 'Personal Information',
                  active: _tabIndex == 1,
                  onTap: () => setState(() => _tabIndex = 1),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // ── Search + Add ─────────────────────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (v) {
                      _search = v;
                      _load();
                    },
                    decoration: InputDecoration(
                      hintText: 'Search',
                      prefixIcon:
                          const Icon(Icons.search, color: Colors.black45),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            BorderSide(color: Colors.grey.shade300),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            BorderSide(color: Colors.grey.shade400),
                      ),
                    ),
                  ),
                ),
                if (_canWrite) ...[
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: () => _openForm(null),
                    icon: const Icon(Icons.add,
                        color: Colors.white, size: 18),
                    label: const Text('Add User',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _kAddBtn,
                      minimumSize: const Size(0, 48),
                      padding:
                          const EdgeInsets.symmetric(horizontal: 20),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      elevation: 0,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),

            // ── Content ──────────────────────────────────────────────────────
            if (_loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(48),
                      child: CircularProgressIndicator()))
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _CollapsibleSection(
                    title: 'Active Users',
                    count: _active.length,
                    initiallyExpanded: true,
                    isDeactivated: false,
                    child: _UserDataTable(
                      users: _active,
                      tabIndex: _tabIndex,
                      isDeactivated: false,
                      canWrite: _canWrite,
                      onView: _openDetail,
                      onEdit: _openForm,
                      onToggle: _toggleStatus,
                    ),
                  ),
                  if (_inactive.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _CollapsibleSection(
                      title: 'Deactivated Accounts',
                      count: _inactive.length,
                      initiallyExpanded: false,
                      isDeactivated: true,
                      child: _UserDataTable(
                        users: _inactive,
                        tabIndex: _tabIndex,
                        isDeactivated: true,
                        canWrite: _canWrite,
                        onView: _openDetail,
                        onEdit: _openForm,
                        onToggle: _toggleStatus,
                      ),
                    ),
                  ],
                ],
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Banner with hexagon painter
// ─────────────────────────────────────────────────────────────────────────────

class _HeroBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        color: _kBannerBg,
        child: Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: _HexPainter())),
            const Padding(
              padding:
                  EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'User Manager',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
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

  void _hexagon(
      Canvas canvas, Paint paint, Offset center, double r) {
    final path = Path();
    for (int i = 0; i < 6; i++) {
      final angle = (i * 60 - 30) * math.pi / 180;
      final pt = Offset(
        center.dx + r * math.cos(angle),
        center.dy + r * math.sin(angle),
      );
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab button
// ─────────────────────────────────────────────────────────────────────────────

class _TabButton extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _TabButton(
      {required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
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
// Collapsible section
// ─────────────────────────────────────────────────────────────────────────────

class _CollapsibleSection extends StatefulWidget {
  final String title;
  final int count;
  final bool initiallyExpanded;
  final bool isDeactivated;
  final Widget child;

  const _CollapsibleSection({
    required this.title,
    required this.count,
    required this.child,
    this.initiallyExpanded = true,
    this.isDeactivated = false,
  });

  @override
  State<_CollapsibleSection> createState() => _CollapsibleSectionState();
}

class _CollapsibleSectionState extends State<_CollapsibleSection> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    final headerColor = widget.isDeactivated
        ? const Color(0xFFE8ECF0)
        : _kTableHead;
    final titleColor =
        widget.isDeactivated ? _kDeactTxt : Colors.black87;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 14, vertical: 11),
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
                  _expanded
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  color: titleColor,
                ),
              ],
            ),
          ),
        ),
        if (_expanded) ...[
          const SizedBox(height: 12),
          widget.child,
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Data table
// ─────────────────────────────────────────────────────────────────────────────

class _UserDataTable extends StatelessWidget {
  final List<User> users;
  final int tabIndex;
  final bool isDeactivated;
  final bool canWrite;
  final void Function(User) onView;
  final void Function(User) onEdit;
  final void Function(User) onToggle;

  const _UserDataTable({
    required this.users,
    required this.tabIndex,
    required this.isDeactivated,
    required this.canWrite,
    required this.onView,
    required this.onEdit,
    required this.onToggle,
  });

  List<DataColumn> get _columns {
    if (tabIndex == 0) {
      return const [
        DataColumn(label: _ColHeader('ID')),
        DataColumn(label: _ColHeader('Name')),
        DataColumn(label: _ColHeader('Username')),
        DataColumn(label: _ColHeader('Contact')),
        DataColumn(label: _ColHeader('Email')),
        DataColumn(label: _ColHeader('Subject')),
        DataColumn(label: _ColHeader('Grade Level')),
        DataColumn(label: _ColHeader('Role')),
        DataColumn(label: _ColHeader('Action')),
      ];
    } else {
      return const [
        DataColumn(label: _ColHeader('ID')),
        DataColumn(label: _ColHeader('Name')),
        DataColumn(label: _ColHeader('Birthdate')),
        DataColumn(label: _ColHeader('TIN')),
        DataColumn(label: _ColHeader('Pag-IBIG')),
        DataColumn(label: _ColHeader('PhilHealth')),
        DataColumn(label: _ColHeader('Date Hired')),
        DataColumn(label: _ColHeader('Address')),
        DataColumn(label: _ColHeader('Action')),
      ];
    }
  }

  List<DataCell> _cells(User u) {
    final dim = TextStyle(
      color: isDeactivated ? _kDeactTxt : Colors.black87,
      fontSize: 13,
    );
    final link = dim.copyWith(
      color: isDeactivated ? _kDeactTxt : _kLinkBlue,
    );
    final subj = u.subjects.isNotEmpty ? u.subjects.first.subject : '—';

    if (tabIndex == 0) {
      return [
        DataCell(Text('—', style: dim)),
        DataCell(Text(u.fullName, style: link)),
        DataCell(Text(u.username, style: dim)),
        DataCell(Text(u.phoneNumber ?? '—', style: dim)),
        DataCell(Text(u.email ?? '—', style: dim)),
        DataCell(Text(subj, style: dim)),
        DataCell(Text(u.gradeLevel ?? '—', style: dim)),
        DataCell(Text(u.roleLabel, style: dim)),
        DataCell(_ActionMenu(
          user: u,
          isDeactivated: isDeactivated,
          canWrite: canWrite,
          onView: onView,
          onEdit: onEdit,
          onToggle: onToggle,
        )),
      ];
    } else {
      return [
        DataCell(Text('—', style: dim)),
        DataCell(Text(u.fullName, style: link)),
        DataCell(Text(u.birthdate ?? '—', style: dim)),
        DataCell(Text(u.tin ?? '—', style: dim)),
        DataCell(Text(u.hdmf ?? '—', style: dim)),
        DataCell(Text(u.phic ?? '—', style: dim)),
        DataCell(Text(u.dateOfAppointment ?? '—', style: dim)),
        DataCell(Text(u.address ?? '—', style: dim)),
        DataCell(_ActionMenu(
          user: u,
          isDeactivated: isDeactivated,
          canWrite: canWrite,
          onView: onView,
          onEdit: onEdit,
          onToggle: onToggle,
        )),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    if (users.isEmpty) return const SizedBox.shrink();
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
            constraints:
                BoxConstraints(minWidth: constraints.maxWidth),
            child: DataTable(
              headingRowColor:
                  WidgetStateProperty.all(_kTableHead),
              headingRowHeight: 44,
              dataRowMinHeight: 52,
              dataRowMaxHeight: 64,
              dividerThickness: 1,
              border: TableBorder(
                horizontalInside:
                    const BorderSide(color: _kRowBorder),
                borderRadius: BorderRadius.circular(12),
              ),
              columns: _columns,
              rows: users
                  .map((u) => DataRow(cells: _cells(u)))
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }
}

class _ColHeader extends StatelessWidget {
  final String text;
  const _ColHeader(this.text);

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(
          fontWeight: FontWeight.bold, fontSize: 13));
}

class _ActionMenu extends StatelessWidget {
  final User user;
  final bool isDeactivated;
  final bool canWrite;
  final void Function(User) onView;
  final void Function(User) onEdit;
  final void Function(User) onToggle;

  const _ActionMenu({
    required this.user,
    required this.isDeactivated,
    required this.canWrite,
    required this.onView,
    required this.onEdit,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert, size: 20),
      onSelected: (v) {
        switch (v) {
          case 'view':
            onView(user);
          case 'edit':
            onEdit(user);
          case 'toggle':
            onToggle(user);
        }
      },
      itemBuilder: (_) => [
        if (canWrite && !isDeactivated)
          const PopupMenuItem(value: 'edit', child: Text('Edit')),
        const PopupMenuItem(
            value: 'view', child: Text('View Details')),
        if (canWrite)
          PopupMenuItem(
            value: 'toggle',
            child: Text(
              isDeactivated ? 'Reactivate' : 'Deactivate',
              style: TextStyle(
                  color: isDeactivated
                      ? const Color(0xFF4A6FA5)
                      : Colors.red),
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Personnel Detail Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _PersonnelDetailDialog extends StatelessWidget {
  final User user;
  const _PersonnelDetailDialog({required this.user});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: _kPageBg,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints:
            const BoxConstraints(maxWidth: 640, maxHeight: 680),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.fromLTRB(24, 20, 16, 20),
              decoration: const BoxDecoration(
                color: _kNavSel,
                borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(16)),
              ),
              child: Row(children: [
                const Text('User Details',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w700)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.white),
                ),
              ]),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _detailSection('Basic Information', [
                      _detailRow('Name', user.fullName),
                      _detailRow('Username', user.username),
                      _detailRow('Role', user.roleLabel),
                      _detailRow('Status',
                          user.isActive ? 'Active' : 'Deactivated'),
                    ]),
                    const SizedBox(height: 16),
                    _detailSection('Contact Information', [
                      _detailRow('Email', user.email ?? '—'),
                      _detailRow(
                          'Contact Number', user.phoneNumber ?? '—'),
                      _detailRow('Address', user.address ?? '—'),
                    ]),
                    const SizedBox(height: 16),
                    _detailSection('Academic Information', [
                      _detailRow('Grade Level', user.gradeLevel ?? '—'),
                      _detailRow(
                        'Subjects',
                        user.subjects.isNotEmpty
                            ? user.subjects
                                .map((s) => s.subject)
                                .join(', ')
                            : '—',
                      ),
                      _detailRow('Date of Appointment',
                          user.dateOfAppointment ?? '—'),
                    ]),
                    const SizedBox(height: 16),
                    _detailSection('Government IDs', [
                      _detailRow('TIN', user.tin ?? '—'),
                      _detailRow('Pag-IBIG', user.hdmf ?? '—'),
                      _detailRow('PhilHealth', user.phic ?? '—'),
                    ]),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kNavSel,
                    side: const BorderSide(color: _kNavSel),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Close',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailSection(
      String title, List<Widget> rows) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.black87)),
        const SizedBox(height: 6),
        const Divider(height: 1, color: _kRowBorder),
        const SizedBox(height: 10),
        ...rows,
      ],
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 160,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 13,
                    color: Colors.black54)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87)),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add User Dialog  — simple: Email, Username, Password
// ─────────────────────────────────────────────────────────────────────────────

class _AddUserDialog extends StatefulWidget {
  const _AddUserDialog();

  @override
  State<_AddUserDialog> createState() => _AddUserDialogState();
}

class _AddUserDialogState extends State<_AddUserDialog> {
  final _formKey      = GlobalKey<FormState>();
  final _emailCtrl    = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _saving  = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiService.createPersonnel({
        'email':    _emailCtrl.text.trim(),
        'username': _usernameCtrl.text.trim(),
        'password': _passwordCtrl.text,
        'first_name': '',
        'last_name':  '',
        'role': 'teacher',
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _emailCtrl.text.isNotEmpty &&
        _usernameCtrl.text.isNotEmpty &&
        _passwordCtrl.text.length >= 6;

    return Dialog(
      backgroundColor: const Color(0xFFF0F2F5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 28, 28, 24),
          child: Form(
            key: _formKey,
            onChanged: () => setState(() {}),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Add New User',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87)),
                const SizedBox(height: 24),

                // Email
                _label('Email'),
                const SizedBox(height: 6),
                _plainField(_emailCtrl, hint: 'Email',
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Required'
                        : null),
                const SizedBox(height: 16),

                // Username
                _label('Username'),
                const SizedBox(height: 6),
                _plainField(_usernameCtrl, hint: 'Username',
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Required'
                        : null),
                const SizedBox(height: 16),

                // Password
                _label('Password'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (v.length < 6) return 'Min. 6 characters';
                    return null;
                  },
                  decoration: _plainDeco('Password').copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(
                          _obscure
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: Colors.grey),
                      onPressed: () =>
                          setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                const Text('Min. 6 characters',
                    style: TextStyle(fontSize: 11, color: Colors.black45)),

                const SizedBox(height: 28),

                // Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel',
                          style: TextStyle(color: Colors.black54)),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: (_saving || !canSubmit) ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kAddBtn,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Colors.grey.shade300,
                        disabledForegroundColor: Colors.grey.shade500,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                        elevation: 0,
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Text('Create User',
                              style: TextStyle(
                                  fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text,
      style: const TextStyle(
          fontSize: 13, fontWeight: FontWeight.w500, color: Colors.black54));

  Widget _plainField(TextEditingController ctrl,
      {required String hint, String? Function(String?)? validator}) {
    return TextFormField(
      controller: ctrl,
      validator: validator,
      decoration: _plainDeco(hint),
    );
  }

  InputDecoration _plainDeco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.black38, fontSize: 14),
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade400)),
        errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.red)),
        focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.red)),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Personnel Dialog  — full details form
// ─────────────────────────────────────────────────────────────────────────────

class _EditPersonnelDialog extends StatefulWidget {
  final User user;
  const _EditPersonnelDialog({required this.user});

  @override
  State<_EditPersonnelDialog> createState() => _EditPersonnelDialogState();
}

class _EditPersonnelDialogState extends State<_EditPersonnelDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _saving   = false;

  final _passwordCtrl    = TextEditingController();
  final _emailCtrl       = TextEditingController();
  final _firstNameCtrl   = TextEditingController();
  final _middleNameCtrl  = TextEditingController();
  final _lastNameCtrl    = TextEditingController();
  final _suffixCtrl      = TextEditingController();
  final _contactCtrl     = TextEditingController();
  final _pagibigCtrl     = TextEditingController();
  final _philhealthCtrl  = TextEditingController();
  final _appointmentCtrl = TextEditingController();
  final _tinCtrl         = TextEditingController();
  final _birthdateCtrl   = TextEditingController();
  final _addressCtrl     = TextEditingController();

  String _selectedRole = 'teacher';
  int? _selectedGradeLevelId;
  List<Map<String, dynamic>> _gradeLevels = [];

  static const _roles = [
    'principal', 'coordinator', 'dean', 'registrar', 'teacher'
  ];

  @override
  void initState() {
    super.initState();
    _loadMeta();
    _populate(widget.user);
  }

  Future<void> _loadMeta() async {
    final levels = await ApiService.getGradeLevelsMeta();
    if (mounted) setState(() => _gradeLevels = levels);
  }

  void _populate(User u) {
    _emailCtrl.text       = u.email ?? '';
    _firstNameCtrl.text   = u.firstName ?? '';
    _middleNameCtrl.text  = u.middleName ?? '';
    _lastNameCtrl.text    = u.lastName ?? '';
    _suffixCtrl.text      = u.suffix ?? '';
    _contactCtrl.text     = u.phoneNumber ?? '';
    _pagibigCtrl.text     = u.hdmf ?? '';
    _philhealthCtrl.text  = u.phic ?? '';
    _appointmentCtrl.text = u.dateOfAppointment ?? '';
    _tinCtrl.text         = u.tin ?? '';
    _birthdateCtrl.text   = u.birthdate ?? '';
    _addressCtrl.text     = u.address ?? '';
    _selectedRole         = u.role;
    _selectedGradeLevelId = u.gradeLevelId;
  }

  @override
  void dispose() {
    for (final c in [
      _passwordCtrl, _emailCtrl, _firstNameCtrl, _middleNameCtrl,
      _lastNameCtrl, _suffixCtrl, _contactCtrl, _pagibigCtrl,
      _philhealthCtrl, _appointmentCtrl, _tinCtrl, _birthdateCtrl,
      _addressCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final data = <String, dynamic>{
        if (_firstNameCtrl.text.trim().isNotEmpty)
          'first_name': _firstNameCtrl.text.trim(),
        if (_middleNameCtrl.text.isNotEmpty)
          'middle_name': _middleNameCtrl.text.trim(),
        if (_lastNameCtrl.text.trim().isNotEmpty)
          'last_name': _lastNameCtrl.text.trim(),
        if (_suffixCtrl.text.isNotEmpty) 'suffix': _suffixCtrl.text.trim(),
        'role': _selectedRole,
        if (_selectedGradeLevelId != null) 'grade_level_id': _selectedGradeLevelId,
        if (_emailCtrl.text.isNotEmpty) 'email': _emailCtrl.text.trim(),
        if (_contactCtrl.text.isNotEmpty) 'phone_number': _contactCtrl.text.trim(),
        if (_tinCtrl.text.isNotEmpty) 'tin': _tinCtrl.text.trim(),
        if (_pagibigCtrl.text.isNotEmpty) 'hdmf': _pagibigCtrl.text.trim(),
        if (_philhealthCtrl.text.isNotEmpty) 'phic': _philhealthCtrl.text.trim(),
        if (_appointmentCtrl.text.isNotEmpty)
          'date_of_appointment': _appointmentCtrl.text.trim(),
        if (_birthdateCtrl.text.isNotEmpty) 'birthdate': _birthdateCtrl.text.trim(),
        if (_addressCtrl.text.isNotEmpty) 'address': _addressCtrl.text.trim(),
        if (_passwordCtrl.text.isNotEmpty) 'password': _passwordCtrl.text,
      };
      await ApiService.updatePersonnel(widget.user.id, data);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: _kPageBg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620, maxHeight: 720),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(24, 20, 16, 20),
              decoration: const BoxDecoration(
                color: _kNavSel,
                borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(16)),
              ),
              child: Row(children: [
                const Icon(Icons.edit_outlined, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                const Text('Edit Personnel',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.white, size: 20),
                ),
              ]),
            ),
            Expanded(
              child: Form(
                key: _formKey,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sec('New Password'),
                      _field('New Password (leave blank to keep)',
                          _passwordCtrl, obscure: true),
                      _sec('Verified Email'),
                      _field('Email', _emailCtrl, hint: 'user@school.edu.ph'),
                      _sec('Academic Delegation'),
                      _dropdown('Administrative Role *', _roles, _selectedRole,
                          (v) => setState(() => _selectedRole = v!)),
                      const SizedBox(height: 10),
                      if (_gradeLevels.isNotEmpty)
                        DropdownButtonFormField<int>(
                          value: _selectedGradeLevelId,
                          decoration: _deco('Grade Level'),
                          items: [
                            const DropdownMenuItem(
                                value: null, child: Text('— None —')),
                            ..._gradeLevels.map((gl) => DropdownMenuItem(
                                  value: gl['id'] as int,
                                  child: Text(gl['grade_level'] as String),
                                )),
                          ],
                          onChanged: (v) =>
                              setState(() => _selectedGradeLevelId = v),
                        ),
                      _sec('Personal Information'),
                      Row(children: [
                        Expanded(
                            child: _field('First Name', _firstNameCtrl)),
                        const SizedBox(width: 10),
                        Expanded(child: _field('Middle Name', _middleNameCtrl)),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(
                            child: _field('Last Name', _lastNameCtrl)),
                        const SizedBox(width: 10),
                        SizedBox(
                            width: 110,
                            child: _field('Suffix', _suffixCtrl, hint: 'Jr, Sr')),
                      ]),
                      const SizedBox(height: 10),
                      _field('Contact Number', _contactCtrl,
                          hint: '+63 9XX XXX XXXX',
                          keyboardType: TextInputType.phone),
                      const SizedBox(height: 10),
                      _field('Birthdate', _birthdateCtrl, hint: 'YYYY-MM-DD'),
                      const SizedBox(height: 10),
                      _field('Date of Appointment', _appointmentCtrl,
                          hint: 'YYYY-MM-DD'),
                      const SizedBox(height: 10),
                      _field('TIN Number', _tinCtrl,
                          hint: 'Numbers only',
                          keyboardType: TextInputType.number,
                          validator: _numeric),
                      const SizedBox(height: 10),
                      _field('Pag-IBIG Number', _pagibigCtrl,
                          hint: 'Numbers only',
                          keyboardType: TextInputType.number,
                          validator: _numeric),
                      const SizedBox(height: 10),
                      _field('PhilHealth Number', _philhealthCtrl,
                          hint: 'Numbers only',
                          keyboardType: TextInputType.number,
                          validator: _numeric),
                      const SizedBox(height: 10),
                      _field('Address', _addressCtrl, maxLines: 2),
                    ],
                  ),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(24, 14, 24, 20),
              decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: Colors.grey.shade200))),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _kNavSel,
                        side: const BorderSide(color: _kNavSel),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Cancel',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _saving ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kAddBtn,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Text('Save Changes',
                              style: TextStyle(fontWeight: FontWeight.w600)),
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

  Widget _sec(String title) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8),
        child: Text(title,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _kNavSel,
                letterSpacing: 0.5)),
      );

  Widget _field(String label, TextEditingController ctrl,
      {String? hint,
      bool obscure = false,
      int maxLines = 1,
      TextInputType? keyboardType,
      String? Function(String?)? validator}) {
    return TextFormField(
      controller: ctrl,
      obscureText: obscure,
      maxLines: maxLines,
      keyboardType: keyboardType,
      validator: validator,
      decoration: _deco(label, hint: hint),
    );
  }

  Widget _dropdown(String label, List<String> items, String value,
      ValueChanged<String?> onChanged) {
    return DropdownButtonFormField<String>(
      value: value,
      decoration: _deco(label),
      items: items
          .map((r) => DropdownMenuItem(
              value: r,
              child: Text('${r[0].toUpperCase()}${r.substring(1)}')))
          .toList(),
      onChanged: onChanged,
    );
  }

  InputDecoration _deco(String label, {String? hint}) => InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, color: Colors.grey),
      );

  String? _required(String? v) =>
      (v == null || v.trim().isEmpty) ? 'Required' : null;

  String? _numeric(String? v) {
    if (v == null || v.trim().isEmpty) return null;
    if (!RegExp(r'^[0-9]+$').hasMatch(v.trim())) return 'Numbers only';
    return null;
  }
}
