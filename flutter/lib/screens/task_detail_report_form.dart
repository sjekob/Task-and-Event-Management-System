part of 'task_detail_screen.dart';

class _ReportForm extends StatefulWidget {
  final int taskId;
  final Task task;
  final Report? existingReport;
  final VoidCallback onSubmitted;
  final ValueChanged<String> onError;
  final VoidCallback? onUnsubmit;

  const _ReportForm({
    required this.taskId,
    required this.task,
    required this.existingReport,
    required this.onSubmitted,
    required this.onError,
    this.onUnsubmit,
  });

  @override
  State<_ReportForm> createState() => _ReportFormState();
}

class _ReportFormState extends State<_ReportForm> {
  bool _showAddOptions = false;
  String? _selectedType; // 'file' or 'link'
  final _linkCtrl = TextEditingController();
  List<int>? _pickedFileBytes;
  String? _fileName;
  bool _submitting = false;

  @override
  void dispose() {
    _linkCtrl.dispose();
    super.dispose();
  }

  bool get _hasContent =>
      _fileName != null || _linkCtrl.text.trim().isNotEmpty;

  Future<void> _pickFile() async {
    final result = await pickWebFile();
    if (result != null && mounted) {
      setState(() {
        _pickedFileBytes = result['bytes'] as List<int>;
        _fileName = result['name'] as String;
        _showAddOptions = false;
      });
    }
  }

