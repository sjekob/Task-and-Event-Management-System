import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../core/api_service.dart';
import 'models/notification_model.dart';

/// Full-page notifications list view for the sidebar "Notifications" module.
class NotificationsScreen extends StatefulWidget {
  final String username;
  final String role;

  const NotificationsScreen({
    super.key,
    required this.username,
    required this.role,
  });

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final NotificationStore _store = NotificationStore();
  late StreamSubscription<List<AppNotification>> _sub;
  List<AppNotification> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _notifications = _store.notifications;
    _sub = _store.stream.listen((list) {
      if (mounted) setState(() => _notifications = list);
    });
    _fetchFromBackend();
  }

  Future<void> _fetchFromBackend() async {
    setState(() => _loading = true);
    try {
      final api = NotificationsApi();
      final data = await api.getNotifications(limit: 50);
      final items = (data['notifications'] as List<dynamic>? ?? [])
          .map((n) => AppNotification.fromAuditLog(n as Map<String, dynamic>))
          .toList();
      _store.addNotifications(items);
    } catch (e) {
      debugPrint('Error fetching notifications: $e');
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }

  void _markAllRead() async {
    _store.markAllAsRead();
    try {
      await NotificationsApi().markAllAsRead();
    } catch (_) {}
  }

  IconData _iconForType(NotificationType type) {
    switch (type) {
      case NotificationType.evaluationSubmitted:
        return Icons.rate_review_rounded;
      case NotificationType.flaggedAlert:
        return Icons.warning_amber_rounded;
      case NotificationType.statusChange:
        return Icons.swap_horiz_rounded;
      case NotificationType.reportSubmitted:
        return Icons.description_outlined;
    }
  }

  Color _colorForType(NotificationType type) {
    switch (type) {
      case NotificationType.evaluationSubmitted:
        return const Color(0xFF3B82F6);
      case NotificationType.flaggedAlert:
        return const Color(0xFFEF4444);
      case NotificationType.statusChange:
        return const Color(0xFF8B5CF6);
      case NotificationType.reportSubmitted:
        return const Color(0xFF10B981);
    }
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.month}/${dt.day}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final unread = _notifications.where((n) => !n.isRead).length;

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header row ──────────────────────────────────────────────────
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.notifications_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Notifications',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      unread > 0 ? '$unread unread notification${unread > 1 ? 's' : ''}' : 'All caught up!',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                const Spacer(),
                if (unread > 0)
                  TextButton.icon(
                    onPressed: _markAllRead,
                    icon: const Icon(Icons.done_all_rounded, size: 16),
                    label: const Text('Mark all read', style: TextStyle(fontSize: 13)),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF3B82F6),
                    ),
                  ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _fetchFromBackend,
                  icon: const Icon(Icons.refresh_rounded, size: 20),
                  tooltip: 'Refresh',
                  style: IconButton.styleFrom(
                    foregroundColor: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // ── Notification list ─────────────────────────────────────────────
            if (_loading && _notifications.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(48),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else if (_notifications.isEmpty)
              _buildEmptyState()
            else
              ..._notifications.map((n) => _buildNotificationCard(n)),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 80),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Icon(Icons.notifications_none_rounded, size: 48, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 20),
            const Text(
              'No notifications yet',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
            ),
            const SizedBox(height: 8),
            const Text(
              'New notifications will appear here when evaluations\nare submitted or performance alerts are triggered.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8), height: 1.6),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationCard(AppNotification n) {
    final iconColor = _colorForType(n.type);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: n.isRead ? Colors.white : const Color(0xFFF0F7FF),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            if (!n.isRead) {
              _store.markAsRead(n.id);
              try {
                final idInt = int.tryParse(n.id);
                if (idInt != null) {
                  NotificationsApi().markAsRead(idInt);
                }
              } catch (_) {}
            }
          },
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: n.isRead ? const Color(0xFFE2E8F0) : const Color(0xFFBFDBFE),
                width: n.isRead ? 0.8 : 1,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Icon ────────────────────────────────────────
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_iconForType(n.type), color: iconColor, size: 20),
                ),
                const SizedBox(width: 14),
                // ── Content ─────────────────────────────────────
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              n.title,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                          ),
                          Text(
                            _timeAgo(n.timestamp),
                            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        n.message,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                // ── Unread dot ──────────────────────────────────
                if (!n.isRead)
                  Padding(
                    padding: const EdgeInsets.only(left: 8, top: 4),
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFF3B82F6),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}


/// Compact notification bell icon with badge for use in headers/sidebars.
class NotificationBellButton extends StatefulWidget {
  final VoidCallback onTap;
  
  const NotificationBellButton({super.key, required this.onTap});

  @override
  State<NotificationBellButton> createState() => _NotificationBellButtonState();
}

class _NotificationBellButtonState extends State<NotificationBellButton> {
  final NotificationStore _store = NotificationStore();
  late StreamSubscription<List<AppNotification>> _sub;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _unreadCount = _store.unreadCount;
    _sub = _store.stream.listen((_) {
      if (mounted) setState(() => _unreadCount = _store.unreadCount);
    });
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        IconButton(
          onPressed: widget.onTap,
          icon: const Icon(Icons.notifications_outlined, size: 22),
          tooltip: 'Notifications',
          style: IconButton.styleFrom(
            foregroundColor: const Color(0xFF64748B),
          ),
        ),
        if (_unreadCount > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.all(2),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              child: Text(
                _unreadCount > 9 ? '9+' : '$_unreadCount',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
