import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import 'certificates_panel.dart';

/// Personnel picker used when assigning a task. When [loadSuggestions] is
/// given, people are ranked for the task (skills/certifications that match it
/// first; more children or a heavier open workload rank lower), each row shows
/// why, and "Auto-select" picks the matches for the user.
class AssignPickerDialog extends StatefulWidget {
  final List<User> users;
  final Set<int> selected;
  final ValueChanged<Set<int>> onChanged;
  final Future<List<AssigneeSuggestion>> Function()? loadSuggestions;

  const AssignPickerDialog({
    super.key,
    required this.users,
    required this.selected,
    required this.onChanged,
    this.loadSuggestions,
  });

  @override
  State<AssignPickerDialog> createState() => _AssignPickerDialogState();
}

class _AssignPickerDialogState extends State<AssignPickerDialog> {
  late Set<int> _local;
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

  /// Select everyone whose skills/certifications match the task; if nobody
  /// matches, select the single top-ranked (least burdened) person.
  void _autoSelect() {
    final ids = _hasMatches
        ? _ranked.values.where((s) => s.isMatch).map((s) => s.user.id)
        : _ranked.keys.take(1);
    setState(() => _local.addAll(ids));
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final w = size.width < 560 ? size.width - 48 : 520.0;
    final h = (size.height * 0.75).clamp(380.0, 660.0);
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
              Text('Select Personnel', style: AppTheme.heading3),
              const Spacer(),
              TextButton(
                onPressed: () { widget.onChanged(_local); Navigator.pop(context); },
                child: Text('Done (${_local.length})',
                    style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600,
                        color: AppTheme.accentBlue, fontSize: 14)),
              ),
            ]),
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
                  : _hasMatches
                      ? 'Ranked by specialization, certifications, skills and education '
                          'fitting this task. More children or open tasks rank lower.'
                      : 'No specialization, certification or skill matches this task yet — '
                          'ranked by related experience, then fewest children and open tasks.',
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
                  ? 'Select everyone whose specialization, certifications or skills match'
                  : 'Select the top-ranked person',
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
    final hasDetail = s != null && (reasons.isNotEmpty || s.loadFactors.isNotEmpty || certs.isNotEmpty);
    return CheckboxListTile(
      value: checked,
      onChanged: (_) => setState(() => checked ? _local.remove(u.id) : _local.add(u.id)),
      title: Row(children: [
        Flexible(child: Text(u.fullName, style: AppTheme.labelMd, overflow: TextOverflow.ellipsis)),
        if (s != null && s.isMatch) ...[
          const SizedBox(width: 6),
          _badge(isTop ? 'Best match' : 'Match',
              isTop ? AppTheme.greenColor : AppTheme.accentBlue,
              isTop ? AppTheme.greenBg : AppTheme.blueBg),
        ],
      ]),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${u.roleLabel}${u.gradeLevel != null ? ' · ${u.gradeLevel}' : ''}',
              style: AppTheme.bodySm),
          if (certs.isNotEmpty) ...[
            const SizedBox(height: 4),
            Wrap(spacing: 4, runSpacing: 4, children: [
              for (final c in certs)
                _certChip(c, s!.matchedCertifications.contains(c.name) ||
                    s.relatedCertifications.contains(c.name)),
            ]),
          ],
          if (s != null && (reasons.isNotEmpty || s.loadFactors.isNotEmpty)) ...[
            const SizedBox(height: 4),
            Wrap(spacing: 4, runSpacing: 4, children: [
              for (final r in reasons)
                _badge(r, const Color(0xFF15803D), AppTheme.greenBg),
              for (final l in s.loadFactors)
                _badge(l, const Color(0xFFB45309), AppTheme.amberBg),
            ]),
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

  /// Certifications worth showing for this task: the ones matching it, then
  /// related ones, then any others that are verified or awaiting review (max 4).
  List<CertificationInfo> _certsFor(AssigneeSuggestion s) {
    final all = s.user.certificationDetails.where((c) => c.credibility != 'rejected');
    bool fits(CertificationInfo c) =>
        s.matchedCertifications.contains(c.name) || s.relatedCertifications.contains(c.name);
    final matched = all.where((c) => s.matchedCertifications.contains(c.name));
    final related = all.where((c) => s.relatedCertifications.contains(c.name));
    final others = all.where((c) => !fits(c) && c.credibility != 'self_declared');
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
