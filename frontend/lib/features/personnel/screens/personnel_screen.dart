import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../services/app_state.dart';
import '../../../models/models.dart';
import '../providers/personnel_provider.dart';
import '../services/personnel_service.dart';
import '../widgets/personnel_skeleton.dart';

// ── Design tokens ─────────────────────────────────────────────────────────────
const _kPageBg    = Color(0xFFDDE6F0);
const _kBannerBg  = Color(0xFF1A1A2E);
const _kNavSel    = Color(0xFF6B7A92);
const _kTableHead = Color(0xFFC8D6E5);
const _kRowBorder = Color(0xFFD0DCEB);
const _kAddBtn    = Color(0xFF2D3748);
const _kDeactTxt  = Color(0xFF9AA5B4);
const _kLinkBlue  = Color(0xFF4A7FA5);

// ── Entry point — provides PersonnelProvider ──────────────────────────────────
class PersonnelScreen extends StatelessWidget {
  const PersonnelScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => PersonnelProvider()..load(),
      child: const _PersonnelView(),
    );
  }
}

// ── Main view — consumes PersonnelProvider ────────────────────────────────────
class _PersonnelView extends StatelessWidget {
  const _PersonnelView();

  bool _canWrite(BuildContext context) {
    final role = context.read<AppState>().userRole;
    return role == 'principal' || role == 'registrar' || role == 'admin';
  }

  Future<void> _openAdd(BuildContext context, PersonnelProvider provider) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => const _AddUserDialog(),
    );
    if (result == true) {
      provider.load();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Personnel added.')));
      }
    }
  }

  Future<void> _openEdit(
      BuildContext context, PersonnelProvider provider, User user) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _EditRoleDialog(user: user),
    );
    if (result == true) {
      provider.load();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Personnel updated.')));
      }
    }
  }

  Future<void> _openDetail(BuildContext context, User user) async {
    await showDialog(
      context: context,
      builder: (_) => _PersonnelDetailDialog(user: user),
    );
  }

  Future<void> _confirmToggle(
      BuildContext context, PersonnelProvider provider, User user) async {
    final action = user.isActive ? 'deactivate' : 'reactivate';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Confirm ${action[0].toUpperCase()}${action.substring(1)}'),
        content:
            Text('Are you sure you want to $action ${user.fullName}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                  backgroundColor:
                      user.isActive ? Colors.red : Colors.green),
              child: Text(
                  '${action[0].toUpperCase()}${action.substring(1)}')),
        ],
      ),
    );
    if (confirm != true || !context.mounted) return;
    try {
      await provider.toggleStatus(user.id);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('${user.fullName} has been '
                '${user.isActive ? "deactivated" : "reactivated"}.')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed: $e'), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final canWrite = _canWrite(context);
    return Consumer<PersonnelProvider>(
      builder: (ctx, provider, _) {
        return Container(
          color: _kPageBg,
          child: NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n.metrics.pixels >= n.metrics.maxScrollExtent - 300) {
                provider.loadMore();
              }
              return false;
            },
            child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _HeroBanner(),
                const SizedBox(height: 20),

                // Tab row
                Row(children: [
                  _TabButton(
                    label: 'Academic Delegation',
                    active: provider.tabIndex == 0,
                    onTap: () => provider.setTabIndex(0),
                  ),
                  const SizedBox(width: 8),
                  _TabButton(
                    label: 'Personal Information',
                    active: provider.tabIndex == 1,
                    onTap: () => provider.setTabIndex(1),
                  ),
                ]),
                const SizedBox(height: 16),

                // Search + Add
                Row(children: [
                  Expanded(
                    child: TextField(
                      onChanged: provider.search,
                      decoration: InputDecoration(
                        hintText: 'Search',
                        prefixIcon: const Icon(Icons.search,
                            color: Colors.black45),
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
                  if (canWrite) ...[
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      onPressed: () => _openAdd(ctx, provider),
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
                ]),
                const SizedBox(height: 16),

                // Content or skeleton
                if (provider.loading)
                  const PersonnelSkeleton()
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _CollapsibleSection(
                        title: 'Active Users',
                        count: provider.active.length,
                        initiallyExpanded: true,
                        child: _UserDataTable(
                          users: provider.active,
                          tabIndex: provider.tabIndex,
                          isDeactivated: false,
                          canWrite: canWrite,
                          onView: (u) => _openDetail(ctx, u),
                          onEdit: (u) => _openEdit(ctx, provider, u),
                          onToggle: (u) =>
                              _confirmToggle(ctx, provider, u),
                        ),
                      ),
                      if (provider.inactive.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        _CollapsibleSection(
                          title: 'Deactivated Accounts',
                          count: provider.inactive.length,
                          initiallyExpanded: false,
                          isDeactivated: true,
                          child: _UserDataTable(
                            users: provider.inactive,
                            tabIndex: provider.tabIndex,
                            isDeactivated: true,
                            canWrite: canWrite,
                            onView: (u) => _openDetail(ctx, u),
                            onEdit: (u) => _openEdit(ctx, provider, u),
                            onToggle: (u) =>
                                _confirmToggle(ctx, provider, u),
                          ),
                        ),
                      ],
                    ],
                  ),
                if (!provider.loading && provider.hasMore)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Center(
                      child: provider.loadingMore
                          ? const CircularProgressIndicator(strokeWidth: 2)
                          : OutlinedButton(
                              onPressed: provider.loadMore,
                              child: const Text('Load more')),
                    ),
                  ),
              ],
            ),
          ),
          ),
        );
      },
    );
  }
}

