part of 'event_management_screen.dart';

class _CubePatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final topPaint   = Paint()..color = Colors.white.withValues(alpha: 0.07)..style = PaintingStyle.fill;
    final leftPaint  = Paint()..color = Colors.white.withValues(alpha: 0.04)..style = PaintingStyle.fill;
    final rightPaint = Paint()..color = Colors.white.withValues(alpha: 0.02)..style = PaintingStyle.fill;
    final stroke     = Paint()..color = Colors.white.withValues(alpha: 0.06)..style = PaintingStyle.stroke..strokeWidth = 0.5;
    const double w = 40.0, h = 22.0;
    for (double row = -1; row < size.height / h + 2; row++) {
      for (double col = -1; col < size.width / w + 2; col++) {
        final ox = col * w + (row % 2 == 0 ? 0 : w / 2);
        final oy = row * h * 0.75;
        _drawCube(canvas, Offset(ox, oy), w, h, topPaint, leftPaint, rightPaint, stroke);
      }
    }
  }
  void _drawCube(Canvas canvas, Offset o, double w, double h,
      Paint top, Paint left, Paint right, Paint stroke) {
    final cx = o.dx + w / 2, cy = o.dy;
    final tp = Path()..moveTo(cx, cy)..lineTo(cx + w/2, cy + h/2)..lineTo(cx, cy + h)..lineTo(cx - w/2, cy + h/2)..close();
    canvas.drawPath(tp, top); canvas.drawPath(tp, stroke);
    final lp = Path()..moveTo(cx - w/2, cy + h/2)..lineTo(cx, cy + h)..lineTo(cx, cy + h*1.6)..lineTo(cx - w/2, cy + h*1.1)..close();
    canvas.drawPath(lp, left); canvas.drawPath(lp, stroke);
    final rp = Path()..moveTo(cx + w/2, cy + h/2)..lineTo(cx, cy + h)..lineTo(cx, cy + h*1.6)..lineTo(cx + w/2, cy + h*1.1)..close();
    canvas.drawPath(rp, right); canvas.drawPath(rp, stroke);
  }
  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

class _Tab extends StatelessWidget {
  final String label; final bool active; final VoidCallback onTap;
  const _Tab({required this.label, required this.active, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF1E2126) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: active ? const Color(0xFF1E2126) : const Color(0xFFDDE3ED)),
        ),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
            color: active ? Colors.white : const Color(0xFF4A5568))),
      ),
    );
  }
}

// ─── Event Detail Sheet ───────────────────────────────────────────────────────

void _showEventDetail(BuildContext context, _CalEvent event, {
  bool canApprove = false, bool canManage = false, bool isPrincipal = false,
  VoidCallback? onApprove, VoidCallback? onDisable,
}) {
  Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => _EventDetailPage(
      event: event,
      canApprove: canApprove,
      isPrincipal: isPrincipal,
      onApprove: onApprove,
      onDisable: onDisable,
    ),
  ));
}

class _EventDetailPage extends StatelessWidget {
  final _CalEvent event;
  final bool canApprove;
  final bool isPrincipal;
  final VoidCallback? onApprove;
  final VoidCallback? onDisable;
  const _EventDetailPage({
    required this.event,
    this.canApprove = false,
    this.isPrincipal = false,
    this.onApprove,
    this.onDisable,
  });

