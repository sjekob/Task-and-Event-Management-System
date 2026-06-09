import 'package:flutter/material.dart';

// ─── Shared shimmer infrastructure ───────────────────────────────────────────

class _Shimmer extends StatefulWidget {
  final Widget Function(double progress) body;
  const _Shimmer({required this.body});

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      AnimatedBuilder(animation: _ctrl, builder: (_, __) => widget.body(_ctrl.value));
}

class _Bone extends StatelessWidget {
  final double? width;
  final double height;
  final double progress;
  final double phase;
  final double radius;

  const _Bone({
    this.width,
    required this.height,
    required this.progress,
    this.phase = 0,
    this.radius = 4,
  });

  @override
  Widget build(BuildContext context) {
    final p = (progress + phase) % 1.0;
    final cx = p * 4.4 - 2.2;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(
          colors: const [Color(0xFFD0DCEB), Color(0xFFECF3FA), Color(0xFFD0DCEB)],
          begin: Alignment(cx - 0.9, 0),
          end: Alignment(cx + 0.9, 0),
        ),
      ),
      child: SizedBox(width: width, height: height),
    );
  }
}

// ─── Shared sub-components ────────────────────────────────────────────────────

class _BannerBone extends StatelessWidget {
  final double p;
  const _BannerBone({required this.p});

  @override
  Widget build(BuildContext context) =>
      _Bone(height: 88, progress: p, radius: 12);
}

class _SearchBarBone extends StatelessWidget {
  final double p;
  const _SearchBarBone({required this.p});

  @override
  Widget build(BuildContext context) => Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFD0DCEB)),
        ),
        child: Row(children: [
          _Bone(width: 16, height: 16, progress: p, radius: 3),
          const SizedBox(width: 8),
          Expanded(child: _Bone(height: 13, progress: p, phase: 0.02)),
        ]),
      );
}

class _TaskCardBone extends StatelessWidget {
  final double p, phase;
  const _TaskCardBone({required this.p, required this.phase});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD0DCEB)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: _Bone(height: 14, progress: p, phase: phase)),
            const SizedBox(width: 12),
            _Bone(width: 68, height: 22, progress: p, phase: phase + 0.02, radius: 11),
          ]),
          const SizedBox(height: 8),
          FractionallySizedBox(
            widthFactor: 0.75,
            child: _Bone(height: 11, progress: p, phase: phase + 0.03),
          ),
          const SizedBox(height: 8),
          Row(children: [
            _Bone(width: 110, height: 10, progress: p, phase: phase + 0.04),
            const SizedBox(width: 16),
            _Bone(width: 80, height: 10, progress: p, phase: phase + 0.05),
          ]),
        ]),
      );
}

class _StatCardBone extends StatelessWidget {
  final double p, phase;
  const _StatCardBone({required this.p, required this.phase});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD0DCEB)),
        ),
        child: Row(children: [
          _Bone(width: 40, height: 40, progress: p, phase: phase, radius: 8),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _Bone(height: 20, progress: p, phase: phase + 0.02),
              const SizedBox(height: 5),
              FractionallySizedBox(
                widthFactor: 0.7,
                child: _Bone(height: 11, progress: p, phase: phase + 0.04),
              ),
            ]),
          ),
        ]),
      );
}

class _CalendarBone extends StatelessWidget {
  final double p;
  const _CalendarBone({required this.p});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD0DCEB)),
        ),
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            _Bone(width: 20, height: 20, progress: p, radius: 10),
            _Bone(width: 80, height: 13, progress: p, phase: 0.02),
            _Bone(width: 20, height: 20, progress: p, phase: 0.04, radius: 10),
          ]),
          const SizedBox(height: 10),
          Row(children: List.generate(
            7,
            (i) => Expanded(
              child: Center(
                child: _Bone(width: 14, height: 10, progress: p, phase: i * 0.01),
              ),
            ),
          )),
          const SizedBox(height: 6),
          ...List.generate(
            5,
            (row) => Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(children: List.generate(
                7,
                (col) => Expanded(
                  child: Center(
                    child: _Bone(
                      width: 24,
                      height: 24,
                      progress: p,
                      phase: (row * 7 + col) * 0.008,
                      radius: 5,
                    ),
                  ),
                ),
              )),
            ),
          ),
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardSkeleton
// ─────────────────────────────────────────────────────────────────────────────

class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _DashBody(p: p));
}

