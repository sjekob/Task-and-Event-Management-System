import 'dart:async';

enum NotificationType {
  evaluationSubmitted,
  flaggedAlert,
  statusChange,
  reportSubmitted,
}

class AppNotification {
  final String id;
  final String title;
  final String message;
  final NotificationType type;
  final DateTime timestamp;
  bool isRead;
  final String? relatedId; // appraisal_id, event_id, task_id, etc.

  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.timestamp,
    this.isRead = false,
    this.relatedId,
  });

  factory AppNotification.fromAuditLog(Map<String, dynamic> json) {
    final actionType = json['action_type'] as String? ?? '';
    final timestamp = json['timestamp'] as String? ?? '';
    final afterState = json['after_state'] as Map<String, dynamic>? ?? {};
    final id = json['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString();

    NotificationType type;
    String title;
    String message;
    String? relatedId;

    switch (actionType) {
      case 'EVALUATE_SPECIAL_TASK':
        type = NotificationType.evaluationSubmitted;
        final wa = afterState['weighted_average'];
        final score = wa != null ? (wa * 20).round() : 0;
        title = 'Special Task Evaluated';
        message = 'A special task evaluation has been submitted with a score of $score/100.';
        if (afterState['remarks'] != null && (afterState['remarks'] as String).isNotEmpty) {
          message += ' Remarks: "${afterState['remarks']}"';
        }
        break;
      case 'EVALUATE_EVENT':
        type = NotificationType.evaluationSubmitted;
        final eventId = afterState['event_id'] ?? '';
        final avgScore = afterState['average_score'] ?? 0;
        title = 'Event Evaluation Submitted';
        message = 'An evaluation for event $eventId was submitted with an average score of $avgScore/5.0.';
        relatedId = eventId.toString();
        break;
      case 'SUBMIT_REPORT':
        type = NotificationType.reportSubmitted;
        final timingStatus = afterState['timing_status'] ?? '';
        final timingPoints = afterState['timing_points'] ?? 0;
        title = 'Report Submitted';
        message = 'Report submitted — $timingStatus ($timingPoints pts).';
        break;
      case 'LOCK_APPRAISAL':
        type = NotificationType.statusChange;
        title = 'Appraisal Locked';
        message = 'Appraisal record #${afterState['appraisal_id'] ?? ''} has been locked and cannot be modified.';
        relatedId = afterState['appraisal_id']?.toString();
        break;
      case 'ARCHIVE_APPRAISAL':
        type = NotificationType.statusChange;
        title = 'Appraisal Archived';
        message = 'Appraisal record #${afterState['appraisal_id'] ?? ''} has been archived.';
        relatedId = afterState['appraisal_id']?.toString();
        break;
      default:
        type = NotificationType.statusChange;
        title = actionType.replaceAll('_', ' ');
        message = 'Action performed: $actionType';
    }

    DateTime parsedTime;
    try {
      parsedTime = DateTime.parse(timestamp);
    } catch (_) {
      parsedTime = DateTime.now();
    }

    return AppNotification(
      id: id,
      title: title,
      message: message,
      type: type,
      timestamp: parsedTime,
      isRead: false,
      relatedId: relatedId,
    );
  }
}

/// Singleton in-memory notification store with reactive stream.
class NotificationStore {
  static final NotificationStore _instance = NotificationStore._internal();
  factory NotificationStore() => _instance;
  NotificationStore._internal();

  final List<AppNotification> _notifications = [];
  final _controller = StreamController<List<AppNotification>>.broadcast();

  Stream<List<AppNotification>> get stream => _controller.stream;
  List<AppNotification> get notifications => List.unmodifiable(_notifications);
  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  void addNotification(AppNotification notification) {
    // Avoid duplicates by id
    if (_notifications.any((n) => n.id == notification.id)) return;
    _notifications.insert(0, notification);
    _controller.add(notifications);
  }

  void addNotifications(List<AppNotification> items) {
    bool changed = false;
    for (final n in items) {
      if (!_notifications.any((existing) => existing.id == n.id)) {
        _notifications.add(n);
        changed = true;
      }
    }
    if (changed) {
      _notifications.sort((a, b) => b.timestamp.compareTo(a.timestamp));
      _controller.add(notifications);
    }
  }

  void markAsRead(String id) {
    final idx = _notifications.indexWhere((n) => n.id == id);
    if (idx != -1) {
      _notifications[idx].isRead = true;
      _controller.add(notifications);
    }
  }

  void markAllAsRead() {
    for (final n in _notifications) {
      n.isRead = true;
    }
    _controller.add(notifications);
  }

  /// Push a local notification (e.g. after a successful evaluation submit)
  void pushLocal({
    required String title,
    required String message,
    required NotificationType type,
    String? relatedId,
  }) {
    addNotification(AppNotification(
      id: 'local_${DateTime.now().millisecondsSinceEpoch}',
      title: title,
      message: message,
      type: type,
      timestamp: DateTime.now(),
      relatedId: relatedId,
    ));
  }

  void dispose() {
    _controller.close();
  }
}
