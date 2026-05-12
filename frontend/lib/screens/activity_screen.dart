import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class ActivityScreen extends StatelessWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final events = [
      {'title': 'Intramurals', 'date': 'March 25, 2024', 'status': 'Pending Approval'},
      {'title': 'Science and Math Fair', 'date': 'March 25, 2024', 'status': 'Pending Approval'},
      {'title': 'Board Meeting', 'date': 'March 28, 2025', 'status': 'Approved'},
    ];

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(isMobile ? 14 : 24, 0, isMobile ? 14 : 24, 24),
      child: Column(
        children: [
          const SizedBox(height: 4),
          const AppBanner(
            title: 'Activity Calendar',
            subtitle: 'View all scheduled events and activities.',
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppTheme.cardColor,
              borderRadius: BorderRadius.circular(12),
              boxShadow: AppTheme.cardShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Upcoming Events', style: AppTheme.heading3),
                const SizedBox(height: 12),
                ...events.map((e) => Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: AppTheme.borderColor)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(e['title']!, style: AppTheme.labelMd, overflow: TextOverflow.ellipsis),
                          Text(e['date']!, style: AppTheme.bodyMd),
                        ]),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: e['status'] == 'Approved' ? AppTheme.greenBg : AppTheme.amberBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(e['status']!,
                            style: AppTheme.labelSm.copyWith(
                              color: e['status'] == 'Approved'
                                  ? const Color(0xFF15803D)
                                  : const Color(0xFF92400E),
                            )),
                      ),
                    ],
                  ),
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
