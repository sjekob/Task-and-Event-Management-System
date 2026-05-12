import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';

// ── TaskNet Logo ──
class TaskNetLogo extends StatelessWidget {
  final double size;
  const TaskNetLogo({super.key, this.size = 32});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/logo.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
    );
  }
}

// ── Banner Widget (dark honeycomb) ──
class AppBanner extends StatelessWidget {
  final String title;
  final String subtitle;

  const AppBanner({super.key, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
      decoration: BoxDecoration(
        color: AppTheme.darkBanner,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Stack(
        children: [
          // Dot pattern
          Positioned.fill(
            child: CustomPaint(painter: _HoneycombPainter()),
          ),
          // Red glow right
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            width: 200,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.horizontal(right: Radius.circular(14)),
                gradient: RadialGradient(
                  center: Alignment.centerRight,
                  radius: 1.0,
                  colors: [
                    const Color(0xFF8B0000).withOpacity(0.3),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: Colors.white)),
              const SizedBox(height: 6),
              Text(subtitle,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: const Color(0xFF9CA3AF))),
            ],
          ),
        ],
      ),
    );
  }
}

class _HoneycombPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    const r = 12.0;
    const w = r * 2;
    const h = r * 1.732;

    for (double y = -h; y < size.height + h; y += h) {
      for (double x = -w; x < size.width + w; x += w * 1.5) {
        final offset = (y / h).floor().isOdd ? w * 0.75 : 0.0;
        _drawHex(canvas, paint, Offset(x + offset, y), r);
      }
    }
  }

  void _drawHex(Canvas canvas, Paint paint, Offset center, double r) {
    final path = Path();
    for (int i = 0; i < 6; i++) {
      final angle = (i * 60 - 30) * 3.14159 / 180;
      final x = center.dx + r * cos(angle);
      final y = center.dy + r * sin(angle);
      if (i == 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.close();
    canvas.drawPath(path, paint);
  }

  double cos(double rad) => _cos(rad);
  double sin(double rad) => _sin(rad);

  double _cos(double x) {
    double result = 1;
    double term = 1;
    for (int i = 1; i <= 8; i++) {
      term *= -x * x / (2 * i * (2 * i - 1));
      result += term;
    }
    return result;
  }

  double _sin(double x) {
    double result = x;
    double term = x;
    for (int i = 1; i <= 8; i++) {
      term *= -x * x / ((2 * i + 1) * 2 * i);
      result += term;
    }
    return result;
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Status Badge ──
class StatusBadge extends StatelessWidget {
  final String label;
  final Color bgColor;
  final Color textColor;

  const StatusBadge({
    super.key,
    required this.label,
    required this.bgColor,
    required this.textColor,
  });

  factory StatusBadge.pending() => const StatusBadge(
      label: 'Pending',
      bgColor: Color(0xFFDBEAFE),
      textColor: Color(0xFF1D4ED8));

  factory StatusBadge.submitted() => const StatusBadge(
      label: 'Submitted',
      bgColor: Color(0xFFDCFCE7),
      textColor: Color(0xFF15803D));

  factory StatusBadge.disabled() => const StatusBadge(
      label: 'Disabled',
      bgColor: Color(0xFFF3F4F6),
      textColor: Color(0xFF6B7280));

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: textColor)),
    );
  }
}

// ── Submission Count Badge ──
class SubmissionBadge extends StatelessWidget {
  final int count;
  const SubmissionBadge({super.key, required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppTheme.greenColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.description_outlined, size: 13, color: Colors.white),
          const SizedBox(width: 4),
          Text('$count Submission${count > 1 ? 's' : ''}',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
        ],
      ),
    );
  }
}

// ── Task Card ──
class TaskListCard extends StatelessWidget {
  final Task task;
  final bool showBadge;
  final bool showMenu;
  final VoidCallback onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDisable;
  final VoidCallback? onDelete;

  const TaskListCard({
    super.key,
    required this.task,
    this.showBadge = false,
    this.showMenu = false,
    required this.onTap,
    this.onEdit,
    this.onDisable,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(12),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.title, style: AppTheme.heading3),
                  const SizedBox(height: 3),
                  Text(
                    _formatDate(task.startDate ?? task.endDate ?? ''),
                    style: AppTheme.bodySm,
                  ),
                  if (task.instructions != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      task.instructions!.length > 70
                          ? '${task.instructions!.substring(0, 70)}...'
                          : task.instructions!,
                      style: AppTheme.bodyMd,
                    ),
                  ],
                  if (task.submissionCount > 0) ...[
                    const SizedBox(height: 8),
                    SubmissionBadge(count: task.submissionCount),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              children: [
                if (showBadge)
                  task.isSubmitted
                      ? StatusBadge.submitted()
                      : StatusBadge.pending(),
                if (showMenu)
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, size: 18, color: AppTheme.textMuted),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    onSelected: (v) {
                      if (v == 'edit') onEdit?.call();
                      if (v == 'disable') onDisable?.call();
                      if (v == 'delete') onDelete?.call();
                    },
                    itemBuilder: (_) => [
                      PopupMenuItem(value: 'edit', child: Row(children: [const Icon(Icons.edit_outlined, size: 16), const SizedBox(width: 8), Text('Edit', style: AppTheme.labelMd)])),
                      PopupMenuItem(value: 'disable', child: Row(children: [const Icon(Icons.block_outlined, size: 16), const SizedBox(width: 8), Text('Disable', style: AppTheme.labelMd)])),
                      PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete_outline, size: 16, color: AppTheme.redColor), const SizedBox(width: 8), Text('Delete', style: AppTheme.labelMd.copyWith(color: AppTheme.redColor))])),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String d) {
    if (d.isEmpty) return '';
    try {
      final dt = DateTime.parse(d);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      return d;
    }
  }
}

