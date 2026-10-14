import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/web_downloader.dart';

/// How credible a held certification is, as a small colored badge:
/// verified by the principal/registrar, uploaded and awaiting review (shaded by
/// how well the file passed the automated checks), rejected, or not yet
/// confirmed by its owner. The same wording is used in task suggestions.
class CredibilityBadge extends StatelessWidget {
  final String credibility;
  final String? authenticity;
  final bool compact;
  const CredibilityBadge(
      {super.key, required this.credibility, this.authenticity, this.compact = false});

  static ({String label, String hint, IconData icon, Color fg, Color bg}) describe(
      String credibility, String? authenticity) {
    switch (credibility) {
      case 'verified':
        return (label: 'Verified', hint: 'Certificate checked and verified by the principal/registrar',
            icon: Icons.verified, fg: const Color(0xFF15803D), bg: AppTheme.greenBg);
      case 'submitted':
        final strength = switch (authenticity) {
          'high' => 'passed the automated checks',
          'medium' => 'passed some automated checks',
          _ => 'failed some automated checks',
        };
        final low = authenticity != 'high' && authenticity != 'medium';
        return (label: low ? 'Pending · doubtful' : 'Pending review',
            hint: 'Certificate uploaded and $strength; not yet verified',
            icon: low ? Icons.report_gmailerrorred : Icons.hourglass_top,
            fg: low ? const Color(0xFFB45309) : AppTheme.accentBlue,
            bg: low ? AppTheme.amberBg : AppTheme.blueBg);
      case 'rejected':
        return (label: 'Rejected', hint: 'The certificate was rejected on review',
            icon: Icons.block, fg: AppTheme.redColor, bg: AppTheme.redBg);
      default: // pending
        return (label: 'Not added yet', hint: 'Uploaded but not yet confirmed by its owner',
            icon: Icons.more_horiz, fg: AppTheme.textMuted, bg: const Color(0xFFF3F4F6));
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = describe(credibility, authenticity);
    return Tooltip(
      message: d.hint,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: compact ? 5 : 8, vertical: compact ? 1 : 3),
        decoration: BoxDecoration(color: d.bg, borderRadius: BorderRadius.circular(6)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(d.icon, size: compact ? 11 : 13, color: d.fg),
          const SizedBox(width: 3),
          Text(d.label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: compact ? 10.5 : 11.5, fontWeight: FontWeight.w700, color: d.fg)),
        ]),
      ),
    );
  }
}

/// A person's certifications with their credibility. The owner uploads
/// certificates here ([canUpload]); the principal/registrar verifies or
/// rejects them ([canReview]). [userId] null means the signed-in person.
class CertificatesPanel extends StatefulWidget {
  final int? userId;
  final bool canUpload;
  final bool canReview;
  final VoidCallback? onChanged;
  const CertificatesPanel(
      {super.key, this.userId, this.canUpload = false, this.canReview = false, this.onChanged});

  @override
  State<CertificatesPanel> createState() => _CertificatesPanelState();
}

class _CertificatesPanelState extends State<CertificatesPanel> {
  CertificateSet? _set;
  String? _error;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final s = await ApiService.getCertificates(userId: widget.userId);
      if (mounted) setState(() { _set = s; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    }
  }

  void _changed() {
    _load();
    widget.onChanged?.call();
  }