// ── Hero banner ───────────────────────────────────────────────────────────────

class _HeroBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        color: _kBannerBg,
        child: Stack(children: [
          Positioned.fill(child: CustomPaint(painter: _HexPainter())),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('User Manager',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5)),
                SizedBox(height: 4),
                Text(
                    'Easily manage user profiles, roles, and permissions.',
                    style: TextStyle(
                        color: Colors.white70, fontSize: 13)),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

class _HexPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    const r = 28.0;
    const h = r * 1.732;
    for (double y = -r; y < size.height + r; y += h) {
      for (double x = -r; x < size.width + r; x += r * 3) {
        _hex(canvas, p, Offset(x, y), r);
        _hex(canvas, p, Offset(x + r * 1.5, y + h / 2), r);
      }
    }
  }

  void _hex(Canvas canvas, Paint p, Offset c, double r) {
    final path = Path();
    for (int i = 0; i < 6; i++) {
      final a = (i * 60 - 30) * math.pi / 180;
      final pt = Offset(c.dx + r * math.cos(a), c.dy + r * math.sin(a));
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    path.close();
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ── Tab button ────────────────────────────────────────────────────────────────

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
        child: Text(label,
            style: TextStyle(
                color: active ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w500,
                fontSize: 13)),
      ),
    );
  }
}

