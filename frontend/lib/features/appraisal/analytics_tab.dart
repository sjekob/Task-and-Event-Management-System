import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/theme.dart';
import '../../core/role_service.dart';
import '../../shared/widgets/shared_widgets.dart';
import 'models/appraisal_models.dart';

class AnalyticsTab extends StatelessWidget {
  final Widget pageHeader;
  final String role;
  final String username;
  final Map<String, Map<String, dynamic>> evaluations;
  final Map<String, List<AttendeeRating>> newRatings;

  const AnalyticsTab({
    super.key,
    required this.pageHeader,
    required this.role,
    required this.username,
    required this.evaluations,
    required this.newRatings,
  });

  RolePermissions get _perms => RolePermissions(role);

  /// Infer coordinator's department from their username prefix (e.g. "coord.Santos_Engineering" → "Engineering").
  /// For demo purposes, we use the last part after underscore; fallback to first dept found.
  String? get _coordDepartment {
    if (role != 'coordinator') return null;
    final parts = username.split('.');
    if (parts.length > 1) {
      final sub = parts[1].split('_');
      if (sub.length > 1) return sub.last;
    }
    // Fallback: coordinators see Engineering in demo
    return 'Engineering';
  }

  List<FacultyPerformance> _getRealTimeFaculty() {
    final source = (role == 'coordinator' && _coordDepartment != null)
        ? sampleFaculty.where((f) => f.department == _coordDepartment).toList()
        : sampleFaculty;

    return source.map((f) {
      final facultyTasks = sampleTasks.where((t) => t.personnel == f.name).toList();

      final List<int> scores = [];
      for (final t in facultyTasks) {
        final eval = evaluations[t.id];
        if (eval != null) {
          final int? s = eval['score'] as int?;
          if (s != null) scores.add(s);
        } else {
          final sc = t.getScore();
          if (sc > 0) scores.add(sc);
        }
      }

      final int? realTimeTaskScore = scores.isEmpty
          ? f.taskScore
          : (scores.reduce((a, b) => a + b) / scores.length).round();

      final int realTimeOverallScore = realTimeTaskScore != null
          ? ((f.reportScore ?? 100) + realTimeTaskScore) ~/ 2
          : (f.reportScore ?? 100);

      AppraisalGrade grade = AppraisalGrade.satisfactory;
      if (realTimeOverallScore >= 90) {
        grade = AppraisalGrade.outstanding;
      } else if (realTimeOverallScore >= 80) {
        grade = AppraisalGrade.verySatisfactory;
      } else if (realTimeOverallScore >= 70) {
        grade = AppraisalGrade.satisfactory;
      } else {
        grade = AppraisalGrade.unsatisfactory;
      }

      return FacultyPerformance(
        name: f.name,
        department: f.department,
        reportScore: f.reportScore,
        taskScore: realTimeTaskScore,
        eventScore: f.eventScore,
        overallScore: realTimeOverallScore,
        grade: grade,
        trend: f.trend,
      );
    }).toList()..sort((a, b) => b.overallScore.compareTo(a.overallScore));
  }

  List<FacultyPerformance> get _flaggedPersonnel {
    return _getRealTimeFaculty().where((f) => f.overallScore < 60).toList();
  }

