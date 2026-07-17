import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show LogicalKeyboardKey;
import 'package:google_fonts/google_fonts.dart';
import '../utils/input_formatters.dart';
import '../utils/date_parse.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';

class AddEventScreen extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onCreated;
  final Map<String, dynamic>? existingEvent; // null = create, non-null = edit

  const AddEventScreen({
    super.key,
    required this.onBack,
    required this.onCreated,
    this.existingEvent,
  });

  @override
  State<AddEventScreen> createState() => _AddEventScreenState();
}

class _AddEventScreenState extends State<AddEventScreen> {
  int _step = 0;
  final _pageController = PageController();
  bool _submitting = false;

  // True once the proposal has been explicitly submitted/saved or auto-saved,
  // so we don't create duplicate drafts on exit/logout/expiry.
  bool _persisted = false;
  AppState? _appState;

  bool get _isEditing => widget.existingEvent != null;

  final _stepTitles = const [
    'Proposal Brief',
    'Rationale & Objectives',
    'Methodology',
    'Activity Matrix',
    'Budget',
    'Monitoring & Evaluation',
  ];

  // Step 1
  late final TextEditingController _titleCtrl;
  late final TextEditingController _dateCtrl;
  late final TextEditingController _venueCtrl;
  late final TextEditingController _budgetCtrl;
  late final TextEditingController _fundCtrl;
  late final TextEditingController _focalNameCtrl;
  late final TextEditingController _focalRoleCtrl;
  late final TextEditingController _focalCpCtrl;
  late String _nature;
  late final TextEditingController _pCat1Ctrl;
  late final TextEditingController _pCat2Ctrl;
  int _tMale = 0, _tFemale = 0, _jMale = 0, _jFemale = 0;
  late final List<TextEditingController> _outputCtrls;

  // Step 2
  late final TextEditingController _rationaleCtrl;
  late final TextEditingController _objectivesCtrl;

  // Step 3
  late List<Map<String, TextEditingController>> _methodologyRows;

  // Step 4
  late List<Map<String, TextEditingController>> _matrixRows;

  // Step 5
  late List<Map<String, TextEditingController>> _matRows;
  late List<Map<String, TextEditingController>> _snackRows;
  late List<Map<String, TextEditingController>> _execRows;
  late List<Map<String, dynamic>> _twgGroups;

  // Step 6
  late final TextEditingController _meCtrl;
  late final TextEditingController _commentsCtrl;
  late List<Map<String, dynamic>> _indicators;
  late final List<Map<String, dynamic>> _signatoryRows;

  Map<String, dynamic> _newIndicator({String label = ''}) => {
    'label': TextEditingController(text: label),
  };

  Map<String, TextEditingController> _newPhase({String stage='',String activities=''}) => {
    'stage': TextEditingController(text: stage),
    'activities': TextEditingController(text: activities),
  };
  Map<String, TextEditingController> _newMatrix({String day='',String time='',String event='',String speaker=''}) => {
    'day': TextEditingController(text: day),
    'time': TextEditingController(text: time),
    'event': TextEditingController(text: event),
    'speaker': TextEditingController(text: speaker),
  };
  Map<String, TextEditingController> _newMat({String item='',String qty='',String cost='',String total=''}) => {
    'item': TextEditingController(text: item),
    'qty': TextEditingController(text: qty),
    'cost': TextEditingController(text: cost),
    'total': TextEditingController(text: total),
  };
  Map<String, TextEditingController> _newSnack({String item='',String pax='',String cost='',String total=''}) => {
    'item': TextEditingController(text: item),
    'pax': TextEditingController(text: pax),
    'cost': TextEditingController(text: cost),
    'total': TextEditingController(text: total),
  };
  Map<String, TextEditingController> _newExec({String name='',String position=''}) => {
    'name': TextEditingController(text: name),
    'position': TextEditingController(text: position),
  };
  Map<String, TextEditingController> _newMember({String name='',String designation='',String tor='',String output=''}) => {
    'name': TextEditingController(text: name),
    'designation': TextEditingController(text: designation),
    'tor': TextEditingController(text: tor),
    'output': TextEditingController(text: output),
  };

