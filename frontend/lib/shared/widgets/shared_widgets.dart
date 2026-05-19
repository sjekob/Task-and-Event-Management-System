import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../features/auth/login_screen.dart';

// ── Sidebar ───────────────────────────────────────────────────────────────────

class AppSidebar extends StatelessWidget {
  final int activeIndex;
  final ValueChanged<int> onNavTap;
  final String role;
  final String username;

  const AppSidebar({
    super.key,
    required this.activeIndex,
    required this.onNavTap,
    this.role = 'coordinator',
    this.username = 'Louis Lok',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      color: AppColors.sidebarBg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Logo / branding
          _SidebarLogo(),

          const SizedBox(height: 6),

          // ── Nav items
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              children: _buildNavItems(role.toLowerCase()),
            ),
          ),

          // ── User footer + logout
          _SidebarFooter(username: username, role: role),
        ],
      ),
    );
  }

  List<Widget> _buildNavItems(String role) {
    List<Widget> items = [];

    if (role == 'teacher') {
      items = [
        _sectionLabel('MAIN MENU'),
        const SizedBox(height: 4),
        _NavItem(icon: Icons.home_outlined, label: 'Dashboard', active: activeIndex == 0, onTap: () => onNavTap(0)),
        _NavItem(icon: Icons.edit_outlined, label: 'Task', active: activeIndex == 1, onTap: () => onNavTap(1)),
        _NavItem(icon: Icons.list_alt_outlined, label: 'Activity Calendar', active: activeIndex == 3, onTap: () => onNavTap(3)),
        _NavItem(icon: Icons.bar_chart_outlined, label: 'Appraisal', active: activeIndex == 2, onTap: () => onNavTap(2)),
      ];
    } else if (role == 'dean') {
      items = [
        _sectionLabel('MAIN MENU'),
        const SizedBox(height: 4),
        _NavItem(icon: Icons.home_outlined, label: 'Dashboard', active: activeIndex == 0, onTap: () => onNavTap(0)),
        _NavItem(icon: Icons.edit_outlined, label: 'Task', active: activeIndex == 1, onTap: () => onNavTap(1)),
        _NavItem(icon: null, label: '  Task Manager', active: activeIndex == 7, onTap: () => onNavTap(7)),
        _NavItem(icon: null, label: '  My Tasks', active: activeIndex == 8, onTap: () => onNavTap(8)),
        _NavItem(icon: Icons.list_alt_outlined, label: 'Activity Calendar', active: activeIndex == 3, onTap: () => onNavTap(3)),
        _NavItem(icon: Icons.bar_chart_outlined, label: 'Appraisal', active: activeIndex == 2, onTap: () => onNavTap(2)),
      ];
    } else if (role == 'principal') {
      items = [
        _sectionLabel('MAIN MENU'),
        const SizedBox(height: 4),
        _NavItem(icon: Icons.home_outlined, label: 'Dashboard', active: activeIndex == 0, onTap: () => onNavTap(0)),
        _NavItem(icon: Icons.edit_outlined, label: 'Task', active: activeIndex == 1, onTap: () => onNavTap(1)),
        _NavItem(icon: Icons.list_alt_outlined, label: 'Activity Calendar', active: activeIndex == 3, onTap: () => onNavTap(3)),
        _NavItem(icon: Icons.people_outline, label: 'Users', active: activeIndex == 9, onTap: () => onNavTap(9)),
        _NavItem(icon: Icons.bar_chart_outlined, label: 'Appraisal', active: activeIndex == 2, onTap: () => onNavTap(2)),
      ];
    } else {
      // Default: Coordinator (Current UI)
      items = [
        _sectionLabel('MAIN MENU'),
        const SizedBox(height: 4),
        _NavItem(icon: Icons.home_outlined, label: 'Dashboard', active: activeIndex == 0, onTap: () => onNavTap(0)),
        _NavItem(icon: Icons.assignment_outlined, label: 'Task', active: activeIndex == 1, onTap: () => onNavTap(1)),
        _NavItem(icon: Icons.bar_chart_outlined, label: 'Appraisal', active: activeIndex == 2, onTap: () => onNavTap(2)),
        _NavItem(icon: Icons.calendar_today_outlined, label: 'Activity Calendar', active: activeIndex == 3, onTap: () => onNavTap(3)),
      ];
    }

    // Append SYSTEM section for all roles
    items.addAll([
      const SizedBox(height: 12),
      _sectionLabel('SYSTEM'),
      const SizedBox(height: 4),
      _NavItem(icon: Icons.people_outline, label: 'Personnel', active: activeIndex == 4, onTap: () => onNavTap(4)),
      _NavItem(icon: Icons.notifications_outlined, label: 'Notifications', active: activeIndex == 5, onTap: () => onNavTap(5)),
      _NavItem(icon: Icons.settings_outlined, label: 'Settings', active: activeIndex == 6, onTap: () => onNavTap(6)),
    ]);

    return items;
  }

  Widget _sectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(left: 14, bottom: 4, top: 2),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0x80FFFFFF),   // 50% white
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