  @override
  Widget build(BuildContext context) {
    final realTimeFaculty = _getRealTimeFaculty();
    final flagged = _flaggedPersonnel;
    final isCoordinator = role == 'coordinator';
    final scopeLabel = isCoordinator && _coordDepartment != null
        ? '${_coordDepartment!} Department'
        : 'School-Wide';

    // Role-specific notes
    final bool isPrincipal = role == 'principal';

    final avgPerformance = realTimeFaculty.isEmpty
        ? '0.0'
        : (realTimeFaculty
                    .map((f) => f.overallScore)
                    .reduce((a, b) => a + b) /
                realTimeFaculty.length)
            .toStringAsFixed(1);

    final sourceTasks = isCoordinator && _coordDepartment != null
        ? sampleTasks.where((t) => t.department == _coordDepartment).toList()
        : sampleTasks;

    final tasksCompleted = sourceTasks.where((t) {
      final hasEval = evaluations.containsKey(t.id);
      if (hasEval) return true;
      return t.status == TaskStatus.evaluated || t.status == TaskStatus.flagged;
    }).length;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          pageHeader,
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [

                // ── Scope banner ─────────────────────────────────────────────
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBFDBFE), width: 0.8),
                  ),
                  child: Row(children: [
                    const Icon(Icons.info_outline, color: AppColors.info, size: 16),
                    const SizedBox(width: 8),
                    Text(
                      isCoordinator
                          ? 'Showing compliance data for $scopeLabel only. You can only view personnel under your area.'
                          : 'Showing school-wide compliance dashboard for all faculty. Read-only view — no evaluation submission.',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.info),
                    ),
                  ]),
                ),

                // ── Escalation Alerts ─────────────────────────────────────────
                if (flagged.isNotEmpty && (_perms.canViewEscalationAlerts || isPrincipal || isCoordinator)) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFECACA), width: 0.8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          const Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            'Escalation Alerts — ${flagged.length} personnel below threshold',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.danger),
                          ),
                        ]),
                        const SizedBox(height: 12),
                        ...flagged.map((f) => Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(7),
                            border: Border.all(color: const Color(0xFFFECACA), width: 0.8),
                          ),
                          child: Row(children: [
                            const Icon(Icons.person_outline, color: AppColors.danger, size: 16),
                            const SizedBox(width: 8),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(f.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                              Text(f.department, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ])),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text('${f.overallScore}% — Below 60', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.danger)),
                            ),
                          ]),
                        )),
                        const SizedBox(height: 4),
                        const Text(
                          'These personnel have been automatically flagged. Supervisor notification has been sent.',
                          style: TextStyle(fontSize: 12, color: AppColors.danger, fontStyle: FontStyle.italic),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Summary stat cards ─────────────────────────────────────
                Row(children: [
                  Expanded(
                      child: StatCard(
                    label: '$scopeLabel Performance',
                    value: '$avgPerformance%',
                    valueColor: AppColors.success,
                    icon: const Icon(Icons.trending_up, color: AppColors.success, size: 20),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                      child: StatCard(
                    label: 'Total Personnel',
                    value: '${realTimeFaculty.length}',
                    valueColor: AppColors.textPrimary,
                    icon: const Icon(Icons.people, color: AppColors.info, size: 20),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                      child: StatCard(
                    label: 'Tasks Completed',
                    value: '$tasksCompleted',
                    valueColor: AppColors.amber,
                    icon: const Icon(Icons.assignment, color: AppColors.amber, size: 20),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                      child: StatCard(
                    label: 'Flagged Personnel',
                    value: '${flagged.length}',
                    valueColor: flagged.isNotEmpty ? AppColors.danger : AppColors.success,
                    icon: Icon(Icons.flag, color: flagged.isNotEmpty ? AppColors.danger : AppColors.success, size: 20),
                  )),
                ]),

                const SizedBox(height: 20),

                // Monthly trends chart
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Monthly Performance Trend',
                          style: AppTextStyles.sectionTitle),
                      const SizedBox(height: 16),
                      SizedBox(
                          height: 250,
                          child: _MonthlyTrendChart(
                              realTimeOverallAvg: double.parse(avgPerformance))),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Department Performance & Top Performers
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: SectionCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isCoordinator ? 'Personnel Compliance Points' : 'Department Performance',
                              style: AppTextStyles.sectionTitle,
                            ),
                            const SizedBox(height: 16),
                            if (role == 'teacher')
                              _PersonalComplianceOverview(username: username, evaluations: evaluations, newRatings: newRatings)
                            else if (role == 'dean')
                              _DeanTaskOverview(username: username, faculty: realTimeFaculty, evaluations: evaluations)
                            else if (role == 'coordinator')
                              _PersonnelCompliance(faculty: realTimeFaculty)
                            else
                              _DepartmentPerformance(faculty: realTimeFaculty),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: SectionCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Top Performers', style: AppTextStyles.sectionTitle),
                            const SizedBox(height: 16),
                            _TopPerformers(faculty: realTimeFaculty),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                // Export button — Principal only
                if (role == 'principal') ...[
                  const SizedBox(height: 20),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.tabActive,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Generating consolidated DepEd Annual Faculty Evaluation report…'),
                            backgroundColor: AppColors.tabActive,
                          ),
                        );
                      },
                      icon: const Icon(Icons.download_rounded, color: Colors.white, size: 18),
                      label: const Text('Export Consolidated Report', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Personnel Compliance table for Coordinators ────────────────────────────
class _PersonnelCompliance extends StatelessWidget {
  final List<FacultyPerformance> faculty;
  const _PersonnelCompliance({required this.faculty});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: faculty.map((f) {
        final stars = (f.overallScore / 20).clamp(1, 5).round();
        final compliancePts = stars * 20;
        final isFlagged = stars < 3;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isFlagged ? const Color(0xFFFFF1F1) : AppColors.pageBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isFlagged ? const Color(0xFFFECACA) : AppColors.cardBorder,
              width: 0.8,
            ),
          ),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(f.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 2),
              Row(children: List.generate(5, (i) => Icon(
                i < stars ? Icons.star_rounded : Icons.star_outline_rounded,
                color: AppColors.amber, size: 14,
              ))),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('$compliancePts pts', style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w700,
                color: isFlagged ? AppColors.danger : AppColors.success,
              )),
              if (isFlagged)
                const Text('⚠ Below threshold', style: TextStyle(fontSize: 11, color: AppColors.danger)),
            ]),
          ]),
        );
      }).toList(),
    );
  }
}