  void _toast(String text, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(text),
      backgroundColor: error ? AppTheme.redColor : null,
    ));
  }

  Future<void> _upload() async {
    final picked = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
    );
    final file = picked?.files.firstOrNull;
    if (file == null || file.bytes == null) return;
    if (file.size > 10 * 1024 * 1024) {
      _toast('The file is larger than 10 MB.', error: true);
      return;
    }
    setState(() => _uploading = true);
    try {
      final result = await ApiService.analyzeCertificate(file.bytes!, file.name);
      if (!mounted) return;
      await _showResult(result);
    } catch (e) {
      if (mounted) _toast(_msg(e), error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
      _changed();
    }
  }

  Future<void> _showResult(CertificateFile cert) async {
    final added = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => CertificateResultDialog(certificate: cert),
    );
    if (added == true && mounted) {
      _toast('Certificate added. The principal or registrar will verify it.');
    }
  }

  Future<void> _remove(CertificateFile c) async {
    final ok = await _confirm('Remove certificate?',
        'Remove "${c.title ?? c.originalName ?? 'this certificate'}" from your profile?', 'Remove');
    if (!ok) return;
    try {
      await ApiService.deleteCertificate(c.id!);
      _changed();
    } catch (e) {
      _toast(_msg(e), error: true);
    }
  }

  Future<void> _review(CertificateFile c) async {
    final updated = await showDialog<bool>(
      context: context,
      builder: (_) => CertificateDetailDialog(certificate: c, canReview: widget.canReview),
    );
    if (updated == true) _changed();
  }

  Future<bool> _confirm(String title, String body, String action) async =>
      await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title, style: AppTheme.heading3),
          content: Text(body, style: AppTheme.bodyMd),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: TextButton.styleFrom(foregroundColor: AppTheme.redColor),
              child: Text(action),
            ),
          ],
        ),
      ) ??
      false;

  @override
  Widget build(BuildContext context) {
    final s = _set;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(
          child: Text(
            widget.canUpload
                ? 'Upload a PDF or photo of each certificate. It is read and checked automatically, '
                    'then verified by the principal or registrar. Verified certificates count most '
                    'when you are suggested for tasks.'
                : 'Certificates count toward task suggestions by how credible they are.',
            style: AppTheme.bodySm,
          ),
        ),
        if (widget.canUpload) ...[
          const SizedBox(width: 12),
          ElevatedButton.icon(
            onPressed: _uploading ? null : _upload,
            icon: _uploading
                ? const SizedBox(width: 14, height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.upload_file, size: 16),
            label: Text(_uploading ? 'Reading…' : 'Upload certificate'),
          ),
        ],
      ]),
      const SizedBox(height: 12),
      if (_error != null)
        Text(_error!, style: AppTheme.bodySm.copyWith(color: AppTheme.redColor))
      else if (s == null)
        const Padding(
          padding: EdgeInsets.all(12),
          child: Center(child: SizedBox(width: 20, height: 20,
              child: CircularProgressIndicator(strokeWidth: 2))),
        )
      else if (s.isEmpty)
        _empty()
      else ...[
        if (widget.canUpload)
          for (final p in s.pending) _CertificateTile(
            cert: p,
            onOpen: () => _showResult(p).then((_) => _changed()),
            actionLabel: 'Finish adding',
            onRemove: () => _remove(p),
          ),
        for (final c in s.certificates) _CertificateTile(
          cert: c,
          onOpen: () => _review(c),
          actionLabel: widget.canReview && c.status == 'submitted' ? 'Review' : 'Details',
          onRemove: widget.canUpload ? () => _remove(c) : null,
        ),
      ],
    ]);
  }

  Widget _empty() => Container(
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 14),
        decoration: BoxDecoration(
          color: AppTheme.bgColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Row(children: [
          const Icon(Icons.workspace_premium_outlined, color: AppTheme.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.canUpload
                  ? 'No certificates yet. Upload one to be suggested for matching tasks.'
                  : 'No certificates on file.',
              style: AppTheme.bodyMd,
            ),
          ),
        ]),
      );
}

class _CertificateTile extends StatelessWidget {
  final CertificateFile cert;
  final VoidCallback? onOpen;
  final String? actionLabel;
  final VoidCallback? onRemove;
  const _CertificateTile({required this.cert, this.onOpen, this.actionLabel, this.onRemove});