// ── Sidebar logo ──────────────────────────────────────────────────────────────

class _SidebarLogo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 62,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0x20FFFFFF), width: 1),
        ),
      ),
      child: Row(
        children: [
          // Icon container
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.verified_outlined,
              color: Colors.white,
              size: 17,
            ),
          ),
          const SizedBox(width: 10),
          const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TaskNet',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
              Text(
                'Appraisal System',
                style: TextStyle(
                  color: Color(0xBBFFFFFF),
                  fontSize: 10,
                  fontWeight: FontWeight.w400,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Nav item ──────────────────────────────────────────────────────────────────

class _NavItem extends StatefulWidget {
  final IconData? icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final bool highlighted = widget.active || _hovered;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          margin: const EdgeInsets.only(bottom: 2),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: widget.active
                ? AppColors.sidebarActiveItem
                : _hovered
                    ? AppColors.sidebarHover
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              // Active indicator bar (left side)
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 3,
                height: 16,
                margin: const EdgeInsets.only(left: 10, right: 8),
                decoration: BoxDecoration(
                  color: widget.active ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              if (widget.icon != null) ...[
                Icon(
                  widget.icon,
                  size: 17,
                  color: highlighted
                      ? Colors.white
                      : AppColors.sidebarMuted,
                ),
                const SizedBox(width: 9),
              ] else ...[
                const SizedBox(width: 26), // Match icon + padding space
              ],
              Expanded(
                child: Text(
                  widget.label,
                  style: TextStyle(
                    color: highlighted
                        ? Colors.white
                        : AppColors.sidebarMuted,
                    fontSize: 13,
                    fontWeight: widget.active
                        ? FontWeight.w600
                        : FontWeight.w400,
                    letterSpacing: 0.1,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Sidebar footer ────────────────────────────────────────────────────────────

class _SidebarFooter extends StatelessWidget {
  final String username;
  final String role;

  const _SidebarFooter({
    this.username = 'Louis Lok',
    this.role = 'coordinator',
  });

  @override
  Widget build(BuildContext context) {
    // Get initials for the avatar (e.g., "Louis Lok" -> "LL", "principal.rodriguez" -> "PR")
    String getInitials(String name) {
      if (name.isEmpty) return '?';
      final parts = name.split(RegExp(r'[\s.]'));
      if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    
    // Capitalize role
    String displayRole = role.isNotEmpty 
        ? role[0].toUpperCase() + role.substring(1) 
        : 'Coordinator';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: Color(0x20FFFFFF), width: 1),
        ),
      ),
      child: Column(
        children: [
          // User row
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    getInitials(username),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      username,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      displayRole,
                      style: const TextStyle(
                        color: Color(0xCCFFFFFF),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Logout button
          GestureDetector(
            onTap: () {
              showDialog<bool>(
                context: context,
                builder: (dialogContext) => AlertDialog(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  title: const Text(
                    'Confirm Logout',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  content: const Text(
                    'Are you sure you want to logout? Any unsaved changes will be lost.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF666666)),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(dialogContext).pop(false),
                      child: const Text('Cancel'),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                      onPressed: () {
                        Navigator.of(dialogContext).pop(true);
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(builder: (context) => const LoginScreen()),
                          (route) => false,
                        );
                      },
                      child: const Text(
                        'Logout',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              );
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.12),
                borderRadius: BorderRadius.circular(7),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout_outlined,
                      color: Color(0xCCFFFFFF), size: 15),
                  SizedBox(width: 7),
                  Text(
                    'Logout',
                    style: TextStyle(
                      color: Color(0xCCFFFFFF),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;
  final String? subtitle;
  final Widget? icon;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.valueColor,
    this.subtitle,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.cardBorder, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[icon!, const SizedBox(width: 8)],
              Expanded(
                child: Text(
                  label,
                  style: AppTextStyles.statLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w600,
              color: valueColor,
              letterSpacing: -0.3,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(subtitle!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ],
      ),
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class PersonAvatar extends StatelessWidget {
  final String name;

  const PersonAvatar({super.key, required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 30,
      height: 30,
      decoration: const BoxDecoration(
        color: Color(0xFFCBD8EB),
        shape: BoxShape.circle,
      ),
      child: const Icon(
        Icons.person_outline,
        color: Color(0xFF5B7898),
        size: 18,
      ),
    );
  }
}

// ── Score Badge ───────────────────────────────────────────────────────────────

class ScoreBadge extends StatelessWidget {
  final int score;

  const ScoreBadge({super.key, required this.score});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    if (score >= 90) {
      bg = AppColors.scoreGreenBg;
      fg = AppColors.scoreGreenFg;
    } else if (score >= 60) {
      bg = AppColors.scoreBlueBg;
      fg = AppColors.scoreBlueFg;
    } else {
      bg = AppColors.scoreRedBg;
      fg = AppColors.scoreRedFg;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        '$score/100',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: fg,
        ),
      ),
    );
  }
}

// ── Status Badge ──────────────────────────────────────────────────────────────

class StatusBadge extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.label,
    required this.bg,
    required this.fg,
    this.icon,
  });

  factory StatusBadge.evaluated() => const StatusBadge(
        label: 'Evaluated',
        bg: AppColors.statusGreenBg,
        fg: AppColors.statusGreenFg,
        icon: Icons.check_circle_outline,
      );

  factory StatusBadge.flagged() => const StatusBadge(
        label: 'Flagged',
        bg: AppColors.statusRedBg,
        fg: AppColors.statusRedFg,
        icon: Icons.flag_outlined,
      );

  factory StatusBadge.pending() => const StatusBadge(
        label: 'Pending',
        bg: AppColors.statusAmberBg,
        fg: AppColors.statusAmberFg,
      );

  factory StatusBadge.rated() => const StatusBadge(
        label: 'Rated',
        bg: AppColors.statusGreenBg,
        fg: AppColors.statusGreenFg,
        icon: Icons.check_circle_outline,
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: fg, size: 12),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: fg,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Not Submitted Badge ───────────────────────────────────────────────────────

class NotSubmittedBadge extends StatelessWidget {
  const NotSubmittedBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.notSubmittedBg,
        borderRadius: BorderRadius.circular(5),
      ),
      child: const Text(
        'Not Submitted',
        style: TextStyle(
          fontSize: 11,
          color: AppColors.notSubmittedFg,
          fontWeight: FontWeight.w400,
        ),
      ),
    );
  }
}

// ── Table Action Button — FIXED: no longer full-width ─────────────────────────

class TableActionButton extends StatefulWidget {
  final String label;
  final VoidCallback? onTap;
  final bool outlined;

  const TableActionButton({
    super.key,
    required this.label,
    this.onTap,
    this.outlined = false,
  });

  @override
  State<TableActionButton> createState() => _TableActionButtonState();
}

class _TableActionButtonState extends State<TableActionButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          // ↑ No width constraint — hugs content naturally
          decoration: BoxDecoration(
            color: widget.outlined
                ? (_hovered ? AppColors.tableRowHover : Colors.white)
                : (_hovered
                    ? AppColors.sidebarActiveItem
                    : AppColors.tabActive),
            borderRadius: BorderRadius.circular(6),
            border: widget.outlined
                ? Border.all(color: AppColors.cardBorder, width: 1)
                : null,
          ),
          child: Text(
            widget.label,
            style: TextStyle(
              color: widget.outlined
                  ? AppColors.textPrimary
                  : Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Info Banner — FIXED: was purple, now light blue ───────────────────────────

class InfoBanner extends StatelessWidget {
  final String text;
  final bool isWarning;

  const InfoBanner({super.key, required this.text, this.isWarning = false});

  @override
  Widget build(BuildContext context) {
    final Color bg = isWarning ? AppColors.warningBannerBg : AppColors.infoBannerBg;
    final Color fg = isWarning ? AppColors.warningBannerFg : AppColors.infoBannerFg;
    final Color border = isWarning ? AppColors.warningBannerBdr : AppColors.infoBannerBdr;
    final IconData icon = isWarning ? Icons.warning_amber_outlined : Icons.info_outline;
    final Color iconColor = isWarning ? AppColors.warning : AppColors.infoBannerIcon;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: border, width: 0.8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: fg,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section Card ──────────────────────────────────────────────────────────────

class SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;

  const SectionCard({super.key, required this.child, this.padding});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder, width: 0.8),
      ),
      child: child,
    );
  }
}

// ── Page scaffold ─────────────────────────────────────────────────────────────

class AppraisalScaffold extends StatelessWidget {
  final int sidebarIndex;
  final Widget body;

  const AppraisalScaffold({
    super.key,
    required this.sidebarIndex,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AppSidebar(activeIndex: sidebarIndex, onNavTap: (_) {}),
        Expanded(child: body),
      ],
    );
  }
}