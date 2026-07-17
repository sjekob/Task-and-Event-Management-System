import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// Reached by scanning an event's QR code — no login involved. This is a DepEd
/// "Observation Tool": the indicators come from the last section of the event's
/// own proposal (served by the backend). Each indicator is marked Evident /
/// Not Evident with optional remarks. No scoring happens here — the backend
/// decides everything (which indicators, whether the form is open, the score).
class PublicEvaluationScreen extends StatefulWidget {
  final String eventId;
  const PublicEvaluationScreen({super.key, required this.eventId});

  @override
  State<PublicEvaluationScreen> createState() => _PublicEvaluationScreenState();
}

enum _ViewState { loading, locked, error, form, submitted }

const _roleOptions = [
  'student', 'teacher', 'parent', 'visitor',
  'dean', 'coordinator', 'principal', 'registrar',
];

class _Indicator {
  final String label;
  bool? evident;
  _Indicator(this.label);
}

class _PublicEvaluationScreenState extends State<PublicEvaluationScreen> {
  _ViewState _state = _ViewState.loading;
  String _message = '';
  Map<String, dynamic>? _event;

  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _commentsCtrl = TextEditingController();
  String _role = 'student';
  List<_Indicator> _indicators = [];
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadEvent();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _commentsCtrl.dispose();
    super.dispose();
  }

  bool _validEmail(String s) =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(s);

  Future<void> _loadEvent() async {
    setState(() => _state = _ViewState.loading);
    try {
      final event = await ApiService.getPublicEvent(widget.eventId);
      if (!mounted) return;
      final rawIndicators = (event['indicators'] as List?) ?? const [];
      final indicators = rawIndicators
          .map((e) => _Indicator(e.toString()))
          .toList();
      if (event['is_open'] == true) {
        setState(() {
          _event = event;
          _indicators = indicators;
          _state = _ViewState.form;
        });
      } else {
        setState(() {
          _event = event;
          _message = (event['lock_reason'] as String?) ??
              'This event is not open for evaluation yet.';
          _state = _ViewState.locked;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString().replaceFirst('Exception: ', '');
        _state = _ViewState.error;
      });
    }
  }

  bool get _allMarked => _indicators.every((i) => i.evident != null);

  Future<void> _submit() async {
    if (!_validEmail(_emailCtrl.text.trim())) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Please enter a valid email address.'),
          backgroundColor: Colors.red));
      return;
    }
    if (!_allMarked) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Please mark every indicator as Evident or Not Evident.'),
          backgroundColor: Colors.red));
      return;
    }
    setState(() => _submitting = true);
    try {
      await ApiService.submitPublicEvaluation(widget.eventId, {
        'evaluator_name': _nameCtrl.text.trim().isEmpty ? null : _nameCtrl.text.trim(),
        'evaluator_email': _emailCtrl.text.trim(),
        'evaluator_role': _role,
        'indicators': _indicators
            .map((i) => {
                  'label': i.label,
                  'evident': i.evident,
                })
            .toList(),
        'comments': _commentsCtrl.text.trim().isEmpty ? null : _commentsCtrl.text.trim(),
      });
      if (mounted) setState(() => _state = _ViewState.submitted);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
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
            constraints: const BoxConstraints(maxWidth: 720),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 16,
                    offset: const Offset(0, 4))],
              ),
              child: _buildBody(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_state) {
      case _ViewState.loading:
        return const SizedBox(height: 200, child: Center(child: CircularProgressIndicator()));
      case _ViewState.error:
        return _statusPanel(Icons.error_outline, AppTheme.redColor, 'Unable to load event', _message);
      case _ViewState.locked:
        return _statusPanel(Icons.lock_outline, AppTheme.amberColor,
            _event?['title'] as String? ?? 'Event Evaluation', _message);
      case _ViewState.submitted:
        return _statusPanel(Icons.check_circle_outline, AppTheme.greenColor,
            'Evaluation Submitted!',
            'Thank you for your response. Your feedback helps improve our future events.');
      case _ViewState.form:
        return _buildForm();
    }
  }

  Widget _statusPanel(IconData icon, Color color, String title, String body) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 56, color: color),
      const SizedBox(height: 16),
      Text(title,
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(
              fontSize: 20, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
      const SizedBox(height: 8),
      Text(body,
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textMuted)),
    ]);
  }

  Widget _buildForm() {
    final event = _event!;
    final monitoring = (event['monitoring_criteria'] as String?)?.trim();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // ── Header ───────────────────────────────────────────────────────────
      Row(children: [
        Container(
          width: 44, height: 44,
          decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF0F2C59)),
          child: const Icon(Icons.account_balance, color: Colors.white, size: 24),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Kagawaran ng Edukasyon',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
          Text('Performance Observation Tool',
              style: GoogleFonts.plusJakartaSans(fontSize: 11, color: const Color(0xFF475569))),
        ])),
      ]),
      const SizedBox(height: 12),
      const Divider(color: Color(0xFF0F172A), thickness: 2, height: 2),
      const SizedBox(height: 16),

      // ── Event details ────────────────────────────────────────────────────
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE2E8F0))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(event['title'] as String? ?? 'Event Evaluation',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
          const SizedBox(height: 4),
          Text(
            [
              if ((event['target_date'] as String?)?.isNotEmpty == true)
                'Date: ${event['target_date']}',
              if ((event['organizer_name'] as String?)?.isNotEmpty == true)
                'Organizer: ${event['organizer_name']}',
              if ((event['venue'] as String?)?.isNotEmpty == true)
                'Venue: ${event['venue']}',
            ].join('  ·  '),
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: const Color(0xFF475569)),
          ),
        ]),
      ),
      if (monitoring != null && monitoring.isNotEmpty) ...[
        const SizedBox(height: 12),
        Text('Monitoring & Evaluation Criteria',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
        const SizedBox(height: 4),
        Text(monitoring,
            style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted)),
      ],
      const SizedBox(height: 20),

      // ── Name & role ──────────────────────────────────────────────────────
      Row(children: [
        Expanded(child: TextField(
          controller: _nameCtrl,
          decoration: _decor('Name (optional)'),
          style: const TextStyle(fontSize: 13),
        )),
        const SizedBox(width: 12),
        Expanded(child: DropdownButtonFormField<String>(
          initialValue: _role,
          decoration: _decor('I am a...'),
          style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary),
          items: _roleOptions
              .map((r) => DropdownMenuItem(value: r,
                  child: Text(r[0].toUpperCase() + r.substring(1))))
              .toList(),
          onChanged: (v) => setState(() => _role = v ?? _role),
        )),
      ]),
      const SizedBox(height: 12),
      // ── Email (required — one evaluation per email per event) ─────────────
      TextField(
        controller: _emailCtrl,
        keyboardType: TextInputType.emailAddress,
        decoration: _decor('Email (required)'),
        style: const TextStyle(fontSize: 13),
      ),
      const SizedBox(height: 20),

      // ── Indicators (the proposal's last section) ─────────────────────────
      Text('Observation Indicators',
          style: GoogleFonts.plusJakartaSans(
              fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.textPrimary)),
      const SizedBox(height: 4),
      Text('Mark each indicator as Evident or Not Evident based on what you observed.',
          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textMuted)),
      const SizedBox(height: 12),
      ..._indicators.asMap().entries.map((e) => _indicatorRow(e.key, e.value)),
      const SizedBox(height: 8),

      // ── Comments ─────────────────────────────────────────────────────────
      TextField(
        controller: _commentsCtrl,
        maxLines: 3,
        decoration: _decor('Overall comments (optional)'),
        style: const TextStyle(fontSize: 13),
      ),
      const SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _submitting ? null : _submit,
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F2C59),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14)),
          child: _submitting
              ? const SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Submit Evaluation'),
        ),
      ),
    ]);
  }

  Widget _indicatorRow(int idx, _Indicator ind) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: const Color(0xFFFAFBFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE5E7EB))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${idx + 1}. ${ind.label}',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
        const SizedBox(height: 10),
        Row(children: [
          _evidentChip(ind, true, 'Evident', AppTheme.greenColor),
          const SizedBox(width: 8),
          _evidentChip(ind, false, 'Not Evident', AppTheme.redColor),
        ]),
      ]),
    );
  }

  Widget _evidentChip(_Indicator ind, bool value, String label, Color color) {
    final selected = ind.evident == value;
    return Expanded(child: GestureDetector(
      onTap: () => setState(() => ind.evident = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: 0.12) : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: selected ? color : const Color(0xFFCBD5E1),
                width: selected ? 1.4 : 0.8)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(value ? Icons.check_circle : Icons.cancel,
              size: 15, color: selected ? color : const Color(0xFF94A3B8)),
          const SizedBox(width: 6),
          Text(label,
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, fontWeight: FontWeight.w600,
                  color: selected ? color : AppTheme.textMuted)),
        ]),
      ),
    ));
  }

  InputDecoration _decor(String hint) => InputDecoration(
        labelText: hint,
        filled: true,
        fillColor: const Color(0xFFF9FAFB),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      );
}
