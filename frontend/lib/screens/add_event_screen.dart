import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class AddEventScreen extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onCreated;

  const AddEventScreen({super.key, required this.onBack, required this.onCreated});

  @override
  State<AddEventScreen> createState() => _AddEventScreenState();
}

class _AddEventScreenState extends State<AddEventScreen> {
  int _step = 0;
  final _pageController = PageController();
  bool _submitting = false;

  final _stepTitles = const [
    'Proposal Brief',
    'Rationale & Objectives',
    'Methodology',
    'Activity Matrix',
    'Budget',
    'Monitoring & Evaluation',
  ];

  // Step 1
  final _titleCtrl     = TextEditingController();
  final _dateCtrl      = TextEditingController();
  final _venueCtrl     = TextEditingController();
  final _budgetCtrl    = TextEditingController();
  final _fundCtrl      = TextEditingController();
  final _focalNameCtrl = TextEditingController();
  final _focalRoleCtrl = TextEditingController();
  final _focalCpCtrl   = TextEditingController();
  String _nature       = 'Co-curricular';
  int _tMale = 0, _tFemale = 0, _jMale = 0, _jFemale = 0;
  final List<TextEditingController> _outputCtrls = [
    TextEditingController(), TextEditingController()
  ];

  // Step 2
  final _rationaleCtrl = TextEditingController();
  final List<TextEditingController> _objCtrls = [
    TextEditingController(), TextEditingController(), TextEditingController(),
  ];

  // Step 3
  final _p1Ctrl = TextEditingController(text: 'Planning\nRecruitment of participants');
  final _p2Ctrl = TextEditingController(text: 'Training-workshop sessions');
  final _p3Ctrl = TextEditingController(text: 'Selection of school paper staff\nEvaluation of the activity');

  // Step 4
  late List<Map<String, TextEditingController>> _matrixRows;

  // Step 5
  late List<Map<String, TextEditingController>> _matRows;
  late List<Map<String, TextEditingController>> _snackRows;
  late List<Map<String, TextEditingController>> _execRows;
  late List<Map<String, dynamic>> _twgGroups;

  // Step 6
  final _meCtrl       = TextEditingController();
  final _commentsCtrl = TextEditingController();
  final List<Map<String, dynamic>> _indicators = [
    {'label': 'The special program has an approved proposal.',                                                                                  'value': '', 'remarks': TextEditingController()},
    {'label': 'The training matrix was observed or was completely delivered.',                                                                  'value': '', 'remarks': TextEditingController()},
    {'label': 'The number of days were maximized as stated in the training design.',                                                            'value': '', 'remarks': TextEditingController()},
    {'label': 'The objectives of the special program were met.',                                                                                'value': '', 'remarks': TextEditingController()},
    {'label': 'The monitoring and evaluation tools were utilized.',                                                                             'value': '', 'remarks': TextEditingController()},
    {'label': 'Participants were able to submit the required output.',                                                                          'value': '', 'remarks': TextEditingController()},
    {'label': 'Attendance was systematically monitored.',                                                                                       'value': '', 'remarks': TextEditingController()},
    {'label': 'The venue was conducive.',                                                                                                       'value': '', 'remarks': TextEditingController()},
    {'label': 'The Session started and ended on time.',                                                                                        'value': '', 'remarks': TextEditingController()},
    {'label': 'The trainers/facilitators used appropriate resource package (Pretest and post-tests, power point, video presentation, etc.)',    'value': '', 'remarks': TextEditingController()},
  ];

  Map<String, TextEditingController> _newMatrix() => {
    'day': TextEditingController(), 'time': TextEditingController(),
    'event': TextEditingController(), 'speaker': TextEditingController(),
  };
  Map<String, TextEditingController> _newMat() => {
    'item': TextEditingController(), 'qty': TextEditingController(),
    'cost': TextEditingController(), 'total': TextEditingController(),
  };
  Map<String, TextEditingController> _newSnack() => {
    'item': TextEditingController(), 'pax': TextEditingController(),
    'cost': TextEditingController(), 'total': TextEditingController(),
  };
  Map<String, TextEditingController> _newExec() => {
    'name': TextEditingController(), 'position': TextEditingController(),
  };
  Map<String, TextEditingController> _newMember() => {
    'name': TextEditingController(), 'designation': TextEditingController(),
    'tor': TextEditingController(), 'output': TextEditingController(),
  };