class _MonthlyTrendChart extends StatelessWidget {
  final double realTimeOverallAvg;

  const _MonthlyTrendChart({required this.realTimeOverallAvg});

  @override
  Widget build(BuildContext context) {
    return BarChart(
      BarChartData(
        minY: 0,
        maxY: 100,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: 25,
          getDrawingHorizontalLine: (v) => const FlLine(
            color: Color(0xFFEEEEEE),
            strokeWidth: 1,
          ),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, meta) {
                const months = [
                  'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'
                ];
                if (v.toInt() < months.length) {
                  return Text(months[v.toInt()],
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary));
                }
                return const SizedBox();
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, meta) => Text('${v.toInt()}%',
                  style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary)),
              reservedSize: 40,
            ),
          ),
          topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false)),
        ),
        barGroups: [
          BarChartGroupData(x: 0, barRods: [BarChartRodData(toY: 72.3, color: const Color(0xFF7B95B8))]),
          BarChartGroupData(x: 1, barRods: [BarChartRodData(toY: 75.1, color: const Color(0xFF7B95B8))]),
          BarChartGroupData(x: 2, barRods: [BarChartRodData(toY: 76.8, color: const Color(0xFF7B95B8))]),
          BarChartGroupData(x: 3, barRods: [BarChartRodData(toY: 77.5, color: const Color(0xFF7B95B8))]),
          BarChartGroupData(x: 4, barRods: [BarChartRodData(toY: 79.2, color: const Color(0xFF7B95B8))]),
          BarChartGroupData(x: 5, barRods: [BarChartRodData(toY: 80.4, color: const Color(0xFF7B95B8))]),
          BarChartGroupData(x: 6, barRods: [BarChartRodData(toY: 81.6, color: const Color(0xFF7B95B8))]),
          BarChartGroupData(x: 7, barRods: [BarChartRodData(toY: realTimeOverallAvg, color: const Color(0xFF7B95B8))]),
        ],
      ),
    );
  }
}

class _DepartmentPerformance extends StatelessWidget {
  final List<FacultyPerformance> faculty;

  const _DepartmentPerformance({required this.faculty});

  @override
  Widget build(BuildContext context) {
    final engScores = faculty.where((f) => f.department == 'Engineering').map((f) => f.overallScore);
    final busScores = faculty.where((f) => f.department == 'Business').map((f) => f.overallScore);
    final sciScores = faculty.where((f) => f.department == 'Sciences').map((f) => f.overallScore);

    final engAvg = engScores.isEmpty ? 82.3 : (engScores.reduce((a, b) => a + b) / engScores.length).roundToDouble();
    final busAvg = busScores.isEmpty ? 76.8 : (busScores.reduce((a, b) => a + b) / busScores.length).roundToDouble();
    final sciAvg = sciScores.isEmpty ? 85.1 : (sciScores.reduce((a, b) => a + b) / sciScores.length).roundToDouble();

    final departments = [
      ('Engineering', engAvg, AppColors.success),
      ('Business',    busAvg, AppColors.info),
      ('Sciences',    sciAvg, AppColors.success),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: departments.map((dept) {
        final (name, score, color) = dept;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textPrimary)),
                Text('$score%',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: color)),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: score / 100,
                minHeight: 6,
                backgroundColor: const Color(0xFFE5E7EB),
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
            const SizedBox(height: 12),
          ],
        );
      }).toList(),
    );
  }
}

class _TopPerformers extends StatelessWidget {
  final List<FacultyPerformance> faculty;

  static const _rankColors = [
    Color(0xFFFCD34D),  // 1st – gold
    Color(0xFF9CA3AF),  // 2nd – silver
    Color(0xFFCD7F32),  // 3rd – bronze
    AppColors.info,     // 4th
    AppColors.success,  // 5th
  ];

  const _TopPerformers({required this.faculty});