  @override
  void initState() {
    super.initState();
    // Register draft auto-save so a logout / token-expiry persists the work.
    _appState = context.read<AppState>();
    _appState?.registerDraftAutosave(_autoSaveDraft);

    final e = widget.existingEvent;

    // Step 1
    _titleCtrl     = TextEditingController(text: e?['title'] ?? '');
    _dateCtrl      = TextEditingController(text: e?['target_date'] ?? '');
    _venueCtrl     = TextEditingController(text: e?['venue'] ?? '');
    _budgetCtrl    = TextEditingController(text: e?['proposed_budget'] ?? '');
    _fundCtrl      = TextEditingController(text: e?['fund_source'] ?? '');
    _focalNameCtrl = TextEditingController(text: e?['focal_name'] ?? '');
    _focalRoleCtrl = TextEditingController(text: e?['focal_role'] ?? '');
    _focalCpCtrl   = TextEditingController(text: e?['focal_contact'] ?? '');
    _nature        = e?['nature'] ?? 'Co-curricular';

    // Parse participants
    String pCat1 = 'Teachers/Speakers';
    String pCat2 = 'Aspiring journalists';
    if (e?['participants'] != null) {
      try {
        final p = jsonDecode(e!['participants']) as Map<String, dynamic>;
        final rows = p['rows'] as List?;
        if (rows != null && rows.length >= 2) {
          pCat1    = (rows[0]['category'] ?? pCat1).toString();
          _tMale   = (rows[0]['male']   ?? 0) as int;
          _tFemale = (rows[0]['female'] ?? 0) as int;
          pCat2    = (rows[1]['category'] ?? pCat2).toString();
          _jMale   = (rows[1]['male']   ?? 0) as int;
          _jFemale = (rows[1]['female'] ?? 0) as int;
        } else {
          _tMale   = (p['teachers']?['male']    ?? 0) as int;
          _tFemale = (p['teachers']?['female']  ?? 0) as int;
          _jMale   = (p['journalists']?['male']   ?? 0) as int;
          _jFemale = (p['journalists']?['female'] ?? 0) as int;
        }
      } catch (_) {}
    }
    _pCat1Ctrl = TextEditingController(text: pCat1);
    _pCat2Ctrl = TextEditingController(text: pCat2);

    // Parse expected outputs
    List<String> outputs = ['', ''];
    if (e?['expected_outputs'] != null) {
      try {
        final decoded = jsonDecode(e!['expected_outputs']);
        if (decoded is List) outputs = List<String>.from(decoded);
      } catch (_) {}
    }
    _outputCtrls = outputs.map((t) => TextEditingController(text: t)).toList();
    if (_outputCtrls.isEmpty) {
      _outputCtrls.addAll([TextEditingController(), TextEditingController()]);
    }

    // Step 2
    _rationaleCtrl = TextEditingController(text: e?['rationale'] ?? '');
    String objText = '';
    if (e?['objectives'] != null) {
      final raw = e!['objectives'].toString();
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          // Legacy JSON-array format → join as newline-separated text
          objText = decoded.where((s) => s.toString().trim().isNotEmpty).join('\n');
        } else {
          objText = raw;
        }
      } catch (_) {
        objText = raw;
      }
    }
    _objectivesCtrl = TextEditingController(text: objText);

    // Step 3 - Methodology phases
    _methodologyRows = [];
    if (e?['phase1'] != null) {
      try {
        final decoded = jsonDecode(e!['phase1']);
        if (decoded is List && decoded.isNotEmpty) {
          _methodologyRows = decoded.map((r) => _newPhase(
            stage: (r['stage'] ?? '').toString(),
            activities: (r['activities'] ?? '').toString(),
          )).toList();
        }
      } catch (_) {}
    }
    if (_methodologyRows.isEmpty) {
      _methodologyRows = [
        _newPhase(stage: 'Pre-Implementation Stage', activities: (e?['phase1'] ?? 'Planning\nRecruitment of participants').toString()),
        _newPhase(stage: 'Implementation', activities: (e?['phase2'] ?? 'Training-workshop sessions').toString()),
        _newPhase(stage: 'Post-Implementation', activities: (e?['phase3'] ?? 'Selection of school paper staff\nEvaluation of the activity').toString()),
      ];
    }

    // Step 4 - Activity matrix
    _matrixRows = [];
    if (e?['activity_matrix'] != null) {
      try {
        final decoded = jsonDecode(e!['activity_matrix']);
        if (decoded is List && decoded.isNotEmpty) {
          _matrixRows = decoded.map((r) => _newMatrix(
            day: r['day'] ?? '', time: r['time'] ?? '',
            event: r['event'] ?? '', speaker: r['speaker'] ?? '',
          )).toList();
        }
      } catch (_) {}
    }
    if (_matrixRows.isEmpty) _matrixRows = List.generate(3, (_) => _newMatrix());

    // Step 5 - Budget
    _matRows = [];
    if (e?['training_materials'] != null) {
      try {
        final decoded = jsonDecode(e!['training_materials']);
        if (decoded is List && decoded.isNotEmpty) {
          _matRows = decoded.map((r) => _newMat(
            item: r['item'] ?? '', qty: r['qty'] ?? '',
            cost: r['cost'] ?? '', total: r['total'] ?? '',
          )).toList();
        }
      } catch (_) {}
    }
    if (_matRows.isEmpty) _matRows = List.generate(2, (_) => _newMat());

    _snackRows = [];
    if (e?['snacks'] != null) {
      try {
        final decoded = jsonDecode(e!['snacks']);
        if (decoded is List && decoded.isNotEmpty) {
          _snackRows = decoded.map((r) => _newSnack(
            item: r['item'] ?? '', pax: r['pax'] ?? '',
            cost: r['cost'] ?? '', total: r['total'] ?? '',
          )).toList();
        }
      } catch (_) {}
    }
    if (_snackRows.isEmpty) _snackRows = List.generate(1, (_) => _newSnack());

    _execRows = [];
    if (e?['exec_committee'] != null) {
      try {
        final decoded = jsonDecode(e!['exec_committee']);
        if (decoded is List && decoded.isNotEmpty) {
          _execRows = decoded.map((r) => _newExec(
            name: r['name'] ?? '', position: r['position'] ?? '',
          )).toList();
        }
      } catch (_) {}
    }
    if (_execRows.isEmpty) _execRows = List.generate(2, (_) => _newExec());

    // TWG groups
    _twgGroups = [];
    if (e?['twg_groups'] != null) {
      try {
        final decoded = jsonDecode(e!['twg_groups']);
        if (decoded is List && decoded.isNotEmpty) {
          for (final g in decoded) {
            final members = <Map<String, TextEditingController>>[];
            if (g['members'] is List) {
              for (final m in g['members']) {
                members.add(_newMember(
                  name: m['name'] ?? '', designation: m['designation'] ?? '',
                  tor: m['tor'] ?? '', output: m['output'] ?? '',
                ));
              }
            }
            if (members.isEmpty) members.add(_newMember());
            _twgGroups.add({
              'title': TextEditingController(text: g['title'] ?? ''),
              'members': members,
            });
          }
        }
      } catch (_) {}
    }
    if (_twgGroups.isEmpty) {
      _twgGroups = [
        {'title': TextEditingController(text: 'Supervising Committee'),    'members': <Map<String, TextEditingController>>[_newMember()]},
        {'title': TextEditingController(text: 'Program Implementation Committee'), 'members': <Map<String, TextEditingController>>[_newMember()]},
      ];
    }

    // Step 6
    _meCtrl       = TextEditingController(text: e?['monitoring_criteria'] ?? '');
    _commentsCtrl = TextEditingController(text: e?['comments'] ?? '');

    // Indicators
    _indicators = [];
    if (e?['indicators'] != null) {
      try {
        final decoded = jsonDecode(e!['indicators']);
        if (decoded is List && decoded.isNotEmpty) {
          _indicators = decoded.map((d) => _newIndicator(
            label: (d['label'] ?? '').toString(),
          )).toList();
        }
      } catch (_) {}
    }
    if (_indicators.isEmpty) _indicators = [_newIndicator()];

    // Signatories (stored in comments field as JSON)
    final sigDefaults = [
      {'role': 'Noted',                   'name': '', 'title': 'School Principal'},
      {'role': 'Endorsed',                'name': '', 'title': 'Public Schools District Supervisor'},
      {'role': 'Recommending Approval',   'name': '', 'title': 'Assistant Schools Division Superintendent'},
      {'role': 'Approved',                'name': '', 'title': 'Schools Division Superintendent'},
    ];
    if (e?['comments'] != null) {
      try {
        final dec = jsonDecode(e!['comments'].toString());
        if (dec is Map && dec['signatories'] is List) {
          final list = dec['signatories'] as List;
          for (int i = 0; i < sigDefaults.length && i < list.length; i++) {
            sigDefaults[i]['name']  = (list[i]['name']  ?? '').toString();
            sigDefaults[i]['title'] = (list[i]['title'] ?? sigDefaults[i]['title']).toString();
          }
        }
      } catch (_) {}
    }
    _signatoryRows = sigDefaults.map((d) => <String, dynamic>{
      'role':  d['role'],
      'name':  TextEditingController(text: d['name']),
      'title': TextEditingController(text: d['title']),
    }).toList();
  }

  @override
  void dispose() {
    // Auto-save as draft on exit (navigating away / closing the screen).
    // Build the payload synchronously here — before the controllers below are
    // disposed — then fire the request without awaiting.
    if (!_persisted && _canSaveAsDraft && _titleCtrl.text.trim().isNotEmpty) {
      _persisted = true;
      final payload = _buildPayload()..['status'] = 'draft';
      if (_isEditing) {
        ApiService.updateEvent(widget.existingEvent!['id'] as int, payload);
      } else {
        ApiService.createEvent(payload);
      }
    }
    _appState?.unregisterDraftAutosave(_autoSaveDraft);

    _titleCtrl.dispose(); _dateCtrl.dispose(); _venueCtrl.dispose();
    _budgetCtrl.dispose(); _fundCtrl.dispose(); _focalNameCtrl.dispose();
    _focalRoleCtrl.dispose(); _focalCpCtrl.dispose();
    _rationaleCtrl.dispose();
    _objectivesCtrl.dispose();
    _meCtrl.dispose(); _commentsCtrl.dispose();
    for (final s in _signatoryRows) {
      (s['name'] as TextEditingController).dispose();
      (s['title'] as TextEditingController).dispose();
    }
    _pCat1Ctrl.dispose(); _pCat2Ctrl.dispose();
    for (final c in _outputCtrls) {
      c.dispose();
    }
    for (final ind in _indicators) {
      (ind['label'] as TextEditingController).dispose();
    }
    for (final row in _methodologyRows) {
      row['stage']!.dispose();
      row['activities']!.dispose();
    }
    super.dispose();
  }

  void _goTo(int s) {
    setState(() => _step = s);
    _pageController.animateToPage(s,
        duration: const Duration(milliseconds: 220), curve: Curves.easeInOut);
  }

  /// Returns the step index and a message for the first unanswered required
  /// field, or null if every field across all steps has been filled in.
  (int, String)? _firstEmptyField() {
    // Step 1 - Proposal Brief
    if (_titleCtrl.text.trim().isEmpty) return (0, 'Please enter the event title.');
    if (_dateCtrl.text.trim().isEmpty) return (0, 'Please enter the target date.');
    if (_venueCtrl.text.trim().isEmpty) return (0, 'Please enter the proposed venue.');
    if (_pCat1Ctrl.text.trim().isEmpty) return (0, 'Please name the first target participant category.');
    if (_pCat2Ctrl.text.trim().isEmpty) return (0, 'Please name the second target participant category.');
    for (var i = 0; i < _outputCtrls.length; i++) {
      if (_outputCtrls[i].text.trim().isEmpty) return (0, 'Please fill in expected output #${i + 1}.');
    }
    if (_budgetCtrl.text.trim().isEmpty) return (0, 'Please enter the proposed budget.');
    if (_fundCtrl.text.trim().isEmpty) return (0, 'Please enter the source of fund.');
    if (_focalNameCtrl.text.trim().isEmpty) return (0, "Please enter the focal person's name.");
    if (_focalRoleCtrl.text.trim().isEmpty) return (0, "Please enter the focal person's designation.");
    if (_focalCpCtrl.text.trim().isEmpty) return (0, "Please enter the focal person's contact number.");

    // Step 2 - Rationale & Objectives
    if (_rationaleCtrl.text.trim().isEmpty) return (1, 'Please provide the rationale.');
    if (_objectivesCtrl.text.trim().isEmpty) return (1, 'Please provide the objectives.');

    // Step 3 - Methodology
    for (var i = 0; i < _methodologyRows.length; i++) {
      final row = _methodologyRows[i];
      if (row['stage']!.text.trim().isEmpty) return (2, 'Please fill in the stage for Phase ${i + 1}.');
      if (row['activities']!.text.trim().isEmpty) return (2, 'Please fill in the activities for Phase ${i + 1}.');
    }

    // Step 4 - Activity Matrix
    for (var i = 0; i < _matrixRows.length; i++) {
      final row = _matrixRows[i];
      if (row['day']!.text.trim().isEmpty) return (3, 'Please fill in the day for activity matrix row ${i + 1}.');
      if (row['time']!.text.trim().isEmpty) return (3, 'Please fill in the time for activity matrix row ${i + 1}.');
      if (row['event']!.text.trim().isEmpty) return (3, 'Please fill in the event for activity matrix row ${i + 1}.');
      if (row['speaker']!.text.trim().isEmpty) return (3, 'Please fill in the speaker for activity matrix row ${i + 1}.');
    }

    // Step 5 - Budget
    for (var i = 0; i < _matRows.length; i++) {
      final row = _matRows[i];
      if (row['item']!.text.trim().isEmpty) return (4, 'Please fill in the item for training material row ${i + 1}.');
      if (row['qty']!.text.trim().isEmpty) return (4, 'Please fill in the quantity for training material row ${i + 1}.');
      if (row['cost']!.text.trim().isEmpty) return (4, 'Please fill in the cost for training material row ${i + 1}.');
      if (row['total']!.text.trim().isEmpty) return (4, 'Please fill in the total for training material row ${i + 1}.');
    }
    for (var i = 0; i < _snackRows.length; i++) {
      final row = _snackRows[i];
      if (row['item']!.text.trim().isEmpty) return (4, 'Please fill in the item for snack row ${i + 1}.');
      if (row['pax']!.text.trim().isEmpty) return (4, 'Please fill in the pax for snack row ${i + 1}.');
      if (row['cost']!.text.trim().isEmpty) return (4, 'Please fill in the cost for snack row ${i + 1}.');
      if (row['total']!.text.trim().isEmpty) return (4, 'Please fill in the total for snack row ${i + 1}.');
    }
    for (var i = 0; i < _execRows.length; i++) {
      final row = _execRows[i];
      if (row['name']!.text.trim().isEmpty) return (4, 'Please fill in the name for executive committee member ${i + 1}.');
      if (row['position']!.text.trim().isEmpty) return (4, 'Please fill in the position for executive committee member ${i + 1}.');
    }
    for (var i = 0; i < _twgGroups.length; i++) {
      final group = _twgGroups[i];
      final title = group['title'] as TextEditingController;
      if (title.text.trim().isEmpty) return (4, 'Please name TWG group ${i + 1}.');
      final members = group['members'] as List<Map<String, TextEditingController>>;
      for (var j = 0; j < members.length; j++) {
        final m = members[j];
        if (m['name']!.text.trim().isEmpty) return (4, 'Please fill in the name for ${title.text} member ${j + 1}.');
        if (m['designation']!.text.trim().isEmpty) return (4, 'Please fill in the designation for ${title.text} member ${j + 1}.');
        if (m['tor']!.text.trim().isEmpty) return (4, 'Please fill in the terms of reference for ${title.text} member ${j + 1}.');
        if (m['output']!.text.trim().isEmpty) return (4, 'Please fill in the output for ${title.text} member ${j + 1}.');
      }
    }

    // Step 6 - Monitoring & Evaluation
    if (_meCtrl.text.trim().isEmpty) return (5, 'Please provide the monitoring instructions / evaluation criteria.');
    for (var i = 0; i < _indicators.length; i++) {
      final ind = _indicators[i];
      if ((ind['label'] as TextEditingController).text.trim().isEmpty) return (5, 'Please fill in indicator #${i + 1}.');
    }

    return null;
  }

  Map<String, dynamic> _buildPayload() {
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
      'label': (ind['label'] as TextEditingController).text,
    }).toList();

    final payload = {
      'title':              _titleCtrl.text,
      'nature':             _nature,
      'target_date':        _dateCtrl.text,
      'venue':              _venueCtrl.text,
      'proposed_budget':    _budgetCtrl.text,
      'fund_source':        _fundCtrl.text,
      'focal_name':         _focalNameCtrl.text,
      'focal_role':         _focalRoleCtrl.text,
      'focal_contact':      _focalCpCtrl.text,
      'expected_outputs':   jsonEncode(_outputCtrls.map((c) => c.text).toList()),
      'participants': jsonEncode({
        'rows': [
          {'category': _pCat1Ctrl.text, 'male': _tMale, 'female': _tFemale, 'total': _tMale + _tFemale},
          {'category': _pCat2Ctrl.text, 'male': _jMale, 'female': _jFemale, 'total': _jMale + _jFemale},
        ],
        'totals': {
          'male': _tMale + _jMale,
          'female': _tFemale + _jFemale,
          'total': _tMale + _tFemale + _jMale + _jFemale,
        },
      }),
      'rationale':           _rationaleCtrl.text,
      'objectives':          _objectivesCtrl.text,
      'phase1':              jsonEncode(_methodologyRows.map((r) => {
        'stage': r['stage']!.text, 'activities': r['activities']!.text,
      }).toList()),
      'phase2':              '',
      'phase3':              '',
      'activity_matrix':     jsonEncode(matrixData),
      'training_materials':  jsonEncode(matData),
      'snacks':              jsonEncode(snackData),
      'exec_committee':      jsonEncode(execData),
      'twg_groups':          jsonEncode(twgData),
      'monitoring_criteria': _meCtrl.text,
      'indicators':          jsonEncode(indicatorData),
      'comments':            jsonEncode({
        'signatories': _signatoryRows.map((s) => {
          'role':  s['role'],
          'name':  (s['name']  as TextEditingController).text,
          'title': (s['title'] as TextEditingController).text,
        }).toList(),
      }),
    };

    return payload;
  }

  /// Whether the event being edited (if any) can still be saved as a draft.
  /// Approved/disabled proposals shouldn't be silently demoted back to draft.
  bool get _canSaveAsDraft {
    final status = widget.existingEvent?['status'] as String?;
    return status == null || status == 'draft' || status == 'pending_approval';
  }

  /// Persists the current form as a draft. Invoked by the AppState auto-save
  /// hook on logout / token-expiry. Guarded so it saves at most once and only
  /// when there is meaningful, still-draftable content.
  Future<void> _autoSaveDraft() async {
    if (_persisted || !_canSaveAsDraft) return;
    if (_titleCtrl.text.trim().isEmpty) return; // nothing worth saving
    _persisted = true;
    final payload = _buildPayload();
    payload['status'] = 'draft';
    try {
      if (_isEditing) {
        await ApiService.updateEvent(widget.existingEvent!['id'] as int, payload);
      } else {
        await ApiService.createEvent(payload);
      }
    } catch (_) {
      _persisted = false; // let a later trigger retry
    }
  }

  Future<void> _submit({bool asDraft = false}) async {
    if (!asDraft) {
      final issue = _firstEmptyField();
      if (issue != null) {
        final (step, message) = issue;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: const Color(0xFFE53E3E)),
        );
        _goTo(step);
        return;
      }
    }
    setState(() => _submitting = true);

    final payload = _buildPayload();
    payload['status'] = asDraft ? 'draft' : 'pending_approval';

    try {
      dynamic result;
      if (_isEditing) {
        result = await ApiService.updateEvent(widget.existingEvent!['id'] as int, payload);
      } else {
        result = await ApiService.createEvent(payload);
      }
      if (result != null) _persisted = true;
      if (!mounted) return;
      if (result != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(asDraft
                ? 'Saved as draft.'
                : _isEditing
                    ? 'Event updated successfully!'
                    : 'Event proposal submitted for approval!'),
            backgroundColor: const Color(0xFF48BB78),
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
            Text(_isEditing ? 'Edit Event' : 'Add New Event',
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
              Row(
                children: [
                  if (_canSaveAsDraft) ...[
                    SizedBox(
                      width: 140, height: 44,
                      child: OutlinedButton(
                        onPressed: _submitting ? null : () => _submit(asDraft: true),
                        style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF1E2126),
                            side: const BorderSide(color: Color(0xFFACC2DF)),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8))),
                        child: const Text('Save as Draft'),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
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
                              : _isEditing ? 'Save Changes' : 'Submit Proposal'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // Target date is picked from a calendar and stored month-in-words
  // ("October 1, 2026") so viewing shows it directly and the calendar parses it.
  static const _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  String _fmtLongDate(DateTime d) => '${_monthNames[d.month - 1]} ${d.day}, ${d.year}';

  Future<void> _pickTargetDate() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final parsed = parseEventDate(_dateCtrl.text) ?? today;
    // A proposal can't target a date that has already passed — start no earlier
    // than today (the backend re-checks this and any same-day conflict).
    final initial = parsed.isBefore(today) ? today : parsed;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: today,
      lastDate: DateTime(now.year + 5),
    );
    if (picked != null) {
      setState(() => _dateCtrl.text = _fmtLongDate(picked));
    }
  }

  Widget _buildDateField() {
    return TextField(
      controller: _dateCtrl,
      readOnly: true,
      onTap: _pickTargetDate,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        hintText: 'Select target date',
        hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
        filled: true, fillColor: const Color(0xFFF7F9FC),
        suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18, color: Color(0xFF718096)),
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

  // ── Step 1 ────────────────────────────────────────────────────────────────
  Widget _buildProposalBrief() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
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
                _buildDateField(),
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
                            child: Text(h, textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12))))
                        .toList(),
                  ),
                  _paxRow(_pCat1Ctrl, _tMale, _tFemale, 'tm', 'tf'),
                  _paxRow(_pCat2Ctrl, _jMale, _jFemale, 'jm', 'jf'),
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
                    Text('${e.key + 1}. ', style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
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
              Expanded(child: _tField(_focalNameCtrl, hint: 'Full name', titleCase: true)),
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

  // ── Step 2 ────────────────────────────────────────────────────────────────
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
            const Text(
              'Enter each objective on a new line. They will be numbered automatically in the printed proposal.',
              style: TextStyle(fontSize: 13, color: Color(0xFF4A5568)),
            ),
            const SizedBox(height: 12),
            _tField(_objectivesCtrl,
                hint: 'equip young journalists with the basics of writing...\nproduce various journalistic articles...\nchoose the campus journalists who will compete...',
                maxLines: 8),
          ],
        ),
      ),
    );
  }

  // ── Step 3 ────────────────────────────────────────────────────────────────
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
              "The training shall be composed of lectures, video clip viewing, sharing and games. 5E's approach shall be utilized for most of the sessions.",
              style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 20),
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
                  child: const Row(children: [
                    Expanded(flex: 1, child: Text('Phase', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    Expanded(flex: 2, child: Text('Stage', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    Expanded(flex: 3, child: Text('Activities', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                    SizedBox(width: 36),
                  ]),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                ..._methodologyRows.asMap().entries.map((e) => Column(children: [
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Expanded(flex: 1, child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                              child: Text('Phase ${e.key + 1}',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)))),
                          const SizedBox(width: 8),
                          Expanded(flex: 2, child: TextField(
                            controller: e.value['stage'], maxLines: null,
                            style: const TextStyle(fontSize: 13),
                            decoration: InputDecoration(
                              filled: true, fillColor: const Color(0xFFF7F9FC),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                              contentPadding: const EdgeInsets.all(10)),
                          )),
                          const SizedBox(width: 8),
                          Expanded(flex: 3, child: TextField(
                            controller: e.value['activities'], maxLines: null,
                            style: const TextStyle(fontSize: 13),
                            decoration: InputDecoration(
                              filled: true, fillColor: const Color(0xFFF7F9FC),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                              contentPadding: const EdgeInsets.all(10)),
                          )),
                          const SizedBox(width: 8),
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: GestureDetector(
                              onTap: () => setState(() => _methodologyRows.removeAt(e.key)),
                              child: const Icon(Icons.remove_circle_outline, size: 20, color: Color(0xFFE53E3E)),
                            ),
                          ),
                        ]),
                      ),
                      if (e.key < _methodologyRows.length - 1)
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                    ])),
              ]),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
                onPressed: () => setState(() => _methodologyRows.add(_newPhase())),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add phase'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
          ],
        ),
      ),
    );
  }

  // ── Step 4 ────────────────────────────────────────────────────────────────
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
                  child: const Row(children: [
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

  // ── Step 5 ────────────────────────────────────────────────────────────────
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
            const Text('Charged against School Paper Fund/SPTA Fund subject to usual accounting and auditing rules.',
                style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 20),
            const Text('a. Training Materials', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            _budgetTable(
              headers: ['Particulars', 'Quantity', 'Cost', 'Total'],
              rows: _matRows, keys: ['item', 'qty', 'cost', 'total'],
              hints: ['Bond paper...', '1 ream', '270.00', '270.00'],
              onAdd: () => setState(() => _matRows.add(_newMat())),
              onRemove: (i) => setState(() => _matRows.removeAt(i)),
            ),
            const SizedBox(height: 20),
            const Text('b. Snacks for Program Partners', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
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
            const Text('a. Executive Committee', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            _committeeTable(
              rows: _execRows, headers: ['Name', 'Position'],
              keys: ['name', 'position'],
              hints: ['e.g. FREDERICK M. BALDOZA', 'e.g. Principal'],
              onAdd: () => setState(() => _execRows.add(_newExec())),
              onRemove: (i) => setState(() => _execRows.removeAt(i)),
            ),
            const SizedBox(height: 24),
            const Text('b. Technical Working Group', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
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

  // ── Step 6 ────────────────────────────────────────────────────────────────
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
            _tField(_meCtrl, hint: 'Add specific monitoring instructions or evaluation criteria...', maxLines: 6),
            const SizedBox(height: 28),
            _secTitle('Observation Tool Indicators'),
            const Text(
                'List the indicators to be observed. The Evident / Not Evident columns will be filled in on the printed evaluation form.',
                style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8)),
              child: Column(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: const BoxDecoration(
                      color: Color(0xFFF7F9FC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
                  child: const Row(children: [
                    Text('#', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF718096))),
                    SizedBox(width: 12),
                    Expanded(child: Text('Indicator Description', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  ]),
                ),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                ..._indicators.asMap().entries.map((e) => Column(children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                          Text('${e.key + 1}. ', style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
                          const SizedBox(width: 6),
                          Expanded(child: TextField(
                            controller: e.value['label'] as TextEditingController,
                            style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
                            decoration: const InputDecoration(
                              isDense: true,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              hintText: 'Describe what will be observed...',
                              hintStyle: TextStyle(color: Color(0xFFAAAAAA), fontSize: 12),
                            ),
                          )),
                          if (_indicators.length > 1) ...[
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () => setState(() => _indicators.removeAt(e.key)),
                              child: const Icon(Icons.remove_circle_outline, size: 20, color: Color(0xFFE53E3E)),
                            ),
                          ],
                        ]),
                      ),
                      if (e.key < _indicators.length - 1)
                        const Divider(height: 1, color: Color(0xFFE2E8F0)),
                    ])),
              ]),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
                onPressed: () => setState(() => _indicators.add(_newIndicator())),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add indicator'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF63B3ED))),
            const SizedBox(height: 32),
            _secTitle('Signatories'),
            const Text(
                'Enter the names and positions of the signatories. These will appear in the printed proposal.',
                style: TextStyle(fontSize: 13, color: Color(0xFF4A5568))),
            const SizedBox(height: 16),
            ..._signatoryRows.map((s) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(s['role'] as String,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF718096))),
                const SizedBox(height: 6),
                Row(children: [
                  Expanded(child: _tField(s['name'] as TextEditingController, hint: 'Full name (e.g. Juan D. Cruz)', titleCase: true)),
                  const SizedBox(width: 10),
                  Expanded(child: _tField(s['title'] as TextEditingController, hint: 'Position/Title')),
                ]),
              ]),
            )),
          ],
        ),
      ),
    );
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  TableRow _paxRow(TextEditingController labelCtrl, int male, int female, String mk, String fk) {
    return TableRow(children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: TextField(
            controller: labelCtrl,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(fontSize: 13),
            decoration: const InputDecoration(
              isDense: true,
              border: InputBorder.none,
              hintText: 'Category',
            ),
          )),
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
            if (key == 'tm') {
              _tMale = n;
            } else if (key == 'tf') _tFemale = n;
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

Widget _tField(TextEditingController c, {String hint = '', int maxLines = 1, bool titleCase = false}) {
  final field = TextField(
    controller: c, maxLines: maxLines,
    inputFormatters: titleCase ? const [TitleCaseTextInputFormatter()] : null,
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
  if (maxLines <= 1) return field;
  return CallbackShortcuts(
    bindings: {
      const SingleActivator(LogicalKeyboardKey.tab): () {
        final sel = c.selection;
        if (!sel.isValid) return;
        final text = c.text;
        final newText = text.replaceRange(sel.start, sel.end, '    ');
        c.value = TextEditingValue(
          text: newText,
          selection: TextSelection.collapsed(offset: sel.start + 4),
        );
      },
    },
    child: field,
  );
}

Widget _secTitle(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))));