  @override
  Widget build(BuildContext context) {
    final raw = event.raw;
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: const Color(0xFF1A1A2E),
        titleSpacing: 0,
        title: Text(event.title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(child: _StatusBadge(status: event.status)),
          ),
        ],
      ),
      body: ListView(
              padding: const EdgeInsets.fromLTRB(24, 18, 24, 32),
              children: [
                // Creator & date meta
                if (event.creatorName.isNotEmpty)
                  _PropMeta(Icons.person_outline, 'Proposed by ${event.creatorName}'),
                if ((raw['target_date'] ?? '').toString().isNotEmpty)
                  _PropMeta(Icons.calendar_today_outlined, raw['target_date'].toString()),
                const SizedBox(height: 16),

                // I. Proposal Brief
                _ProposalSection(title: 'I. Proposal Brief', children: [
                  _PropField('Nature', raw['nature']),
                  _PropField('Venue', raw['venue']),
                  _PropField('Proposed Budget', raw['proposed_budget']),
                  _PropField('Fund Source', raw['fund_source']),
                  if (_notEmpty(raw['focal_name'])) ...[
                    const SizedBox(height: 6),
                    const Text('Focal Person',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                    const SizedBox(height: 4),
                    _PropField('Name', raw['focal_name']),
                    _PropField('Role', raw['focal_role']),
                    _PropField('Contact', raw['focal_contact']),
                  ],
                  if (_notEmpty(raw['expected_outputs'])) ...[
                    const SizedBox(height: 6),
                    const Text('Expected Outputs',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF718096))),
                    const SizedBox(height: 2),
                    _buildOutputs(raw['expected_outputs'].toString()),
                  ],
                  if (_notEmpty(raw['participants'])) ...[
                    const SizedBox(height: 6),
                    _buildParticipantsWidget(raw['participants'].toString()),
                  ],
                ]),

                // II. Rationale
                if (_notEmpty(raw['rationale']))
                  _ProposalSection(title: 'II. Rationale', children: [
                    _PropBody(raw['rationale'].toString()),
                  ]),

                // III. Objectives
                if (_notEmpty(raw['objectives']))
                  _ProposalSection(title: 'III. Objectives', children: [
                    _PropBullets(raw['objectives'].toString()),
                  ]),

                // IV. Methodology
                if (_notEmpty(raw['phase1']) || _notEmpty(raw['phase2']) || _notEmpty(raw['phase3']))
                  _ProposalSection(title: 'IV. Methodology / Work Plan', children: [
                    _buildMethodology(raw['phase1'].toString()),
                    if (_notEmpty(raw['phase2'])) _PropField('Phase 2', raw['phase2']),
                    if (_notEmpty(raw['phase3'])) _PropField('Phase 3', raw['phase3']),
                  ]),

                // V. Activity Matrix
                if (_notEmpty(raw['activity_matrix']))
                  _ProposalSection(title: 'V. Activity Matrix', children: [
                    _buildActivityMatrix(raw['activity_matrix'].toString()),
                  ]),

                // VI. Budget
                if (_notEmpty(raw['training_materials']) || _notEmpty(raw['snacks']))
                  _ProposalSection(title: 'VI. Budget', children: [
                    if (_notEmpty(raw['training_materials'])) ...[
                      const Text('Training Materials',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildBudgetTable(raw['training_materials'].toString(),
                          [('item', 'Item'), ('qty', 'Qty'), ('cost', 'Cost'), ('total', 'Total')]),
                    ],
                    if (_notEmpty(raw['snacks'])) ...[
                      const SizedBox(height: 12),
                      const Text('Meals / Snacks',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildBudgetTable(raw['snacks'].toString(),
                          [('item', 'Item'), ('pax', 'Participants'), ('cost', 'Cost/Day'), ('total', 'Total')]),
                    ],
                  ]),

                // VII. Committees
                if (_notEmpty(raw['exec_committee']) || _notEmpty(raw['twg_groups']))
                  _ProposalSection(title: 'VII. Committees', children: [
                    if (_notEmpty(raw['exec_committee'])) ...[
                      const Text('Executive Committee',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildCommitteeList(raw['exec_committee'].toString()),
                    ],
                    if (_notEmpty(raw['twg_groups'])) ...[
                      const SizedBox(height: 12),
                      const Text('Technical Working Groups',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
                      const SizedBox(height: 6),
                      _buildTwgGroups(raw['twg_groups'].toString()),
                    ],
                  ]),

                // VIII. Monitoring & Evaluation
                if (_notEmpty(raw['monitoring_criteria']) || _notEmpty(raw['indicators']))
                  _ProposalSection(title: 'VIII. Monitoring & Evaluation', children: [
                    if (_notEmpty(raw['monitoring_criteria']))
                      _PropBody(raw['monitoring_criteria'].toString()),
                    if (_notEmpty(raw['indicators'])) ...[
                      const Text('Indicators',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF718096))),
                      const SizedBox(height: 4),
                      _buildIndicators(raw['indicators'].toString()),
                    ],
                  ]),

                // Signatories (stored in the comments field as JSON)
                if (_notEmpty(raw['comments']))
                  _ProposalSection(title: 'Signatories', children: [
                    _buildSignatories(raw['comments'].toString()),
                  ]),

                // Action buttons — principal approving/rejecting pending events
                if (canApprove && event.status == _EventStatus.pendingApproval) ...[
                  const SizedBox(height: 20),
                  SizedBox(width: double.infinity, height: 44,
                    child: ElevatedButton(
                      onPressed: () { Navigator.pop(context); onApprove?.call(); },
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF48BB78),
                          foregroundColor: Colors.white, elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                      child: const Text('Approve Event',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                  ),
                ],
                if (isPrincipal && event.status == _EventStatus.pendingApproval) ...[
                  const SizedBox(height: 10),
                  SizedBox(width: double.infinity, height: 44,
                    child: OutlinedButton(
                      onPressed: () { Navigator.pop(context); onDisable?.call(); },
                      style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFE53E3E),
                          side: const BorderSide(color: Color(0xFFE53E3E)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                      child: const Text('Disable Event',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

// ── Detail helpers ────────────────────────────────────────────────────────────

bool _notEmpty(dynamic v) => v != null && v.toString().trim().isNotEmpty;

Widget _buildParticipantsWidget(String raw) {
  try {
    final data = jsonDecode(raw) as Map<String, dynamic>;
    final rows  = (data['rows'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final tots  = data['totals'] as Map<String, dynamic>?;
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Target Participants',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF4A5568))),
      const SizedBox(height: 6),
      Table(
        border: TableBorder.all(color: const Color(0xFFDDE3ED), width: 0.8),
        columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(1), 2: FlexColumnWidth(1), 3: FlexColumnWidth(1)},
        children: [
          TableRow(decoration: const BoxDecoration(color: Color(0xFFF8F9FA)), children: [
            _tc('Category', bold: true), _tc('M', bold: true), _tc('F', bold: true), _tc('Total', bold: true),
          ]),
          for (final r in rows)
            TableRow(children: [
              _tc(r['category']?.toString() ?? ''),
              _tc(r['male']?.toString() ?? ''),
              _tc(r['female']?.toString() ?? ''),
              _tc(r['total']?.toString() ?? ''),
            ]),
          if (tots != null)
            TableRow(decoration: const BoxDecoration(color: Color(0xFFF0F4FF)), children: [
              _tc('TOTAL', bold: true),
              _tc(tots['male']?.toString() ?? '', bold: true),
              _tc(tots['female']?.toString() ?? '', bold: true),
              _tc(tots['total']?.toString() ?? '', bold: true),
            ]),
        ],
      ),
    ]);
  } catch (_) {
    return _PropField('Participants', raw);
  }
}

Widget _buildActivityMatrix(String raw) {
  try {
    final rows = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return const SizedBox.shrink();
    return Table(
      border: TableBorder.all(color: const Color(0xFFDDE3ED), width: 0.8),
      columnWidths: const {0: FixedColumnWidth(56), 1: FixedColumnWidth(72), 2: FlexColumnWidth(2), 3: FlexColumnWidth(2)},
      children: [
        TableRow(decoration: const BoxDecoration(color: Color(0xFFF8F9FA)), children: [
          _tc('Day', bold: true), _tc('Time', bold: true), _tc('Activity', bold: true), _tc('Speaker/Facilitator', bold: true),
        ]),
        for (final r in rows)
          TableRow(children: [
            _tc(r['day']?.toString() ?? ''),
            _tc(r['time']?.toString() ?? ''),
            _tc(r['event']?.toString() ?? ''),
            _tc(r['speaker']?.toString() ?? ''),
          ]),
      ],
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

// columns: list of (dataKey, headerLabel). Decoupling the two lets the same
// data key (e.g. 'cost') carry a different header per table (Cost vs Cost/Day).
Widget _buildBudgetTable(String raw, List<(String, String)> columns) {
  try {
    final rows = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return const SizedBox.shrink();
    return Table(
      border: TableBorder.all(color: const Color(0xFFDDE3ED), width: 0.8),
      defaultColumnWidth: const FlexColumnWidth(1),
      children: [
        TableRow(decoration: const BoxDecoration(color: Color(0xFFF8F9FA)), children: [
          for (final c in columns) _tc(c.$2, bold: true),
        ]),
        for (final r in rows)
          TableRow(children: [
            for (final c in columns) _tc(r[c.$1]?.toString() ?? ''),
          ]),
      ],
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildCommitteeList(String raw) {
  try {
    final members = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: members.map((m) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Builder(builder: (_) {
          // Exec-committee members store 'position'; TWG members use 'designation'.
          final pos = (m['position'] ?? m['designation'] ?? '').toString();
          return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('• ', style: TextStyle(fontSize: 12, color: Color(0xFF718096))),
            Expanded(child: Text(
              '${m['name'] ?? ''}${pos.isNotEmpty ? ' — $pos' : ''}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)),
            )),
          ]);
        }),
      )).toList(),
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildMethodology(String raw) {
  try {
    final list = jsonDecode(raw) as List;
    final sections = <Widget>[];
    for (final item in list) {
      final m = item as Map<String, dynamic>;
      final stage = (m['stage'] ?? '').toString().trim();
      final activities = (m['activities'] ?? '').toString().trim();
      if (stage.isEmpty && activities.isEmpty) continue;
      sections.add(Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (stage.isNotEmpty)
            Text(stage,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E))),
          for (final l in activities.split('\n').where((l) => l.trim().isNotEmpty))
            Padding(
              padding: const EdgeInsets.only(left: 8, top: 2),
              child: Text('• ${l.trim()}',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568))),
            ),
        ]),
      ));
    }
    if (sections.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: sections);
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildOutputs(String raw) {
  // expected_outputs is stored as a JSON array, but legacy data may be newline text.
  List<String> items;
  final t = raw.trim();
  if (t.startsWith('[')) {
    try {
      final decoded = jsonDecode(t);
      items = decoded is List ? decoded.map((e) => e.toString()).toList() : [raw];
    } catch (_) {
      items = [raw];
    }
  } else {
    items = raw.split('\n');
  }
  items = items.where((s) => s.trim().isNotEmpty).toList();
  if (items.isEmpty) return const SizedBox.shrink();
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: items.map((s) => Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Text('• ${s.trim().replaceFirst(RegExp(r'^[•\-\*·●○]\s*'), '')}',
          style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E), height: 1.4)),
    )).toList(),
  );
}

Widget _buildSignatories(String raw) {
  try {
    final decoded = jsonDecode(raw);
    final list = (decoded is Map ? decoded['signatories'] : decoded) as List;
    final rows = <Widget>[];
    for (final s in list) {
      final m = s as Map<String, dynamic>;
      final role = (m['role'] ?? '').toString().trim();
      final name = (m['name'] ?? '').toString().trim();
      final title = (m['title'] ?? '').toString().trim();
      if (role.isEmpty && name.isEmpty && title.isEmpty) continue;
      rows.add(Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (role.isNotEmpty)
            Text('$role:', style: const TextStyle(fontSize: 11, color: Color(0xFF718096))),
          Text(name.isNotEmpty ? name : '—',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E))),
          if (title.isNotEmpty)
            Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568))),
        ]),
      ));
    }
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: rows);
  } catch (_) {
    // Fall back to raw text for any legacy free-text comments.
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildTwgGroups(String raw) {
  try {
    final list = jsonDecode(raw) as List;
    final sections = <Widget>[];
    for (final group in list) {
      final g = group as Map<String, dynamic>;
      final title = g['title']?.toString() ?? '';
      final members = (g['members'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (title.isNotEmpty) {
        sections.add(Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 4),
          child: Text(title,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                  color: Color(0xFF718096), letterSpacing: 0.3)),
        ));
      }
      for (final m in members) {
        final name  = m['name']?.toString() ?? '';
        final desig = m['designation']?.toString() ?? '';
        sections.add(Padding(
          padding: const EdgeInsets.only(bottom: 3, left: 8),
          child: Text('• $name${desig.isNotEmpty ? ' — $desig' : ''}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568))),
        ));
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: sections);
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _buildIndicators(String raw) {
  try {
    final list = jsonDecode(raw) as List;
    final items = list
        .asMap()
        .entries
        .map((e) {
          final label = (e.value as Map<String, dynamic>)['label']?.toString() ?? '';
          return '${e.key + 1}. $label';
        })
        .where((s) => s.trim().length > 3)
        .toList();
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: items.map((s) => Padding(
        padding: const EdgeInsets.only(bottom: 3),
        child: Text(s, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568))),
      )).toList(),
    );
  } catch (_) {
    return Text(raw, style: const TextStyle(fontSize: 12, color: Color(0xFF4A5568)));
  }
}

Widget _tc(String text, {bool bold = false}) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: Text(text,
          style: TextStyle(
              fontSize: 11,
              fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
              color: bold ? const Color(0xFF1A1A2E) : const Color(0xFF4A5568))),
    );

