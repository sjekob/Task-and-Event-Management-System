part of 'appraisal_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Badges Tab — achievement badges computed by the backend from submission
// timing, special-task ratings and event evaluations for the selected school
// year / term. Personnel see their own; supervisors also get a leaderboard.
// ─────────────────────────────────────────────────────────────────────────────

const _kGold = Color(0xFFD97706);
const _kSilver = Color(0xFF64748B);
const _kBronze = Color(0xFFB45309);

IconData _badgeIcon(String key) => switch (key) {
      'schedule' => Icons.schedule_rounded,
      'wb_sunny' => Icons.wb_sunny_rounded,
      'local_fire_department' => Icons.local_fire_department_rounded,
      'verified' => Icons.verified_rounded,
      'star' => Icons.star_rounded,
      'emoji_events' => Icons.emoji_events_rounded,
      'groups' => Icons.groups_rounded,
      _ => Icons.workspace_premium_rounded,
    };

Color _badgeColor(AppraisalBadge b) {
  if (!b.earned) return const Color(0xFFCBD5E1);
  return switch (b.tier) {
    'gold' => _kGold,
    'silver' => _kSilver,
    'bronze' => _kBronze,
    _ => AppTheme.accentBlue,
  };
}

class _BadgesTab extends StatefulWidget {
  final SchoolYearFilter filter;
  final bool showOwn;
  final bool showLeaderboard;
  const _BadgesTab({required this.filter, required this.showOwn, required this.showLeaderboard});

  @override
  State<_BadgesTab> createState() => _BadgesTabState();
}

class _BadgesTabState extends State<_BadgesTab> {
  List<AppraisalBadge> _mine = [];
  List<Map<String, dynamic>> _board = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(_BadgesTab old) {
    super.didUpdateWidget(old);
    if (old.filter != widget.filter) _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        widget.showOwn ? ApiService.getBadges(filter: widget.filter) : Future.value(<AppraisalBadge>[]),
        widget.showLeaderboard
            ? ApiService.getBadgeLeaderboard(filter: widget.filter)
            : Future.value(<Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _mine = results[0] as List<AppraisalBadge>;
        _board = results[1] as List<Map<String, dynamic>>;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  void _openPerson(Map<String, dynamic> p) => showDialog<void>(
        context: context,
        builder: (_) => _PersonBadgesDialog(person: p, filter: widget.filter),
      );

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return _ErrorPanel(message: _error!, onRetry: _load);
    final earned = _mine.where((b) => b.earned).length;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(children: [
        if (widget.showOwn) ...[
          _sectionTitle('My badges', '$earned of ${_mine.length} earned this period'),
          const SizedBox(height: 12),
          _BadgeGrid(badges: _mine),
          const SizedBox(height: 28),
        ],
        if (widget.showLeaderboard) ...[
          _sectionTitle('Badge leaderboard', 'Personnel ranked by badges earned this period'),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE3E9F3)),
            ),
            child: _board.isEmpty
                ? Padding(padding: const EdgeInsets.all(20),
                    child: Text('No personnel to show.', style: AppTheme.bodyMd))
                : Column(children: [
                    for (var i = 0; i < _board.length; i++) ...[
                      if (i > 0) const Divider(height: 1, color: Color(0xFFF0F2F6)),
                      _LeaderRow(rank: i + 1, person: _board[i], onTap: () => _openPerson(_board[i])),
                    ],
                  ]),
          ),
        ],
      ]),
    );
  }

  Widget _sectionTitle(String title, String sub) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.plusJakartaSans(
              fontSize: 17, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          const SizedBox(height: 2),
          Text(sub, style: AppTheme.bodySm),
        ],
      );
}

class _BadgeGrid extends StatelessWidget {
  final List<AppraisalBadge> badges;
  const _BadgeGrid({required this.badges});

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, c) {
        final cols = c.maxWidth >= 1100 ? 4 : c.maxWidth >= 700 ? 3 : c.maxWidth >= 440 ? 2 : 1;
        final w = (c.maxWidth - 14 * (cols - 1)) / cols;
        // Earned first, then closest to earning.
        final sorted = [...badges]..sort((a, b) {
            if (a.earned != b.earned) return a.earned ? -1 : 1;
            return (b.progress / b.target).compareTo(a.progress / a.target);
          });
        return Wrap(spacing: 14, runSpacing: 14, children: [
          for (final b in sorted) SizedBox(width: w, child: _BadgeCard(badge: b)),
        ]);
      });
}

class _BadgeCard extends StatelessWidget {
  final AppraisalBadge badge;
  const _BadgeCard({required this.badge});

  @override
  Widget build(BuildContext context) {
    final color = _badgeColor(badge);
    final b = badge;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: b.earned ? Colors.white : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: b.earned ? color.withValues(alpha: 0.45) : const Color(0xFFE2E8F0),
            width: b.earned ? 1.5 : 1),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: b.earned ? color.withValues(alpha: 0.14) : const Color(0xFFF1F5F9),
            border: Border.all(color: color, width: 2),
          ),
          child: Icon(b.earned ? _badgeIcon(b.icon) : Icons.lock_outline_rounded,
              color: b.earned ? color : const Color(0xFF94A3B8), size: 26),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(b.name, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700,
              color: b.earned ? AppTheme.textPrimary : AppTheme.textMuted)),
          const SizedBox(height: 3),
          Text(b.description, style: AppTheme.caption),
          const SizedBox(height: 10),
          if (b.earned)
            Row(children: [
              Icon(Icons.check_circle_rounded, size: 15, color: color),
              const SizedBox(width: 5),
              Text('Earned', style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, fontWeight: FontWeight.w700, color: color)),
            ])
          else ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: b.target == 0 ? 0 : b.progress / b.target,
                minHeight: 6,
                backgroundColor: const Color(0xFFE2E8F0),
                color: AppTheme.accentBlue,
              ),
            ),
            const SizedBox(height: 4),
            Text('${b.progress} / ${b.target}', style: AppTheme.caption),
          ],
        ])),
      ]),
    );
  }
}

