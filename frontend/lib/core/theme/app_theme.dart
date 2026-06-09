import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // ─── Color Palette ───────────────────────────────────────────
  static const Color primaryLight = Color(0xFFE1EBF8); // Main background
  static const Color primaryMid = Color(0xFFACC2DF); // Sidebar, accents
  static const Color darkSurface = Color(0xFF1E2126); // Dark banner/cards
  static const Color white = Color(0xFFFFFFFF);
  static const Color textDark = Color(0xFF1A1A2E);
  static const Color textMedium = Color(0xFF4A5568);
  static const Color textLight = Color(0xFF718096);
  static const Color success = Color(0xFF48BB78);
  static const Color warning = Color(0xFFED8936);
  static const Color danger = Color(0xFFE53E3E);
  static const Color accentGreen = Color(0xFF38A169);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: const ColorScheme.light(
        primary: primaryMid,
        secondary: primaryLight,
        surface: primaryLight,
        onPrimary: white,
        onSecondary: textDark,
        onSurface: textDark,
      ),
      scaffoldBackgroundColor: primaryLight,
      textTheme: GoogleFonts.dmSansTextTheme().copyWith(
        displayLarge: GoogleFonts.dmSans(
            fontSize: 32, fontWeight: FontWeight.w700, color: textDark),
        displayMedium: GoogleFonts.dmSans(
            fontSize: 24, fontWeight: FontWeight.w700, color: textDark),
        titleLarge: GoogleFonts.dmSans(
            fontSize: 18, fontWeight: FontWeight.w600, color: textDark),
        titleMedium: GoogleFonts.dmSans(
            fontSize: 16, fontWeight: FontWeight.w600, color: textDark),
        bodyLarge: GoogleFonts.dmSans(
            fontSize: 15, fontWeight: FontWeight.w400, color: textDark),
        bodyMedium: GoogleFonts.dmSans(
            fontSize: 13, fontWeight: FontWeight.w400, color: textMedium),
        labelSmall: GoogleFonts.dmSans(
            fontSize: 11, fontWeight: FontWeight.w500, color: textLight),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: primaryMid,
        elevation: 0,
        titleTextStyle: GoogleFonts.dmSans(
            fontSize: 18, fontWeight: FontWeight.w700, color: white),
        iconTheme: const IconThemeData(color: white),
      ),
      cardTheme: CardThemeData(
        color: AppTheme.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: darkSurface,
          foregroundColor: white,
          minimumSize: const Size(0, 52),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle:
              GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        hintStyle: GoogleFonts.dmSans(color: textLight),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }

  // ─── Spacing ─────────────────────────────────────────────────
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;

  // ─── Border Radius ───────────────────────────────────────────
  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;
  static const double radiusXl = 24;
}
