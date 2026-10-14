import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/geolocation.dart';

/// Landing page of an attendance QR (Time In or Time Out for one Activity
/// Matrix row). The backend accepts the scan only inside its time window. The
/// device's location is sent along for the record when it can be read — it
/// never blocks a scan. A successful Time Out goes straight to the evaluation.
class AttendanceScanScreen extends StatefulWidget {
  final int eventId;
  final int activityIndex;
  final String action; // 'time_in' | 'time_out'
  final String code;   // QR signature
  const AttendanceScanScreen({
    super.key,
    required this.eventId,
    required this.activityIndex,
    required this.action,
    required this.code,
  });

  @override
  State<AttendanceScanScreen> createState() => _AttendanceScanScreenState();
}

enum _Step { loading, locating, submitting, done, error }

class _AttendanceScanScreenState extends State<AttendanceScanScreen> {
  _Step _step = _Step.loading;
  String _message = '';
  Map<String, dynamic>? _info;

  bool get _isTimeIn => widget.action == 'time_in';
  String get _label => _isTimeIn ? 'Time In' : 'Time Out';

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    if ((widget.action != 'time_in' && widget.action != 'time_out') || widget.code.isEmpty) {
      setState(() {
        _step = _Step.error;
        _message = 'This attendance QR code is incomplete. Please scan it again.';
      });
      return;
    }
    try {
      setState(() => _step = _Step.loading);
      _info ??= await ApiService.getAttendanceActivity(widget.eventId, widget.activityIndex);
      if (!mounted) return;
      setState(() => _step = _Step.locating);
      // Passive log only: carry on without coordinates if location fails.
      GeoFix? fix;
      try {
        fix = await getCurrentPosition();
      } catch (_) {}
      if (!mounted) return;
      setState(() => _step = _Step.submitting);
      final res = await ApiService.scanAttendance(
        widget.eventId,
        activityIndex: widget.activityIndex,
        action: widget.action,
        code: widget.code,
        latitude: fix?.latitude,
        longitude: fix?.longitude,
      );
      if (!mounted) return;
      if (res['redirect_to_evaluation'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(res['message']?.toString() ?? 'Time Out recorded.'),
            backgroundColor: AppTheme.greenColor));
        context.go('/attendance/${widget.eventId}/${widget.activityIndex}/evaluate');
        return;
      }
      setState(() {
        _step = _Step.done;
        _message = res['message']?.toString() ?? '$_label recorded.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _step = _Step.error;
        _message = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 16,
                    offset: const Offset(0, 4))],
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _header(),
                const SizedBox(height: 20),
                _body(),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _header() {
    final info = _info;
    final activity = (info?['activity'] as Map?) ?? const {};
    final windows = info?['windows'] as Map?;
    final window = (windows?[widget.action] as Map?)?['label'];
    return Column(children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: (_isTimeIn ? AppTheme.greenColor : AppTheme.accentBlue).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text('Attendance · $_label',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, fontWeight: FontWeight.w700,
                color: _isTimeIn ? AppTheme.greenColor : AppTheme.accentBlue)),
      ),
      if (info != null) ...[
        const SizedBox(height: 12),
        Text((activity['event'] ?? '').toString().isEmpty
                ? 'Activity ${widget.activityIndex + 1}' : activity['event'].toString(),
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
        const SizedBox(height: 2),
        Text(info['event_title']?.toString() ?? '',
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textMuted)),
        const SizedBox(height: 6),
        Text(
          [
            if ((activity['time'] ?? '').toString().isNotEmpty) activity['time'],
            if ((info['venue'] ?? '').toString().isNotEmpty) info['venue'],
          ].join('  ·  '),
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted),
        ),
        if (window != null) ...[
          const SizedBox(height: 4),
          Text('$_label window: $window',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
        ],
      ],
    ]);
  }

  Widget _body() {
    switch (_step) {
      case _Step.loading:
        return _progress('Loading activity…');
      case _Step.locating:
        return _progress('Getting your location for the record…');
      case _Step.submitting:
        return _progress('Recording your $_label…');
      case _Step.done:
        return _status(Icons.check_circle_outline, AppTheme.greenColor, '$_label recorded', _message,
            action: TextButton(
                onPressed: () => context.go('/dashboard'),
                child: const Text('Go to dashboard')));
      case _Step.error:
        return _status(Icons.error_outline, AppTheme.redColor, '$_label not recorded', _message,
            action: ElevatedButton.icon(
              onPressed: _run,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Try again'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F2C59), foregroundColor: Colors.white),
            ));
    }
  }

  Widget _progress(String text) => Column(children: [
        const SizedBox(height: 8),
        const CircularProgressIndicator(),
        const SizedBox(height: 16),
        Text(text,
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textMuted)),
      ]);

  Widget _status(IconData icon, Color color, String title, String body, {Widget? action}) {
    return Column(children: [
      Icon(icon, size: 56, color: color),
      const SizedBox(height: 12),
      Text(title,
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(
              fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
      const SizedBox(height: 6),
      Text(body,
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textMuted)),
      if (action != null) ...[const SizedBox(height: 16), action],
    ]);
  }
}