String _monthName(int month) {
  const months = ['','January','February','March','April','May','June',
      'July','August','September','October','November','December'];
  return months[month];
}

class _StatusBadge extends StatelessWidget {
  final _EventStatus status;
  const _StatusBadge({required this.status});
  @override
  Widget build(BuildContext context) {
    final isApproved = status == _EventStatus.approved;
    final isDisabled = status == _EventStatus.disabled;
    final isDraft    = status == _EventStatus.draft;
    final color = isDisabled ? const Color(0xFFE53E3E)
        : isDraft ? const Color(0xFF718096)
        : isApproved ? const Color(0xFF48BB78) : const Color(0xFFED8936);
    final label = isDisabled ? 'Disabled' : isDraft ? 'Draft' : isApproved ? 'Approved' : 'Pending';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

// ─── Proposal Detail Widgets ──────────────────────────────────────────────────

class _PropMeta extends StatelessWidget {
  final IconData icon;
  final String   text;
  const _PropMeta(this.icon, this.text);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(children: [
      Icon(icon, size: 14, color: const Color(0xFF718096)),
      const SizedBox(width: 6),
      Expanded(child: Text(text,
          style: const TextStyle(fontSize: 12, color: Color(0xFF718096)))),
    ]),
  );
}

class _ProposalSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _ProposalSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
        decoration: BoxDecoration(
            color: const Color(0xFF1E2126),
            borderRadius: BorderRadius.circular(6)),
        child: Text(title,
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: Colors.white, letterSpacing: 0.4)),
      ),
      ...children,
      const SizedBox(height: 16),
    ]);
  }
}