  @override
  Widget build(BuildContext context) {
    final topPerformers = faculty
        .asMap()
        .entries
        .toList()
        .sublist(0, faculty.length.clamp(0, 5));

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: topPerformers.length,
      itemBuilder: (context, index) {
        final fVal = topPerformers[index].value;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: _rankColors[index],
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text('${index + 1}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 12)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(fVal.name,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textPrimary)),
                    Text(fVal.department,
                        style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary)),
                  ],
                ),
              ),
              Text('${fVal.overallScore}%',
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.success)),
            ],
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Role-specific small widgets
// ─────────────────────────────────────────────────────────────────────────────

class MiniStat extends StatelessWidget {
  final String label;
  final String value;
  const MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
      ]),
    );
  }
}

class _PersonalComplianceOverview extends StatelessWidget {
  final String username;
  final Map<String, Map<String, dynamic>> evaluations;
  final Map<String, List<AttendeeRating>> newRatings;

  const _PersonalComplianceOverview({required this.username, required this.evaluations, required this.newRatings});

  @override
  Widget build(BuildContext context) {
    final myTasks = sampleTasks.where((t) => t.personnel == username).toList();
    final List<int> taskScores = [];
    for (final t in myTasks) {
      final eval = evaluations[t.id];
      if (eval != null && eval['score'] is int) {
        taskScores.add(eval['score'] as int);
      } else {
        final s = t.getScore();
        if (s > 0) taskScores.add(s);
      }
    }

    // Flatten event ratings and filter by evaluator name
    final allRatings = newRatings.values.expand((l) => l).where((r) => r.name == username).toList();

    final avgTask = taskScores.isEmpty ? 0 : (taskScores.reduce((a, b) => a + b) / taskScores.length).round();
    final avgEvent = allRatings.isEmpty ? 0 : (allRatings.map((r) => r.overallScore).reduce((a, b) => a + b) / allRatings.length).round();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: MiniStat(label: 'Avg Task Score', value: '$avgTask')),
        const SizedBox(width: 12),
        Expanded(child: MiniStat(label: 'Avg Event Rating', value: '$avgEvent')),
      ]),
      const SizedBox(height: 12),
      const Text('Performance Standing', style: AppTextStyles.statLabel),
      const SizedBox(height: 8),
      LinearProgressIndicator(value: ((avgTask + avgEvent) / 2) / 100, minHeight: 8, backgroundColor: const Color(0xFFE5E7EB), color: AppColors.success),
    ]);
  }
}

class _DeanTaskOverview extends StatelessWidget {
  final String username;
  final List<FacultyPerformance> faculty;
  final Map<String, Map<String, dynamic>> evaluations;

  const _DeanTaskOverview({required this.username, required this.faculty, required this.evaluations});

  @override
  Widget build(BuildContext context) {
    final myEvaluatedTasks = evaluations.entries.where((e) {
      final meta = e.value;
      // backend stores evaluator name under 'evaluator' or not; we tolerate both
      final evName = meta['evaluator'] ?? meta['evaluatorName'] ?? '';
      return evName == username;
    }).map((e) => e.value).toList();

    final departmentTeachers = faculty.where((f) => f.department == faculty.first.department).toList();

    final barValues = myEvaluatedTasks.map((m) => (m['score'] as int?)?.toDouble() ?? 0.0).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Your Evaluated Tasks (${barValues.length})', style: AppTextStyles.statLabel),
      const SizedBox(height: 10),
      SizedBox(height: 140, child: _SimpleBarChart(values: barValues)),
      const SizedBox(height: 12),
      Text('Teachers Under Your Supervision (${departmentTeachers.length})', style: AppTextStyles.statLabel),
      const SizedBox(height: 8),
      SizedBox(height: 120, child: _TeacherList(teachers: departmentTeachers)),
    ]);
  }
}

class _SimpleBarChart extends StatelessWidget {
  final List<double> values;
  const _SimpleBarChart({required this.values});

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) return const Center(child: Text('No data'));
    return BarChart(BarChartData(
      alignment: BarChartAlignment.spaceBetween,
      barGroups: List.generate(values.length, (i) => BarChartGroupData(x: i, barRods: [BarChartRodData(toY: values[i], color: AppColors.info, width: 12)])),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(show: false),
      gridData: FlGridData(show: false),
    ));
  }
}

class _TeacherList extends StatelessWidget {
  final List<FacultyPerformance> teachers;
  const _TeacherList({required this.teachers});

  @override
  Widget build(BuildContext context) {
    if (teachers.isEmpty) return const Center(child: Text('No teachers'));
    return ListView.builder(
      itemCount: teachers.length,
      itemBuilder: (c, i) => ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(teachers[i].name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: Text('${teachers[i].overallScore}% • ${teachers[i].department}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ),
    );
  }
}