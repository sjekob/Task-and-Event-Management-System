import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../shared/widgets/shared_widgets.dart';
import 'models/appraisal_models.dart';

class PersonalDashboardTab extends StatelessWidget {
  final Widget pageHeader;
  final String username;
  final Map<String, Map<String, dynamic>> evaluations;
  final Map<String, List<AttendeeRating>> newRatings;

  const PersonalDashboardTab({
    super.key,
    required this.pageHeader,
    required this.username,
    required this.evaluations,
    required this.newRatings,
  });

  @override
  Widget build(BuildContext context) {
    // 1. Calculate the real-time scores for the current user
    // We will assume "username" maps to the user's name in `sampleFaculty`.
    // In a real app, we'd query by ID. We do a loose match or exact match.
    final userFaculty = sampleFaculty.firstWhere(
      (f) => f.name.toLowerCase() == username.toLowerCase() || username.contains(f.name.split(' ').last.toLowerCase()),
      orElse: () => FacultyPerformance(
        name: username.isEmpty ? 'Unknown User' : username,
        department: 'N/A',
        reportScore: null,
        taskScore: null,
        eventScore: null,
        overallScore: 0,
        grade: AppraisalGrade.satisfactory,
        trend: TrendDirection.stable,
      ),
    );

    // Compute task score dynamically
    final facultyTasks = sampleTasks.where((t) => t.personnel == userFaculty.name).toList();
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
        ? userFaculty.taskScore
        : (scores.reduce((a, b) => a + b) / scores.length).round();

    final int realTimeOverallScore = realTimeTaskScore != null
        ? ((userFaculty.reportScore ?? 100) + realTimeTaskScore) ~/ 2
        : (userFaculty.reportScore ?? 100);

    // Calculate stars
    double stars = (realTimeOverallScore / 20).clamp(0, 5).toDouble();
    if (stars < 0) stars = 0;

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
                // Info Banner
                if (stars < 3)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 20),
                    child: InfoBanner(
                      text: 'Your current rating has fallen below 3 stars. An escalation alert has been triggered to your coordinator.',
                      isWarning: true,
                    ),
                  ),

                // Top level stats
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        label: 'Compliance Points',
                        value: '$realTimeOverallScore / 100',
                        valueColor: stars >= 3 ? AppColors.success : AppColors.danger,
                        icon: Icon(Icons.stars, color: stars >= 3 ? AppColors.success : AppColors.danger, size: 20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatCard(
                        label: 'Star Rating',
                        value: '${stars.toStringAsFixed(1)} ★',
                        valueColor: AppColors.amber,
                        icon: const Icon(Icons.star, color: AppColors.amber, size: 20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatCard(
                        label: 'Evaluated Tasks',
                        value: '${scores.length}',
                        valueColor: AppColors.info,
                        icon: const Icon(Icons.assignment_turned_in, color: AppColors.info, size: 20),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Performance Summary
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Performance Summary', style: AppTextStyles.sectionTitle),
                      const SizedBox(height: 16),
                      Text('Department: ${userFaculty.department}', style: AppTextStyles.tableCell),
                      const SizedBox(height: 8),
                      Text('Report Submission Average: ${userFaculty.reportScore ?? 'N/A'}%', style: AppTextStyles.tableCell),
                      const SizedBox(height: 8),
                      Text('Special Task Average: ${realTimeTaskScore ?? 'N/A'}%', style: AppTextStyles.tableCell),
                      const SizedBox(height: 8),
                      Text('Event Participation Average: ${userFaculty.eventScore ?? 'N/A'}%', style: AppTextStyles.tableCell),
                      const SizedBox(height: 16),
                      const Divider(),
                      const SizedBox(height: 16),
                      const Text('Recent Task Evaluations', style: AppTextStyles.sectionTitle),
                      const SizedBox(height: 12),
                      if (facultyTasks.isEmpty)
                        const Text('No recent task evaluations found.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13))
                      else
                        ...facultyTasks.map((task) {
                          int? score = task.score;
                          if (evaluations.containsKey(task.id)) {
                            score = evaluations[task.id]!['score'] as int?;
                          }
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8.0),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: Text(task.task, style: AppTextStyles.tableCell, maxLines: 1, overflow: TextOverflow.ellipsis),
                                ),
                                Expanded(
                                  child: Text('By: ${task.assignedBy}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                ),
                                score != null ? ScoreBadge(score: score) : StatusBadge.pending(),
                              ],
                            ),
                          );
                        }).toList(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