  @override
  void initState() {
    super.initState();
    _matrixRows = List.generate(3, (_) => _newMatrix());
    _matRows    = List.generate(2, (_) => _newMat());
    _snackRows  = List.generate(1, (_) => _newSnack());
    _execRows   = List.generate(2, (_) => _newExec());
    _twgGroups  = [
      {'title': TextEditingController(text: 'Supervising Committee'),    'members': <Map<String, TextEditingController>>[_newMember()]},
      {'title': TextEditingController(text: 'Program Implementation Committee'), 'members': <Map<String, TextEditingController>>[_newMember()]},
    ];
  }

  @override
  void dispose() {
    _titleCtrl.dispose(); _dateCtrl.dispose(); _venueCtrl.dispose();
    _budgetCtrl.dispose(); _fundCtrl.dispose(); _focalNameCtrl.dispose();
    _focalRoleCtrl.dispose(); _focalCpCtrl.dispose();
    _rationaleCtrl.dispose(); _p1Ctrl.dispose(); _p2Ctrl.dispose();
    _p3Ctrl.dispose(); _meCtrl.dispose(); _commentsCtrl.dispose();
    for (final c in _outputCtrls) c.dispose();
    for (final c in _objCtrls) c.dispose();
    super.dispose();
  }

  void _goTo(int s) {
    setState(() => _step = s);
    _pageController.animateToPage(s,
        duration: const Duration(milliseconds: 220), curve: Curves.easeInOut);
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter the event title in Step 1.')),
      );
      _goTo(0);
      return;
    }
    setState(() => _submitting = true);

    final matrixData = _matrixRows.map((r) => {
      'day': r['day']!.text, 'time': r['time']!.text,
      'event': r['event']!.text, 'speaker': r['speaker']!.text,
    }).toList();
    final matData = _matRows.map((r) => {
      'item': r['item']!.text, 'qty': r['qty']!.text,
      'cost': r['cost']!.text, 'total': r['total']!.text,
    }).toList();
    final snackData = _snackRows.map((r) => {
      'item': r['item']!.text, 'pax': r['pax']!.text,
      'cost': r['cost']!.text, 'total': r['total']!.text,
    }).toList();
    final execData = _execRows.map((r) => {
      'name': r['name']!.text, 'position': r['position']!.text,
    }).toList();
    final twgData = _twgGroups.map((g) => {
      'title': (g['title'] as TextEditingController).text,
      'members': (g['members'] as List<Map<String, TextEditingController>>)
          .map((m) => {
                'name': m['name']!.text, 'designation': m['designation']!.text,
                'tor': m['tor']!.text, 'output': m['output']!.text,
              })
          .toList(),
    }).toList();
    final indicatorData = _indicators.map((ind) => {
      'label': ind['label'], 'value': ind['value'],
      'remarks': (ind['remarks'] as TextEditingController).text,
    }).toList();

    final payload = {
      'title':            _titleCtrl.text,
      'nature':           _nature,
      'target_date':      _dateCtrl.text,
      'venue':            _venueCtrl.text,
      'proposed_budget':  _budgetCtrl.text,
      'fund_source':      _fundCtrl.text,
      'focal_name':       _focalNameCtrl.text,
      'focal_role':       _focalRoleCtrl.text,
      'focal_contact':    _focalCpCtrl.text,
      'expected_outputs': jsonEncode(_outputCtrls.map((c) => c.text).toList()),
      'participants': jsonEncode({
        'teachers':    {'male': _tMale, 'female': _tFemale},
        'journalists': {'male': _jMale, 'female': _jFemale},
      }),
      'rationale':          _rationaleCtrl.text,
      'objectives':         jsonEncode(_objCtrls.map((c) => c.text).toList()),
      'phase1':             _p1Ctrl.text,
      'phase2':             _p2Ctrl.text,
      'phase3':             _p3Ctrl.text,
      'activity_matrix':    jsonEncode(matrixData),
      'training_materials': jsonEncode(matData),
      'snacks':             jsonEncode(snackData),
      'exec_committee':     jsonEncode(execData),
      'twg_groups':         jsonEncode(twgData),
      'monitoring_criteria': _meCtrl.text,
      'indicators':          jsonEncode(indicatorData),
      'comments':            _commentsCtrl.text,
    };

    try {
      final result = await ApiService.createEvent(payload);
      if (!mounted) return;
      if (result != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Event proposal submitted for approval!'),
            backgroundColor: Color(0xFF48BB78),
          ),
        );
        widget.onCreated();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to submit. Check server connection.'),
            backgroundColor: Color(0xFFE53E3E),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: const Color(0xFFE53E3E)),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Header ──
        Container(
          color: const Color(0xFFF0F4FA),
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
          child: Row(children: [
            IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1A1A2E)),
              onPressed: widget.onBack,
            ),
            const SizedBox(width: 8),
            Text('Add New Event',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1A1A2E))),
          ]),
        ),
        // ── Step indicators ──
        Container(
          color: const Color(0xFFF0F4FA),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
          child: Row(
            children: List.generate(_stepTitles.length, (i) => Expanded(
              child: GestureDetector(
                onTap: () => _goTo(i),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  child: Column(children: [
                    Row(children: [
                      Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i < _step
                              ? const Color(0xFF48BB78)
                              : i == _step
                                  ? const Color(0xFF1E2126)
                                  : const Color(0xFFACC2DF),
                        ),
                        child: Center(
                          child: i < _step
                              ? const Icon(Icons.check, size: 14, color: Colors.white)
                              : Text('${i + 1}',
                                  style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_stepTitles[i],
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: i == _step ? FontWeight.w700 : FontWeight.w400,
                                color: i == _step
                                    ? const Color(0xFF1A1A2E)
                                    : const Color(0xFF718096))),
                      ),
                    ]),
                    const SizedBox(height: 6),
                    Container(
                      height: 3,
                      decoration: BoxDecoration(
                        color: i <= _step
                            ? const Color(0xFF1E2126)
                            : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ]),
                ),
              ),
            )),
          ),
        ),

        // ── Page content ──
        Expanded(
          child: PageView(
            controller: _pageController,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _buildProposalBrief(),
              _buildRationale(),
              _buildMethodology(),
              _buildActivityMatrix(),
              _buildBudget(),
              _buildMonitoringEvaluation(),
            ],
          ),
        ),

        // ── Footer ──
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          decoration: const BoxDecoration(
            color: Color(0xFFE1EBF8),
            border: Border(top: BorderSide(color: Color(0xFFACC2DF))),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (_step > 0)
                SizedBox(
                  width: 120, height: 44,
                  child: OutlinedButton(
                    onPressed: () => _goTo(_step - 1),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF4A5568),
                        side: const BorderSide(color: Color(0xFFDDE3ED)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8))),
                    child: const Text('Back'),
                  ),
                )
              else
                const SizedBox(),
              SizedBox(
                width: 160, height: 44,
                child: ElevatedButton(
                  onPressed: _submitting
                      ? null
                      : () {
                          if (_step < _stepTitles.length - 1) {
                            _goTo(_step + 1);
                          } else {
                            _submit();
                          }
                        },
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E2126),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      elevation: 0),
                  child: _submitting
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text(_step < _stepTitles.length - 1
                          ? 'Next →'
                          : 'Submit Proposal'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Step 1: Proposal Brief ────────────────────────────────────────────────
  Widget _buildProposalBrief() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _secTitle('I. PROPOSAL BRIEF'),
            _fLabel('a. Title'),
            _tField(_titleCtrl, hint: 'Enter project title'),
            const SizedBox(height: 16),
            _fLabel('b. Nature of Activity'),
            Wrap(
              spacing: 8,
              children: ['Curricular', 'Co-curricular', 'Extra-curricular']
                  .map((n) => Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Radio<String>(
                              value: n, groupValue: _nature,
                              onChanged: (v) => setState(() => _nature = v!),
                              activeColor: const Color(0xFF1E2126)),
                          Text(n, style: const TextStyle(fontSize: 13)),
                        ],
                      ))
                  .toList(),
            ),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _fLabel('c. Target Date'),
                _tField(_dateCtrl, hint: 'e.g. October 23, 24 & 28, 2024'),
              ])),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _fLabel('d. Proposed Venue'),
                _tField(_venueCtrl, hint: 'e.g. NCS II Pavilion'),
              ])),
            ]),
            const SizedBox(height: 16),
            _fLabel('e. Target Participants'),
            Container(
              decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8)),
              child: Table(
                columnWidths: const {
                  0: FlexColumnWidth(2.5), 1: FlexColumnWidth(1),
                  2: FlexColumnWidth(1),  3: FlexColumnWidth(1),
                },
                children: [
                  TableRow(
                    decoration: const BoxDecoration(color: Color(0xFFF7F9FC)),
                    children: ['', 'MALE', 'FEMALE', 'TOTAL']
                        .map((h) => Padding(
                            padding: const EdgeInsets.all(10),
                            child: Text(h,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12))))
                        .toList(),
                  ),
                  _paxRow('Teachers/Speakers', _tMale, _tFemale, 'tm', 'tf'),
                  _paxRow('Aspiring journalists', _jMale, _jFemale, 'jm', 'jf'),
                  TableRow(children: [
                    const Padding(padding: EdgeInsets.all(10),
                        child: Text('TOTAL', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
                    ...[_tMale + _jMale, _tFemale + _jFemale,
                        _tMale + _tFemale + _jMale + _jFemale].map((v) => Padding(
                            padding: const EdgeInsets.all(10),
                            child: Text('$v', textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)))),
                  ]),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _fLabel('f. Expected Outputs'),
            ..._outputCtrls.asMap().entries.map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    Text('${e.key + 1}. ',
                        style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
                    Expanded(child: _tField(e.value, hint: 'Expected output...')),
                  ]),
                )),
            TextButton.icon(
                onPressed: () => setState(() => _outputCtrls.add(TextEditingController())),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add output'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _fLabel('g. Proposed Budget (₱)'),
                _tField(_budgetCtrl, hint: 'e.g. 3,120.00'),
              ])),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _fLabel('h. Source of Fund'),
                _tField(_fundCtrl, hint: 'e.g. School Paper Fund/SPTA Fund'),
              ])),
            ]),
            const SizedBox(height: 16),
            _fLabel('h. Focal Person'),
            Row(children: [
              Expanded(child: _tField(_focalNameCtrl, hint: 'Full name')),
              const SizedBox(width: 12),
              Expanded(child: _tField(_focalRoleCtrl, hint: 'Designation')),
              const SizedBox(width: 12),
              Expanded(child: _tField(_focalCpCtrl, hint: 'CP # / Contact')),
            ]),
          ],
        ),
      ),
    );
  }

  // ── Step 2: Rationale & Objectives ────────────────────────────────────────
  Widget _buildRationale() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _secTitle('II. RATIONALE'),
            _tField(_rationaleCtrl, hint: 'Provide the rationale for this activity...', maxLines: 8),
            const SizedBox(height: 28),
            _secTitle('III. OBJECTIVES'),
            const Text('This project aims to:',
                style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 12),
            ..._objCtrls.asMap().entries.map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 28, height: 28,
                        margin: const EdgeInsets.only(right: 10, top: 2),
                        decoration: BoxDecoration(
                            color: const Color(0xFF1E2126),
                            borderRadius: BorderRadius.circular(14)),
                        child: Center(child: Text('${e.key + 1}',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
                      ),
                      Expanded(child: _tField(e.value, hint: 'Objective ${e.key + 1}...')),
                    ],
                  ),
                )),
            TextButton.icon(
                onPressed: () => setState(() => _objCtrls.add(TextEditingController())),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add objective'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
          ],
        ),
      ),
    );
  }

  // ── Step 3: Methodology ───────────────────────────────────────────────────
  Widget _buildMethodology() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _secTitle('IV. METHODOLOGY'),
            const Text(
              'The training shall be composed of lectures, video clip viewing, sharing and games. 5E\'s approach shall be utilized for most of the sessions.',
              style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 20),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: MediaQuery.of(context).size.width - 96),
                child: Container(
                  decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(8)),
                  child: Table(
                    columnWidths: const {
                      0: FixedColumnWidth(90), 1: FixedColumnWidth(160), 2: FixedColumnWidth(220),
                    },
                    children: [
                      TableRow(
                        decoration: const BoxDecoration(color: Color(0xFFF7F9FC)),
                        children: ['Phase', 'Stage', 'Activities']
                            .map((h) => Padding(padding: const EdgeInsets.all(12),
                                child: Text(h, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))))
                            .toList(),
                      ),
                      _phaseRow('Phase 1', 'Pre-Implementation Stage', _p1Ctrl),
                      _phaseRow('Phase 2', 'Implementation', _p2Ctrl),
                      _phaseRow('Phase 3', 'Post-Implementation', _p3Ctrl),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Step 4: Activity Matrix ───────────────────────────────────────────────
  Widget _buildActivityMatrix() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _secTitle('V. ACTIVITY MATRIX'),
            Container(
              decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8)),
              child: Column(children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                      color: Color(0xFFF7F9FC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
                  child: Row(children: const [
                    Expanded(flex: 2, child: Text('Day', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    Expanded(flex: 2, child: Text('Time', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    Expanded(flex: 3, child: Text('Event', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    Expanded(flex: 3, child: Text('Speaker', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    SizedBox(width: 36),
                  ]),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                ..._matrixRows.asMap().entries.map((e) => Column(children: [
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Row(children: [
                          Expanded(flex: 2, child: _mini(e.value['day']!, 'Oct. 23, 2024')),
                          const SizedBox(width: 8),
                          Expanded(flex: 2, child: _mini(e.value['time']!, '4:00-5:00 PM')),
                          const SizedBox(width: 8),
                          Expanded(flex: 3, child: _mini(e.value['event']!, 'e.g. News Writing')),
                          const SizedBox(width: 8),
                          Expanded(flex: 3, child: _mini(e.value['speaker']!, 'Speaker name')),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () => setState(() => _matrixRows.removeAt(e.key)),
                            child: const Icon(Icons.remove_circle_outline, size: 20, color: Color(0xFFE53E3E)),
                          ),
                        ]),
                      ),
                      if (e.key < _matrixRows.length - 1)
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                    ])),
              ]),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
                onPressed: () => setState(() => _matrixRows.add(_newMatrix())),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add row'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
          ],
        ),
      ),
    );
  }

  // ── Step 5: Budget & Working Committee ────────────────────────────────────
  Widget _buildBudget() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _secTitle('VII. PROPOSED BUDGET'),
            const Text(
              'Charged against School Paper Fund/SPTA Fund subject to usual accounting and auditing rules.',
              style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 20),
            const Text('a. Training Materials',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            _budgetTable(
              headers: ['Particulars', 'Quantity', 'Cost', 'Total'],
              rows: _matRows, keys: ['item', 'qty', 'cost', 'total'],
              hints: ['Bond paper...', '1 ream', '270.00', '270.00'],
              onAdd: () => setState(() => _matRows.add(_newMat())),
              onRemove: (i) => setState(() => _matRows.removeAt(i)),
            ),
            const SizedBox(height: 20),
            const Text('b. Snacks for Program Partners',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            _budgetTable(
              headers: ['Particulars', 'No. of Participants', 'Cost/pax', 'Total'],
              rows: _snackRows, keys: ['item', 'pax', 'cost', 'total'],
              hints: ['Meals', '11 pax', '100.00', '1100.00'],
              onAdd: () => setState(() => _snackRows.add(_newSnack())),
              onRemove: (i) => setState(() => _snackRows.removeAt(i)),
            ),
            const SizedBox(height: 28),
            _secTitle('VI. WORKING COMMITTEE'),
            const Text('a. Executive Committee',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            _committeeTable(
              rows: _execRows, headers: ['Name', 'Position'],
              keys: ['name', 'position'],
              hints: ['e.g. FREDERICK M. BALDOZA', 'e.g. Principal'],
              onAdd: () => setState(() => _execRows.add(_newExec())),
              onRemove: (i) => setState(() => _execRows.removeAt(i)),
            ),
            const SizedBox(height: 24),
            const Text('b. Technical Working Group',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            ..._twgGroups.asMap().entries.map((g) {
              final members = g.value['members'] as List<Map<String, TextEditingController>>;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: g.value['title'] as TextEditingController,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        hintText: 'e.g. Supervising Committee',
                        hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
                        filled: true, fillColor: const Color(0xFFF0F4FA),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        prefixIcon: const Icon(Icons.group_outlined, size: 18, color: Color(0xFF718096)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (_twgGroups.length > 1)
                    GestureDetector(
                      onTap: () => setState(() => _twgGroups.removeAt(g.key)),
                      child: const Icon(Icons.remove_circle_outline, size: 20, color: Color(0xFFE53E3E)),
                    ),
                ]),
                const SizedBox(height: 10),
                _committeeTable(
                  rows: members,
                  headers: ['Name', 'Designation', 'Terms of Reference', 'Output'],
                  keys: ['name', 'designation', 'tor', 'output'],
                  hints: ['Full name', 'e.g. Chairperson', 'e.g. Leads the Committee', 'e.g. Checked reports'],
                  onAdd: () => setState(() => members.add(_newMember())),
                  onRemove: (i) => setState(() => members.removeAt(i)),
                ),
                const SizedBox(height: 16),
              ]);
            }),
            TextButton.icon(
                onPressed: () => setState(() => _twgGroups.add({
                      'title': TextEditingController(text: 'New Committee'),
                      'members': <Map<String, TextEditingController>>[_newMember()],
                    })),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add Committee Group'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
          ],
        ),
      ),
    );
  }

  // ── Step 6: Monitoring & Evaluation ──────────────────────────────────────
  Widget _buildMonitoringEvaluation() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _secTitle('VIII. MONITORING AND EVALUATION'),
            _fLabel('Monitoring Instructions / Evaluation Criteria'),
            _tField(_meCtrl,
                hint: 'Add specific monitoring instructions or evaluation criteria...', maxLines: 6),
            const SizedBox(height: 28),
            _secTitle('Observation Tool Indicators'),
            const Text(
              'Please assess the effectiveness of the project/program according to the indicators below.',
              style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8)),
              child: Column(children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                      color: Color(0xFFF7F9FC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
                  child: Row(children: const [
                    Expanded(flex: 5, child: Text('Indicators', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    SizedBox(width: 8),
                    SizedBox(width: 80, child: Text('Evident', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    SizedBox(width: 8),
                    SizedBox(width: 100, child: Text('Not Evident', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    SizedBox(width: 8),
                    Expanded(flex: 2, child: Text('Remarks', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  ]),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                ..._indicators.asMap().entries.map((e) => Column(children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(flex: 5, child: Text('${e.key + 1}. ${e.value['label']}',
                                style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)))),
                            const SizedBox(width: 8),
                            SizedBox(width: 80, child: Radio<String>(
                                value: 'evident', groupValue: e.value['value'] as String,
                                onChanged: (v) => setState(() => _indicators[e.key]['value'] = v!),
                                activeColor: const Color(0xFF48BB78))),
                            const SizedBox(width: 8),
                            SizedBox(width: 100, child: Radio<String>(
                                value: 'not_evident', groupValue: e.value['value'] as String,
                                onChanged: (v) => setState(() => _indicators[e.key]['value'] = v!),
                                activeColor: const Color(0xFFE53E3E))),
                            const SizedBox(width: 8),
                            Expanded(flex: 2, child: TextField(
                              controller: e.value['remarks'] as TextEditingController,
                              style: const TextStyle(fontSize: 12),
                              decoration: InputDecoration(
                                hintText: 'Remarks...',
                                hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 11),
                                filled: true, fillColor: const Color(0xFFF7F9FC),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                    borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                    borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                              ),
                            )),
                          ],
                        ),
                      ),
                      if (e.key < _indicators.length - 1)
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                    ])),
              ]),
            ),
            const SizedBox(height: 24),
            _fLabel('Comments and Recommendations'),
            _tField(_commentsCtrl,
                hint: 'Write your comments and recommendations here...', maxLines: 5),
          ],
        ),
      ),
    );
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  TableRow _paxRow(String label, int male, int female, String mk, String fk) {
    return TableRow(children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Text(label, style: const TextStyle(fontSize: 13))),
      _numCell(male, mk), _numCell(female, fk),
      Padding(padding: const EdgeInsets.all(10),
          child: Text('${male + female}', textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
    ]);
  }

  Widget _numCell(int val, String key) {
    return Padding(
      padding: const EdgeInsets.all(4),
      child: TextField(
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        onChanged: (v) {
          final n = int.tryParse(v) ?? 0;
          setState(() {
            if (key == 'tm') _tMale = n;
            else if (key == 'tf') _tFemale = n;
            else if (key == 'jm') _jMale = n;
            else if (key == 'jf') _jFemale = n;
          });
        },
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          hintText: '$val',
          hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
          filled: true, fillColor: const Color(0xFFF7F9FC),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        ),
      ),
    );
  }

  TableRow _phaseRow(String ph, String stage, TextEditingController ctrl) {
    return TableRow(children: [
      Padding(padding: const EdgeInsets.all(12),
          child: Text(ph, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
      Padding(padding: const EdgeInsets.all(12),
          child: Text(stage, style: const TextStyle(fontSize: 13))),
      Padding(padding: const EdgeInsets.all(8), child: TextField(
        controller: ctrl, maxLines: null,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          filled: true, fillColor: const Color(0xFFF7F9FC),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          contentPadding: const EdgeInsets.all(10)),
      )),
    ]);
  }

  Widget _mini(TextEditingController c, String hint) {
    return TextField(
      controller: c,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 12),
        filled: true, fillColor: const Color(0xFFF7F9FC),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      ),
    );
  }

  Widget _budgetTable({
    required List<String> headers,
    required List<Map<String, TextEditingController>> rows,
    required List<String> keys,
    required List<String> hints,
    required VoidCallback onAdd,
    required ValueChanged<int> onRemove,
  }) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE2E8F0)),
            borderRadius: BorderRadius.circular(8)),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(color: Color(0xFFF7F9FC),
                borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
            child: Row(children: [
              ...headers.map((h) => Expanded(child: Text(h,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)))),
              const SizedBox(width: 36),
            ]),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          ...rows.asMap().entries.map((e) => Padding(
              padding: const EdgeInsets.all(8),
              child: Row(children: [
                ...keys.asMap().entries.map((kv) => Expanded(
                    child: Padding(padding: const EdgeInsets.only(right: 8),
                        child: _mini(e.value[kv.value]!, hints[kv.key])))),
                GestureDetector(onTap: () => onRemove(e.key),
                    child: const Icon(Icons.remove_circle_outline, size: 20, color: Color(0xFFE53E3E))),
              ]))),
        ]),
      ),
      TextButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add item'),
          style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
    ]);
  }

  Widget _committeeTable({
    required List<Map<String, TextEditingController>> rows,
    required List<String> headers,
    required List<String> keys,
    required List<String> hints,
    required VoidCallback onAdd,
    required ValueChanged<int> onRemove,
  }) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE2E8F0)),
            borderRadius: BorderRadius.circular(8)),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(color: Color(0xFFF7F9FC),
                borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
            child: Row(children: [
              ...headers.map((h) => Expanded(child: Text(h,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)))),
              const SizedBox(width: 36),
            ]),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          ...rows.asMap().entries.map((e) => Padding(
              padding: const EdgeInsets.all(8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                ...keys.asMap().entries.map((kv) => Expanded(
                    child: Padding(padding: const EdgeInsets.only(right: 8),
                        child: TextField(
                          controller: e.value[kv.value], maxLines: null,
                          style: const TextStyle(fontSize: 12),
                          decoration: InputDecoration(
                            hintText: hints[kv.key],
                            hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 11),
                            filled: true, fillColor: const Color(0xFFF7F9FC),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                          ),
                        )))),
                GestureDetector(onTap: () => onRemove(e.key),
                    child: const Padding(padding: EdgeInsets.only(top: 10),
                        child: Icon(Icons.remove_circle_outline, size: 20, color: Color(0xFFE53E3E)))),
              ]))),
        ]),
      ),
      TextButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add member'),
          style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
    ]);
  }
}

// ─── Top-level helpers ────────────────────────────────────────────────────────

Widget _fLabel(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(t, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E))));

Widget _tField(TextEditingController c, {String hint = '', int maxLines = 1}) {
  return TextField(
    controller: c, maxLines: maxLines,
    style: const TextStyle(fontSize: 13),
    decoration: InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
      filled: true, fillColor: const Color(0xFFF7F9FC),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFACC2DF), width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    ),
  );
}

Widget _secTitle(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))));
