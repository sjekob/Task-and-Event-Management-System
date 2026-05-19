import 'package:flutter/material.dart';

class MeshGradientPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // ── 1. Base gradient ──────────────────────────────────────────────────────
    final baseRect = Rect.fromLTWH(0, 0, w, h);
    final basePaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [
          Color(0xFFD6DBE4),
          Color(0xFFB8C3D0),
          Color(0xFFC8C4AF),
          Color(0xFFD4C898),
        ],
        stops: [0.0, 0.35, 0.65, 1.0],
      ).createShader(baseRect);
    canvas.drawRect(baseRect, basePaint);

    // ── 2. Blobs ──────────────────────────────────────────────────────────────
    _drawBlob(canvas,
        center: Offset(w * 0.5, h * 0.15),
        radiusX: w * 0.55,
        radiusY: h * 0.28,
        color: const Color(0xFFB8C8DC).withValues(alpha: 0.75),
        angle: -0.1);

    _drawBlob(canvas,
        center: Offset(w * 0.15, h * 0.45),
        radiusX: w * 0.38,
        radiusY: h * 0.55,
        color: const Color(0xFFA8B4BA).withValues(alpha: 0.55),
        angle: 0.5);

    _drawBlob(canvas,
        center: Offset(w * 0.65, h * 0.55),
        radiusX: w * 0.50,
        radiusY: h * 0.45,
        color: const Color(0xFF9DAFC2).withValues(alpha: 0.5),
        angle: -0.2);

    _drawBlob(canvas,
        center: Offset(w * 0.88, h * 0.82),
        radiusX: w * 0.35,
        radiusY: h * 0.32,
        color: const Color(0xFF7A8FAA).withValues(alpha: 0.60),
        angle: 0.3);

    _drawBlob(canvas,
        center: Offset(w * 0.92, h * 0.08),
        radiusX: w * 0.22,
        radiusY: h * 0.18,
        color: const Color(0xFFE8EBF0).withValues(alpha: 0.65),
        angle: 0.0);

    _drawBlob(canvas,
        center: Offset(w * 0.05, h * 0.88),
        radiusX: w * 0.28,
        radiusY: h * 0.22,
        color: const Color(0xFFD4C070).withValues(alpha: 0.35),
        angle: -0.3);
  }

  void _drawBlob(
    Canvas canvas, {
    required Offset center,
    required double radiusX,
    required double radiusY,
    required Color color,
    required double angle,
  }) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(angle);

    final paint = Paint()
      ..shader = RadialGradient(
        colors: [color, color.withValues(alpha: 0)],
        stops: const [0.0, 1.0],
      ).createShader(Rect.fromCenter(
        center: Offset.zero,
        width: radiusX * 2,
        height: radiusY * 2,
      ));

    canvas.scale(1.0, radiusY / radiusX);
    canvas.drawCircle(Offset.zero, radiusX, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
