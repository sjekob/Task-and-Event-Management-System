import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/theme.dart';
import '../../core/role_service.dart';
import '../../shared/widgets/shared_widgets.dart';
import 'models/appraisal_models.dart';

class AnalyticsTab extends StatefulWidget {
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

  @override
  State<AnalyticsTab> createState() => _AnalyticsTabState();
}

class _AnalyticsTabState extends State<AnalyticsTab> {
  // Cached computed faculty list — recalculated whenever evaluations change
  late List<FacultyPerformance> _faculty;

  @override
  void initState() {
    super.initState();
    _faculty = _getRealTimeFaculty();
  }

  @override
  void didUpdateWidget(AnalyticsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Force recompute whenever evaluations or ratings change
    if (oldWidget.evaluations != widget.evaluations ||
        oldWidget.newRatings != widget.newRatings) {
      setState(() {
        _faculty = _getRealTimeFaculty();
      });
    }
  }

  RolePermissions get _perms => RolePermissions(widget.role);

  List<FacultyPerformance> _getRealTimeFaculty() {
    // Show all faculty for coordinators in demo mode (real app would scope by dept)
    final source = sampleFaculty;

    return source.map((f) {
      final facultyTasks = sampleTasks.where((t) => t.personnel == f.name).toList();

      final List<int> scores = [];
      for (final t in facultyTasks) {
        final eval = widget.evaluations[t.id];
        if (eval != null) {
          // Type-safe parse: handle both int and double from backend
          final raw = eval['score'];
          final int s = raw is num ? raw.round() : 0;
          if (s > 0) scores.add(s);
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

  List<FacultyPerformance> get _flaggedPersonnel =>
      _faculty.where((f) => f.overallScore < 75).toList();

  @override
  Widget build(BuildContext context) {
    switch (widget.role) {
      case 'teacher':
        return SingleChildScrollView(child: _buildTeacherView(context));
      case 'dean':
        return SingleChildScrollView(child: _buildDeanView(context));
      case 'coordinator':
        return SingleChildScrollView(child: _buildCoordinatorView(context));
      case 'principal':
      default:
        return SingleChildScrollView(child: _buildPrincipalView(context));
    }
  }

  Widget _buildTeacherView(BuildContext context) {
    final myFaculty = sampleFaculty.firstWhere((f) => f.name == widget.username, orElse: () => sampleFaculty.first);
    final myTasks = sampleTasks.where((t) => t.personnel == widget.username).toList();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.pageHeader,
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('My Personal Analytics', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(child: StatCard(label: 'Compliance Points', value: '${myFaculty.overallScore}%', valueColor: AppColors.success, icon: const Icon(Icons.star_rounded, color: AppColors.success, size: 20))),
                  const SizedBox(width: 12),
                  Expanded(child: StatCard(label: 'Tasks Completed', value: '${myTasks.length}', valueColor: AppColors.textPrimary, icon: const Icon(Icons.assignment_turned_in, color: AppColors.info, size: 20))),
                  const SizedBox(width: 12),
                  Expanded(child: StatCard(label: 'Performance Standing', value: myFaculty.overallScore >= 60 ? 'Good' : 'Flagged', valueColor: myFaculty.overallScore >= 60 ? AppColors.success : AppColors.danger, icon: const Icon(Icons.verified_user, color: AppColors.success, size: 20))),
                ],
              ),
              const SizedBox(height: 24),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Compliance Trend & Rubric Averages', style: AppTextStyles.sectionTitle),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 200,
                      child: _MonthlyTrendChart(realTimeOverallAvg: myFaculty.overallScore.toDouble()),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDeanView(BuildContext context) {
    final realTimeFaculty = _faculty;
    final myDeptFaculty = realTimeFaculty.where((f) => f.department == (sampleFaculty.firstWhere((x) => x.name == widget.username, orElse: () => sampleFaculty.first).department)).toList();
    final myFaculty = sampleFaculty.firstWhere((f) => f.name == widget.username, orElse: () => sampleFaculty.first);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.pageHeader,
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Dean Analytics Dashboard', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(child: StatCard(label: 'My Compliance Points', value: '${myFaculty.overallScore}%', valueColor: AppColors.success, icon: const Icon(Icons.star_rounded, color: AppColors.success, size: 20))),
                  const SizedBox(width: 12),
                  Expanded(child: StatCard(label: 'My Standing', value: myFaculty.overallScore >= 60 ? 'Good' : 'Flagged', valueColor: myFaculty.overallScore >= 60 ? AppColors.success : AppColors.danger, icon: const Icon(Icons.flag, color: AppColors.success, size: 20))),
                  const SizedBox(width: 12),
                  Expanded(child: StatCard(label: 'Teachers Under Supervision', value: '${myDeptFaculty.length}', valueColor: AppColors.textPrimary, icon: const Icon(Icons.people, color: AppColors.info, size: 20))),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('My Task Rating Trends', style: AppTextStyles.sectionTitle),
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 200,
                            child: _MonthlyTrendChart(realTimeOverallAvg: myFaculty.overallScore.toDouble()),
                          ),
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
                          const Text('Department Compliance Averages', style: AppTextStyles.sectionTitle),
                          const SizedBox(height: 16),
                          _DepartmentPerformance(faculty: myDeptFaculty),
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
    );
  }

  Widget _buildPrincipalView(BuildContext context) {
    final realTimeFaculty = _faculty;
    final flagged = _flaggedPersonnel;
    
    final avgPerformance = realTimeFaculty.isEmpty
        ? '0.0'
        : (realTimeFaculty
                    .map((f) => f.overallScore)
                    .reduce((a, b) => a + b) /
                realTimeFaculty.length)
            .toStringAsFixed(1);

    final tasksCompleted = sampleTasks.where((t) {
      final hasEval = widget.evaluations.containsKey(t.id);
      if (hasEval) return true;
      return t.status == TaskStatus.evaluated || t.status == TaskStatus.flagged;
    }).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.pageHeader,
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
                  child: const Row(children: [
                    Icon(Icons.info_outline, color: AppColors.info, size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Showing school-wide compliance dashboard for all faculty. Read-only view.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.info),
                    ),
                  ]),
                ),

                // ── Escalation Alerts ─────────────────────────────────────────
                if (flagged.isNotEmpty) ...[
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
                    label: 'School-Wide Performance',
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
                            const Text(
                              'Department Performance',
                              style: AppTextStyles.sectionTitle,
                            ),
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
                            const Text('Top Performers', style: AppTextStyles.sectionTitle),
                            const SizedBox(height: 16),
                            _TopPerformers(faculty: realTimeFaculty),
                            const SizedBox(height: 20),
                            _buildRequiresAttentionCard(flagged),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                // Export button — Principal only
                if (widget.role == 'principal') ...[
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
                const SizedBox(height: 24),
                _FacultyAppraisalOverviewTable(
                  faculty: realTimeFaculty,
                  evaluations: widget.evaluations,
                  newRatings: widget.newRatings,
                ),
              ],
            ),
          ),
        ],
    );
  }

  Widget _buildCoordinatorView(BuildContext context) {
    final realTimeFaculty = _faculty;
    final avgPerformance = realTimeFaculty.isEmpty
        ? '0.0'
        : (realTimeFaculty.map((f) => f.overallScore).reduce((a, b) => a + b) / realTimeFaculty.length).toStringAsFixed(1);
    final tasksCompleted = sampleTasks.where((t) {
      final hasEval = widget.evaluations.containsKey(t.id);
      if (hasEval) return true;
      return t.status == TaskStatus.evaluated || t.status == TaskStatus.flagged;
    }).length;
    final eventsCount = widget.newRatings.isEmpty ? 24 : widget.newRatings.values.expand((x) => x).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.pageHeader,
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stat Cards
              Row(
                children: [
                  Expanded(
                    child: _AnalyticsStatCard(
                      label: 'Overall Performance',
                      value: '$avgPerformance%',
                      icon: Icons.workspace_premium_outlined,
                      iconColor: const Color(0xFF10B981),
                      subWidget: Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        runSpacing: 4,
                        children: [
                          const Icon(Icons.trending_up, color: Color(0xFF10B981), size: 14),
                          const SizedBox(width: 4),
                          const Text('Real-time avg', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _AnalyticsStatCard(
                      label: 'Total Personnel',
                      value: '${realTimeFaculty.length}',
                      icon: Icons.group_outlined,
                      iconColor: const Color(0xFF3B82F6),
                      subWidget: const Text('In your scope', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _AnalyticsStatCard(
                      label: 'Special Tasks',
                      value: '$tasksCompleted',
                      icon: Icons.assignment_outlined,
                      iconColor: const Color(0xFFF59E0B),
                      subWidget: const Text('Evaluated tasks', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _AnalyticsStatCard(
                      label: 'Events Evaluated',
                      value: '$eventsCount',
                      icon: Icons.calendar_today_outlined,
                      iconColor: const Color(0xFF8B5CF6),
                      subWidget: const Text('Real-time count', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Monthly Trend Bar Chart
              _buildMonthlyTrendCard(),
              const SizedBox(height: 18),

              // Dual Columns: Left (Department Performance) & Right (Top Performers & Requires Attention)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 1, child: _buildDepartmentPerformanceCard()),
                  const SizedBox(width: 18),
                  Expanded(
                    flex: 1,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildTopPerformersCard(),
                        const SizedBox(height: 18),
                        _buildRequiresAttentionCard(_flaggedPersonnel),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Performance Distribution Bottom Card
              _buildPerformanceDistributionCard(),
              const SizedBox(height: 24),
              _FacultyAppraisalOverviewTable(
                faculty: realTimeFaculty,
                evaluations: widget.evaluations,
                newRatings: widget.newRatings,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMonthlyTrendCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Monthly Performance Trend',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 180,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                maxY: 100,
                barTouchData: BarTouchData(enabled: true),
                titlesData: FlTitlesData(
                  show: true,
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, meta) {
                        const style = TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600, fontSize: 12);
                        Widget text;
                        switch (value.toInt()) {
                          case 0: text = const Text('Sep', style: style); break;
                          case 1: text = const Text('Oct', style: style); break;
                          case 2: text = const Text('Nov', style: style); break;
                          case 3: text = const Text('Dec', style: style); break;
                          case 4: text = const Text('Jan', style: style); break;
                          case 5: text = const Text('Feb', style: style); break;
                          case 6: text = const Text('Mar', style: style); break;
                          case 7: text = const Text('Apr', style: style); break;
                          default: text = const Text('', style: style); break;
                        }
                        return SideTitleWidget(axisSide: meta.axisSide, child: text);
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 40,
                      getTitlesWidget: (value, meta) {
                        return SideTitleWidget(
                          axisSide: meta.axisSide,
                          child: Text('${value.toInt()}%', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                        );
                      },
                    ),
                  ),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                ),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (value) => FlLine(color: const Color(0xFFF1F5F9), strokeWidth: 1),
                ),
                borderData: FlBorderData(show: false),
                barGroups: [
                  _makeBarGroup(0, 72.3),
                  _makeBarGroup(1, 75.1),
                  _makeBarGroup(2, 76.8),
                  _makeBarGroup(3, 77.5),
                  _makeBarGroup(4, 79.2),
                  _makeBarGroup(5, 80.4),
                  _makeBarGroup(6, 81.6),
                  _makeBarGroup(7, 83.1),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  BarChartGroupData _makeBarGroup(int x, double y) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: y,
          color: const Color(0xFF1E293B),
          width: 24,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(6),
            topRight: Radius.circular(6),
          ),
          backDrawRodData: BackgroundBarChartRodData(
            show: true,
            toY: 100,
            color: const Color(0xFFF1F5F9),
          ),
        ),
      ],
    );
  }

  Widget _buildDepartmentPerformanceCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Department Performance',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 20),
          _buildDeptPerfRow('Engineering', '12 personnel · 45 tasks completed', 0.823, const Color(0xFF10B981), true),
          _buildDeptPerfRow('Business', '10 personnel · 38 tasks completed', 0.768, const Color(0xFF3B82F6), null),
          _buildDeptPerfRow('Sciences', '8 personnel · 32 tasks completed', 0.851, const Color(0xFF10B981), true),
          _buildDeptPerfRow('Humanities', '9 personnel · 28 tasks completed', 0.724, const Color(0xFFEF4444), false),
          _buildDeptPerfRow('Arts', '6 personnel · 13 tasks completed', 0.796, const Color(0xFF10B981), true),
        ],
      ),
    );
  }

  Widget _buildDeptPerfRow(String name, String sub, double pct, Color barColor, bool? trendUp) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                  const SizedBox(height: 2),
                  Text(sub, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
              Row(
                children: [
                  if (trendUp != null) ...[
                    Icon(
                      trendUp ? Icons.arrow_upward : Icons.arrow_downward,
                      size: 14,
                      color: trendUp ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    ),
                    const SizedBox(width: 4),
                  ],
                  Text(
                    '${(pct * 100).toStringAsFixed(1)}%',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: trendUp == false ? const Color(0xFFEF4444) : const Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor: const Color(0xFFF1F5F9),
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopPerformersCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Top Performers',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 20),
          _buildPerformerRow(1, 'Dr. Maria Santos', 'Sciences · 8 tasks', '95.2%', const Color(0xFFF59E0B)),
          _buildPerformerRow(2, 'Prof. John Chen', 'Engineering · 10 tasks', '92.8%', const Color(0xFF94A3B8)),
          _buildPerformerRow(3, 'Dr. Sarah Cruz', 'Business · 7 tasks', '89.5%', const Color(0xFFD97706)),
          _buildPerformerRow(4, 'Prof. Michael Rivera', 'Engineering · 9 tasks', '87.3%', const Color(0xFF64748B)),
          _buildPerformerRow(5, 'Dr. Lisa Martinez', 'Arts · 5 tasks', '86.9%', const Color(0xFF64748B)),
        ],
      ),
    );
  }

  Widget _buildPerformerRow(int rank, String name, String sub, String pct, Color rankColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(color: rankColor.withOpacity(0.12), shape: BoxShape.circle),
            child: Center(
              child: Text(
                '#$rank',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: rankColor),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                const SizedBox(height: 2),
                Text(sub, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Text(pct, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF10B981))),
        ],
      ),
    );
  }

  Widget _buildRequiresAttentionCard(List<FacultyPerformance> flaggedPersonnel) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 4, color: const Color(0xFFEF4444)),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Requires Attention',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Personnel rated below 3 stars are automatically flagged and coordinators are alerted immediately.',
                      style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 16),
                    if (flaggedPersonnel.isEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 16),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'All personnel are performing satisfactorily.',
                                style: TextStyle(fontSize: 12, color: Color(0xFF15803D), fontWeight: FontWeight.w500),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      ...flaggedPersonnel.take(5).map((f) {
                        final tasks = sampleTasks.where((t) => t.personnel == f.name).toList();
                        final flaggedTasksCount = tasks.where((t) {
                          final eval = widget.evaluations[t.id];
                          if (eval != null) {
                            final score = eval['score'];
                            final numScore = score is num ? score.toDouble() : 100.0;
                            return numScore < 60.0;
                          }
                          return t.getScore() > 0 && t.getScore() < 60;
                        }).length;
                        return _buildAttentionRow(
                          f.name,
                          '${f.department} \u00b7 ${tasks.length} tasks',
                          '${f.overallScore}%',
                          '$flaggedTasksCount flagged tasks',
                        );
                      }),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttentionRow(String name, String sub, String score, String alert) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                const SizedBox(height: 2),
                Text(sub, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(score, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFFEF4444))),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: const Color(0xFFFEE2E2), width: 0.8),
                  color: const Color(0xFFFEF2F2),
                ),
                child: Text(
                  alert,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFEF4444)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPerformanceDistributionCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Performance Distribution',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildDistributionPill('12', 'Excellent', '90-100%', const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
              _buildDistributionPill('18', 'Very Good', '80-89%', const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
              _buildDistributionPill('10', 'Good', '70-79%', const Color(0xFFD97706), const Color(0xFFFEF3C7)),
              _buildDistributionPill('3', 'Fair', '60-69%', const Color(0xFFEA580C), const Color(0xFFFFEDD5)),
              _buildDistributionPill('2', 'Needs Imp.', '<60%', const Color(0xFFEF4444), const Color(0xFFFEE2E2)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDistributionPill(String val, String label, String range, Color textCol, Color bgCol) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 6),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(color: bgCol, borderRadius: BorderRadius.circular(8)),
        child: Column(
          children: [
            Text(
              val,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: textCol),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: textCol),
            ),
            const SizedBox(height: 2),
            Text(
              range,
              style: TextStyle(fontSize: 10, color: textCol.withOpacity(0.8)),
            ),
          ],
        ),
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

