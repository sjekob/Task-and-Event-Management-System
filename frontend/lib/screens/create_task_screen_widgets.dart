part of 'create_task_screen.dart';

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
      style: GoogleFonts.plusJakartaSans(
          fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary));
}

/// A titled white card grouping related fields.
class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final List<Widget> children;
  const _SectionCard({required this.icon, required this.title, required this.children});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE3E9F3)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 30, height: 30,
              decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FA), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, size: 16, color: AppTheme.darkBanner),
            ),
            const SizedBox(width: 10),
            Text(title,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          ]),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppTheme.borderColor),
          const SizedBox(height: 16),
          ...children,
        ]),
      );
}

/// Labeled button for adding an attachment.
class _AttachButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _AttachButton(this.icon, this.label, this.onTap);

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 16),
        label: Text(label,
            style: GoogleFonts.plusJakartaSans(fontSize: 12.5, fontWeight: FontWeight.w600)),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppTheme.textPrimary,
          side: const BorderSide(color: AppTheme.borderColor),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
}

/// A tappable field showing a picked date/time (or a prompt when empty).
class _PickerField extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;
  const _PickerField(
      {required this.icon, required this.label, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppTheme.borderColor),
          ),
          child: Row(children: [
            Icon(icon, size: 18, color: value == null ? AppTheme.textLight : AppTheme.accentBlue),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 11, color: AppTheme.textLight, fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Text(value ?? 'Not set',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13.5, fontWeight: FontWeight.w600,
                        color: value == null ? AppTheme.textMuted : AppTheme.textPrimary)),
              ]),
            ),
            const Icon(Icons.chevron_right, size: 18, color: AppTheme.textLight),
          ]),
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
