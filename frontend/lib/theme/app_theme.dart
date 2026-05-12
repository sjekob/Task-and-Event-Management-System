import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // ── Core Colors (matching the HTML design exactly) ──
  static const Color bgColor = Color(0xFFDCE6F5);
  static const Color sidebarColor = Color(0xFFB8C8E8);
  static const Color sidebarActive = Color(0xFF8FAAD4);
  static const Color cardColor = Colors.white;
  static const Color darkBanner = Color(0xFF1A1A2E);
  static const Color accentBlue = Color(0xFF2563EB);
  static const Color accentHover = Color(0xFF1D4ED8);
  static const Color textPrimary = Color(0xFF1A1A2E);
  static const Color textMuted = Color(0xFF6B7280);
  static const Color textLight = Color(0xFF9CA3AF);
  static const Color greenColor = Color(0xFF22C55E);
  static const Color greenBg = Color(0xFFDCFCE7);
  static const Color redColor = Color(0xFFEF4444);
  static const Color redBg = Color(0xFFFEE2E2);
  static const Color amberColor = Color(0xFFF59E0B);
  static const Color amberBg = Color(0xFFFEF3C7);
  static const Color blueBg = Color(0xFFDBEAFE);
  static const Color borderColor = Color(0xFFE5E7EB);
  static const Color logoutBtn = Color(0xFF2D3748);

  static ThemeData get theme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: bgColor,
      colorScheme: ColorScheme.fromSeed(
        seedColor: accentBlue,
        background: bgColor,
        surface: cardColor,
        primary: accentBlue,
      ),
      textTheme: GoogleFonts.plusJakartaSansTextTheme().copyWith(
        displayLarge: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800, color: textPrimary),
        headlineLarge: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800, color: textPrimary),
        headlineMedium: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w700, color: textPrimary),
        bodyLarge: GoogleFonts.plusJakartaSans(color: textPrimary),
        bodyMedium: GoogleFonts.plusJakartaSans(color: textMuted),
      ),
      cardTheme: CardThemeData(
      color: cardColor,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        shadowColor: Colors.black.withOpacity(0.08),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: darkBanner,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cardColor,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: borderColor, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: borderColor, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: accentBlue, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }

  // ── Text Styles (Figma typography spec) ──
  // H3 → 32px Semi Bold | H4 → 26px | S1 → 18px | S2 → 16px
  // B1/B3 Regular, B2/B4 Medium | C1 Regular, C2/C3 Medium | Label Medium 12px
  static TextStyle get heading1 => GoogleFonts.plusJakartaSans(
      fontSize: 26, fontWeight: FontWeight.w600, color: textPrimary, height: 1.31);
  static TextStyle get heading2 => GoogleFonts.plusJakartaSans(
      fontSize: 20, fontWeight: FontWeight.w600, color: textPrimary, height: 1.4);
  static TextStyle get heading3 => GoogleFonts.plusJakartaSans(
      fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary, height: 1.5);
  static TextStyle get subtitle1 => GoogleFonts.plusJakartaSans(
      fontSize: 18, fontWeight: FontWeight.w600, color: textPrimary, height: 1.56);
  static TextStyle get subtitle2 => GoogleFonts.plusJakartaSans(
      fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary, height: 1.5);
  static TextStyle get bodyLg => GoogleFonts.plusJakartaSans(
      fontSize: 16, fontWeight: FontWeight.w400, color: textPrimary, height: 1.5);
  static TextStyle get bodyMd => GoogleFonts.plusJakartaSans(
      fontSize: 14, fontWeight: FontWeight.w400, color: textMuted, height: 1.43);
  static TextStyle get bodySm => GoogleFonts.plusJakartaSans(
      fontSize: 12, fontWeight: FontWeight.w400, color: textLight, height: 1.33);
  static TextStyle get labelMd => GoogleFonts.plusJakartaSans(
      fontSize: 14, fontWeight: FontWeight.w500, color: textPrimary, height: 1.43);
  static TextStyle get labelSm => GoogleFonts.plusJakartaSans(
      fontSize: 12, fontWeight: FontWeight.w500, color: textMuted, height: 1.33);
  static TextStyle get caption => GoogleFonts.plusJakartaSans(
      fontSize: 12, fontWeight: FontWeight.w400, color: textLight, height: 1.33);
  static TextStyle get captionMd => GoogleFonts.plusJakartaSans(
      fontSize: 12, fontWeight: FontWeight.w500, color: textMuted, height: 1.33);
  static TextStyle get captionSm => GoogleFonts.plusJakartaSans(
      fontSize: 10, fontWeight: FontWeight.w500, color: textMuted, height: 1.4);

  // ── Shadows ──
  static List<BoxShadow> get cardShadow => [
        BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2))
      ];
  static List<BoxShadow> get shadowLg => [
        BoxShadow(
            color: Colors.black.withOpacity(0.12),
            blurRadius: 24,
            offset: const Offset(0, 8))
      ];
}
