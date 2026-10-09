import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import 'certificates_panel.dart';

/// Personnel picker used when assigning a task. When [loadSuggestions] is
/// given, people are ranked by a fit score out of 100 (competency 60 +
/// workload 30 + life context 10), each row has a small box explaining why,
/// people who are already heavily loaded are flagged "High burden", and
/// selecting one of them shows a warning.
class AssignPickerDialog extends StatefulWidget {
  final List<User> users;
  final Set<int> selected;
  final ValueChanged<Set<int>> onChanged;
  final Future<List<AssigneeSuggestion>> Function()? loadSuggestions;
  /// False when the task has no title/subject/instructions yet, so skills
  /// and certifications can't be matched.
  final bool hasTaskText;
  /// Dialog title (default "Select Personnel").
  final String? title;
  /// Extra controls under the title, e.g. the "Assign as" role selector.
  final Widget? header;
  /// When set, the button assigns right away (e.g. on an existing task) and
  /// the dialog closes with `true` once it succeeds.
  final Future<void> Function(Set<int> ids)? onConfirm;

  const AssignPickerDialog({
    super.key,
    required this.users,
    required this.selected,
    required this.onChanged,
    this.loadSuggestions,
    this.hasTaskText = true,
    this.title,
    this.header,
    this.onConfirm,
  });

  @override
  State<AssignPickerDialog> createState() => _AssignPickerDialogState();
}

class _AssignPickerDialogState extends State<AssignPickerDialog> {
  late Set<int> _local;
  bool _busy = false;
  String _search = '';
  bool _loading = false;
  // Suggestion per user id, in ranked order. Empty → plain alphabetical list.
  Map<int, AssigneeSuggestion> _ranked = {};

  @override
  void initState() {
    super.initState();
    _local = Set.from(widget.selected);
    _loadSuggestions();
  }

  Future<void> _loadSuggestions() async {
    if (widget.loadSuggestions == null) return;
    setState(() => _loading = true);
    try {
      final list = await widget.loadSuggestions!();
      if (mounted) setState(() => _ranked = {for (final s in list) s.user.id: s});
    } catch (_) {
      // Suggestions are an aid only — fall back to the plain list.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Users in ranked order (suggested first), then anyone the ranking skipped.
  List<User> get _ordered {
    if (_ranked.isEmpty) return widget.users;
    final byId = {for (final u in widget.users) u.id: u};
    return [
      for (final id in _ranked.keys) if (byId.containsKey(id)) byId[id]!,
      ...widget.users.where((u) => !_ranked.containsKey(u.id)),
    ];
  }

  List<User> get _filtered {
    if (_search.isEmpty) return _ordered;
    final q = _search.toLowerCase();
    return _ordered.where((u) {
      final s = _ranked[u.id];
      return u.fullName.toLowerCase().contains(q) ||
          (s?.user.skills.any((k) => k.toLowerCase().contains(q)) ?? false) ||
          (s?.user.certifications.any((k) => k.toLowerCase().contains(q)) ?? false);
    }).toList();
  }

  bool get _hasMatches => _ranked.values.any((s) => s.isMatch);

  /// Select everyone whose profile matches the task, skipping anyone with a
  /// high burden; if that leaves nobody, select the top-ranked person.
  void _autoSelect() {
    final ok = _ranked.values.where((s) => !s.isHighBurden);
    final matches = ok.where((s) => s.isMatch).map((s) => s.user.id).toList();
    final ids = matches.isNotEmpty
        ? matches
        : [ok.isNotEmpty ? ok.first.user.id : _ranked.keys.first];
    setState(() => _local.addAll(ids));
  }

  Future<void> _confirm() async {
    setState(() => _busy = true);
    try {
      await widget.onConfirm!(_local);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(e.toString().replaceFirst('Exception: ', '')),
        backgroundColor: AppTheme.redColor,
      ));
    }
  }

  /// Selected people who already carry a high burden.
  List<AssigneeSuggestion> get _burdenedSelection =>
      [for (final id in _local) if (_ranked[id]?.isHighBurden ?? false) _ranked[id]!];