class _PropField extends StatelessWidget {
  final String  label;
  final dynamic value;
  const _PropField(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    final v = value?.toString() ?? '';
    if (v.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                color: Color(0xFF718096))),
        const SizedBox(height: 2),
        Text(v, style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E), height: 1.45)),
      ]),
    );
  }
}

class _PropBody extends StatelessWidget {
  final String text;
  const _PropBody(this.text);

  @override
  Widget build(BuildContext context) {
    if (text.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E), height: 1.55)),
    );
  }
}

class _PropBullets extends StatelessWidget {
  final String text;
  const _PropBullets(this.text);

  @override
  Widget build(BuildContext context) {
    final lines = text.split('\n').where((l) => l.trim().isNotEmpty).toList();
    if (lines.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.map((l) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('• ', style: TextStyle(fontSize: 13, color: Color(0xFF718096))),
          Expanded(child: Text(l.trim(),
              style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A2E), height: 1.45))),
        ]),
      )).toList(),
    );
  }
}

// ─── Event Card ───────────────────────────────────────────────────────────────

class _EventCard extends StatelessWidget {
  final _CalEvent    event;
  final bool         canManage;
  final bool         canApprove;
  final bool         isPrincipal;
  final VoidCallback onEdit;
  final VoidCallback onDisable;
  final VoidCallback onApprove;
  final VoidCallback? onPrint;
  final VoidCallback? onTap;