// ── Collapsible section ───────────────────────────────────────────────────────

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
    final headerColor =
        widget.isDeactivated ? const Color(0xFFE8ECF0) : _kTableHead;
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
            child: Row(children: [
              Text('${widget.title} (${widget.count})',
                  style: TextStyle(
                      color: titleColor,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
              const Spacer(),
              Icon(
                  _expanded
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  color: titleColor),
            ]),
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

// ── Data table ────────────────────────────────────────────────────────────────

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
        color: isDeactivated ? _kDeactTxt : Colors.black87, fontSize: 13);
    final link =
        dim.copyWith(color: isDeactivated ? _kDeactTxt : _kLinkBlue);
    final subj =
        u.subjects.isNotEmpty ? u.subjects.first.subject : '—';

    t(String v, {TextStyle? style}) =>
        Text(v, overflow: TextOverflow.ellipsis, style: style ?? dim);

    if (tabIndex == 0) {
      return [
        DataCell(t('—')),
        DataCell(t(u.fullName, style: link)),
        DataCell(t(u.username)),
        DataCell(t(u.phoneNumber ?? '—')),
        DataCell(t(u.email ?? '—')),
        DataCell(t(subj)),
        DataCell(t(u.gradeLevel ?? '—')),
        DataCell(t(u.roleLabel)),
        DataCell(_ActionMenu(
            user: u,
            isDeactivated: isDeactivated,
            canWrite: canWrite,
            onView: onView,
            onEdit: onEdit,
            onToggle: onToggle)),
      ];
    } else {
      return [
        DataCell(t('—')),
        DataCell(t(u.fullName, style: link)),
        DataCell(t(u.birthdate ?? '—')),
        DataCell(t(u.tin ?? '—')),
        DataCell(t(u.hdmf ?? '—')),
        DataCell(t(u.phic ?? '—')),
        DataCell(t(u.dateOfAppointment ?? '—')),
        DataCell(t(u.address ?? '—')),
        DataCell(_ActionMenu(
            user: u,
            isDeactivated: isDeactivated,
            canWrite: canWrite,
            onView: onView,
            onEdit: onEdit,
            onToggle: onToggle)),
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
            constraints: BoxConstraints(minWidth: constraints.maxWidth),
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(_kTableHead),
              headingRowHeight: 44,
              dataRowMinHeight: 52,
              dataRowMaxHeight: 64,
              columnSpacing: 20,
              horizontalMargin: 16,
              dividerThickness: 1,
              border: TableBorder(
                horizontalInside:
                    const BorderSide(color: _kRowBorder),
                borderRadius: BorderRadius.circular(12),
              ),
              columns: _columns,
              rows: users.map((u) => DataRow(cells: _cells(u))).toList(),
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
      overflow: TextOverflow.ellipsis,
      style:
          const TextStyle(fontWeight: FontWeight.bold, fontSize: 13));
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
          case 'view': onView(user);
          case 'edit': onEdit(user);
          case 'toggle': onToggle(user);
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

// ── User detail dialog ────────────────────────────────────────────────────────

class _PersonnelDetailDialog extends StatelessWidget {
  final User user;
  const _PersonnelDetailDialog({required this.user});

  @override
  Widget build(BuildContext context) {
    final u = user;
    final subjects = u.subjects.isNotEmpty
        ? u.subjects
            .map((s) =>
                s.gradeLevel != null ? '${s.subject} (${s.gradeLevel})' : s.subject)
            .join(', ')
        : '—';

    String? coordinatorLabel;
    if (u.role == 'coordinator') {
      coordinatorLabel = u.coordinatorType ?? 'Coordinator';
    } else if (u.role == 'dean') {
      coordinatorLabel = u.deanGradeLevel != null
          ? 'Dean — ${u.deanGradeLevel}'
          : 'Dean';
    }

    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 700, maxHeight: 700),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.fromLTRB(24, 18, 12, 18),
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
                      fontSize: 18,
                      fontWeight: FontWeight.w700)),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon:
                    const Icon(Icons.close, color: Colors.white, size: 22),
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              ),
            ]),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(28, 24, 28, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionHeader('Basic Information'),
                  _twoCol(
                    _field('ID',
                        u.id > 0 ? u.id.toString().padLeft(3, '0') : '—'),
                    _field('Name',
                        u.fullName.isNotEmpty ? u.fullName : '—'),
                  ),
                  const SizedBox(height: 18),
                  _twoCol(
                    _field('Username', u.username),
                    _field('Role', u.roleLabel),
                  ),
                  const SizedBox(height: 18),
                  _statusField(u.isActive),
                  const SizedBox(height: 24),
                  _sectionHeader('Contact Information'),
                  _twoCol(
                    _field('Email', u.email ?? '—'),
                    _field('Contact Number', u.phoneNumber ?? '—'),
                  ),
                  const SizedBox(height: 18),
                  _field('Address', u.address ?? '—'),
                  const SizedBox(height: 24),
                  _sectionHeader('Academic Information'),
                  if (u.isDean && (u.department ?? '').isNotEmpty) ...[
                    _field('Department', u.department!),
                    const SizedBox(height: 18),
                  ],
                  if (coordinatorLabel != null) ...[
                    _field('Assignment', coordinatorLabel),
                    const SizedBox(height: 18),
                  ],
                  _field('Subject-Grade Assignments', subjects),
                  const SizedBox(height: 24),
                  _sectionHeader('Personal Information'),
                  _twoCol(
                    _field('Birthdate', u.birthdate ?? '—'),
                    _field('Date Hired', u.dateOfAppointment ?? '—'),
                  ),
                  const SizedBox(height: 18),
                  _twoCol(
                    _field('TIN', u.tin ?? '—'),
                    _field('GSIS', u.qsis ?? '—'),
                  ),
                  const SizedBox(height: 18),
                  _twoCol(
                    _field('Pag-IBIG', u.hdmf ?? '—'),
                    _field('PhilHealth', u.phic ?? '—'),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 18),
            child: Align(
              alignment: Alignment.centerLeft,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kNavSel,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 28, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  elevation: 0,
                ),
                child: const Text('Close',
                    style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _sectionHeader(String t) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Colors.black87)),
          const SizedBox(height: 8),
          const Divider(
              height: 1, thickness: 1, color: Color(0xFFE5E7EB)),
          const SizedBox(height: 16),
        ],
      );

  Widget _twoCol(Widget l, Widget r) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: l),
          const SizedBox(width: 24),
          Expanded(child: r),
        ],
      );

  Widget _field(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w400,
                  color: Colors.black87)),
        ],
      );

  Widget _statusField(bool isActive) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Status',
              style: TextStyle(
                  fontSize: 12, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 4),
          Text(
            isActive ? 'Active' : 'Inactive',
            style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: isActive
                    ? const Color(0xFF16A34A)
                    : const Color(0xFFDC2626)),
          ),
        ],
      );
}

