part of 'task_detail_screen.dart';

class _AssignSection extends StatefulWidget {
  final int taskId;
  final List<User> assignedUsers;
  final VoidCallback onAssigned;

  const _AssignSection({
    required this.taskId,
    required this.assignedUsers,
    required this.onAssigned,
  });

  @override
  State<_AssignSection> createState() => _AssignSectionState();
}

class _AssignSectionState extends State<_AssignSection> {
  void _openAssignDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _AssignDialog(
        taskId: widget.taskId,
        alreadyAssigned: widget.assignedUsers,
      ),
    );
    if (result == true) widget.onAssigned();
  }

  Future<void> _unassign(int userId) async {
    try {
      await ApiService.unassignTask(widget.taskId, userId);
      widget.onAssigned();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppTheme.redColor,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Assigned To', style: AppTheme.heading3),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _openAssignDialog,
                icon: const Icon(Icons.person_add_outlined, size: 16),
                label: const Text('Assign'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.accentBlue,
                  side: const BorderSide(color: AppTheme.accentBlue),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  visualDensity: VisualDensity.compact,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          if (widget.assignedUsers.isEmpty) ...[
            const SizedBox(height: 8),
            Text('No one assigned yet', style: AppTheme.bodyMd),
          ] else ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: widget.assignedUsers.map((u) => _UserChip(
                user: u,
                onRemove: () => _unassign(u.id),
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _UserChip extends StatelessWidget {
  final User user;
  final VoidCallback? onRemove;
  const _UserChip({required this.user, this.onRemove});

  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.only(left: 8, right: onRemove != null ? 4 : 8, top: 5, bottom: 5),
        decoration: BoxDecoration(
          color: AppTheme.blueBg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 10,
              backgroundColor: AppTheme.sidebarActive,
              child: Text(user.initials,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 6),
            Text(user.fullName,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.accentBlue)),
            if (onRemove != null) ...[
              const SizedBox(width: 4),
              GestureDetector(
                onTap: onRemove,
                child: const Icon(Icons.close_rounded, size: 14, color: AppTheme.accentBlue),
              ),
            ],
          ],
        ),
      );
}

// ── Assign Dialog ──────────────────────────────────────────────────────────────

class _AssignDialog extends StatefulWidget {
  final int taskId;
  final List<User> alreadyAssigned;

  const _AssignDialog({required this.taskId, required this.alreadyAssigned});

  @override
  State<_AssignDialog> createState() => _AssignDialogState();
}

class _AssignDialogState extends State<_AssignDialog> {
  List<User> _available = [];
  final Set<int> _selected = {};
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    try {
      final users = await ApiService.getAssignableUsers();
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

  Future<void> _confirm() async {
    if (_selected.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await ApiService.assignTask(widget.taskId, _selected.toList());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppTheme.redColor,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 400,
        constraints: const BoxConstraints(maxHeight: 520),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Text('Assign Users', style: AppTheme.heading2),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, color: AppTheme.textMuted),
              ),
            ]),
            const SizedBox(height: 4),
            Text('Select personnel to assign this task to',
                style: AppTheme.bodySm),
            const SizedBox(height: 16),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.accentBlue))
                  : _error != null
                      ? Center(child: Text(_error!, style: AppTheme.bodyMd))
                      : _available.isEmpty
                          ? Center(
                              child: Text('No available personnel to assign',
                                  style: AppTheme.bodyMd))
                          : ListView.builder(
                              itemCount: _available.length,
                              itemBuilder: (_, i) {
                                final u = _available[i];
                                final checked = _selected.contains(u.id);
                                return CheckboxListTile(
                                  value: checked,
                                  onChanged: (_) => setState(() {
                                    if (checked) {
                                      _selected.remove(u.id);
                                    } else {
                                      _selected.add(u.id);
                                    }
                                  }),
                                  title: Text(u.fullName, style: AppTheme.labelMd),
                                  subtitle: Text(
                                    '${u.roleLabel}${u.gradeLevel != null ? ' · ${u.gradeLevel}' : ''}',
                                    style: AppTheme.bodySm,
                                  ),
                                  secondary: CircleAvatar(
                                    radius: 16,
                                    backgroundColor: AppTheme.sidebarActive,
                                    child: Text(u.initials,
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700)),
                                  ),
                                  activeColor: AppTheme.accentBlue,
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                );
                              },
                            ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel', style: AppTheme.labelMd),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  onPressed: (_selected.isEmpty || _submitting) ? null : _confirm,
                  child: _submitting
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text('Assign ${_selected.isEmpty ? '' : '(${_selected.length})'}'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Report submission form ────────────────────────────────────────────────────
