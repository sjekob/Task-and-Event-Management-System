part of 'create_task_screen.dart';

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: GoogleFonts.plusJakartaSans(
          fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary));
}

class _AttIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _AttIcon(this.icon, this.color, this.onTap);

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            color: AppTheme.darkBanner,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 18, color: Colors.white),
        ),
      );
}

// ── Attachment dialog ──────────────────────────────────────────────────────────

class _AttachmentDialog extends StatefulWidget {
  final String type;
  const _AttachmentDialog({required this.type});
  @override
  State<_AttachmentDialog> createState() => _AttachmentDialogState();
}

class _AttachmentDialogState extends State<_AttachmentDialog> {
  final _urlCtrl = TextEditingController(text: 'https://');
  final _nameCtrl = TextEditingController();
  String? _urlError;

  @override
  void dispose() { _urlCtrl.dispose(); _nameCtrl.dispose(); super.dispose(); }

  String get _title => switch (widget.type) {
    'link' => 'Add Link', 'gdrive' => 'Add Google Drive Link',
    'youtube' => 'Add YouTube Video', _ => 'Add File URL',
  };

  String get _urlHint => switch (widget.type) {
    'gdrive' => 'https://drive.google.com/...', 'youtube' => 'https://youtube.com/...',
    _ => 'https://...',
  };

  bool _validate() {
    final url = _urlCtrl.text.trim();
    if (url.isEmpty || url == 'https://') { setState(() => _urlError = 'URL is required'); return false; }
    if (!url.startsWith('http')) { setState(() => _urlError = 'Must start with http://'); return false; }
    setState(() => _urlError = null);
    return true;
  }

  void _confirm() {
    if (!_validate()) return;
    final url = _urlCtrl.text.trim();
    final name = _nameCtrl.text.trim().isEmpty ? _defaultName(url) : _nameCtrl.text.trim();
    Navigator.pop(context, {'attachment_type': widget.type, 'name': name, 'url': url});
  }

  String _defaultName(String url) => switch (widget.type) {
    'youtube' => 'YouTube Video', 'gdrive' => 'Google Drive File',
    'file' => 'Attached File', _ => Uri.tryParse(url)?.host.replaceFirst('www.', '') ?? 'Link',
  };

  @override
  Widget build(BuildContext context) => Dialog(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(_title, style: AppTheme.heading3),
          const Spacer(),
          IconButton(onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
              padding: EdgeInsets.zero, constraints: const BoxConstraints()),
        ]),
        const SizedBox(height: 16),
        Text('URL', style: AppTheme.labelSm),
        const SizedBox(height: 6),
        TextField(controller: _urlCtrl, autofocus: true,
            style: GoogleFonts.plusJakartaSans(fontSize: 14),
            decoration: InputDecoration(hintText: _urlHint, hintStyle: AppTheme.bodyMd, errorText: _urlError,
                filled: true, fillColor: AppTheme.bgColor,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5)))),
        const SizedBox(height: 12),
        Text('Name (optional)', style: AppTheme.labelSm),
        const SizedBox(height: 6),
        TextField(controller: _nameCtrl, style: GoogleFonts.plusJakartaSans(fontSize: 14),
            decoration: InputDecoration(hintText: 'Label for this attachment', hintStyle: AppTheme.bodyMd,
                filled: true, fillColor: AppTheme.bgColor,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.borderColor)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5)))),
        const SizedBox(height: 20),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          OutlinedButton(onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: AppTheme.borderColor),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: Text('Cancel', style: AppTheme.labelMd)),
          const SizedBox(width: 10),
          ElevatedButton(onPressed: _confirm,
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.darkBanner,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              child: const Text('Add')),
        ]),
      ]),
    ),
  );
}

// ── Template picker dialog ─────────────────────────────────────────────────────

class _TemplatePickerDialog extends StatefulWidget {
  const _TemplatePickerDialog();
  @override
  State<_TemplatePickerDialog> createState() => _TemplatePickerDialogState();
}