// ── Add user dialog ───────────────────────────────────────────────────────────

class _AddUserDialog extends StatefulWidget {
  const _AddUserDialog();

  @override
  State<_AddUserDialog> createState() => _AddUserDialogState();
}

class _AddUserDialogState extends State<_AddUserDialog> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _saving = false;

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
      final username = _usernameCtrl.text.trim();
      await PersonnelService.create({
        'email': _emailCtrl.text.trim(),
        'username': username,
        'password': _passwordCtrl.text,
        'first_name': username,
        'last_name': '',
        'role': 'teacher',
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Error: $e'),
                backgroundColor: Colors.red));
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
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
                _label('Email'),
                const SizedBox(height: 6),
                _field(_emailCtrl, hint: 'Email',
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Required' : null),
                const SizedBox(height: 16),
                _label('Username'),
                const SizedBox(height: 6),
                _field(_usernameCtrl, hint: 'Username',
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Required' : null),
                const SizedBox(height: 16),
                _label('Password'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  style: const TextStyle(
                      color: Colors.black87, fontSize: 14),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (v.length < 6) return 'Min. 6 characters';
                    return null;
                  },
                  decoration: _deco('Password').copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(
                          _obscure
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: Colors.grey.shade600),
                      onPressed: () =>
                          setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text('Min. 6 characters',
                    style: TextStyle(
                        fontSize: 11, color: Colors.grey.shade600)),
                const SizedBox(height: 28),
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
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.black87));

  Widget _field(TextEditingController ctrl,
      {required String hint, String? Function(String?)? validator}) {
    return TextFormField(
      controller: ctrl,
      validator: validator,
      style: const TextStyle(color: Colors.black87, fontSize: 14),
      decoration: _deco(hint),
    );
  }

  InputDecoration _deco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle:
            TextStyle(color: Colors.grey.shade500, fontSize: 14),
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide:
                BorderSide(color: Colors.grey.shade500, width: 1.5)),
        errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.red)),
        focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.red)),
      );
}

// ── Edit role & assignment dialog ─────────────────────────────────────────────

class _SubjectRow {
  int? gradeLevelId;
  String? subject;
  _SubjectRow({this.gradeLevelId, this.subject});
  factory _SubjectRow.empty() => _SubjectRow();
}

class _EditRoleDialog extends StatefulWidget {
  final User user;
  const _EditRoleDialog({required this.user});

  @override
  State<_EditRoleDialog> createState() => _EditRoleDialogState();
}

