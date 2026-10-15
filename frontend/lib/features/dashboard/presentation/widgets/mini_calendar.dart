import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../../../core/theme/app_theme.dart';

class MiniCalendar extends StatefulWidget {
  const MiniCalendar({super.key});

  @override
  State<MiniCalendar> createState() => _MiniCalendarState();
}

class _MiniCalendarState extends State<MiniCalendar> {
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  // Simulated event days
  final _eventDays = {
    DateTime(2025, 1, 14),
    DateTime(2025, 1, 22),
    DateTime(2025, 1, 28),
    DateTime(2025, 1, 30),
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: TableCalendar(
        firstDay: DateTime(2020),
        lastDay: DateTime(2030),
        focusedDay: _focusedDay,
        selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
        eventLoader: (day) =>
            _eventDays.any((e) => isSameDay(e, day)) ? [Object()] : [],
        onDaySelected: (selectedDay, focusedDay) => setState(() {
          _selectedDay = selectedDay;
          _focusedDay = focusedDay;
        }),
        onPageChanged: (focusedDay) => setState(() => _focusedDay = focusedDay),
        calendarStyle: const CalendarStyle(
          todayDecoration:
              BoxDecoration(color: AppTheme.primaryMid, shape: BoxShape.circle),
          selectedDecoration: BoxDecoration(
              color: AppTheme.darkSurface, shape: BoxShape.circle),
          markerDecoration: BoxDecoration(
              color: AppTheme.accentGreen, shape: BoxShape.circle),
          markerSize: 5,
          outsideDaysVisible: false,
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: false,
          titleCentered: true,
          titleTextStyle: Theme.of(context).textTheme.titleMedium!,
          leftChevronIcon: const Icon(Icons.chevron_left, size: 20),
          rightChevronIcon: const Icon(Icons.chevron_right, size: 20),
        ),
        daysOfWeekStyle: DaysOfWeekStyle(
          weekdayStyle: Theme.of(context)
              .textTheme
              .bodyMedium!
              .copyWith(fontWeight: FontWeight.w500),
          weekendStyle: Theme.of(context)
              .textTheme
              .bodyMedium!
              .copyWith(fontWeight: FontWeight.w500),
        ),
      ),
    );
  }
}
