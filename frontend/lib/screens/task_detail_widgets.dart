part of 'task_detail_screen.dart';

class _ReportListItem extends StatelessWidget {
  final Report report;
  final bool isSelected;
  final VoidCallback onTap;
  final ValueChanged<String>? onStatusChange;

  const _ReportListItem({
    required this.report,
    required this.isSelected,
    required this.onTap,
    this.onStatusChange,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppTheme.accentBlue : AppTheme.borderColor,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: AppTheme.sidebarActive,
                child: Text(
                  (report.fullName ?? '?')[0].toUpperCase(),
                  style: const TextStyle(
                      color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(report.fullName ?? '', style: AppTheme.labelMd),
                  if (report.gradeLevel != null)
                    Text(report.gradeLevel!, style: AppTheme.bodySm),
                ]),
              ),
              _StatusChip(status: report.reportStatus, small: true),
            ]),
            if (isSelected && report.reportTitle.isNotEmpty) ...[
              const SizedBox(height: 8),
              _SubmissionTypeLabel(type: report.reportType),
              const SizedBox(height: 6),
              Text(report.reportTitle, style: AppTheme.bodyMd),
              if (report.reportDescription != null) ...[
                const SizedBox(height: 4),
                Text(report.reportDescription!, style: AppTheme.bodySm),
              ],
              if (report.reportFilename != null && report.reportFilePath != null) ...[
                const SizedBox(height: 6),
                _FileItem(
                  filename: report.reportFilename!,
                  url: '${ApiService.baseUrl}${report.reportFilePath!}',
                ),
              ],
              if (report.reportLinkUrl != null) ...[
                const SizedBox(height: 6),
                _LinkItem(url: report.reportLinkUrl!),
              ],
              if (onStatusChange != null) ...[
                const SizedBox(height: 10),
                _StatusButtons(
                  onCompleted: () => onStatusChange!('Completed'),
                  onMissing: () => onStatusChange!('Missing'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

// ── Small components ──────────────────────────────────────────────────────────

class _StatusButtons extends StatelessWidget {
  final VoidCallback onCompleted;
  final VoidCallback onMissing;
  const _StatusButtons({required this.onCompleted, required this.onMissing});

  @override
  Widget build(BuildContext context) => Row(children: [
        OutlinedButton(
          onPressed: onCompleted,
          style: OutlinedButton.styleFrom(
            foregroundColor: AppTheme.greenColor,
            side: const BorderSide(color: AppTheme.greenColor),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            visualDensity: VisualDensity.compact,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          ),
          child: const Text('Completed', style: TextStyle(fontSize: 12)),
        ),
        const SizedBox(width: 8),
        OutlinedButton(
          onPressed: onMissing,
          style: OutlinedButton.styleFrom(
            foregroundColor: AppTheme.redColor,
            side: const BorderSide(color: AppTheme.redColor),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            visualDensity: VisualDensity.compact,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          ),
          child: const Text('Missing', style: TextStyle(fontSize: 12)),
        ),
      ]);
}

class _StatusChip extends StatelessWidget {
  final String status;
  final bool small;
  const _StatusChip({required this.status, this.small = false});

  @override
  Widget build(BuildContext context) {
    Color bg, fg;
    switch (status) {
      case 'Completed':
        bg = AppTheme.greenBg; fg = AppTheme.greenColor; break;
      case 'Missing':
        bg = AppTheme.redBg; fg = AppTheme.redColor; break;
      default:
        bg = AppTheme.amberBg; fg = const Color(0xFF92400E);
    }
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(status,
          style: GoogleFonts.plusJakartaSans(
              fontSize: small ? 10 : 12, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}

class _LinkItem extends StatelessWidget {
  final String url;
  const _LinkItem({required this.url});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => webOpenUrl(url),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: AppTheme.blueBg,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(children: [
            const Icon(Icons.link, size: 14, color: AppTheme.accentBlue),
            const SizedBox(width: 6),
            Expanded(
              child: Text(url,
                  style: AppTheme.bodySm.copyWith(
                      color: AppTheme.accentBlue,
                      decoration: TextDecoration.underline),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.open_in_new, size: 13, color: AppTheme.accentBlue),
          ]),
        ),
      );
}

class _FileItem extends StatelessWidget {
  final String filename;
  final String url;
  const _FileItem({required this.filename, required this.url});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppTheme.greenColor.withOpacity(0.25)),
        ),
        child: Row(children: [
          const Icon(Icons.insert_drive_file_outlined,
              size: 14, color: AppTheme.greenColor),
          const SizedBox(width: 6),
          Expanded(
            child: Text(filename,
                style: AppTheme.bodySm.copyWith(color: AppTheme.textPrimary),
                maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: () => webDownload(url, filename),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.greenColor,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.download_rounded,
                    size: 12, color: Colors.white),
                const SizedBox(width: 4),
                Text('Download',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 10, fontWeight: FontWeight.w600,
                        color: Colors.white)),
              ]),
            ),
          ),
        ]),
      );
}

