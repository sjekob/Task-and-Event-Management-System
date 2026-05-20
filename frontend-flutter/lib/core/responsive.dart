// TaskNet - Responsive Breakpoint Helper
// File: frontend-flutter/lib/core/responsive.dart

import 'package:flutter/widgets.dart';

/// Breakpoints aligned with the design:
///   mobile  < 600px  → collapsible drawer, stacked layout
///   tablet  < 1024px → rail, moderate density
///   desktop ≥ 1024px → expanded side nav, full table
class Responsive {
  Responsive._();

  static const double _mobileBreakpoint  = 600;
  static const double _desktopBreakpoint = 1024;

  static bool isMobile(BuildContext ctx) =>
      MediaQuery.sizeOf(ctx).width < _mobileBreakpoint;

  static bool isTablet(BuildContext ctx) {
    final w = MediaQuery.sizeOf(ctx).width;
    return w >= _mobileBreakpoint && w < _desktopBreakpoint;
  }

  static bool isDesktop(BuildContext ctx) =>
      MediaQuery.sizeOf(ctx).width >= _desktopBreakpoint;

  /// Returns a value based on the current screen class.
  static T value<T>(
    BuildContext ctx, {
    required T mobile,
    T? tablet,
    required T desktop,
  }) {
    if (isDesktop(ctx)) return desktop;
    if (isTablet(ctx)) return tablet ?? desktop;
    return mobile;
  }
}