  const _EventCard({
    required this.event, required this.canManage, required this.canApprove,
    required this.isPrincipal, required this.onEdit, required this.onDisable,
    required this.onApprove, this.onPrint, this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(event.title,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E)))),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: event.status == _EventStatus.approved
                          ? const Color(0xFF48BB78).withValues(alpha: 0.12)
                          : const Color(0xFFED8936).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4)),
                  child: Text(
                      event.status == _EventStatus.approved ? 'Approved' : 'Pending',
                      style: TextStyle(fontSize: 11,
                          color: event.status == _EventStatus.approved
                              ? const Color(0xFF48BB78) : const Color(0xFFED8936),
                          fontWeight: FontWeight.w500)),
                ),
              ]),
              const SizedBox(height: 3),
              Text(event.description,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF718096)),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              if (event.creatorName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('By ${event.creatorName}',
                    style: const TextStyle(fontSize: 11, color: Color(0xFFB0B7C3))),
              ],
            ]),
          ),

          // Print / Save as PDF — available to all roles for all statuses
          if (onPrint != null)
            IconButton(
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18, color: Color(0xFF718096)),
              onPressed: onPrint,
              tooltip: 'Print / Save as PDF',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),

          // Principal: Approve + Disable for pending events
          if (isPrincipal && canApprove && event.status == _EventStatus.pendingApproval)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF718096)),
              offset: const Offset(0, 30),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: EdgeInsets.zero,
              onSelected: (v) {
                if (v == 'approve') onApprove();
                if (v == 'disable') onDisable();
              },
              itemBuilder: (_) => [
                const PopupMenuItem<String>(value: 'approve', height: 40,
                    child: Text('Approve',
                        style: TextStyle(fontSize: 13, color: Color(0xFF48BB78)))),
                PopupMenuItem<String>(value: 'disable', height: 40, padding: EdgeInsets.zero,
                  child: Container(width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: const BoxDecoration(color: Color(0xFFE53E3E),
                        borderRadius: BorderRadius.vertical(
                            top: Radius.circular(0), bottom: Radius.circular(8))),
                    child: const Text('Disable',
                        style: TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500))),
                ),
              ],
            )

          // Coordinator/Dean/Admin: Edit only for pending events (no disable)
          else if (canManage && event.status == _EventStatus.pendingApproval)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF718096)),
              offset: const Offset(0, 30),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: EdgeInsets.zero,
              onSelected: (v) {
                if (v == 'edit') onEdit();
              },
              itemBuilder: (_) => [
                const PopupMenuItem<String>(value: 'edit', height: 40,
                    child: Text('Edit',
                        style: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)))),
              ],
            ),
        ]),
      ),
    );
  }
}