class _SubmissionTypeLabel extends StatelessWidget {
  final String? type;
  const _SubmissionTypeLabel({this.type});

  @override
  Widget build(BuildContext context) {
    final isFile = type == 'file';
    final label = isFile ? 'File Attachment' : 'Link Submission';
    final icon = isFile ? Icons.attach_file_rounded : Icons.link_rounded;
    final color = isFile ? AppTheme.greenColor : AppTheme.accentBlue;
    final bg = isFile ? const Color(0xFFF0FDF4) : AppTheme.blueBg;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 11, color: color),
        const SizedBox(width: 4),
        Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 10, fontWeight: FontWeight.w600, color: color)),
      ]),
    );
  }
}

class _BackButton extends StatelessWidget {
  final VoidCallback? onBack;
  const _BackButton({this.onBack});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => onBack != null ? onBack!() : Navigator.pop(context),
        child: Container(
          width: 34, height: 34,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.borderColor, width: 1.5),
            color: Colors.white,
          ),
          child: const Icon(Icons.arrow_back, size: 16),
        ),
      );
}

class _OptionRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _OptionRow({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(children: [
            Icon(icon, size: 18, color: AppTheme.textMuted),
            const SizedBox(width: 10),
            Text(label, style: AppTheme.labelMd),
          ]),
        ),
      );
}

class _InlineCommentInput extends StatefulWidget {
  final String userInitials;
  final Function(String) onSend;
  const _InlineCommentInput({required this.userInitials, required this.onSend});

  @override
  State<_InlineCommentInput> createState() => _InlineCommentInputState();
}

class _InlineCommentInputState extends State<_InlineCommentInput> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _send() {
    if (_ctrl.text.trim().isEmpty) return;
    widget.onSend(_ctrl.text.trim());
    _ctrl.clear();
  }

  @override
  Widget build(BuildContext context) {
    const double h = 40;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      child: Row(children: [
        CircleAvatar(
          radius: h / 2,
          backgroundColor: AppTheme.sidebarActive,
          child: Text(widget.userInitials,
              style: const TextStyle(
                  color: Colors.white, fontSize: 12,
                  fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            height: h,
            padding: const EdgeInsets.only(left: 2, right: 5),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F3F7),
              borderRadius: BorderRadius.circular(h / 2),
            ),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 12.5, color: AppTheme.textPrimary),
                  textAlignVertical: TextAlignVertical.center,
                  cursorColor: AppTheme.accentBlue,
                  decoration: InputDecoration(
                    hintText: 'Add a private comment…',
                    hintStyle: GoogleFonts.plusJakartaSans(
                        fontSize: 12.5, color: AppTheme.textLight),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    isCollapsed: true,
                  ),
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 6),
              // Send button — fills with accent once there's text to send.
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: _ctrl,
                builder: (_, value, __) {
                  final active = value.text.trim().isNotEmpty;
                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: active ? _send : null,
                      customBorder: const CircleBorder(),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: active
                              ? AppTheme.accentBlue
                              : const Color(0xFFD7DBE3),
                        ),
                        child: const Icon(Icons.arrow_upward_rounded,
                            size: 17, color: Colors.white),
                      ),
                    ),
                  );
                },
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _FormLabel extends StatelessWidget {
  final String text;
  const _FormLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Text(text, style: AppTheme.labelSm),
      );
}

// ── Points preview card (shown in sidebar before submission) ─────────────────

class _PointsPreviewCard extends StatelessWidget {
  final Task task;
  const _PointsPreviewCard({required this.task});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.darkBanner,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.bolt_rounded, color: Colors.amber, size: 16),
            const SizedBox(width: 6),
            Text('Points You Can Earn',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w700,
                    color: Colors.white)),
          ]),
          const SizedBox(height: 10),
          _row('Early Submission', '+${task.pointsEarly}',
              const Color(0xFF6EE7B7)),
          _row('On Time', '+${task.pointsOntime}',
              const Color(0xFF93C5FD)),
          _row('Late (within 24h)', '+${task.pointsLate24}',
              const Color(0xFFFCD34D)),
          _row('Late (after 24h)', '${task.pointsAfter24}',
              const Color(0xFFF87171)),
        ],
      ),
    );
  }

  Widget _row(String label, String value, Color valueColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        Expanded(
          child: Text(label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: Colors.white.withOpacity(0.7))),
        ),
        Text(value,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w700,
                color: valueColor)),
      ]),
    );
  }
}