class _DashBody extends StatelessWidget {
  final double p;
  const _DashBody({required this.p});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final hPad = isMobile ? 14.0 : 24.0;

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _BannerBone(p: p),
        const SizedBox(height: 20),
        Row(children: List.generate(3, (i) => Expanded(
          child: Padding(
            padding: EdgeInsets.only(left: i > 0 ? 12 : 0),
            child: _StatCardBone(p: p, phase: i * 0.06),
          ),
        ))),
        const SizedBox(height: 20),
        if (isMobile) ...[
          _SectionCardBone(p: p, phase: 0.00),
          const SizedBox(height: 14),
          _SectionCardBone(p: p, phase: 0.10),
          const SizedBox(height: 14),
          _SectionCardBone(p: p, phase: 0.20),
        ] else
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(children: [
                _SectionCardBone(p: p, phase: 0.00),
                const SizedBox(height: 14),
                _SectionCardBone(p: p, phase: 0.10),
                const SizedBox(height: 14),
                _SectionCardBone(p: p, phase: 0.20),
              ]),
            ),
            const SizedBox(width: 20),
            SizedBox(width: 260, child: _CalendarBone(p: p)),
          ]),
      ]),
    );
  }
}

class _SectionCardBone extends StatelessWidget {
  final double p, phase;
  const _SectionCardBone({required this.p, required this.phase});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD0DCEB)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Bone(width: 90, height: 10, progress: p, phase: phase),
          const SizedBox(height: 12),
          ...List.generate(3, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _Bone(height: 13, progress: p, phase: phase + i * 0.03),
              const SizedBox(height: 4),
              FractionallySizedBox(
                widthFactor: 0.65,
                child: _Bone(height: 10, progress: p, phase: phase + i * 0.03 + 0.01),
              ),
            ]),
          )),
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskManagerSkeleton
// ─────────────────────────────────────────────────────────────────────────────

class TaskManagerSkeleton extends StatelessWidget {
  const TaskManagerSkeleton({super.key});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _TaskManagerBody(p: p));
}

class _TaskManagerBody extends StatelessWidget {
  final double p;
  const _TaskManagerBody({required this.p});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final hPad = isMobile ? 14.0 : 24.0;

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _BannerBone(p: p),
        const SizedBox(height: 20),
        _SearchBarBone(p: p),
        const SizedBox(height: 16),
        ...List.generate(4, (i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _TaskCardBone(p: p, phase: i * 0.05),
        )),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MyTasksSkeleton
// ─────────────────────────────────────────────────────────────────────────────

class MyTasksSkeleton extends StatelessWidget {
  const MyTasksSkeleton({super.key});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _MyTasksBody(p: p));
}

class _MyTasksBody extends StatelessWidget {
  final double p;
  const _MyTasksBody({required this.p});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final hPad = isMobile ? 14.0 : 24.0;

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _BannerBone(p: p),
        const SizedBox(height: 20),
        _SearchBarBone(p: p),
        const SizedBox(height: 12),
        Row(children: List.generate(3, (i) => Padding(
          padding: EdgeInsets.only(right: i < 2 ? 8 : 0),
          child: _Bone(width: 72, height: 30, progress: p, phase: i * 0.03, radius: 15),
        ))),
        const SizedBox(height: 16),
        ...List.generate(5, (i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _TaskCardBone(p: p, phase: i * 0.05),
        )),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivitySkeleton
// ─────────────────────────────────────────────────────────────────────────────

class ActivitySkeleton extends StatelessWidget {
  const ActivitySkeleton({super.key});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _ActivityBody(p: p));
}

class _ActivityBody extends StatelessWidget {
  final double p;
  const _ActivityBody({required this.p});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final hPad = isMobile ? 14.0 : 24.0;

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(hPad, 4, hPad, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SizedBox(height: 4),
        _BannerBone(p: p),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFD0DCEB)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: _Bone(height: 15, progress: p)),
              const SizedBox(width: 12),
              _Bone(width: 24, height: 24, progress: p, phase: 0.02, radius: 12),
            ]),
            const SizedBox(height: 16),
            ...List.generate(5, (i) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(children: [
                _Bone(width: 40, height: 40, progress: p, phase: i * 0.04, radius: 8),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _Bone(height: 13, progress: p, phase: i * 0.04 + 0.01),
                    const SizedBox(height: 5),
                    FractionallySizedBox(
                      widthFactor: 0.55,
                      child: _Bone(height: 10, progress: p, phase: i * 0.04 + 0.02),
                    ),
                  ]),
                ),
                const SizedBox(width: 12),
                _Bone(width: 82, height: 24, progress: p, phase: i * 0.04 + 0.03, radius: 12),
              ]),
            )),
          ]),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EventManagementSkeleton