class _EditRoleDialogState extends State<_EditRoleDialog> {
  bool _saving = false;
  late String _selectedRole;
  int? _deanGradeLevelId;
  String? _coordinatorType;
  bool _alsoTeaching = false;
  final _appointmentCtrl = TextEditingController();
  List<Map<String, dynamic>> _gradeLevels = [];
  List<String> _subjects = [];
  List<_SubjectRow> _subjectRows = [];

  static const _roles = [
    'principal', 'coordinator', 'dean', 'registrar', 'teacher'
  ];
  // Coordinator delegation choices, grouped by category. Each category header is
  // a non-selectable label; the specific types under it are the pickable values.
  static const Map<String, List<String>> _coordinatorTypeGroups = {
    'Subject & Curriculum': [
      'Filipino Coordinator',
      'English Coordinator',
      'Araling Panlipunan (Social Studies) Coordinator',
      'Science Coordinator',
      'Mathematics Coordinator',
      'EPP (Edukasyong Pantahanan at Pangkabuhayan) Coordinator',
      'MAPEH (Music, Arts, Physical Education, and Health) Coordinator',
    ],
    'Program & Special Project': [
      'SSES Coordinator',
      'SBFP Coordinator',
      'Brigada Eskwela Coordinator',
      'Disaster Risk Reduction and Management (DRRM) Coordinator',
      'Feeding Program Coordinator',
      'Gulayan sa Paaralan Coordinator',
      'School Health Focal Person',
      'Youth for Environment in Schools Organization (YES-O) Coordinator',
    ],
    'Student & Extracurricular': [
      'Supreme Elementary Learner Government (SELG) Adviser',
      'Girl Scout Coordinator',
      'Twinkler Coordinator',
      'Star Scout Coordinator',
      'Boy Scout Coordinator',
      'KAB Scout Coordinator',
      'Kid Scout Coordinator',
      'School Paper Adviser',
    ],
    'Administrative & Support': [
      'Property Custodian',
      'Library Coordinator',
      'School Testing Coordinator',
      'ICT (Information and Communications Technology) Coordinator',
      'LIS (Learner Info System) Coordinator',
      'School Information Coordinator',
      'School Assessment Coordinator',
      'Gender and Development (GAD) Coordinator',
      'External Partnership Focal Person',
    ],
  };

  // Flat list of all selectable types (used for value validation).
  static final List<String> _coordinatorTypes = [
    for (final list in _coordinatorTypeGroups.values) ...list,
  ];

  @override
  void initState() {
    super.initState();
    _selectedRole = widget.user.role;
    _deanGradeLevelId =
        widget.user.deanGradeLevelId ?? widget.user.gradeLevelId;
    _coordinatorType = widget.user.coordinatorType;
    _alsoTeaching = widget.user.alsoTeaching;
    _appointmentCtrl.text = widget.user.dateOfAppointment ?? '';
    _loadMeta();
  }

  Future<void> _loadMeta() async {
    final results = await Future.wait([
      PersonnelService.gradeLevelsMeta(),
      PersonnelService.subjectsMeta(),
    ]);
    if (!mounted) return;
    final levels = results[0];
    final subjectsList =
        results[1].map((s) => s['subject_name'] as String).toList();
    setState(() {
      _gradeLevels = levels;
      _subjects = subjectsList;
      _subjectRows = widget.user.subjects.map((s) {
        final glId = levels.firstWhere(
          (gl) => gl['grade_level'] == s.gradeLevel,
          orElse: () => {'id': null},
        )['id'] as int?;
        return _SubjectRow(gradeLevelId: glId, subject: s.subject);
      }).toList();
      if (_subjectRows.isEmpty) _subjectRows.add(_SubjectRow.empty());
    });
  }