  @override
  Widget build(BuildContext context) {
    final c = cert;
    final sub = [c.issuerLabel, c.category].whereType<String>().join(' · ');
    final narrow = MediaQuery.of(context).size.width < 600;
    final actions = Row(mainAxisSize: MainAxisSize.min, children: [
      if (onOpen != null && actionLabel != null)
        TextButton(onPressed: onOpen, child: Text(actionLabel!)),
      if (onRemove != null)
        IconButton(
          tooltip: 'Remove',
          onPressed: onRemove,
          icon: const Icon(Icons.delete_outline, size: 18, color: AppTheme.textMuted),
        ),
    ]);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
                color: const Color(0xFFEEF2FA), borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.description_outlined,
                size: 18, color: AppTheme.darkBanner),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Text(c.title ?? c.detectedTitle ?? c.originalName ?? 'Unidentified certificate',
                    style: AppTheme.labelMd),
                CredibilityBadge(credibility: c.status, authenticity: c.authenticity),
              ]),
              if (sub.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(sub, style: AppTheme.bodySm),
              ],
              if (c.description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(c.description, style: AppTheme.caption),
              ],
              if (c.status == 'rejected' && c.reviewNote != null) ...[
                const SizedBox(height: 4),
                Text('Reason: ${c.reviewNote}',
                    style: AppTheme.caption.copyWith(color: AppTheme.redColor)),
              ],
            ]),
          ),
          if (!narrow) actions,
        ]),
        if (narrow) Align(alignment: Alignment.centerRight, child: actions),
      ]),
    );
  }
}

/// The analysis of a freshly uploaded certificate: what it is, who issued it,
/// the automated authenticity checks, and a list to correct what it was read
/// as. "Add to my profile" confirms it; "Discard" deletes the upload.
/// Pops true when added.
class CertificateResultDialog extends StatefulWidget {
  final CertificateFile certificate;
  const CertificateResultDialog({super.key, required this.certificate});

  @override
  State<CertificateResultDialog> createState() => _CertificateResultDialogState();
}

class _CertificateResultDialogState extends State<CertificateResultDialog> {
  List<CertificationCatalogItem> _catalog = [];
  int? _selectedId;
  bool _busy = false;
  String? _error;

  CertificateFile get c => widget.certificate;
  bool get _duplicate => c.checks.any((k) => k.key == 'duplicate' && k.status == 'fail');

  @override
  void initState() {
    super.initState();
    _selectedId = c.certificationId;
    ApiService.getCertificationCatalog().then((list) {
      if (mounted) setState(() => _catalog = list);
    }).catchError((_) {});
  }

  CertificationCatalogItem? get _selected =>
      _catalog.where((x) => x.id == _selectedId).firstOrNull;

  Future<void> _add() async {
    if (_selectedId == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      await ApiService.confirmCertificate(c.id!, _selectedId!);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = _msg(e); });
    }
  }

  Future<void> _discard() async {
    setState(() => _busy = true);
    try {
      await ApiService.deleteCertificate(c.id!);
    } catch (_) {}
    if (mounted) Navigator.pop(context, false);
  }

  @override
  Widget build(BuildContext context) {
    final sel = _selected;
    final title = sel?.name ?? c.title;
    final issuer = sel?.issuer ?? c.issuerLabel;
    final category = sel?.category ?? c.category;
    final description = sel != null ? sel.description : c.description;
    return _DialogFrame(
      title: 'Certificate read',
      subtitle: c.originalName,
      body: [
        _AuthenticityBanner(authenticity: c.authenticity, duplicate: _duplicate),
        const SizedBox(height: 16),
        _Fact(label: 'Title', value: title ?? 'Not identified — choose it below'),
        _Fact(label: 'Issued by', value: issuer ?? 'Issuer not recognized'),
        _Fact(label: 'What it is', value: description.isNotEmpty ? description : '—'),
        if (category != null) _Fact(label: 'Category', value: category),
        const SizedBox(height: 8),
        DropdownButtonFormField<int>(
          key: ValueKey('cert-${_catalog.length}'),
          isExpanded: true,
          initialValue: _catalog.any((x) => x.id == _selectedId) ? _selectedId : null,
          decoration: _inputDecoration(
              c.certificationId == null ? 'Which certification is this?' : 'Not right? Change it'),
          style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textPrimary),
          items: [
            for (final x in _catalog)
              DropdownMenuItem(
                value: x.id,
                child: Text(x.issuer != null ? '${x.name} · ${x.issuer}' : x.name,
                    overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: _busy ? null : (v) => setState(() => _selectedId = v),
        ),
        const SizedBox(height: 18),
        Text('Authenticity checks', style: AppTheme.labelMd),
        const SizedBox(height: 8),
        for (final k in c.checks) _CheckRow(check: k),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: AppTheme.bodySm.copyWith(color: AppTheme.redColor)),
        ],
      ],
      actions: [
        TextButton(
          onPressed: _busy ? null : _discard,
          style: TextButton.styleFrom(foregroundColor: AppTheme.redColor),
          child: const Text('Discard'),
        ),
        const SizedBox(width: 8),
        ElevatedButton(
          onPressed: _busy || _duplicate || _selectedId == null ? null : _add,
          child: _busy
              ? const SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Add to my profile'),
        ),
      ],
    );
  }
}