  Future<void> _submit() async {
    if (!_hasContent) return;
    setState(() => _submitting = true);
    try {
      final title = _selectedType == 'link'
          ? _linkCtrl.text.trim()
          : (_fileName ?? 'File submission');
      await ApiService.submitReport(
        widget.taskId,
        reportTitle: title,
        reportType: _selectedType,
        reportLinkUrl: _selectedType == 'link' ? _linkCtrl.text.trim() : null,
      );
      // Upload file bytes if file was picked
      if (_selectedType == 'file' && _pickedFileBytes != null) {
        try {
          await ApiService.uploadReportFile(widget.taskId, _pickedFileBytes!, _fileName!);
        } catch (_) {} // file upload failure is non-critical
      }
      if (mounted) widget.onSubmitted();
    } catch (e) {
      widget.onError(e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.existingReport != null) return _buildSubmittedState();
    return _buildFormState();
  }

  Widget _buildFormState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Files & Links card ──
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                child: Text('Files & Links',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 14, fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: _hasContent
                    ? _buildAddedPreview()
                    : Text('No files added yet', style: AppTheme.bodySm),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                child: OutlinedButton(
                  onPressed: () => setState(() {
                    _showAddOptions = !_showAddOptions;
                    if (!_showAddOptions) _selectedType = null;
                  }),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.textPrimary,
                    side: const BorderSide(color: AppTheme.borderColor),
                    backgroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    minimumSize: const Size(double.infinity, 0),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text('+ Add File or Link',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 13, fontWeight: FontWeight.w500)),
                ),
              ),
              if (_showAddOptions) ...[
                const Divider(height: 1, color: AppTheme.borderColor),
                _OptionRow(
                  icon: Icons.insert_drive_file_outlined,
                  label: 'Files',
                  onTap: () => setState(() {
                    _selectedType = 'file';
                    _showAddOptions = false;
                  }),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16,
                    color: AppTheme.borderColor),
                _OptionRow(
                  icon: Icons.link_rounded,
                  label: 'Links',
                  onTap: () => setState(() {
                    _selectedType = 'link';
                    _showAddOptions = false;
                  }),
                ),
              ],
              if (_selectedType == 'file') ...[
                const Divider(height: 1, color: AppTheme.borderColor),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: OutlinedButton(
                    onPressed: _pickFile,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.textPrimary,
                      side: const BorderSide(color: AppTheme.borderColor),
                      backgroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      minimumSize: const Size(double.infinity, 0),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                      const Icon(Icons.insert_drive_file_outlined, size: 16),
                      const SizedBox(width: 8),
                      Text('Select A File',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 13, fontWeight: FontWeight.w500)),
                    ]),
                  ),
                ),
              ],
              if (_selectedType == 'link') ...[
                const Divider(height: 1, color: AppTheme.borderColor),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: TextField(
                    controller: _linkCtrl,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'www.example.com',
                      hintStyle: AppTheme.bodyMd,
                      suffixIcon: const Icon(Icons.link_rounded, size: 18,
                          color: AppTheme.textMuted),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                              color: AppTheme.borderColor)),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                              color: AppTheme.borderColor)),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                              color: AppTheme.accentBlue)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        // ── Submit button ──
        ElevatedButton.icon(
          onPressed: (_hasContent && !_submitting) ? _submit : null,
          icon: _submitting
              ? const SizedBox(width: 15, height: 15,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.send_outlined, size: 16),
          label: Text('Submit Report',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, fontWeight: FontWeight.w600)),
          style: ElevatedButton.styleFrom(
            backgroundColor:
                _hasContent ? AppTheme.darkBanner : const Color(0xFFCBD5E1),
            disabledBackgroundColor: const Color(0xFFCBD5E1),
            foregroundColor: Colors.white,
            disabledForegroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }

  Widget _buildAddedPreview() {
    if (_selectedType == 'link' && _linkCtrl.text.trim().isNotEmpty) {
      return Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Row(children: [
          const Icon(Icons.link_rounded, size: 14, color: AppTheme.accentBlue),
          const SizedBox(width: 6),
          Expanded(
            child: Text(_linkCtrl.text.trim(),
                style: AppTheme.bodySm.copyWith(color: AppTheme.accentBlue),
                maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ]),
      );
    }
    if (_fileName != null) {
      return Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Row(children: [
          const Icon(Icons.insert_drive_file_outlined,
              size: 14, color: AppTheme.accentBlue),
          const SizedBox(width: 6),
          Expanded(
            child: Text(_fileName!,
                style: AppTheme.bodySm.copyWith(color: AppTheme.textPrimary),
                maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ]),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildSubmittedState() {
    final r = widget.existingReport!;
    final points = _calcPoints();
    final reason = _pointsReason(points);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Submitted badge ──
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppTheme.greenBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.greenColor.withOpacity(0.3)),
          ),
          child: Row(children: [
            const Icon(Icons.check_circle,
                color: AppTheme.greenColor, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Submitted',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 14, fontWeight: FontWeight.w700,
                        color: AppTheme.greenColor)),
                Text('Your report has been received',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 11, color: AppTheme.greenColor.withOpacity(0.75))),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 10),
        // ── Submitted content card ──
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              _SubmissionTypeLabel(type: r.reportType),
            ]),
            const SizedBox(height: 8),
            Text(r.reportTitle,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary)),
            if (r.reportFilename != null && r.reportFilePath != null) ...[
              const SizedBox(height: 8),
              _FileItem(
                filename: r.reportFilename!,
                url: '${ApiService.baseUrl}${r.reportFilePath!}',
              ),
            ],
            if (r.reportLinkUrl != null) ...[
              const SizedBox(height: 8),
              _LinkItem(url: r.reportLinkUrl!),
            ],
          ]),
        ),
        const SizedBox(height: 10),
        // ── Points card ──
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.darkBanner,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Points Earned',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, fontWeight: FontWeight.w500,
                    color: Colors.white.withOpacity(0.65))),
            const SizedBox(height: 6),
            Text('+$points',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 28, fontWeight: FontWeight.w800,
                    color: Colors.white)),
            Text(reason,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, color: Colors.white.withOpacity(0.65))),
            if (r.reportDate.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(children: [
                Icon(Icons.access_time, size: 12,
                    color: Colors.white.withOpacity(0.5)),
                const SizedBox(width: 4),
                Text('Submitted: ${_fmtDateTime(r.reportDate)}',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: Colors.white.withOpacity(0.55))),
              ]),
            ],
          ]),
        ),
        const SizedBox(height: 10),
        // ── Unsubmit ──
        ElevatedButton(
          onPressed: widget.onUnsubmit,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF3D4350),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
          child: Text('Unsubmit',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }

  int _calcPoints() {
    final t = widget.task;
    final r = widget.existingReport!;
    if (t.endDate == null || r.reportDate.isEmpty) return 0;
    try {
      final due = DateTime.parse(t.endDate!);
      final submitted = DateTime.parse(r.reportDate);
      final diff = submitted.difference(due);
      if (diff.inHours <= -24) return t.pointsEarly ?? 100;
      if (diff.inHours <= 0) return t.pointsOntime ?? 100;
      if (diff.inHours <= 24) return t.pointsLate24 ?? 50;
      return t.pointsAfter24 ?? 0;
    } catch (_) {
      return 0;
    }
  }

  String _pointsReason(int points) {
    if (points >= 100) return 'On time';
    if (points >= 50) return 'Late (within 24h)';
    return 'Late (after 24h)';
  }

  String _fmtDateTime(String dt) {
    try {
      final d = DateTime.parse(dt);
      final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
      final m = d.minute.toString().padLeft(2, '0');
      final ampm = d.hour >= 12 ? 'PM' : 'AM';
      return '${d.month}/${d.day}/${d.year}, $h:$m $ampm';
    } catch (_) {
      return dt;
    }
  }
}

// ── Report list item (for reviewer views) ────────────────────────────────────