  @override
  void dispose() {
    _appointmentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await PersonnelService.update(widget.user.id, {
        'role': _selectedRole,
        if (_appointmentCtrl.text.trim().isNotEmpty)
          'date_of_appointment': _appointmentCtrl.text.trim(),
        if (_selectedRole == 'dean' && _deanGradeLevelId != null)
          'dean_grade_level_id': _deanGradeLevelId,
        if (_selectedRole == 'coordinator' && _coordinatorType != null)
          'coordinator_type': _coordinatorType,
        if (_selectedRole == 'dean' ||
            _selectedRole == 'coordinator' ||
            _selectedRole == 'registrar')
          'also_teaching': _alsoTeaching,
      });
      final subjects = _subjectRows
          .where((r) => r.subject != null && r.subject!.isNotEmpty)
          .map((r) =>
              {'grade_level_id': r.gradeLevelId, 'subject': r.subject!})
          .toList();
      await PersonnelService.updateSubjects(widget.user.id, subjects);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560, maxHeight: 680),
        child: Column(children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(24, 20, 16, 20),
            decoration: const BoxDecoration(
              color: _kAddBtn,
              borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16)),
            ),
            child: Row(children: [
              const Icon(Icons.edit_outlined,
                  color: Colors.white, size: 20),
              const SizedBox(width: 10),
              const Text('Edit Role & Assignment',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700)),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close,
                    color: Colors.white, size: 20),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ]),
          ),

          // Body
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionLabel('Role Assignment'),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _roleDropdown()),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _appointmentCtrl,
                          keyboardType: TextInputType.number,
                          inputFormatters: [_DateFormatter()],
                          decoration: _deco('Date of Appointment',
                              hint: 'YYYY-MM-DD'),
                        ),
                      ),
                    ],
                  ),
                  if (_selectedRole == 'dean' &&
                      _gradeLevels.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _gradeLevelDropdown(
                      label: 'Grade Level Handled',
                      value: _deanGradeLevelId,
                      onChanged: (v) =>
                          setState(() => _deanGradeLevelId = v),
                    ),
                  ],
                  if (_selectedRole == 'coordinator') ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue:
                          _coordinatorTypes.contains(_coordinatorType)
                              ? _coordinatorType
                              : null,
                      decoration: _deco('Coordinator Type'),
                      hint: const Text('Select type'),
                      items: [
                        for (final entry in _coordinatorTypeGroups.entries) ...[
                          DropdownMenuItem<String>(
                            enabled: false,
                            value: null,
                            child: Text(entry.key.toUpperCase(),
                                style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF94A3B8),
                                    letterSpacing: 0.5)),
                          ),
                          ...entry.value.map((t) => DropdownMenuItem<String>(
                                value: t,
                                child: Padding(
                                  padding: const EdgeInsets.only(left: 10),
                                  child: Text(t,
                                      style: const TextStyle(fontSize: 14)),
                                ),
                              )),
                        ],
                      ],
                      onChanged: (v) =>
                          setState(() => _coordinatorType = v),
                    ),
                  ],
                  if (_selectedRole == 'dean' ||
                      _selectedRole == 'coordinator' ||
                      _selectedRole == 'registrar') ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.fromLTRB(14, 2, 6, 2),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(children: [
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('Also teaching personnel',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            Text('Adds a Teacher identity to this account, selectable at login.',
                                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                          ],
                        )),
                        Switch(
                          value: _alsoTeaching,
                          onChanged: (v) => setState(() => _alsoTeaching = v),
                        ),
                      ]),
                    ),
                  ],
                  const SizedBox(height: 24),
                  _sectionLabel('Subject-Grade Assignment'),
                  const SizedBox(height: 12),
                  if (_gradeLevels.isEmpty)
                    const Center(
                        child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2)))
                  else
                    ..._subjectRows.asMap().entries.map((entry) {
                      final i = entry.key;
                      final row = entry.value;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(children: [
                          Expanded(
                            flex: 2,
                            child: _gradeLevelDropdown(
                              label: 'Grade Level',
                              value: row.gradeLevelId,
                              onChanged: (v) => setState(() =>
                                  _subjectRows[i] = _SubjectRow(
                                      gradeLevelId: v,
                                      subject: row.subject)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 3,
                            child: DropdownButtonFormField<String>(
                              initialValue:
                                  _subjects.contains(row.subject)
                                      ? row.subject
                                      : null,
                              decoration: _deco('Subject'),
                              hint: const Text('Select subject',
                                  style: TextStyle(fontSize: 13)),
                              isExpanded: true,
                              items: _subjects
                                  .map((s) => DropdownMenuItem(
                                      value: s,
                                      child: Text(s,
                                          style: const TextStyle(
                                              fontSize: 14))))
                                  .toList(),
                              onChanged: (v) => setState(() =>
                                  _subjectRows[i] = _SubjectRow(
                                      gradeLevelId: row.gradeLevelId,
                                      subject: v)),
                            ),
                          ),
                          const SizedBox(width: 4),
                          IconButton(
                            onPressed: _subjectRows.length > 1
                                ? () => setState(
                                    () => _subjectRows.removeAt(i))
                                : null,
                            icon: Icon(Icons.close,
                                size: 18,
                                color: _subjectRows.length > 1
                                    ? Colors.red.shade400
                                    : Colors.grey.shade300),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                                minWidth: 32, minHeight: 32),
                          ),
                        ]),
                      );
                    }),
                  TextButton.icon(
                    onPressed: () => setState(
                        () => _subjectRows.add(_SubjectRow.empty())),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add Subject',
                        style: TextStyle(fontSize: 13)),
                    style: TextButton.styleFrom(
                        foregroundColor: _kLinkBlue,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 6)),
                  ),
                ],
              ),
            ),
          ),

          // Footer
          Container(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
            decoration: BoxDecoration(
                border: Border(
                    top: BorderSide(color: Colors.grey.shade200))),
            child: Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kAddBtn,
                    side: BorderSide(color: Colors.grey.shade400),
                    padding:
                        const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Cancel',
                      style:
                          TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kAddBtn,
                    foregroundColor: Colors.white,
                    padding:
                        const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white))
                      : const Text('Save Changes',
                          style: TextStyle(
                              fontWeight: FontWeight.w600)),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _sectionLabel(String title) => Text(title,
      style: GoogleFonts.plusJakartaSans(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: _kNavSel,
          letterSpacing: 0.4));

  Widget _roleDropdown() => DropdownButtonFormField<String>(
        initialValue: _selectedRole,
        decoration: _deco('Administrative Role'),
        items: _roles
            .map((r) => DropdownMenuItem(
                value: r,
                child: Text(
                    '${r[0].toUpperCase()}${r.substring(1)}',
                    style: const TextStyle(fontSize: 14))))
            .toList(),
        onChanged: (v) => setState(() => _selectedRole = v!),
      );

  Widget _gradeLevelDropdown({
    required String label,
    required int? value,
    required ValueChanged<int?> onChanged,
  }) =>
      DropdownButtonFormField<int>(
        initialValue: value,
        decoration: _deco(label),
        hint: const Text('— None —',
            style: TextStyle(fontSize: 14)),
        items: [
          const DropdownMenuItem(
              value: null,
              child:
                  Text('— None —', style: TextStyle(fontSize: 14))),
          ..._gradeLevels.map((gl) => DropdownMenuItem(
              value: gl['id'] as int,
              child: Text(gl['grade_level'] as String,
                  style: const TextStyle(fontSize: 14)))),
        ],
        onChanged: onChanged,
      );

  InputDecoration _deco(String label, {String? hint}) =>
      InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Colors.grey.shade50,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide:
                BorderSide(color: Colors.grey.shade500, width: 1.5)),
        labelStyle: GoogleFonts.plusJakartaSans(
            fontSize: 13, color: Colors.grey.shade600),
      );
}

// ── Date auto-formatter ───────────────────────────────────────────────────────

class _DateFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue old, TextEditingValue next) {
    final digits = next.text.replaceAll(RegExp(r'[^0-9]'), '');
    final buf = StringBuffer();
    for (int i = 0; i < digits.length && i < 8; i++) {
      if (i == 4 || i == 6) buf.write('-');
      buf.write(digits[i]);
    }
    final out = buf.toString();
    return next.copyWith(
      text: out,
      selection: TextSelection.collapsed(offset: out.length),
    );
  }
}