  List<String> get _offHours =>
      _ranked.isEmpty ? const [] : _ranked.values.first.offHours;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final w = size.width < 620 ? size.width - 48 : 580.0;
    final h = (size.height * 0.82).clamp(420.0, 760.0);
    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: SizedBox(
        width: w,
        height: h,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Row(children: [
              Text(widget.title ?? 'Select Personnel', style: AppTheme.heading3),
              const Spacer(),
              if (widget.onConfirm == null)
                TextButton(
                  onPressed: () { widget.onChanged(_local); Navigator.pop(context); },
                  child: Text('Done (${_local.length})',
                      style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600,
                          color: AppTheme.accentBlue, fontSize: 14)),
                )
              else ...[
                TextButton(
                  onPressed: _busy ? null : () => Navigator.pop(context, false),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 4),
                ElevatedButton(
                  onPressed: _busy || _local.isEmpty ? null : _confirm,
                  child: _busy
                      ? const SizedBox(width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Assign${_local.isEmpty ? '' : ' (${_local.length})'}'),
                ),
              ],
            ]),
          ),
          if (widget.header != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Align(alignment: Alignment.centerLeft, child: widget.header!),
            ),
          if (widget.loadSuggestions != null) _suggestionBar(),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              decoration: InputDecoration(hintText: 'Search by name or skill...', hintStyle: AppTheme.bodyMd,
                  prefixIcon: const Icon(Icons.search, size: 18, color: AppTheme.textMuted),
                  filled: true, fillColor: AppTheme.bgColor,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none)),
            ),
          ),
          const Divider(height: 1, color: AppTheme.borderColor),
          Expanded(
            child: _filtered.isEmpty
                ? Center(child: Text('No personnel found', style: AppTheme.bodyMd))
                : ListView.builder(
                    itemCount: _filtered.length,
                    itemBuilder: (_, i) => _row(_filtered[i])),
          ),
          if (_burdenedSelection.isNotEmpty) _burdenWarning(),
        ]),
      ),
    );
  }

  Widget _suggestionBar() => Container(
        margin: const EdgeInsets.fromLTRB(20, 10, 20, 0),
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        decoration: BoxDecoration(
          color: AppTheme.blueBg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(children: [
          const Icon(Icons.auto_awesome, size: 16, color: AppTheme.accentBlue),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _loading
                  ? 'Finding the best fit for this task...'
                  : [
                      !widget.hasTaskText
                          ? 'Add a title or instructions first so skills and certifications '
                              'can be matched. For now people are ranked by workload only.'
                          : _hasMatches
                              ? 'Best fit first: fit score = competency (60) + workload (30) '
                                  '+ life context (10).'
                              : 'No one\'s skills or certifications match the words in this '
                                  'task; ranked by workload and life context.',
                      if (_offHours.isNotEmpty)
                        'This task is ${_offHours.join(', ')}, so people with children '
                            'or family care lose life-context points unless they opted in.',
                    ].join(' '),
              style: AppTheme.bodySm,
            ),
          ),
          const SizedBox(width: 8),
          if (_loading)
            const SizedBox(width: 16, height: 16,
                child: CircularProgressIndicator(strokeWidth: 2))
          else if (_ranked.isNotEmpty)
            Tooltip(
              message: _hasMatches
                  ? 'Select everyone whose profile matches, skipping high-burden people'
                  : 'Select the top-ranked person without a high burden',
              child: TextButton.icon(
                onPressed: _autoSelect,
                icon: const Icon(Icons.bolt, size: 16),
                label: const Text('Auto-select'),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.accentBlue,
                  textStyle: GoogleFonts.plusJakartaSans(
                      fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            ),
        ]),
      );

  Widget _row(User u) {
    final checked = _local.contains(u.id);
    final s = _ranked[u.id];
    final isTop = s != null && s.isMatch && _ranked.keys.first == u.id;
    // Certifications are shown as chips with their credibility, so drop the
    // text reasons that repeat them ("Certified (verified): ...").
    final reasons = s?.reasons
            .where((r) => !r.startsWith('Certified (') && !r.startsWith('Related certification'))
            .toList() ??
        const [];
    final certs = s == null ? const <CertificationInfo>[] : _certsFor(s);
    final hasDetail = s != null;
    return CheckboxListTile(
      value: checked,
      onChanged: (_) => setState(() => checked ? _local.remove(u.id) : _local.add(u.id)),
      title: Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
        Text(u.fullName, style: AppTheme.labelMd, overflow: TextOverflow.ellipsis),
        if (s != null) _fitPill(s),
        if (s != null && s.isMatch)
          _badge(isTop ? 'Best fit' : 'Match',
              isTop ? AppTheme.greenColor : AppTheme.accentBlue,
              isTop ? AppTheme.greenBg : AppTheme.blueBg),
        if (s != null && s.burden != 'low') _burdenPill(s),
      ]),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${u.roleLabel}${u.gradeLevel != null ? ' · ${u.gradeLevel}' : ''}',
              style: AppTheme.bodySm),
          if (s != null) ...[
            const SizedBox(height: 6),
            _whyBox(s, reasons, certs),
          ],
        ],
      ),
      isThreeLine: hasDetail,
      secondary: CircleAvatar(radius: 18, backgroundColor: AppTheme.sidebarActive,
          child: Text(u.initials, style: const TextStyle(color: Colors.white,
              fontSize: 13, fontWeight: FontWeight.w700))),
      activeColor: AppTheme.accentBlue,
      controlAffinity: ListTileControlAffinity.trailing,
    );
  }

  Widget _fitPill(AssigneeSuggestion s) {
    final score = s.fitCompetency + s.fitWorkload + s.fitLifeContext;
    final (fg, bg) = score >= 60
        ? (const Color(0xFF15803D), AppTheme.greenBg)
        : score >= 35
            ? (AppTheme.accentBlue, AppTheme.blueBg)
            : (AppTheme.textMuted, const Color(0xFFF3F4F6));
    return _badge('Fit ${score.round()}/100', fg, bg);
  }

  Widget _burdenPill(AssigneeSuggestion s) => Tooltip(
        message: s.loadFactors.join(' · '),
        child: s.isHighBurden
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: AppTheme.redBg, borderRadius: BorderRadius.circular(6)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.warning_amber_rounded, size: 12, color: AppTheme.redColor),
                  const SizedBox(width: 3),
                  Text('High burden',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.redColor)),
                ]),
              )
            : _badge('Moderate load', const Color(0xFFB45309), AppTheme.amberBg),
      );

  /// The small "why" box under each person: the three fit parts, then the
  /// reasons they fit and what weighs against them.
  Widget _whyBox(AssigneeSuggestion s, List<String> reasons, List<CertificationInfo> certs) {
    String part(String label, double v, int max) => '$label ${v.round()}/$max';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: AppTheme.bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: s.isHighBurden ? AppTheme.redColor.withValues(alpha: 0.35) : AppTheme.borderColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          [
            part('Competency', s.fitCompetency, 60),
            part('Workload', s.fitWorkload, 30),
            part('Life context', s.fitLifeContext, 10),
          ].join('  ·  '),
          style: GoogleFonts.plusJakartaSans(
              fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
        ),
        const SizedBox(height: 4),
        Text(_whySentence(s, reasons), style: AppTheme.bodySm.copyWith(fontSize: 11.5)),
        if (certs.isNotEmpty) ...[
          const SizedBox(height: 6),
          Wrap(spacing: 4, runSpacing: 4, children: [
            for (final c in certs)
              _certChip(c, s.matchedCertifications.contains(c.name) ||
                  s.relatedCertifications.contains(c.name)),
          ]),
        ],
      ]),
    );
  }

  /// "Skilled in: ..." -> "skilled in: ..." but leaves acronyms ("BEEd", "NC II") alone.
  static String _lowerFirst(String r) =>
      r.length > 1 && r[1] == r[1].toLowerCase() ? r[0].toLowerCase() + r.substring(1) : r;

  /// One plain sentence: why they fit, then what weighs against them.
  String _whySentence(AssigneeSuggestion s, List<String> reasons) {
    final fit = reasons.isEmpty
        ? 'Nothing in their profile matches this task.'
        : 'Fits because of ${reasons.map(_lowerFirst).join('; ')}.';
    final against = s.loadFactors.isEmpty
        ? ' No current workload.'
        : ' Weighing against: ${s.loadFactors.join(', ')}.';
    return fit + against;
  }

  Widget _burdenWarning() {
    final people = _burdenedSelection;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.redBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.redColor.withValues(alpha: 0.4)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.warning_amber_rounded, color: AppTheme.redColor, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              people.length == 1
                  ? 'High burden: ${people.first.user.fullName}'
                  : 'High burden: ${people.length} selected people',
              style: AppTheme.labelMd.copyWith(color: AppTheme.redColor),
            ),
            const SizedBox(height: 2),
            for (final p in people)
              Text('${people.length > 1 ? '${p.user.fullName}: ' : ''}${p.loadFactors.join(', ')}',
                  style: AppTheme.bodySm),
            const SizedBox(height: 2),
            Text('Consider someone with a lighter load, or keep them if this task needs them.',
                style: AppTheme.bodySm),
          ]),
        ),
      ]),
    );
  }

  /// Certifications worth showing for this task: the ones matching it, then
  /// related ones, then any others that are verified or awaiting review (max 4).
  List<CertificationInfo> _certsFor(AssigneeSuggestion s) {
    final all = s.user.certificationDetails.where((c) => c.credibility != 'rejected');
    bool fits(CertificationInfo c) =>
        s.matchedCertifications.contains(c.name) || s.relatedCertifications.contains(c.name);
    final matched = all.where((c) => s.matchedCertifications.contains(c.name));
    final related = all.where((c) => s.relatedCertifications.contains(c.name));
    final others = all.where((c) => !fits(c));
    return [...matched, ...related, ...others].take(4).toList();
  }

  Widget _certChip(CertificationInfo c, bool matched) => Tooltip(
      message: [
        c.issuerLabel,
        c.category,
        if (matched) 'fits this task',
      ].whereType<String>().join(' · '),
      child: Container(
        padding: const EdgeInsets.fromLTRB(6, 2, 3, 2),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(7),
          border: Border.all(
              color: matched ? AppTheme.greenColor.withValues(alpha: 0.6) : AppTheme.borderColor),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.workspace_premium_outlined, size: 12,
              color: matched ? AppTheme.greenColor : AppTheme.textMuted),
          const SizedBox(width: 3),
          Flexible(
            child: Text(c.name,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          ),
          const SizedBox(width: 4),
          CredibilityBadge(credibility: c.credibility, authenticity: c.authenticity, compact: true),
        ]),
      ));

  Widget _badge(String text, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
        child: Text(text,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
      );
}
