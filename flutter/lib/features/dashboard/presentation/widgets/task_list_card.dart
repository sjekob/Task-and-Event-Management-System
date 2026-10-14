import 'package:flutter/material.dart';

class TaskListItem {
  final String  title;
  final String? subtitle;

  const TaskListItem({
    required this.title,
    this.subtitle,
  });
}

class TaskListCard extends StatelessWidget {
  final List<TaskListItem> items;

  const TaskListCard({
    super.key,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: items.asMap().entries.map((entry) {
          final i    = entry.key;
          final item = entry.value;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18, vertical: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1A1A2E),
                      )),
                    if (item.subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(item.subtitle!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF718096),
                          fontWeight: FontWeight.w400,
                        )),
                    ],
                  ],
                ),
              ),
              if (i < items.length - 1)
                const Divider(
                  height: 1,
                  thickness: 0.8,
                  indent: 18,
                  endIndent: 18,
                  color: Color(0xFFEDF2F7),
                ),
            ],
          );
        }).toList(),
      ),
    );
  }
}