// ─── Disabled Event Card ──────────────────────────────────────────────────────

class _DisabledEventCard extends StatelessWidget {
  final _CalEvent event; final bool canManage;
  final VoidCallback onEnable; final VoidCallback? onPrint; final VoidCallback? onTap;
  const _DisabledEventCard({required this.event, required this.canManage,
      required this.onEnable, this.onPrint, this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE53E3E).withValues(alpha: 0.3))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(event.title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
                      color: Color(0xFF9CA3AF), decoration: TextDecoration.lineThrough))),
              const SizedBox(width: 8),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFE53E3E).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4)),
                child: const Text('Disabled',
                    style: TextStyle(fontSize: 11, color: Color(0xFFE53E3E), fontWeight: FontWeight.w500))),
            ]),
            const SizedBox(height: 3),
            Text(event.description, style: const TextStyle(fontSize: 12, color: Color(0xFFB0B7C3))),
          ])),
          if (onPrint != null)
            IconButton(
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18, color: Color(0xFF718096)),
              onPressed: onPrint,
              tooltip: 'Print / Save as PDF',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
          if (canManage)
            TextButton(onPressed: onEnable,
              style: TextButton.styleFrom(foregroundColor: const Color(0xFF48BB78),
                  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              child: const Text('Enable')),
        ]),
      ),
    );
  }
}