class _TemplatePickerDialogState extends State<_TemplatePickerDialog> {
  List<TaskTemplate> _templates = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final t = await ApiService.getTemplates();
      if (mounted) setState(() { _templates = t; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Dialog(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    child: SizedBox(
      width: 420,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 12, 8),
            child: Row(children: [
              const Icon(Icons.library_books_outlined,
                  size: 20, color: AppTheme.accentBlue),
              const SizedBox(width: 10),
              Expanded(child: Text('Use a Template', style: AppTheme.heading3)),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, size: 20, color: AppTheme.textMuted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppTheme.borderColor),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: CircularProgressIndicator(color: AppTheme.accentBlue),
            )
          else if (_templates.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Text('No templates yet.', style: AppTheme.bodyMd),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 380),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _templates.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, color: AppTheme.borderColor),
                itemBuilder: (_, i) {
                  final t = _templates[i];
                  return InkWell(
                    onTap: () => Navigator.pop(context, t),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 14),
                      child: Row(children: [
                        Container(
                          width: 38, height: 38,
                          decoration: BoxDecoration(
                            color: AppTheme.blueBg,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.description_outlined,
                              size: 18, color: AppTheme.accentBlue),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(t.title, style: AppTheme.labelMd),
                              if (t.instructions != null &&
                                  t.instructions!.isNotEmpty)
                                Text(
                                  t.instructions!.replaceAll('\n', ' '),
                                  style: AppTheme.bodySm,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              if (t.createdByName != null)
                                Text('By ${t.createdByName}',
                                    style: AppTheme.captionSm),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios,
                            size: 14, color: AppTheme.textMuted),
                      ]),
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

// ── Assign picker sheet ────────────────────────────────────────────────────────

class _AssignPickerSheet extends StatefulWidget {
  final List<User> users;
  final Set<int> selected;
  final ValueChanged<Set<int>> onChanged;
  const _AssignPickerSheet({required this.users, required this.selected, required this.onChanged});
  @override
  State<_AssignPickerSheet> createState() => _AssignPickerSheetState();
}

class _AssignPickerSheetState extends State<_AssignPickerSheet> {
  late Set<int> _local;
  String _search = '';

  @override
  void initState() { super.initState(); _local = Set.from(widget.selected); }

  List<User> get _filtered => _search.isEmpty
      ? widget.users
      : widget.users.where((u) => u.fullName.toLowerCase().contains(_search.toLowerCase())).toList();

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final w = size.width < 520 ? size.width - 48 : 460.0;
    final h = (size.height * 0.7).clamp(360.0, 600.0);
    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: SizedBox(
        width: w,
        height: h,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Row(children: [
              Text('Select Personnel', style: AppTheme.heading3),
              const Spacer(),
              TextButton(
                onPressed: () { widget.onChanged(_local); Navigator.pop(context); },
                child: Text('Done (${_local.length})',
                    style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600,
                        color: AppTheme.accentBlue, fontSize: 14)),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              decoration: InputDecoration(hintText: 'Search by name...', hintStyle: AppTheme.bodyMd,
                  prefixIcon: const Icon(Icons.search, size: 18, color: AppTheme.textMuted),
                  filled: true, fillColor: AppTheme.bgColor,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderColor),
          Expanded(
            child: _filtered.isEmpty
                ? Center(child: Text('No personnel found', style: AppTheme.bodyMd))
                : ListView.builder(
                    itemCount: _filtered.length,
                    itemBuilder: (_, i) {
                      final u = _filtered[i];
                      final checked = _local.contains(u.id);
                      return CheckboxListTile(
                        value: checked,
                        onChanged: (_) => setState(() => checked ? _local.remove(u.id) : _local.add(u.id)),
                        title: Text(u.fullName, style: AppTheme.labelMd),
                        subtitle: Text('${u.roleLabel}${u.gradeLevel != null ? ' · ${u.gradeLevel}' : ''}',
                            style: AppTheme.bodySm),
                        secondary: CircleAvatar(radius: 18, backgroundColor: AppTheme.sidebarActive,
                            child: Text(u.initials, style: const TextStyle(color: Colors.white,
                                fontSize: 13, fontWeight: FontWeight.w700))),
                        activeColor: AppTheme.accentBlue,
                        controlAffinity: ListTileControlAffinity.trailing,
                      );
                    }),
          ),
        ]),
      ),
    );
  }
}