// ── Points Row ──
class PointsRow extends StatelessWidget {
  final String label;
  final String value;
  final Color bgColor;
  final Color valueColor;

  const PointsRow({
    super.key,
    required this.label,
    required this.value,
    required this.bgColor,
    required this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w500)),
          Text(value,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: valueColor)),
        ],
      ),
    );
  }
}

// ── Comment Item ──
class CommentItem extends StatelessWidget {
  final Comment comment;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const CommentItem({
    super.key,
    required this.comment,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: AppTheme.sidebarActive,
            child: Text(
              comment.fullName.isNotEmpty ? comment.fullName[0].toUpperCase() : '?',
              style: const TextStyle(
                  color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(comment.fullName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 6),
                    Text(_formatDate(comment.createdAt),
                        style: AppTheme.bodySm),
                    if (onEdit != null || onDelete != null) ...[
                      const SizedBox(width: 2),
                      SizedBox(
                        width: 28,
                        height: 28,
                        child: PopupMenuButton<String>(
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.more_horiz,
                              size: 18, color: AppTheme.textMuted),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                          onSelected: (v) {
                            if (v == 'edit') onEdit?.call();
                            if (v == 'delete') onDelete?.call();
                          },
                          itemBuilder: (_) => [
                            if (onEdit != null)
                              PopupMenuItem(
                                value: 'edit',
                                child: Row(children: [
                                  const Icon(Icons.edit_outlined,
                                      size: 15, color: AppTheme.textMuted),
                                  const SizedBox(width: 8),
                                  Text('Edit', style: AppTheme.labelMd),
                                ]),
                              ),
                            if (onDelete != null)
                              PopupMenuItem(
                                value: 'delete',
                                child: Row(children: [
                                  Icon(Icons.delete_outline,
                                      size: 15, color: AppTheme.redColor),
                                  const SizedBox(width: 8),
                                  Text('Delete',
                                      style: AppTheme.labelMd
                                          .copyWith(color: AppTheme.redColor)),
                                ]),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(comment.content, style: AppTheme.bodyMd),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String d) {
    if (d.isEmpty) return '';
    try {
      final dt = DateTime.parse(d);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      return d;
    }
  }
}

// ── Comment Input ──
class CommentInputField extends StatefulWidget {
  final String placeholder;
  final Function(String) onSend;
  const CommentInputField({super.key, required this.placeholder, required this.onSend});

  @override
  State<CommentInputField> createState() => _CommentInputFieldState();
}

class _CommentInputFieldState extends State<CommentInputField> {
  final _ctrl = TextEditingController();

  void _send() {
    if (_ctrl.text.trim().isNotEmpty) {
      widget.onSend(_ctrl.text.trim());
      _ctrl.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _ctrl,
            maxLines: 4,
            minLines: 3,
            style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textPrimary),
            textInputAction: TextInputAction.newline,
            decoration: InputDecoration(
              hintText: widget.placeholder,
              hintStyle: AppTheme.bodyMd,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppTheme.borderColor)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                ElevatedButton.icon(
                  onPressed: _send,
                  icon: const Icon(Icons.send_rounded, size: 15),
                  label: Text('Send',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.darkBanner,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stat Card ──
class StatCard extends StatelessWidget {
  final String count;
  final String label;
  final Color iconBg;
  final Color iconColor;
  final IconData icon;

  const StatCard({
    super.key,
    required this.count,
    required this.label,
    required this.iconBg,
    required this.iconColor,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: isMobile ? 10 : 18, vertical: 16),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(height: 10),
          Text(count,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary)),
          Text(label,
              style: AppTheme.bodyMd,
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

// ── Search Bar ──
class AppSearchBar extends StatelessWidget {
  final String hint;
  final ValueChanged<String> onChanged;
  const AppSearchBar({super.key, required this.hint, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(8),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        children: [
          const Icon(Icons.search, size: 16, color: AppTheme.textLight),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              onChanged: onChanged,
              style: AppTheme.bodyLg,
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: AppTheme.bodyMd,
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section Header ──
class SectionHeader extends StatelessWidget {
  final String title;
  final int? count;
  const SectionHeader({super.key, required this.title, this.count});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(title, style: AppTheme.heading3),
          if (count != null) ...[
            const SizedBox(width: 6),
            Text('($count task${count != 1 ? 's' : ''})',
                style: AppTheme.bodyMd),
          ],
        ],
      ),
    );
  }
}
