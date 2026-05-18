import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/theme.dart';
import '../../shared/widgets/shared_widgets.dart';
import 'models/appraisal_models.dart';

class AnalyticsTab extends StatelessWidget {
  /// The pre-built page header passed from [AppraisalScreen].
  final Widget pageHeader;
  final Map<String, Map<String, dynamic>> evaluations;
  final Map<String, List<AttendeeRating>> newRatings;

  const AnalyticsTab({
    super.key,
    required this.pageHeader,
    required this.evaluations,
    required this.newRatings,
  });

  List<FacultyPerformance> _getRealTimeFaculty() {
    return sampleFaculty.map((f) {
      final facultyTasks = sampleTasks.where((t) => t.personnel == f.name).toList();

      final List<int> scores = [];
      for (final t in facultyTasks) {
        final eval = evaluations[t.id];
        if (eval != null) {
          final int? s = eval['score'] as int?;
          if (s != null) scores.add(s);
        } else if (t.score != null) {
          scores.add(t.score!);
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

  @override
  Widget build(BuildContext context) {
    final realTimeFaculty = _getRealTimeFaculty();

    final avgPerformance = (realTimeFaculty
                .map((f) => f.overallScore)
                .reduce((a, b) => a + b) /
            realTimeFaculty.length)
        .toStringAsFixed(1);

    final tasksCompleted = sampleTasks.where((t) {
      final hasEval = evaluations.containsKey(t.id);
      if (hasEval) return true;
      return t.status == TaskStatus.evaluated || t.status == TaskStatus.flagged;
    }).length;

    final eventsCompleted = sampleEvents.where((e) {
      final hasRatings = newRatings.containsKey(e.id) && newRatings[e.id]!.isNotEmpty;
      if (hasRatings) return true;
      return e.status == EventStatus.rated;
    }).length;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Scrollable page header ────────────────────────────────────────
          pageHeader,

          // ── Tab content ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Summary stat cards
                Row(children: [
                  Expanded(
                      child: StatCard(
                    label: 'Overall Performance',
                    value: '$avgPerformance%',
                    valueColor: AppColors.success,
                    icon: const Icon(Icons.trending_up,
                        color: AppColors.success, size: 20),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                      child: StatCard(
                    label: 'Total Personnel',
                    value: '${sampleFaculty.length}',
                    valueColor: AppColors.textPrimary,
                    icon: const Icon(Icons.people,
                        color: AppColors.info, size: 20),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                      child: StatCard(
                    label: 'Special Tasks',
                    value: '$tasksCompleted',
                    valueColor: AppColors.amber,
                    icon: const Icon(Icons.assignment,
                        color: AppColors.amber, size: 20),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                      child: StatCard(
                    label: 'Events Evaluated',
                    value: '$eventsCompleted',
                    valueColor: AppColors.info,
                    icon: const Icon(Icons.calendar_today,
                        color: AppColors.info, size: 20),
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
                            const Text('Department Performance',
                                style: AppTextStyles.sectionTitle),
                            const SizedBox(height: 16),
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
                            const Text('Top Performers',
                                style: AppTextStyles.sectionTitle),
                            const SizedBox(height: 16),
                            _TopPerformers(faculty: realTimeFaculty),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
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