// ─────────────────────────────────────────────────────────────────────────────

class EventManagementSkeleton extends StatelessWidget {
  const EventManagementSkeleton({super.key});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _EventMgmtBody(p: p));
}

class _EventMgmtBody extends StatelessWidget {
  final double p;
  const _EventMgmtBody({required this.p});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Dark banner skeleton
        Container(
          height: 148,
          decoration: BoxDecoration(
            color: const Color(0xFF1E2126),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 220,
                height: 30,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: 300,
                height: 12,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        if (isMobile)
          _EventListBone(p: p)
        else
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: _EventListBone(p: p)),
            const SizedBox(width: 20),
            SizedBox(width: 290, child: _CalendarBone(p: p)),
          ]),
      ]),
    );
  }
}

class _EventListBone extends StatelessWidget {
  final double p;
  const _EventListBone({required this.p});

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            _Bone(width: 84, height: 30, progress: p, radius: 6),
            const SizedBox(width: 8),
            _Bone(width: 84, height: 30, progress: p, phase: 0.03, radius: 6),
          ]),
          const SizedBox(height: 12),
          ...List.generate(4, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _EventCardBone(p: p, phase: i * 0.05),
          )),
        ],
      );
}

class _EventCardBone extends StatelessWidget {
  final double p, phase;
  const _EventCardBone({required this.p, required this.phase});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD0DCEB)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: _Bone(height: 14, progress: p, phase: phase)),
            const SizedBox(width: 12),
            _Bone(width: 90, height: 22, progress: p, phase: phase + 0.02, radius: 11),
          ]),
          const SizedBox(height: 8),
          FractionallySizedBox(
            widthFactor: 0.6,
            child: _Bone(height: 10, progress: p, phase: phase + 0.03),
          ),
          const SizedBox(height: 8),
          _Bone(width: 100, height: 10, progress: p, phase: phase + 0.04),
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileSkeleton
// ─────────────────────────────────────────────────────────────────────────────

class ProfileSkeleton extends StatelessWidget {
  const ProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _ProfileBody(p: p));
}

class _ProfileBody extends StatelessWidget {
  final double p;
  const _ProfileBody({required this.p});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final hPad = isMobile ? 14.0 : 24.0;

    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(hPad, 8, hPad, 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Avatar card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFD0DCEB)),
          ),
          child: Column(children: [
            _Bone(width: 80, height: 80, progress: p, radius: 40),
            const SizedBox(height: 12),
            _Bone(width: 160, height: 17, progress: p, phase: 0.02),
            const SizedBox(height: 6),
            _Bone(width: 100, height: 13, progress: p, phase: 0.04),
            const SizedBox(height: 6),
            _Bone(width: 80, height: 22, progress: p, phase: 0.05, radius: 11),
          ]),
        ),
        const SizedBox(height: 16),
        // Info card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFD0DCEB)),
          ),
          child: Column(
            children: List.generate(6, (i) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(children: [
                SizedBox(
                  width: 120,
                  child: _Bone(height: 12, progress: p, phase: i * 0.03),
                ),
                const SizedBox(width: 16),
                Expanded(child: _Bone(height: 12, progress: p, phase: i * 0.03 + 0.02)),
              ]),
            )),
          ),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDetailSkeleton
// ─────────────────────────────────────────────────────────────────────────────

class TaskDetailSkeleton extends StatelessWidget {
  /// Pass true when the screen is used inside a route (has onBack), false when
  /// it wraps its own Scaffold.
  final bool hasBack;
  const TaskDetailSkeleton({super.key, this.hasBack = false});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _TaskDetailBody(p: p, hasBack: hasBack));
}

