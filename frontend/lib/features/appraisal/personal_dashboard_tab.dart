import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/theme.dart';
import 'models/appraisal_models.dart';

bool _matchesName(String nameA, String nameB) {
  String clean(String s) {
    return s.toLowerCase()
        .replaceAll(RegExp(r'\b(dr|prof|dean|coord|principal|teacher|mr|ms|mrs)\b\.?'), '')
        .replaceAll(RegExp(r'[^\w\s]'), ' ')
        .trim();
  }
  
  final a = clean(nameA);
  final b = clean(nameB);
  
  if (a.isEmpty || b.isEmpty) return false;
  if (a == b) return true;
  
  final partsA = a.split(RegExp(r'\s+'));
  final partsB = b.split(RegExp(r'\s+'));
  
  for (final pA in partsA) {
    if (pA.length > 2 && partsB.contains(pA)) return true;
  }
  return false;
}

class PersonalDashboardTab extends StatelessWidget {
  final Widget pageHeader;
  final String username;
  final String role;
  final Map<String, Map<String, dynamic>> evaluations;
  final Map<String, List<AttendeeRating>> newRatings;

  const PersonalDashboardTab({
    super.key,
    required this.pageHeader,
    required this.username,
    required this.role,
    required this.evaluations,
    required this.newRatings,
  });

