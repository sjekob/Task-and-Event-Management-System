import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// One audit-trail entry: who did what, when, with before → after values.
class AuditEntry {
  final int id;
  final DateTime? createdAt;
  final String? actorName;
  final String? actorRole;
  final String action;
  final String entityType;
  final String? entityLabel;
  final String summary;
  final Map<String, List<dynamic>> changes;
  final String? ipAddress;

  const AuditEntry({
    required this.id, this.createdAt, this.actorName, this.actorRole,
    required this.action, required this.entityType, this.entityLabel,
    required this.summary, this.changes = const {}, this.ipAddress,
  });

  factory AuditEntry.fromJson(Map<String, dynamic> j) => AuditEntry(
        id: (j['id'] as num).toInt(),
        // Stored in UTC ("...Z"), shown in local time.
        createdAt: DateTime.tryParse((j['created_at'] ?? '').toString())?.toLocal(),
        actorName: j['actor_name']?.toString(),
        actorRole: j['actor_role']?.toString(),
        action: (j['action'] ?? '').toString(),
        entityType: (j['entity_type'] ?? '').toString(),
        entityLabel: j['entity_label']?.toString(),
        summary: (j['summary'] ?? '').toString(),
        changes: {
          for (final e in ((j['changes'] as Map?) ?? {}).entries)
            e.key.toString(): (e.value as List? ?? const []),
        },
        ipAddress: j['ip_address']?.toString(),
      );
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String formatAuditTime(DateTime? t) {
  if (t == null) return '—';
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  final m = t.minute.toString().padLeft(2, '0');
  final s = t.second.toString().padLeft(2, '0');
  return '${_months[t.month - 1]} ${t.day}, ${t.year} · $h:$m:$s ${t.hour < 12 ? 'AM' : 'PM'}';
}

String _roleLabel(String? r) =>
    r == null || r.isEmpty ? '' : '${r[0].toUpperCase()}${r.substring(1)}';

String _value(dynamic v) {
  if (v == null || v == '') return '—';
  if (v is bool) return v ? 'Yes' : 'No';
  return v.toString();
}

(IconData, Color) _iconFor(String action) {
  if (action.startsWith('account.deactivate')) return (Icons.person_off_outlined, AppTheme.redColor);
  if (action.startsWith('account')) return (Icons.person_add_alt_outlined, AppTheme.greenColor);
  if (action.startsWith('personnel')) return (Icons.manage_accounts_outlined, AppTheme.accentBlue);
  if (action == 'certificate.verified') return (Icons.verified_outlined, AppTheme.greenColor);
  if (action == 'certificate.rejected') return (Icons.block, AppTheme.redColor);
  if (action.startsWith('certificate')) return (Icons.workspace_premium_outlined, AppTheme.accentBlue);
  if (action.startsWith('school_year')) return (Icons.date_range_outlined, AppTheme.amberColor);
  if (action.startsWith('event')) return (Icons.event_outlined, const Color(0xFF7C3AED));
  if (action.startsWith('task')) return (Icons.assignment_ind_outlined, AppTheme.accentBlue);
  return (Icons.history, AppTheme.textMuted);
}

class AuditEntryTile extends StatelessWidget {
  final AuditEntry entry;
  /// Show which record it is about (hidden when listing one record's history).
  final bool showEntity;
  const AuditEntryTile({super.key, required this.entry, this.showEntity = true});

  @override
  Widget build(BuildContext context) {
    final e = entry;
    final (icon, color) = _iconFor(e.action);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, size: 18, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8, runSpacing: 2, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(e.summary, style: AppTheme.labelMd),
              if (showEntity && e.entityLabel != null)
                Text('· ${e.entityLabel}', style: AppTheme.bodySm),
            ]),
            const SizedBox(height: 3),
            Text(
              [
                formatAuditTime(e.createdAt),
                'by ${e.actorName ?? 'system'}'
                    '${e.actorRole != null ? ' (${_roleLabel(e.actorRole)})' : ''}',
              ].join('  ·  '),
              style: AppTheme.caption,
            ),
            if (e.changes.isNotEmpty) ...[
              const SizedBox(height: 8),
              for (final c in e.changes.entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text.rich(TextSpan(
                    style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppTheme.textPrimary),
                    children: [
                      TextSpan(text: '${c.key.replaceAll('_', ' ')}: ',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      TextSpan(text: _value(c.value.isNotEmpty ? c.value[0] : null),
                          style: const TextStyle(color: AppTheme.textMuted,
                              decoration: TextDecoration.lineThrough)),
                      const TextSpan(text: '  →  '),
                      TextSpan(text: _value(c.value.length > 1 ? c.value[1] : null)),
                    ],
                  )),
                ),
            ],
          ]),
        ),
      ]),
    );
  }
}

/// The change history of one record (e.g. a person's account and delegation).
class AuditHistory extends StatefulWidget {
  final String entityType;
  final int entityId;
  const AuditHistory({super.key, required this.entityType, required this.entityId});

  @override
  State<AuditHistory> createState() => _AuditHistoryState();
}

class _AuditHistoryState extends State<AuditHistory> {
  List<AuditEntry>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    ApiService.getAuditLog(entityType: widget.entityType, entityId: widget.entityId, limit: 50)
        .then((r) { if (mounted) setState(() => _items = r.items); })
        .catchError((e) { if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', '')); });
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Text(_error!, style: AppTheme.bodySm);
    if (_items == null) {
      return const Padding(
        padding: EdgeInsets.all(8),
        child: Center(child: SizedBox(width: 18, height: 18,
            child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }
    if (_items!.isEmpty) return Text('No recorded changes yet.', style: AppTheme.bodySm);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [for (final e in _items!) AuditEntryTile(entry: e, showEntity: false)],
    );
  }
}