class _AnalyticsStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;
  final Widget? subWidget;

  const _AnalyticsStatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
    this.subWidget,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.5,
                  ),
                ),
                if (subWidget != null) ...[
                  const SizedBox(height: 6),
                  subWidget!,
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
        ],
      ),
    );
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

class _FacultyAppraisalOverviewTable extends StatefulWidget {
  final List<FacultyPerformance> faculty;
  final Map<String, Map<String, dynamic>> evaluations;
  final Map<String, List<AttendeeRating>> newRatings;

  const _FacultyAppraisalOverviewTable({
    required this.faculty,
    required this.evaluations,
    required this.newRatings,
  });

  @override
  State<_FacultyAppraisalOverviewTable> createState() => _FacultyAppraisalOverviewTableState();
}

class _FacultyAppraisalOverviewTableState extends State<_FacultyAppraisalOverviewTable> {
  String? _selectedDept;
  String? _selectedRole;
  String? _selectedPersonnel;

  @override
  Widget build(BuildContext context) {
    // 1. Compute dynamic data for all faculty based on evaluations and newRatings
    final allRows = widget.faculty.map((f) {
      final tasks = sampleTasks.where((t) => t.personnel == f.name).toList();
      final evaluatedTasksCount = tasks.where((t) {
        final eval = widget.evaluations[t.id];
        if (eval != null) return true;
        return t.status == TaskStatus.evaluated || t.status == TaskStatus.flagged;
      }).length;
      
      final eventRatingsList = widget.newRatings.values.expand((x) => x).where((r) => r.name == f.name).toList();
      final double eventAvg = eventRatingsList.isEmpty 
          ? (f.eventScore ?? 80.0).toDouble() 
          : eventRatingsList.map((r) => r.overallScore).reduce((a, b) => a + b) / eventRatingsList.length;

      final double taskAvg = f.taskScore?.toDouble() ?? 80.0;
      final bool isFlagged = f.overallScore < 60;
      
      // Determine a pseudo-role for the mock data based on dept or hardcoded
      String mockRole = 'Teacher';
      if (f.name.contains('Santos') || f.name.contains('Lim')) mockRole = 'Dean';

      return {
        'id': 'FA${f.name.hashCode.toString().substring(0, 3)}',
        'personnel': f.name,
        'role': mockRole,
        'department': f.department,
        'totalEvals': '${evaluatedTasksCount + eventRatingsList.length}',
        'eventAvg': '${(eventAvg / 20).toStringAsFixed(1)}★',
        'taskAvg': '${(taskAvg / 20).toStringAsFixed(1)}★',
        'compliance': '${f.overallScore} pts', // mock calculation for UI
        'flagged': isFlagged ? 'Yes' : 'No',
        'status': isFlagged ? 'Flagged' : 'Good Standing',
        'isFlagged': isFlagged,
      };
    }).toList();

    // 2. Filter
    var filtered = allRows.where((row) {
      if (_selectedDept != null && _selectedDept != 'All' && row['department'] != _selectedDept) return false;
      if (_selectedRole != null && _selectedRole != 'All' && row['role'] != _selectedRole) return false;
      if (_selectedPersonnel != null && _selectedPersonnel != 'All' && row['personnel'] != _selectedPersonnel) return false;
      return true;
    }).toList();

    // Collect distinct values for dropdowns
    final depts = ['All', ...widget.faculty.map((e) => e.department).toSet()];
    final roles = ['All', 'Teacher', 'Dean', 'Coordinator'];
    final personnel = ['All', ...widget.faculty.map((e) => e.name).toSet()];

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Table Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Row(
              children: [
                const Text(
                  'Faculty Appraisal Overview',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                ),
                const Spacer(),
                _buildFilterDropdown(
                  hint: 'By Department',
                  value: _selectedDept,
                  items: depts,
                  onChanged: (v) => setState(() => _selectedDept = v),
                ),
                const SizedBox(width: 8),
                _buildFilterDropdown(
                  hint: 'By Role',
                  value: _selectedRole,
                  items: roles,
                  onChanged: (v) => setState(() => _selectedRole = v),
                ),
                const SizedBox(width: 8),
                _buildFilterDropdown(
                  hint: 'Select personnel...',
                  value: _selectedPersonnel,
                  items: personnel,
                  onChanged: (v) => setState(() => _selectedPersonnel = v),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // Columns Header
          Container(
            color: const Color(0xFFF8FAFC),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: const Row(
              children: [
                SizedBox(width: 60, child: Text('ID', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 150, child: Text('PERSONNEL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 90, child: Text('ROLE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 100, child: Text('DEPARTMENT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 120, child: Text('TOTAL EVALUATIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 90, child: Text('EVENT AVG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 110, child: Text('TASK RATING AVG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 160, child: Text('OVERALL COMPLIANCE POINTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 80, child: Text('FLAGGED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                SizedBox(width: 120, child: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
                Expanded(child: Text('ACTION', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)))),
              ],
            ),
          ),
          const Divider(height: 1),
          // Rows
          ...filtered.map((r) => _buildTableRow(
            context,
            r['id'] as String,
            r['personnel'] as String,
            r['role'] as String,
            r['department'] as String,
            r['totalEvals'] as String,
            r['eventAvg'] as String,
            r['taskAvg'] as String,
            r['compliance'] as String,
            r['flagged'] as String,
            r['status'] as String,
            r['isFlagged'] as bool,
          )),
          if (filtered.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('No personnel matches the filters.', style: TextStyle(color: AppColors.textSecondary))),
            ),
        ],
      ),
    );
  }

  Widget _buildFilterDropdown({
    required String hint,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFCBD5E1), width: 0.8),
        borderRadius: BorderRadius.circular(6),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Row(
            children: [
              if (hint.contains('By ')) ...[
                const Icon(Icons.filter_alt_outlined, size: 14, color: Color(0xFF64748B)),
                const SizedBox(width: 6),
              ],
              Text(hint, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            ],
          ),
          icon: const Padding(
            padding: EdgeInsets.only(left: 8),
            child: Icon(Icons.keyboard_arrow_down, size: 16, color: Color(0xFF64748B)),
          ),
          isDense: true,
          style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B), fontWeight: FontWeight.w500),
          items: items.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildTableRow(BuildContext context, String id, String personnel, String role, String department, String totalEvals, String eventAvg, String taskAvg, String compliance, String flagged, String status, bool isFlagged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 0.8)),
      ),
      child: Row(
        children: [
          SizedBox(width: 60, child: Text(id, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)))),
          SizedBox(
            width: 150,
            child: Row(
              children: [
                const Icon(Icons.person, size: 16, color: Color(0xFF94A3B8)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    personnel,
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: 90, child: Text(role, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          SizedBox(width: 100, child: Text(department, style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)))),
          SizedBox(width: 120, child: Text(totalEvals, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B), fontWeight: FontWeight.w500))),
          SizedBox(width: 90, child: Text(eventAvg, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B), fontWeight: FontWeight.w500))),
          SizedBox(width: 110, child: Text(taskAvg, style: const TextStyle(fontSize: 12.5, color: Color(0xFF1E293B), fontWeight: FontWeight.w500))),
          SizedBox(width: 160, child: Text(compliance, style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A), fontWeight: FontWeight.w700))),
          SizedBox(
            width: 80,
            child: Text(
              flagged,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: isFlagged ? const Color(0xFFEF4444) : const Color(0xFF64748B),
              ),
            ),
          ),
          SizedBox(
            width: 120,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isFlagged ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                status,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isFlagged ? const Color(0xFFEF4444) : const Color(0xFF16A34A),
                ),
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: const Size(60, 32),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: const Text('View', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
              ),
            ),
          ),
        ],
      ),
    );
  }
}