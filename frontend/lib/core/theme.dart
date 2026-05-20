import 'package:flutter/material.dart';

class AppColors {
  // Text colors
  static const Color textPrimary = Color(0xFF1F2937);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textHint = Color(0xFF9CA3AF);

  // Status colors
  static const Color success = Color(0xFF10B981);
  static const Color danger = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);
  static const Color amber = Color(0xFFFCD34D);

  // Chart colors
  static const Color chartRpt = Color(0xFF6366F1);
  static const Color chartTask = Color(0xFF8B5CF6);
  static const Color chartEvt = Color(0xFFEC4899);

  // Status badge colors
  static const Color statusGreenBg = Color(0xFFD1FAE5);
  static const Color statusGreenFg = Color(0xFF065F46);
  static const Color statusRedBg = Color(0xFFFEE2E2);
  static const Color statusRedFg = Color(0xFF7F1D1D);
  static const Color statusAmberBg = Color(0xFFFEF3C7);
  static const Color statusAmberFg = Color(0xFF92400E);

  // Component colors
  static const Color cardBorder = Color(0xFFE5E7EB);
  static const Color cardBg = Color(0xFFFFFFFF);
  static const Color pageBg = Color(0xFFF0F2F7);

  // ── Sidebar (unchanged) ───────────────────────────────────────────────────
  static const Color sidebarBg = Color(0xFF7B95B8);
  static const Color sidebarText = Color(0xFFFFFFFF);
  static const Color sidebarMuted = Color(0xFFB8CCE0);
  static const Color sidebarActiveItem = Color(0xFF5B7898);
  static const Color sidebarHover = Color(0xFF6A87AB);

  // Trend
  static const Color trendUp = Color(0xFF10B981);
  static const Color trendDown = Color(0xFFEF4444);
  static const Color trendStable = Color(0xFF6B7280);

  // Score badge
  static const Color scoreGreenBg = Color(0xFFDCFCE7);
  static const Color scoreGreenFg = Color(0xFF065F46);
  static const Color scoreBlueBg = Color(0xFFDEBEFC);
  static const Color scoreBlueFg = Color(0xFF5B21B6);
  static const Color scoreRedBg = Color(0xFFFECACA);
  static const Color scoreRedFg = Color(0xFF7F1D1D);

  // Not Submitted
  static const Color notSubmittedBg = Color(0xFFF0F0F0);
  static const Color notSubmittedFg = Color(0xFF808080);

  // ── Tab bar ───────────────────────────────────────────────────────────────
  // Active tab color (steel blue used in design)
  static const Color tabActive    = Color(0xFF7B95B8);
  static const Color tabActiveFg  = Color(0xFFFFFFFF);
  static const Color tabBorder    = Color(0xFFE5E7EB);

  // ── Info Banner ───────────────────────────────────────────────────────────
  static const Color infoBannerBg  = Color(0xFFEFF6FF);
  static const Color infoBannerFg  = Color(0xFF1D4ED8);
  static const Color infoBannerBdr = Color(0xFFBFDBFE);
  static const Color infoBannerIcon = Color(0xFF3B82F6);

  // Warning Banner
  static const Color warningBannerBg  = Color(0xFFFFF7ED);
  static const Color warningBannerFg  = Color(0xFF92400E);
  static const Color warningBannerBdr = Color(0xFFFED7AA);

  // Misc
  static const Color submittedDate = Color(0xFF6B7280);
  static const Color divider       = Color(0xFFE5E7EB);
  static const Color tableHeaderBg = Color(0xFFF8FAFC);
  static const Color tableRowHover = Color(0xFFF9FAFB);
}

class AppTextStyles {
  static const TextStyle pageTitle = TextStyle(
    fontSize: 30,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: -0.4,
  );

  static const TextStyle pageSub = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
    height: 1.5,
  );

  static const TextStyle sectionTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static const TextStyle tableHeader = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.textSecondary,
    letterSpacing: 0.5,
  );

  static const TextStyle tableCell = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static const TextStyle statLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static const TextStyle tabLabel = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static const TextStyle tabLabelActive = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.tabActiveFg,
  );

  static const TextStyle sidebarNav = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.sidebarText,
    letterSpacing: 0.1,
  );
}

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    primaryColor: AppColors.tabActive,
    scaffoldBackgroundColor: AppColors.pageBg,
    colorScheme: const ColorScheme.light(
      primary: AppColors.tabActive,
      secondary: AppColors.chartTask,
      surface: AppColors.cardBg,
      error: AppColors.danger,
      background: AppColors.pageBg,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.pageBg,
      elevation: 0,
      iconTheme: IconThemeData(color: AppColors.textPrimary),
      titleTextStyle: TextStyle(
        color: AppColors.textPrimary,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.divider,
      thickness: 1,
      space: 0,
    ),
  );
}