// ─── Draft Event Card ─────────────────────────────────────────────────────────

class _DraftEventCard extends StatelessWidget {
  final _CalEvent event;
  final VoidCallback onContinue;
  final VoidCallback onDelete;
  const _DraftEventCard({required this.event, required this.onContinue, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final title = event.title.trim().isEmpty ? 'Untitled Draft' : event.title;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFDDE3ED))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E)))),
              const SizedBox(width: 8),
              const _StatusBadge(status: _EventStatus.draft),
            ]),
            const SizedBox(height: 3),
            const Text('Continue where you left off.',
                style: TextStyle(fontSize: 12, color: Color(0xFF718096))),
          ]),
        ),
        TextButton(onPressed: onContinue,
          style: TextButton.styleFrom(foregroundColor: const Color(0xFF1E2126),
              textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          child: const Text('Continue Editing')),
        IconButton(
          icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFE53E3E)),
          onPressed: onDelete,
          tooltip: 'Delete draft',
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
        ),
      ]),
    );
  }
}

// ─── Confirm Disable Dialog ───────────────────────────────────────────────────

class _ConfirmDisableDialog extends StatelessWidget {
  final String eventTitle;
  const _ConfirmDisableDialog({required this.eventTitle});
  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(width: 320,
        child: Padding(padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Confirm Disable',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))),
            const SizedBox(height: 12),
            Text('Disable "$eventTitle"?', textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(child: SizedBox(height: 44,
                child: ElevatedButton(onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53E3E),
                      foregroundColor: Colors.white, elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Disable', style: TextStyle(fontWeight: FontWeight.w600))))),
              const SizedBox(width: 12),
              Expanded(child: SizedBox(height: 44,
                child: OutlinedButton(onPressed: () => Navigator.pop(context, false),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF4A5568),
                      side: const BorderSide(color: Color(0xFFDDE3ED)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600))))),
            ]),
          ]),
        ),
      ),
    );
  }
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

class _ConfirmDeleteDialog extends StatelessWidget {
  final String eventTitle;
  const _ConfirmDeleteDialog({required this.eventTitle});
  @override
  Widget build(BuildContext context) {
    final title = eventTitle.trim().isEmpty ? 'Untitled Draft' : eventTitle;
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(width: 320,
        child: Padding(padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Delete Draft',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))),
            const SizedBox(height: 12),
            Text('Delete "$title"? This cannot be undone.', textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF718096))),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(child: SizedBox(height: 44,
                child: ElevatedButton(onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53E3E),
                      foregroundColor: Colors.white, elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.w600))))),
              const SizedBox(width: 12),
              Expanded(child: SizedBox(height: 44,
                child: OutlinedButton(onPressed: () => Navigator.pop(context, false),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF4A5568),
                      side: const BorderSide(color: Color(0xFFDDE3ED)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600))))),
            ]),
          ]),
        ),
      ),
    );
  }
}

// ─── Side Calendar ────────────────────────────────────────────────────────────

class _Dot extends StatelessWidget {
  const _Dot();
  @override
  Widget build(BuildContext context) => Container(
        width: 5, height: 5,
        decoration: const BoxDecoration(color: Color(0xFF48BB78), shape: BoxShape.circle),
      );
}

