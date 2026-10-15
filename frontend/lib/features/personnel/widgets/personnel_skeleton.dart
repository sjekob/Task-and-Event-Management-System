import 'package:flutter/material.dart';

/// Shimmer skeleton that mirrors the personnel table's column layout.
class PersonnelSkeleton extends StatefulWidget {
  const PersonnelSkeleton({super.key});

  @override
  State<PersonnelSkeleton> createState() => _PersonnelSkeletonState();
}

class _PersonnelSkeletonState extends State<PersonnelSkeleton>
    with SingleTickerProviderStateMixin {
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
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => _SkeletonTable(progress: _ctrl.value),
    );
  }
}

class _SkeletonTable extends StatelessWidget {
  final double progress;
  const _SkeletonTable({required this.progress});

  static const _flexes = [1, 3, 2, 2, 2, 2, 1];
  static const _factors = [0.6, 0.85, 0.7, 0.65, 0.75, 0.7, 0.4];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD0DCEB)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            height: 44,
            decoration: const BoxDecoration(
              color: Color(0xFFC8D6E5),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(11),
                topRight: Radius.circular(11),
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _boneRow(List.filled(7, 0.9), isHeader: true),
          ),
          // Data rows
          for (int i = 0; i < 7; i++)
            Container(
              height: 56,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(
                border: i < 6
                    ? const Border(
                        bottom: BorderSide(color: Color(0xFFD0DCEB)))
                    : null,
              ),
              child: _boneRow(_factors, rowIndex: i),
            ),
        ],
      ),
    );
  }

  Widget _boneRow(List<double> factors,
      {bool isHeader = false, int rowIndex = 0}) {
    final children = <Widget>[];
    for (int i = 0; i < _flexes.length; i++) {
      children.add(Expanded(
        flex: _flexes[i],
        child: Align(
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: factors[i],
            child: _Bone(
              height: isHeader ? 14 : 12,
              progress: progress,
              phase: i * 0.03 + rowIndex * 0.01,
            ),
          ),
        ),
      ));
      if (i < _flexes.length - 1) children.add(const SizedBox(width: 20));
    }
    return Row(children: children);
  }
}

class _Bone extends StatelessWidget {
  final double height;
  final double progress;
  final double phase;

  const _Bone({
    required this.height,
    required this.progress,
    this.phase = 0,
  });

  @override
  Widget build(BuildContext context) {
    // Sweep highlight band: centre travels -2.2→2.2 in Alignment x-space
    final p = (progress + phase) % 1.0;
    final cx = p * 4.4 - 2.2;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        gradient: LinearGradient(
          colors: const [
            Color(0xFFD0DCEB),
            Color(0xFFECF3FA),
            Color(0xFFD0DCEB),
          ],
          begin: Alignment(cx - 0.9, 0),
          end: Alignment(cx + 0.9, 0),
        ),
      ),
      child: SizedBox(height: height),
    );
  }
}