class _TaskDetailBody extends StatelessWidget {
  final double p;
  final bool hasBack;
  const _TaskDetailBody({required this.p, required this.hasBack});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final body = isMobile ? _buildMobile() : _buildDesktop();
    if (hasBack) return body;
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4F8),
      body: body,
    );
  }

  Widget _buildDesktop() => Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: SingleChildScrollView(
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(28, 14, 28, 28),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _Bone(width: 80, height: 28, progress: p, radius: 6),
                const SizedBox(height: 18),
                _Bone(height: 22, progress: p, phase: 0.02),
                const SizedBox(height: 8),
                FractionallySizedBox(
                  widthFactor: 0.55,
                  child: _Bone(height: 13, progress: p, phase: 0.03),
                ),
                const SizedBox(height: 20),
                _Bone(height: 12, progress: p, phase: 0.04),
                const SizedBox(height: 5),
                _Bone(height: 12, progress: p, phase: 0.05),
                const SizedBox(height: 5),
                FractionallySizedBox(
                  widthFactor: 0.8,
                  child: _Bone(height: 12, progress: p, phase: 0.06),
                ),
                const SizedBox(height: 20),
                ...List.generate(4, (i) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(children: [
                    _Bone(width: 100, height: 12, progress: p, phase: i * 0.04 + 0.07),
                    const SizedBox(width: 12),
                    Expanded(child: _Bone(height: 12, progress: p, phase: i * 0.04 + 0.09)),
                  ]),
                )),
              ]),
            ),
          ),
          Container(
            width: 320,
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(left: BorderSide(color: Color(0xFFD0DCEB))),
            ),
            child: SingleChildScrollView(
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _Bone(width: 80, height: 13, progress: p, phase: 0.10),
                const SizedBox(height: 16),
                ...List.generate(5, (i) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(children: [
                    _Bone(width: 36, height: 36, progress: p, phase: i * 0.03 + 0.10, radius: 18),
                    const SizedBox(width: 10),
                    Expanded(child: _Bone(height: 13, progress: p, phase: i * 0.03 + 0.11)),
                  ]),
                )),
              ]),
            ),
          ),
        ],
      );

  Widget _buildMobile() => SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Bone(width: 80, height: 28, progress: p, radius: 6),
          const SizedBox(height: 18),
          _Bone(height: 22, progress: p, phase: 0.02),
          const SizedBox(height: 8),
          FractionallySizedBox(
            widthFactor: 0.55,
            child: _Bone(height: 13, progress: p, phase: 0.03),
          ),
          const SizedBox(height: 20),
          _Bone(height: 12, progress: p, phase: 0.04),
          const SizedBox(height: 5),
          _Bone(height: 12, progress: p, phase: 0.05),
          const SizedBox(height: 5),
          FractionallySizedBox(
            widthFactor: 0.8,
            child: _Bone(height: 12, progress: p, phase: 0.06),
          ),
          const SizedBox(height: 20),
          ...List.generate(4, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              _Bone(width: 100, height: 12, progress: p, phase: i * 0.04 + 0.07),
              const SizedBox(width: 12),
              Expanded(child: _Bone(height: 12, progress: p, phase: i * 0.04 + 0.09)),
            ]),
          )),
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppraisalTabSkeleton  (used by both SpecialTasks and Events tabs)
// ─────────────────────────────────────────────────────────────────────────────

class AppraisalTabSkeleton extends StatelessWidget {
  const AppraisalTabSkeleton({super.key});

  @override
  Widget build(BuildContext context) =>
      _Shimmer(body: (p) => _AppraisalTabBody(p: p));
}

class _AppraisalTabBody extends StatelessWidget {
  final double p;
  const _AppraisalTabBody({required this.p});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // 4 stat cards
        Row(children: List.generate(4, (i) => Expanded(
          child: Padding(
            padding: EdgeInsets.only(left: i > 0 ? 12 : 0),
            child: _StatCardBone(p: p, phase: i * 0.05),
          ),
        ))),
        const SizedBox(height: 16),
        // Section label
        _Bone(width: 140, height: 13, progress: p, phase: 0.20),
        const SizedBox(height: 12),
        // Table header
        Container(
          height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFFC8D6E5),
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: List.generate(5, (i) => Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: i < 4 ? 12 : 0),
              child: _Bone(height: 12, progress: p, phase: 0.22 + i * 0.02),
            ),
          ))),
        ),
        const SizedBox(height: 4),
        // Table rows
        ...List.generate(6, (i) => Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            border: i < 5
                ? const Border(bottom: BorderSide(color: Color(0xFFD0DCEB)))
                : null,
          ),
          child: Row(children: List.generate(5, (col) => Expanded(
            child: Padding(
              padding: EdgeInsets.only(right: col < 4 ? 12 : 0),
              child: _Bone(
                height: 12,
                progress: p,
                phase: 0.24 + i * 0.02 + col * 0.01,
              ),
            ),
          ))),
        )),
      ]),
    );
  }
}