/// A certificate on someone's profile: what it is, its checks, the file, and —
/// for the principal/registrar — Verify / Reject. Pops true when reviewed.
class CertificateDetailDialog extends StatefulWidget {
  final CertificateFile certificate;
  final bool canReview;
  const CertificateDetailDialog({super.key, required this.certificate, this.canReview = false});

  @override
  State<CertificateDetailDialog> createState() => _CertificateDetailDialogState();
}

class _CertificateDetailDialogState extends State<CertificateDetailDialog> {
  final _note = TextEditingController();
  bool _busy = false;
  bool _opening = false;
  String? _error;

  CertificateFile get c => widget.certificate;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _openFile() async {
    setState(() => _opening = true);
    try {
      final bytes = await ApiService.getCertificateBytes(c.id!);
      webOpenBytes(bytes, c.mime ?? 'application/octet-stream');
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e));
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  Future<void> _decide(String status) async {
    if (status == 'rejected' && _note.text.trim().isEmpty) {
      setState(() => _error = 'Give a reason so the owner knows what to fix.');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await ApiService.reviewCertificate(c.id!, status, note: _note.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = _msg(e); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final reviewed = c.status == 'verified' || c.status == 'rejected';
    return _DialogFrame(
      title: c.title ?? 'Certificate',
      subtitle: c.originalName,
      trailing: CredibilityBadge(credibility: c.status, authenticity: c.authenticity),
      body: [
        _AuthenticityBanner(authenticity: c.authenticity,
            duplicate: c.checks.any((k) => k.key == 'duplicate' && k.status == 'fail')),
        const SizedBox(height: 16),
        _Fact(label: 'Issued by', value: c.issuerLabel ?? 'Issuer not recognized'),
        _Fact(label: 'What it is', value: c.description.isNotEmpty ? c.description : '—'),
        if (c.category != null) _Fact(label: 'Category', value: c.category!),
        if (reviewed)
          _Fact(
            label: c.status == 'verified' ? 'Verified by' : 'Rejected by',
            value: [c.reviewedByName ?? '—', if (c.reviewNote != null) '“${c.reviewNote}”']
                .join(' — '),
          ),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            onPressed: _opening ? null : _openFile,
            icon: const Icon(Icons.open_in_new, size: 16),
            label: Text(_opening ? 'Opening…' : 'View certificate file'),
          ),
        ),
        const SizedBox(height: 18),
        Text('Authenticity checks', style: AppTheme.labelMd),
        const SizedBox(height: 8),
        for (final k in c.checks) _CheckRow(check: k),
        if (widget.canReview) ...[
          const SizedBox(height: 14),
          TextField(
            controller: _note,
            maxLength: 500,
            decoration: _inputDecoration('Note (required when rejecting)'),
            style: GoogleFonts.plusJakartaSans(fontSize: 13),
          ),
        ],
        if (_error != null)
          Text(_error!, style: AppTheme.bodySm.copyWith(color: AppTheme.redColor)),
      ],
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Close'),
        ),
        if (widget.canReview) ...[
          const SizedBox(width: 8),
          if (c.status != 'rejected')
            OutlinedButton(
              onPressed: _busy ? null : () => _decide('rejected'),
              style: OutlinedButton.styleFrom(foregroundColor: AppTheme.redColor),
              child: const Text('Reject'),
            ),
          if (c.status != 'verified') ...[
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: _busy ? null : () => _decide('verified'),
              icon: const Icon(Icons.verified, size: 16),
              label: const Text('Verify'),
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.greenColor),
            ),
          ],
        ],
      ],
    );
  }
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