class _LeaderRow extends StatelessWidget {
  final int rank;
  final Map<String, dynamic> person;
  final VoidCallback onTap;
  const _LeaderRow({required this.rank, required this.person, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final badges = (person['badges'] as List? ?? [])
        .map((b) => AppraisalBadge.fromJson(Map<String, dynamic>.from(b as Map)))
        .toList();
    final role = (person['role'] ?? '').toString();
    final grade = person['grade_level']?.toString();
    return InkWell(
      onTap: onTap,
      hoverColor: const Color(0xFFF6F8FC),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        child: Row(children: [
          SizedBox(width: 28, child: Text('$rank', style: GoogleFonts.plusJakartaSans(
              fontSize: 14, fontWeight: FontWeight.w800,
              color: rank <= 3 && badges.isNotEmpty ? _kGold : AppTheme.textLight))),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text((person['full_name'] ?? '').toString(), overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary)),
            Text([if (role.isNotEmpty) role[0].toUpperCase() + role.substring(1), if (grade != null) grade]
                .join(' · '), style: AppTheme.caption),
          ])),
          if (badges.isEmpty)
            Text('No badges yet', style: AppTheme.caption)
          else
            Wrap(spacing: 4, children: [
              for (final b in badges)
                Tooltip(
                  message: b.name,
                  child: Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(shape: BoxShape.circle,
                        color: _badgeColor(b).withValues(alpha: 0.14),
                        border: Border.all(color: _badgeColor(b), width: 1.5)),
                    child: Icon(_badgeIcon(b.icon), size: 15, color: _badgeColor(b)),
                  ),
                ),
            ]),
          const SizedBox(width: 12),
          SizedBox(width: 34, child: Text('${person['earned_count'] ?? 0}', textAlign: TextAlign.right,
              style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary))),
          const Icon(Icons.chevron_right_rounded, color: AppTheme.textLight),
        ]),
      ),
    );
  }
}

class _PersonBadgesDialog extends StatelessWidget {
  final Map<String, dynamic> person;
  final SchoolYearFilter filter;
  const _PersonBadgesDialog({required this.person, required this.filter});

  @override
  Widget build(BuildContext context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: 820, maxHeight: MediaQuery.of(context).size.height * 0.85),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text("${person['full_name']}'s badges",
                    style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700))),
                IconButton(onPressed: () => Navigator.pop(context), tooltip: 'Close',
                    icon: const Icon(Icons.close)),
              ]),
              const SizedBox(height: 12),
              Expanded(
                child: FutureBuilder<List<AppraisalBadge>>(
                  future: ApiService.getBadges(userId: person['id'] as int?, filter: filter),
                  builder: (_, snap) {
                    if (snap.hasError) {
                      return Text(snap.error.toString().replaceFirst('Exception: ', ''));
                    }
                    if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                    return SingleChildScrollView(child: _BadgeGrid(badges: snap.data!));
                  },
                ),
              ),
            ]),
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator demographics (event evaluations)
// ─────────────────────────────────────────────────────────────────────────────

class _DemographicsDialog extends StatelessWidget {
  final EventForAppraisal event;
  const _DemographicsDialog({required this.event});

  @override
  Widget build(BuildContext context) {
    final d = event.demographics;
    final total = (d['total'] as num?)?.toInt() ?? 0;
    Map<String, int> m(String k) => (d[k] as Map? ?? {})
        .map((key, v) => MapEntry(key.toString(), (v as num).toInt()));
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 720, maxHeight: MediaQuery.of(context).size.height * 0.85),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Evaluator demographics', style: GoogleFonts.plusJakartaSans(
                    fontSize: 18, fontWeight: FontWeight.w700)),
                Text('${event.title} · $total ${total == 1 ? 'evaluation' : 'evaluations'}',
                    style: AppTheme.bodySm),
              ])),
              IconButton(onPressed: () => Navigator.pop(context), tooltip: 'Close',
                  icon: const Icon(Icons.close)),
            ]),
            const SizedBox(height: 16),
            Flexible(
              child: total == 0
                  ? Text('No evaluations yet.', style: AppTheme.bodyMd)
                  : SingleChildScrollView(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        _breakdown('By role', m('by_role'), total),
                        _breakdown('By sex', m('by_sex'), total),
                        _breakdown('By age group', m('by_age_group'), total),
                      ]),
                    ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _breakdown(String title, Map<String, int> counts, int total) => Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          for (final e in counts.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                SizedBox(width: 150, child: Text(
                    e.key.isEmpty ? '—' : e.key[0].toUpperCase() + e.key.substring(1),
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(fontSize: 13,
                        color: e.key == 'Not specified' ? AppTheme.textLight : AppTheme.textPrimary))),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: e.value / total,
                      minHeight: 10,
                      backgroundColor: const Color(0xFFEEF2FA),
                      color: e.key == 'Not specified' ? const Color(0xFFCBD5E1) : AppTheme.accentBlue,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(width: 90, child: Text(
                    '${e.value} · ${(e.value * 100 / total).toStringAsFixed(0)}%',
                    textAlign: TextAlign.right, style: AppTheme.captionMd)),
              ]),
            ),
        ]),
      );
}