class _SideCalendar extends StatelessWidget {
  final DateTime focusedDay; final DateTime? selectedDay;
  final Map<DateTime, List<_CalEvent>> eventsByDay;
  final Function(DateTime, DateTime) onDaySelected;
  final Function(DateTime) onPageChanged;
  const _SideCalendar({required this.focusedDay, required this.selectedDay,
      required this.eventsByDay, required this.onDaySelected, required this.onPageChanged});

  List<_CalEvent> _eventsFor(DateTime day) =>
      eventsByDay[DateTime(day.year, day.month, day.day)] ?? const [];

  // Hover tooltip text: title · when · where for each event on the day.
  String _tooltipText(List<_CalEvent> events) => events.map((e) {
        final when = (e.raw['target_date'] ?? '').toString().trim();
        final where = (e.raw['venue'] ?? '').toString().trim();
        final lines = <String>[e.title];
        if (when.isNotEmpty) lines.add('When: $when');
        if (where.isNotEmpty) lines.add('Where: $where');
        return lines.join('\n');
      }).join('\n\n');

  // A single day cell rendered to match the original calendarStyle, wrapped in
  // a hover Tooltip when the day has events.
  Widget _dayCell(DateTime day, {Color? bg, required Color textColor, bool bold = false}) {
    final events = _eventsFor(day);
    Widget cell = Container(
      margin: const EdgeInsets.all(4),
      alignment: Alignment.center,
      decoration: bg != null ? BoxDecoration(color: bg, shape: BoxShape.circle) : null,
      child: Stack(alignment: Alignment.center, children: [
        Text('${day.day}',
            style: TextStyle(fontSize: 13, color: textColor,
                fontWeight: bold ? FontWeight.w600 : FontWeight.w400)),
        if (events.isNotEmpty)
          const Positioned(bottom: 1, child: _Dot()),
      ]),
    );
    if (events.isEmpty) return cell;
    return Tooltip(
      message: _tooltipText(events),
      waitDuration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      margin: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(8),
      ),
      textStyle: const TextStyle(color: Colors.white, fontSize: 11.5, height: 1.4),
      child: cell,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.only(bottom: 8),
      child: TableCalendar(
        firstDay: DateTime(2020), lastDay: DateTime(2030), focusedDay: focusedDay,
        selectedDayPredicate: (day) => isSameDay(selectedDay, day),
        onDaySelected: onDaySelected, onPageChanged: onPageChanged,
        availableCalendarFormats: const {CalendarFormat.month: 'Month'},
        calendarBuilders: CalendarBuilders(
          defaultBuilder: (_, day, __) =>
              _dayCell(day, textColor: const Color(0xFF1A1A2E)),
          todayBuilder: (_, day, __) => _dayCell(day,
              bg: const Color(0xFFACC2DF), textColor: Colors.white, bold: true),
          selectedBuilder: (_, day, __) => _dayCell(day,
              bg: const Color(0xFF1E2126), textColor: Colors.white, bold: true),
        ),
        calendarStyle: const CalendarStyle(
          todayDecoration: BoxDecoration(color: Color(0xFFACC2DF), shape: BoxShape.circle),
          todayTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          selectedDecoration: BoxDecoration(color: Color(0xFF1E2126), shape: BoxShape.circle),
          selectedTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
          defaultTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          weekendTextStyle: TextStyle(fontSize: 13, color: Color(0xFF1A1A2E)),
          outsideDaysVisible: false,
          cellMargin: EdgeInsets.all(4),
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: false, titleCentered: true,
          headerPadding: const EdgeInsets.symmetric(vertical: 12),
          titleTextFormatter: (date, locale) => '${_monthName(date.month)}\n${date.year}',
          titleTextStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E)),
          leftChevronIcon: const Icon(Icons.chevron_left, size: 20, color: Color(0xFF4A5568)),
          rightChevronIcon: const Icon(Icons.chevron_right, size: 20, color: Color(0xFF4A5568)),
        ),
        daysOfWeekStyle: const DaysOfWeekStyle(
          weekdayStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF718096)),
          weekendStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF718096)),
        ),
        daysOfWeekHeight: 28, rowHeight: 38,
      ),
    );
  }
}