String _msg(Object e) => e.toString().replaceFirst('Exception: ', '');

InputDecoration _inputDecoration(String label) => InputDecoration(
      labelText: label,
      labelStyle: AppTheme.bodySm,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppTheme.borderColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppTheme.borderColor),
      ),
    );

class _DialogFrame extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final List<Widget> body;
  final List<Widget> actions;
  const _DialogFrame(
      {required this.title, this.subtitle, this.trailing, required this.body, required this.actions});

  @override
  Widget build(BuildContext context) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: BoxConstraints(
              maxWidth: 600, maxHeight: MediaQuery.of(context).size.height * 0.88),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 22, 24, 16),
            child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, style: GoogleFonts.plusJakartaSans(
                        fontSize: 19, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                    if (subtitle != null && subtitle!.isNotEmpty)
                      Text(subtitle!, style: AppTheme.bodySm, overflow: TextOverflow.ellipsis),
                  ]),
                ),
                if (trailing != null) ...[const SizedBox(width: 10), trailing!],
              ]),
              const SizedBox(height: 14),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: body),
                ),
              ),
              const Divider(height: 24, color: AppTheme.borderColor),
              Wrap(alignment: WrapAlignment.end, runSpacing: 8, children: actions),
            ]),
          ),
        ),
      );
}

class _AuthenticityBanner extends StatelessWidget {
  final String? authenticity;
  final bool duplicate;
  const _AuthenticityBanner({this.authenticity, this.duplicate = false});

  @override
  Widget build(BuildContext context) {
    final (IconData icon, Color fg, Color bg, String title, String text) = duplicate
        ? (Icons.content_copy, AppTheme.redColor, AppTheme.redBg, 'Already on someone else\'s profile',
            'This exact file was uploaded by another person, so it can\'t be added.')
        : switch (authenticity) {
            'high' => (Icons.verified_user_outlined, const Color(0xFF15803D), AppTheme.greenBg,
                'Looks authentic',
                'The certificate passed the automated checks. The principal or registrar still verifies it.'),
            'medium' => (Icons.shield_outlined, const Color(0xFFB45309), AppTheme.amberBg,
                'Partly confirmed',
                'Some details couldn\'t be confirmed automatically. Review the checks below.'),
            _ => (Icons.gpp_maybe_outlined, AppTheme.redColor, AppTheme.redBg,
                'Doubtful',
                'Several checks failed. It will count little until the principal or registrar verifies it.'),
          };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: fg, size: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: AppTheme.labelMd.copyWith(color: fg)),
            const SizedBox(height: 2),
            Text(text, style: AppTheme.bodySm),
          ]),
        ),
      ]),
    );
  }
}

class _Fact extends StatelessWidget {
  final String label;
  final String value;
  const _Fact({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 100, child: Text(label, style: AppTheme.caption)),
          Expanded(child: Text(value, style: AppTheme.bodyMd.copyWith(color: AppTheme.textPrimary))),
        ]),
      );
}

class _CheckRow extends StatelessWidget {
  final CertificateCheck check;
  const _CheckRow({required this.check});

  @override
  Widget build(BuildContext context) {
    final (IconData icon, Color color) = switch (check.status) {
      'pass' => (Icons.check_circle, AppTheme.greenColor),
      'warn' => (Icons.warning_amber_rounded, AppTheme.amberColor),
      'fail' => (Icons.cancel, AppTheme.redColor),
      _ => (Icons.info_outline, AppTheme.textMuted),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 17, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(check.label, style: AppTheme.labelMd.copyWith(fontSize: 13)),
            Text(check.detail, style: AppTheme.bodySm),
          ]),
        ),
      ]),
    );
  }
}