  @override
  Widget build(BuildContext context) {
    final String activeRole = role.toLowerCase();
    
    // Choose profile avatar based on role
    String avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop';
    String displayRoleTitle = 'Coordinator';
    
    if (activeRole == 'teacher') {
      avatarUrl = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop';
      displayRoleTitle = 'Teacher';
    } else if (activeRole == 'dean') {
      avatarUrl = 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150&auto=format&fit=crop';
      displayRoleTitle = 'Dean';
    } else if (activeRole == 'principal') {
      avatarUrl = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=150&auto=format&fit=crop';
      displayRoleTitle = 'Principal';
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Dashboard Main Title & Avatar Row
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  displayRoleTitle,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.5,
                  ),
                ),
                ClipOval(
                  child: Image.network(
                    avatarUrl,
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        width: 44,
                        height: 44,
                        color: AppColors.tabActive,
                        alignment: Alignment.center,
                        child: const Icon(Icons.person, color: Colors.white, size: 22),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Dashboard Banner Banner 
                DashboardBanner(role: activeRole),
                const SizedBox(height: 24),
                
                // ── Main Two-Column Layout
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Left Column (Lists & Primary content)
                    Expanded(
                      flex: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: _buildLeftColumn(activeRole),
                      ),
                    ),
                    const SizedBox(width: 24),
                    // Right Column (Side calendar / dates)
                    SizedBox(
                      width: 320,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: _buildRightColumn(activeRole),
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

  // ── Helper method to build dynamic left-hand side views ─────────────────────
  List<Widget> _buildLeftColumn(String role) {
    final String activeRole = role.toLowerCase();
    
    // Choose which tasks to evaluate/check based on role
    final List<SpecialTask> roleTasks;
    if (activeRole == 'teacher') {
      roleTasks = sampleTasks.where((t) => _matchesName(t.personnel, username)).toList();
    } else if (activeRole == 'dean') {
      roleTasks = sampleTasks.where((t) => _matchesName(t.personnel, username)).toList();
    } else {
      // coordinator & principal see all tasks
      roleTasks = sampleTasks;
    }

    int pendingCount = 0;
    int submittedCount = 0;
    int missingCount = 0;

    for (final t in roleTasks) {
      final eval = evaluations[t.id];
      if (eval != null) {
        submittedCount++;
      } else if (t.status == TaskStatus.evaluated || t.status == TaskStatus.flagged) {
        submittedCount++;
      } else if (t.status == TaskStatus.notSubmitted) {
        missingCount++;
      } else if (t.status == TaskStatus.pending) {
        pendingCount++;
      }
    }

    final toDoTracker = ToDoTrackerRow(
      pendingCount: pendingCount,
      submittedCount: submittedCount,
      missingCount: missingCount,
    );

    if (role == 'coordinator') {
      return [
        toDoTracker,
        const SizedBox(height: 24),
        const TaskCardList(
          title: 'Task Manager',
          items: [
            TaskListItem(
              title: 'Weekly Lesson Plan',
              subtitle: 'Submit weekly lesson plan for Q1 Week 1',
            ),
            TaskListItem(
              title: 'Class Activity Photos',
              subtitle: 'Upload photos from the science experiment',
            ),
            TaskListItem(
              title: 'Weekly Lesson Plan',
              subtitle: 'Submit weekly lesson plan for Q1 Week 1',
              isLast: true,
            ),
          ],
        ),
        const SizedBox(height: 24),
        const TaskCardList(
          title: 'My Task',
          items: [
            TaskListItem(title: 'Market Research'),
            TaskListItem(title: 'Student Assessment'),
            TaskListItem(title: 'Grading and Record-Keeping', isLast: true),
          ],
        ),
        const SizedBox(height: 24),
        const TaskCardList(
          title: 'Pending Approval',
          items: [
            TaskListItem(title: 'Intramurals', subtitle: '2024-03-25'),
            TaskListItem(title: 'Science and Math Fair', subtitle: '2024-03-25'),
            TaskListItem(title: 'Science and Math Fair', subtitle: '2024-03-25', isLast: true),
          ],
        ),
      ];
    } else if (role == 'teacher') {
      return [
        toDoTracker,
        const SizedBox(height: 24),
        const TaskCardList(
          title: 'My Task',
          items: [
            TaskListItem(title: 'Business'),
            TaskListItem(title: 'General'),
            TaskListItem(title: 'Administration'),
            TaskListItem(title: 'Academic'),
            TaskListItem(title: 'Professional Development', isLast: true),
          ],
        ),
      ];
    } else if (role == 'dean') {
      return [
        toDoTracker,
        const SizedBox(height: 24),
        const TaskCardList(
          title: 'Task Manager',
          items: [
            TaskListItem(
              title: 'Student Performance Analysis',
              subtitle: 'Conduct comprehensive analysis of student performance metrics',
            ),
            TaskListItem(
              title: 'Budget Planning Review',
              subtitle: 'Review department budget and submit recommendations',
            ),
            TaskListItem(
              title: 'Parent-Teacher Conference',
              subtitle: 'Schedule and conduct parent-teacher conferences',
              isLast: true,
            ),
          ],
        ),
        const SizedBox(height: 24),
        const TaskCardList(
          title: 'My Task',
          items: [
            TaskListItem(title: 'Market Research'),
            TaskListItem(title: 'Curriculum Development'),
            TaskListItem(title: 'Faculty Workshop Coordination', isLast: true),
          ],
        ),
      ];
    } else {
      // principal
      return [
        const TaskCardList(
          title: 'Task Tracker',
          items: [
            TaskListItem(
              title: 'Weekly Lesson Plan',
              subtitle: 'Submit weekly lesson plan for Q1 Week 1',
            ),
            TaskListItem(
              title: 'Weekly Lesson Plan',
              subtitle: 'Submit weekly lesson plan for Q1 Week 1',
              isLast: true,
            ),
          ],
        ),
        const SizedBox(height: 24),
        const TaskCardList(
          title: 'Approval Requests',
          items: [
            TaskListItem(
              title: 'Nutrition Month Celebration',
              subtitle: 'April 14, 2025',
              trailing: PendingBadge(),
            ),
            TaskListItem(
              title: 'Intramurals',
              subtitle: 'October 20, 2025',
              trailing: PendingBadge(),
              isLast: true,
            ),
          ],
        ),
      ];
    }
  }

  // ── Helper method to build dynamic right-hand side views ────────────────────
  List<Widget> _buildRightColumn(String role) {
    if (role == 'coordinator' || role == 'dean') {
      return [
        const MiniCalendarWidget(
          year: 2025,
          month: 1,
          title: '',
        ),
      ];
    } else {
      // teacher & principal
      final String calendarHeader = role == 'teacher' ? 'Upcoming Activities' : '';
      return [
        MiniCalendarWidget(
          year: 2026,
          month: 5,
          title: calendarHeader,
        ),
      ];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Dashboard Banner card with custom gradient & HoneycombPainter
// ─────────────────────────────────────────────────────────────────────────────
class DashboardBanner extends StatelessWidget {
  final String role;
  const DashboardBanner({super.key, required this.role});

  @override
  Widget build(BuildContext context) {
    final isDean = role.toLowerCase() == 'dean';
    
    return Container(
      height: 120,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: isDean
            ? const LinearGradient(
                colors: [Color(0xFF334155), Color(0xFF1E293B)], // Slate gradient
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : const LinearGradient(
                colors: [Color(0xFF1E293B), Color(0xFF0F172A)], // Dark tech gradient
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          if (!isDean)
            Positioned.fill(
              child: CustomPaint(
                painter: HoneycombPainter(
                  color: Colors.white.withOpacity(0.04), // faint overlay grid
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Dashboard',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Everything you need in one place — manage tasks, track progress, and stay organized.',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.85),
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. Honeycomb Painter for visual background grid
// ─────────────────────────────────────────────────────────────────────────────
class HoneycombPainter extends CustomPainter {
  final Color color;
  const HoneycombPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    const hexRadius = 16.0;
    const hexWidth = hexRadius * 1.7320508;
    const hexHeight = hexRadius * 2.0;

    for (double y = -hexHeight; y < size.height + hexHeight; y += hexHeight * 0.75) {
      final int row = (y ~/ (hexHeight * 0.75));
      final double xOffset = (row % 2 == 0) ? 0 : hexWidth / 2;
      for (double x = -hexWidth; x < size.width + hexWidth; x += hexWidth) {
        final path = Path();
        final cx = x + xOffset;
        final cy = y;
        
        for (int i = 0; i < 6; i++) {
          final angle = i * 3.141592653589793 / 3;
          final px = cx + hexRadius * math.cos(angle);
          final py = cy + hexRadius * math.sin(angle);
          if (i == 0) {
            path.moveTo(px, py);
          } else {
            path.lineTo(px, py);
          }
        }
        path.close();
        canvas.drawPath(path, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant HoneycombPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. To Do Tracker Row of 3 Stat Cards
// ─────────────────────────────────────────────────────────────────────────────
class ToDoTrackerRow extends StatelessWidget {
  final int pendingCount;
  final int submittedCount;
  final int missingCount;

  const ToDoTrackerRow({
    super.key,
    required this.pendingCount,
    required this.submittedCount,
    required this.missingCount,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'To Do Tracker',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
        ),
        Row(
          children: [
            // Pending Card
            Expanded(
              child: ToDoCard(
                value: '$pendingCount',
                label: 'Pending',
                icon: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.3)),
                  ),
                  child: const Icon(
                    Icons.notifications_active_outlined,
                    color: Color(0xFF3B82F6),
                    size: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Submitted Card
            Expanded(
              child: ToDoCard(
                value: '$submittedCount',
                label: 'Submitted',
                icon: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                  ),
                  child: const Icon(
                    Icons.check_circle_outline,
                    color: Color(0xFF10B981),
                    size: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Missing Card
            Expanded(
              child: ToDoCard(
                value: '$missingCount',
                label: 'Missing',
                icon: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
                  ),
                  child: const Icon(
                    Icons.error_outline,
                    color: Color(0xFFEF4444),
                    size: 20,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class ToDoCard extends StatelessWidget {
  final String value;
  final String label;
  final Widget icon;

  const ToDoCard({
    super.key,
    required this.value,
    required this.label,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.015),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
          icon,
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Custom Task Card List Wrapper
// ─────────────────────────────────────────────────────────────────────────────
class TaskCardList extends StatelessWidget {
  final String title;
  final List<Widget> items;

  const TaskCardList({
    super.key,
    required this.title,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
            ),
          ),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: items,
          ),
        ),
      ],
    );
  }
}

class TaskListItem extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool isLast;

  const TaskListItem({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
        if (!isLast)
          const Divider(
            height: 1,
            color: Color(0xFFF1F5F9),
            thickness: 1,
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Custom Mini Calendar Widget
// ─────────────────────────────────────────────────────────────────────────────
class MiniCalendarWidget extends StatelessWidget {
  final int year;
  final int month;
  final String title;

  const MiniCalendarWidget({
    super.key,
    required this.year,
    required this.month,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    final firstDayOfMonth = DateTime(year, month, 1);
    final lastDayOfMonth = DateTime(year, month + 1, 0);
    
    final daysInMonth = lastDayOfMonth.day;
    final startWeekday = firstDayOfMonth.weekday % 7; 

    final monthName = _getMonthName(month);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
            ),
          ),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Icon(Icons.chevron_left, size: 16, color: Color(0xFF64748B)),
                  ),
                  Text(
                    '$monthName\n$year',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      height: 1.2,
                    ),
                  ),
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Icon(Icons.chevron_right, size: 16, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _WeekdayLabel('S'),
                  _WeekdayLabel('M'),
                  _WeekdayLabel('T'),
                  _WeekdayLabel('W'),
                  _WeekdayLabel('T'),
                  _WeekdayLabel('F'),
                  _WeekdayLabel('S'),
                ],
              ),
              const SizedBox(height: 10),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 1,
                ),
                itemCount: startWeekday + daysInMonth,
                itemBuilder: (context, index) {
                  if (index < startWeekday) {
                    return const SizedBox.shrink();
                  }
                  
                  final dayNum = index - startWeekday + 1;
                  final isTodayHighlight = (year == 2026 && month == 5 && dayNum == 21);
                  
                  bool hasDot = false;
                  Color dotColor = const Color(0xFF10B981);
                  
                  if (year == 2025 && month == 1) {
                    if (dayNum == 14 || dayNum == 21 || dayNum == 22 || dayNum == 28 || dayNum == 29 || dayNum == 30) {
                      hasDot = true;
                      dotColor = const Color(0xFF10B981);
                    }
                  }
                  
                  return _CalendarDayCell(
                    day: dayNum,
                    isHighlighted: isTodayHighlight,
                    hasDot: hasDot,
                    dotColor: dotColor,
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _getMonthName(int m) {
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return names[(m - 1).clamp(0, 11)];
  }
}

class _WeekdayLabel extends StatelessWidget {
  final String text;
  const _WeekdayLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 24,
      child: Center(
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Color(0xFF94A3B8),
          ),
        ),
      ),
    );
  }
}

class _CalendarDayCell extends StatelessWidget {
  final int day;
  final bool isHighlighted;
  final bool hasDot;
  final Color dotColor;

  const _CalendarDayCell({
    required this.day,
    required this.isHighlighted,
    required this.hasDot,
    required this.dotColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Expanded(
          child: Container(
            alignment: Alignment.center,
            decoration: isHighlighted
                ? BoxDecoration(
                    color: const Color(0xFF8B5CF6),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF8B5CF6).withOpacity(0.3),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  )
                : null,
            child: Text(
              '$day',
              style: TextStyle(
                fontSize: 12,
                fontWeight: isHighlighted ? FontWeight.bold : FontWeight.w500,
                color: isHighlighted ? Colors.white : const Color(0xFF334155),
              ),
            ),
          ),
        ),
        if (hasDot && !isHighlighted) ...[
          const SizedBox(height: 2),
          Container(
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Amber "Pending" Status Badge (for Principal Approval requests)
// ─────────────────────────────────────────────────────────────────────────────
class PendingBadge extends StatelessWidget {
  const PendingBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7), // very soft yellow/amber background
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFCD34D), width: 1), // amber border
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: Color(0xFFD97706), // dark amber dot
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          const Text(
            'Pending',
            style: TextStyle(
              color: Color(0xFFD97706),
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
