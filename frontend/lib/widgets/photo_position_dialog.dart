import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// The chosen square crop, as fractions: [left]/[top] of the photo's width /
/// height, [size] of its shorter side (what PUT /api/users/me/avatar/position
/// expects).
typedef PhotoCrop = ({double left, double top, double size});

/// Lets a person choose which part of their photo shows in the round avatar:
/// drag to move, slider or mouse wheel to zoom. Pops a [PhotoCrop] on Save.
class PhotoPositionDialog extends StatefulWidget {
  /// Server path of the full photo (e.g. /uploads/avatars/12_ab_src.jpg).
  final String sourceUrl;
  const PhotoPositionDialog({super.key, required this.sourceUrl});

  @override
  State<PhotoPositionDialog> createState() => _PhotoPositionDialogState();
}

class _PhotoPositionDialogState extends State<PhotoPositionDialog> {
  static const double _view = 280; // viewport (and circle) size in px
  static const double _maxZoom = 4;

  Uint8List? _bytes;
  Size? _imageSize;
  String? _error;
  double _zoom = 1;
  Offset _offset = Offset.zero; // image top-left inside the viewport

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res =
          await http.get(Uri.parse(ApiService.mediaUrl(widget.sourceUrl)!));
      if (res.statusCode != 200) throw Exception('status ${res.statusCode}');
      final img = await decodeImageFromList(res.bodyBytes);
      if (!mounted) return;
      setState(() {
        _bytes = res.bodyBytes;
        _imageSize = Size(img.width.toDouble(), img.height.toDouble());
        _centre();
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'The photo could not be loaded. Try again.');
      }
    }
  }

  /// Scale that makes the photo exactly cover the viewport at zoom 1.
  double get _baseScale =>
      _view / math.min(_imageSize!.width, _imageSize!.height);
  double get _scale => _baseScale * _zoom;
  Size get _shown => _imageSize! * _scale;

  void _centre() {
    _offset = Offset((_view - _shown.width) / 2, (_view - _shown.height) / 2);
  }

  /// Keep the photo covering the whole viewport.
  Offset _clamp(Offset o) => Offset(
        o.dx.clamp(_view - _shown.width, 0.0),
        o.dy.clamp(_view - _shown.height, 0.0),
      );

  void _setZoom(double z) {
    final next = z.clamp(1.0, _maxZoom);
    // Zoom around the viewport centre.
    const c = Offset(_view / 2, _view / 2);
    final focus = (c - _offset) / _scale; // photo point under the centre
    setState(() {
      _zoom = next;
      _offset = _clamp(c - focus * _scale);
    });
  }

  PhotoCrop _crop() => (
        left: (-_offset.dx / _scale) / _imageSize!.width,
        top: (-_offset.dy / _scale) / _imageSize!.height,
        size: 1 / _zoom,
      );

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 22, 24, 16),
          child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Position photo',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary)),
                const SizedBox(height: 4),
                Text('Drag to move. Use the slider or scroll to zoom.',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, color: const Color(0xFF4B5563))),
                const SizedBox(height: 16),
                Center(
                  child: SizedBox(
                    width: _view,
                    height: _view,
                    child: _error != null
                        ? Center(
                            child: Text(_error!,
                                textAlign: TextAlign.center,
                                style: AppTheme.bodyMd))
                        : _bytes == null
                            ? const Center(child: CircularProgressIndicator())
                            : _viewport(),
                  ),
                ),
                const SizedBox(height: 14),
                Row(children: [
                  const Icon(Icons.zoom_out,
                      size: 18, color: AppTheme.textMuted),
                  Expanded(
                    child: Slider(
                      value: _zoom,
                      min: 1,
                      max: _maxZoom,
                      onChanged: _bytes == null ? null : _setZoom,
                    ),
                  ),
                  const Icon(Icons.zoom_in,
                      size: 18, color: AppTheme.textMuted),
                ]),
                const SizedBox(height: 8),
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel')),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _bytes == null
                        ? null
                        : () => Navigator.pop(context, _crop()),
                    child: const Text('Save position'),
                  ),
                ]),
              ]),
        ),
      ),
    );
  }

  Widget _viewport() => Listener(
        onPointerSignal: (e) {
          if (e is PointerScrollEvent) _setZoom(_zoom - e.scrollDelta.dy / 400);
        },
        child: GestureDetector(
          onPanUpdate: (d) =>
              setState(() => _offset = _clamp(_offset + d.delta)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Stack(children: [
              Positioned(
                left: _offset.dx,
                top: _offset.dy,
                width: _shown.width,
                height: _shown.height,
                child: Image.memory(_bytes!,
                    fit: BoxFit.fill, gaplessPlayback: true),
              ),
              // Dim everything outside the circle that becomes the avatar.
              const Positioned.fill(
                  child: IgnorePointer(
                      child: CustomPaint(painter: _CircleMask()))),
            ]),
          ),
        ),
      );
}

class _CircleMask extends CustomPainter {
  const _CircleMask();

  @override
  void paint(Canvas canvas, Size size) {
    final outside = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(Offset.zero & size)
      ..addOval(Offset.zero & size);
    canvas.drawPath(outside, Paint()..color = const Color(0x99000000));
    canvas.drawOval(
      (Offset.zero & size).deflate(1),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
