part of 'task_detail_screen.dart';

/// Everyone assigned to the task with their submission status. Picking someone
/// who has a report opens it in the review panel; assigners can add/remove.
class _AssigneesCard extends StatefulWidget {
  final int taskId;
  final List<User> assignedUsers;
  final String title;
  /// Everyone on the task (the list above may show only the viewer's team);
  /// the Assign dialog leaves all of them out.
  final List<User> allAssigned;
  final bool canEdit;
  final (String, Color, Color) Function(User) statusFor;
  final bool Function(User) hasReport;
  final int? selectedUserId;
  final ValueChanged<User> onSelect;
  final VoidCallback onChanged;
  final Task? task;

  const _AssigneesCard({
    required this.taskId,
    required this.assignedUsers,
    this.title = 'Assigned personnel',
    this.allAssigned = const [],
    required this.canEdit,
    required this.statusFor,
    required this.hasReport,
    required this.selectedUserId,
    required this.onSelect,
    required this.onChanged,
    this.task,
  });

  @override
  State<_AssigneesCard> createState() => _AssigneesCardState();
}

class _AssigneesCardState extends State<_AssigneesCard> {
  void _openAssignDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _AssignDialog(
        taskId: widget.taskId,
        alreadyAssigned: widget.allAssigned.isEmpty ? widget.assignedUsers : widget.allAssigned,
        task: widget.task,
      ),
    );
    if (result == true) widget.onChanged();
  }

  Future<void> _unassign(User u) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Remove ${u.fullName}?'),
        content: const Text('They will no longer see this task. Anything they already '
            'submitted stays on record.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep assigned')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.redColor),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Remove ${u.fullName.split(' ').first}'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.unassignTask(widget.taskId, u.id);
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: AppTheme.redColor,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final users = widget.assignedUsers;
    return _DetailCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text(widget.title, style: GoogleFonts.plusJakartaSans(
              fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          const SizedBox(width: 8),
          _Pill('${users.length}', fg: AppTheme.textMuted, bg: const Color(0xFFF1F5F9)),
          const Spacer(),
          if (widget.canEdit)
            FilledButton.icon(
              onPressed: _openAssignDialog,
              icon: const Icon(Icons.person_add_alt_1_outlined, size: 16),
              label: const Text('Assign'),
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.darkBanner,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
        ]),
        const SizedBox(height: 12),
        if (users.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text('No one is assigned yet.', style: AppTheme.bodyMd),
          )
        else
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: Column(children: [
              for (var i = 0; i < users.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: Color(0xFFF0F2F6)),
                _row(users[i], first: i == 0, last: i == users.length - 1),
              ],
            ]),
          ),
      ]),
    );
  }

  Widget _row(User u, {required bool first, required bool last}) {
    final (label, fg, bg) = widget.statusFor(u);
    final selectable = widget.hasReport(u);
    final selected = widget.selectedUserId == u.id;
    final role = u.roleLabel;
    final sub = [role, if (u.gradeLevel != null) u.gradeLevel!].join(' · ');
    return Material(
      color: selected ? const Color(0xFFEFF6FF) : Colors.transparent,
      borderRadius: BorderRadius.vertical(
        top: first ? const Radius.circular(10) : Radius.zero,
        bottom: last ? const Radius.circular(10) : Radius.zero,
      ),
      child: InkWell(
        onTap: selectable ? () => widget.onSelect(u) : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: AppTheme.sidebarActive,
              child: Text(u.initials, style: const TextStyle(
                  color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(u.fullName, overflow: TextOverflow.ellipsis, style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
              Text(sub, style: AppTheme.caption),
            ])),
            _Pill(label, fg: fg, bg: bg),
            if (selectable) ...[
              const SizedBox(width: 4),
              Tooltip(
                message: 'View ${u.fullName.split(' ').first}\'s report',
                child: Icon(Icons.chevron_right_rounded,
                    color: selected ? AppTheme.accentBlue : AppTheme.textLight),
              ),
            ],
            if (widget.canEdit)
              IconButton(
                tooltip: 'Remove ${u.fullName}',
                onPressed: () => _unassign(u),
                icon: const Icon(Icons.person_remove_outlined, size: 18, color: AppTheme.textMuted),
                visualDensity: VisualDensity.compact,
              ),
          ]),
        ),
      ),
    );
  }
}

// ── Assign Dialog ──────────────────────────────────────────────────────────────

class _AssignDialog extends StatefulWidget {
  final int taskId;
  final List<User> alreadyAssigned;
  /// The task being assigned, for skill/workload suggestions.
  final Task? task;

  const _AssignDialog({required this.taskId, required this.alreadyAssigned, this.task});

  @override
  State<_AssignDialog> createState() => _AssignDialogState();
}

class _AssignDialogState extends State<_AssignDialog> {
  List<User> _available = [];
  final Set<int> _selected = {};
  bool _loading = true;
  String? _error;
  late final List<String> _roleOptions;
  late String _targetRole;

  @override
  void initState() {
    super.initState();
    _roleOptions = context.read<AppState>().assignableRoles;
    _targetRole = _roleOptions.isEmpty ? 'teacher' : _roleOptions.first;
    _loadUsers();
  }

  void _setRole(String r) {
    if (r == _targetRole) return;
    setState(() { _targetRole = r; _selected.clear(); _loading = true; });
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    try {
      final users = await ApiService.getAssignableUsers(targetRole: _targetRole);
      final assignedIds = widget.alreadyAssigned.map((u) => u.id).toSet();
      if (mounted) {
        setState(() {
          _available = users.where((u) => !assignedIds.contains(u.id)).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }


  @override
  Widget build(BuildContext context) {
    final roleSelector = _roleOptions.length > 1
        ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Assign as', style: AppTheme.labelSm),
            const SizedBox(height: 6),
            AssignRoleSelector(options: _roleOptions, value: _targetRole, onChanged: _setRole),
          ])
        : null;
    if (_loading || _error != null || _available.isEmpty) {
      return Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: SizedBox(
          width: 520,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text('Assign Users', style: AppTheme.heading3),
                const Spacer(),
                IconButton(onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: AppTheme.textMuted)),
              ]),
              if (roleSelector != null) ...[const SizedBox(height: 8), roleSelector],
              const SizedBox(height: 24),
              Center(
                child: _loading
                    ? const CircularProgressIndicator(color: AppTheme.accentBlue)
                    : Text(_error ?? 'Everyone with this role is already assigned.',
                        style: AppTheme.bodyMd),
              ),
              const SizedBox(height: 24),
            ]),
          ),
        ),
      );
    }
    final t = widget.task;
    return AssignPickerDialog(
      // A new role reloads the people, so start the picker afresh.
      key: ValueKey(_targetRole),
      title: 'Assign Users',
      header: roleSelector,
      users: _available,
      selected: const {},
      onChanged: (_) {},
      hasTaskText: t != null &&
          [t.title, t.subject, t.instructions].any((v) => (v ?? '').trim().isNotEmpty),
      loadSuggestions: t == null
          ? null
          : () => ApiService.getAssigneeSuggestions(
                targetRole: _targetRole,
                title: t.title,
                subject: t.subject ?? '',
                instructions: t.instructions ?? '',
                taskCategory: t.taskCategory,
                startDate: t.startDate,
                endDate: t.endDate,
                dueTime: t.dueTime,
              ),
      onConfirm: (ids) =>
          ApiService.assignTask(widget.taskId, ids.toList(), targetRole: _targetRole),
    );
  }
}

// ── Report submission form ────────────────────────────────────────────────────
