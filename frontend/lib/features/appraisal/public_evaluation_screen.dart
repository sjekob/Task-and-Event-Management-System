import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../core/api_service.dart';
import 'models/appraisal_models.dart';

class PublicEvaluationScreen extends StatefulWidget {
  final String eventId;
  const PublicEvaluationScreen({super.key, required this.eventId});

  @override
  State<PublicEvaluationScreen> createState() => _PublicEvaluationScreenState();
}

class _IndicatorItem {
  final String name;
  bool? isEvident;
  final TextEditingController remarksController;

  _IndicatorItem({
    required this.name,
    this.isEvident,
    required this.remarksController,
  });
}

class _PublicEvaluationScreenState extends State<PublicEvaluationScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  SchoolEvent? _event;

  final _nameCtrl = TextEditingController();
  final _commentsCtrl = TextEditingController();
  EvaluatorRole _selectedRole = EvaluatorRole.student;

  final List<_IndicatorItem> _indicators = [];
  bool _submitting = false;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _indicators.add(_IndicatorItem(name: '1. The special program has an approved proposal.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '2. The training matrix was observed or was completely delivered.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '3. The number of days were maximized as stated in the training design.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '4. The objectives of the special program were met.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '5. The monitoring and evaluation tools were utilized.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '6. Participants were able to submit the required output.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '7. Attendance was systematically monitored.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '8. The venue was conducive.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '9. The Session started and ended on time.', remarksController: TextEditingController()));
    _indicators.add(_IndicatorItem(name: '10. The trainers/facilitators used appropriate resource package (Pretest and post-tests, power point, video presentation, etc.)', remarksController: TextEditingController()));
    _loadEventDetails();
  }

  Future<void> _loadEventDetails() async {
    try {
      final data = await EventsApi().getEventDetails(widget.eventId);
      final eventData = data['event'];
      if (eventData != null) {
        setState(() {
          _event = SchoolEvent.fromJson(eventData);
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Event not found';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load event details: $e';
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _commentsCtrl.dispose();
    for (final ind in _indicators) {
      ind.remarksController.dispose();
    }
    super.dispose();
  }

  bool get _canSubmit => _indicators.every((i) => i.isEvident != null);

  void _addCustomIndicator() {
    final nameCtrl = TextEditingController();
    showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Custom Indicator'),
        content: TextField(
          controller: nameCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Enter indicator description...',
            labelText: 'Indicator Name',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(nameCtrl.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    ).then((val) {
      nameCtrl.dispose();
      if (val != null && val.isNotEmpty) {
        setState(() {
          final nextNum = _indicators.length + 1;
          _indicators.add(_IndicatorItem(
            name: '$nextNum. $val',
            remarksController: TextEditingController(),
          ));
        });
      }
    });
  }

  Future<void> _submit() async {
    if (!_canSubmit || _submitting) return;

    setState(() => _submitting = true);

    try {
      final evidentCount = _indicators.where((i) => i.isEvident == true).length;
      final double avgScore = _indicators.isEmpty
          ? 3.0
          : (evidentCount * 5.0 + (_indicators.length - evidentCount) * 1.0) / _indicators.length;
      final int scoreInt = avgScore.round().clamp(1, 5);

      final List<String> feedbackParts = [];
      for (final ind in _indicators) {
        final status = ind.isEvident! ? 'Evident' : 'Not Evident';
        final remarks = ind.remarksController.text.trim();
        feedbackParts.add('${ind.name}: $status${remarks.isNotEmpty ? " ($remarks)" : ""}');
      }
      if (_commentsCtrl.text.trim().isNotEmpty) {
        feedbackParts.add('Comments: ${_commentsCtrl.text.trim()}');
      }
      final commentsStr = feedbackParts.join(' | ');

      String roleString = 'Student';
      if (_selectedRole == EvaluatorRole.teacher) roleString = 'Teacher';
      else if (_selectedRole == EvaluatorRole.dean) roleString = 'Dean';
      else if (_selectedRole == EvaluatorRole.coordinator) roleString = 'Coordinator';
      else if (_selectedRole == EvaluatorRole.principal) roleString = 'Principal';
      else if (_selectedRole == EvaluatorRole.registrar) roleString = 'Registrar';
      else if (_selectedRole == EvaluatorRole.parent) roleString = 'Parent';
      else if (_selectedRole == EvaluatorRole.other) roleString = 'Other';

      await EventsApi().evaluateEvent(widget.eventId, {
        'evaluator_id': null,
        'evaluator_name': _nameCtrl.text.trim().isEmpty ? 'Anonymous' : _nameCtrl.text.trim(),
        'evaluator_role': roleString,
        'planning_score': scoreInt,
        'objectives_score': scoreInt,
        'personnel_score': scoreInt,
        'time_mgmt_score': scoreInt,
        'engagement_score': scoreInt,
        'resource_score': scoreInt,
        'template_used': true,
        'feedback_comments': commentsStr,
      });

      setState(() {
        _submitted = true;
        _submitting = false;
      });
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit evaluation: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  InputDecoration _fieldDecor(String hint) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 0.8),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 0.8),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF0F2C59), width: 1.2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline_rounded, size: 64, color: AppColors.danger),
                const SizedBox(height: 16),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please verify the QR link is correct.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_submitted) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle_rounded, size: 80, color: AppColors.success),
                const SizedBox(height: 24),
                const Text(
                  'Evaluation Submitted!',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Thank you for your response. Your feedback helps improve our future events.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _submitted = false;
                      _nameCtrl.clear();
                      _commentsCtrl.clear();
                      _selectedRole = EvaluatorRole.student;
                      for (final ind in _indicators) {
                        ind.isEvident = null;
                        ind.remarksController.clear();
                      }
                    });
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F2C59),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Submit Another Response'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final bool isMobile = constraints.maxWidth < 600;
          final double hPad = isMobile ? 12 : 24;
          final double cardPad = isMobile ? 16 : 28;

          return SingleChildScrollView(
            padding: EdgeInsets.symmetric(horizontal: hPad, vertical: 24),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 800),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  padding: EdgeInsets.all(cardPad),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // ── DepEd Header ────────────────────────────────────
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            width: isMobile ? 40 : 48,
                            height: isMobile ? 40 : 48,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFF0F2C59),
                            ),
                            child: Icon(Icons.account_balance, color: Colors.white, size: isMobile ? 22 : 28),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Republika ng Pilipinas',
                                  style: TextStyle(fontSize: isMobile ? 10 : 12, fontWeight: FontWeight.w400, color: const Color(0xFF334155)),
                                ),
                                Text(
                                  'Kagawaran ng Edukasyon',
                                  style: TextStyle(fontSize: isMobile ? 13 : 16, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A), fontFamily: 'Georgia'),
                                ),
                                Text(
                                  'REHIYON V - BICOL | TANGGAPANG PANSANGAY NG MGA PAARALAN NG LUNGSOD NAGA',
                                  style: TextStyle(fontSize: isMobile ? 8 : 9, fontWeight: FontWeight.w600, color: const Color(0xFF475569)),
                                ),
                                Text(
                                  'NAGA CENTRAL SCHOOL II',
                                  style: TextStyle(fontSize: isMobile ? 9 : 11, fontWeight: FontWeight.bold, color: const Color(0xFF0F2C59)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFF0F172A), thickness: 2),
                      const SizedBox(height: 12),

                      // ── Title ────────────────────────────────────────────
                      Center(
                        child: Text(
                          'OBSERVATION TOOL',
                          style: TextStyle(
                            fontSize: isMobile ? 16 : 20,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // ── Event Details ─────────────────────────────────────
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _event?.name ?? '',
                              style: TextStyle(
                                fontSize: isMobile ? 14 : 16,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Event Date: ${_event?.date ?? ''} · Organizer: ${_event?.organizer ?? ''}',
                              style: TextStyle(fontSize: isMobile ? 11 : 13, color: const Color(0xFF475569)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // ── Name & Role ───────────────────────────────────────
                      if (isMobile) ...[
                        _buildLabeledField(
                          label: 'Name (Optional)',
                          child: TextField(
                            controller: _nameCtrl,
                            decoration: _fieldDecor('Enter name...'),
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildLabeledField(
                          label: 'Role',
                          child: _buildRoleDropdown(),
                        ),
                      ] else
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: 3,
                              child: _buildLabeledField(
                                label: 'Name (Optional)',
                                child: TextField(
                                  controller: _nameCtrl,
                                  decoration: _fieldDecor('Enter name...'),
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              flex: 2,
                              child: _buildLabeledField(
                                label: 'Role',
                                child: _buildRoleDropdown(),
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: 20),

                      // ── Directions ────────────────────────────────────────
                      Text(
                        'Directions: Please assess the effectiveness of the project/program according to the indicators below. Put a check under the appropriate column.',
                        style: TextStyle(
                          fontSize: isMobile ? 11.5 : 12.5,
                          fontStyle: FontStyle.italic,
                          color: const Color(0xFF475569),
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 14),

                      // ── Indicators ────────────────────────────────────────
                      if (isMobile)
                        _buildMobileIndicators()
                      else
                        _buildDesktopIndicatorsTable(),

                      const SizedBox(height: 10),

                      // ── Add Custom Indicator ──────────────────────────────
                      if (_selectedRole != EvaluatorRole.student)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: _addCustomIndicator,
                            icon: const Icon(Icons.add_rounded, color: Color(0xFF0F2C59)),
                            label: const Text(
                              'Add Custom Indicator',
                              style: TextStyle(color: Color(0xFF0F2C59), fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      const SizedBox(height: 20),

                      // ── Comments ──────────────────────────────────────────
                      const Text(
                        'COMMENTS AND RECOMMENDATIONS:',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _commentsCtrl,
                        maxLines: 4,
                        decoration: _fieldDecor('Write comments or recommendations...'),
                        style: const TextStyle(fontSize: 13),
                      ),
                      const SizedBox(height: 28),

                      // ── Submit ────────────────────────────────────────────
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _canSubmit ? _submit : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F2C59),
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: const Color(0xFFE2E8F0),
                            padding: EdgeInsets.symmetric(
                              horizontal: isMobile ? 16 : 32,
                              vertical: isMobile ? 14 : 16,
                            ),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: _submitting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Text(
                                  'Submit Evaluation',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _buildLabeledField({required String label, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
        const SizedBox(height: 6),
        child,
      ],
    );
  }

  Widget _buildRoleDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<EvaluatorRole>(
          value: _selectedRole,
          isExpanded: true,
          icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF64748B)),
          style: const TextStyle(color: Color(0xFF1F2937), fontSize: 13),
          items: EvaluatorRole.values.map((role) {
            return DropdownMenuItem<EvaluatorRole>(
              value: role,
              child: Text(role.label),
            );
          }).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _selectedRole = val);
          },
        ),
      ),
    );
  }

  /// Mobile layout: card per indicator
  Widget _buildMobileIndicators() {
    return Column(
      children: _indicators.map((ind) {
        final index = _indicators.indexOf(ind);
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFCBD5E1)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Indicator name header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(7),
                    topRight: Radius.circular(7),
                  ),
                ),
                child: Text(
                  '${index + 1}. ${ind.name.contains('.') ? ind.name.substring(ind.name.indexOf('.') + 1).trim() : ind.name}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                ),
              ),
              // Radio options row
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => ind.isEvident = true),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: ind.isEvident == true
                                ? const Color(0xFFDCFCE7)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Radio<bool>(
                                value: true,
                                groupValue: ind.isEvident,
                                activeColor: const Color(0xFF16A34A),
                                onChanged: (val) => setState(() => ind.isEvident = val),
                              ),
                              const Text('Evident', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => ind.isEvident = false),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: ind.isEvident == false
                                ? const Color(0xFFFEE2E2)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Radio<bool>(
                                value: false,
                                groupValue: ind.isEvident,
                                activeColor: const Color(0xFFDC2626),
                                onChanged: (val) => setState(() => ind.isEvident = val),
                              ),
                              const Text('Not Evident', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Remarks
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: TextField(
                  controller: ind.remarksController,
                  decoration: InputDecoration(
                    hintText: 'Remarks (optional)...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(6),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(6),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(6),
                      borderSide: const BorderSide(color: Color(0xFF0F2C59), width: 1.2),
                    ),
                  ),
                  style: const TextStyle(fontSize: 12.5),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  /// Desktop layout: classic table
  Widget _buildDesktopIndicatorsTable() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFCBD5E1)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Table(
          columnWidths: const {
            0: FlexColumnWidth(5),
            1: FlexColumnWidth(2),
            2: FlexColumnWidth(2.5),
            3: FlexColumnWidth(4),
          },
          border: TableBorder.all(color: const Color(0xFFCBD5E1), width: 0.8),
          children: [
            // Header
            const TableRow(
              decoration: BoxDecoration(color: Color(0xFFF1F5F9)),
              children: [
                Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('INDICATORS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                ),
                Padding(
                  padding: EdgeInsets.all(12),
                  child: Center(child: Text('Evident', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)))),
                ),
                Padding(
                  padding: EdgeInsets.all(12),
                  child: Center(child: Text('Not Evident', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)))),
                ),
                Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('Remarks', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                ),
              ],
            ),
            // Rows
            ..._indicators.map((ind) {
              return TableRow(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                    child: Text(ind.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                  ),
                  Center(
                    child: Radio<bool>(
                      value: true,
                      groupValue: ind.isEvident,
                      activeColor: const Color(0xFF0F2C59),
                      onChanged: (val) => setState(() => ind.isEvident = val),
                    ),
                  ),
                  Center(
                    child: Radio<bool>(
                      value: false,
                      groupValue: ind.isEvident,
                      activeColor: const Color(0xFF0F2C59),
                      onChanged: (val) => setState(() => ind.isEvident = val),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: TextField(
                      controller: ind.remarksController,
                      decoration: const InputDecoration(
                        hintText: 'Enter remarks...',
                        hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        border: UnderlineInputBorder(
                          borderSide: BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: UnderlineInputBorder(
                          borderSide: BorderSide(color: Color(0xFF0F2C59), width: 1.2),
                        ),
                      ),
                      style: const TextStyle(fontSize: 12.5),
                    ),
                  ),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }
}
