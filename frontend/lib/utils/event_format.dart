import 'dart:convert';

/// Human-readable formatters for the JSON-encoded event proposal fields, for
/// places that display them as plain text (e.g. the Activity feed detail).
/// Each falls back to the raw string if it can't be parsed.

String formatParticipants(String raw) {
  try {
    final data = jsonDecode(raw) as Map<String, dynamic>;
    final rows = (data['rows'] as List?) ?? [];
    final lines = <String>[];
    for (final r in rows) {
      final m = r as Map<String, dynamic>;
      final cat = (m['category'] ?? '').toString().trim();
      if (cat.isEmpty) continue;
      lines.add('$cat: ${m['male'] ?? 0}M / ${m['female'] ?? 0}F  (total ${m['total'] ?? 0})');
    }
    final t = data['totals'] as Map<String, dynamic>?;
    if (t != null) {
      lines.add('Total: ${t['male'] ?? 0}M / ${t['female'] ?? 0}F  (${t['total'] ?? 0})');
    }
    return lines.isEmpty ? raw : lines.join('\n');
  } catch (_) {
    return raw;
  }
}

String _stripBullet(String s) => s.trim().replaceFirst(RegExp(r'^[•\-\*·●○]\s*'), '');

String formatOutputs(String raw) {
  try {
    final t = raw.trim();
    final list = t.startsWith('[') ? (jsonDecode(t) as List) : raw.split('\n');
    final items = list
        .map((e) => _stripBullet(e.toString()))
        .where((s) => s.isNotEmpty)
        .map((s) => '• $s');
    return items.isEmpty ? raw : items.join('\n');
  } catch (_) {
    return raw;
  }
}

String formatMethodology(String raw) {
  try {
    final list = jsonDecode(raw) as List;
    final out = <String>[];
    for (final item in list) {
      final m = item as Map<String, dynamic>;
      final stage = (m['stage'] ?? '').toString().trim();
      final acts = (m['activities'] ?? '').toString().trim();
      if (stage.isNotEmpty) out.add(stage);
      for (final l in acts.split('\n').where((l) => l.trim().isNotEmpty)) {
        out.add('   • ${l.trim()}');
      }
    }
    return out.isEmpty ? raw : out.join('\n');
  } catch (_) {
    return raw;
  }
}

String formatCommittee(String raw) {
  try {
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    final out = list.map((m) {
      final name = (m['name'] ?? '').toString().trim();
      final pos = (m['position'] ?? m['designation'] ?? '').toString().trim();
      return '• $name${pos.isNotEmpty ? ' — $pos' : ''}';
    }).where((s) => s.trim() != '•');
    return out.isEmpty ? raw : out.join('\n');
  } catch (_) {
    return raw;
  }
}

String formatTwg(String raw) {
  try {
    final list = jsonDecode(raw) as List;
    final out = <String>[];
    for (final g in list) {
      final m = g as Map<String, dynamic>;
      final title = (m['title'] ?? '').toString().trim();
      if (title.isNotEmpty) out.add(title);
      for (final mem in (m['members'] as List? ?? [])) {
        final mm = mem as Map<String, dynamic>;
        final name = (mm['name'] ?? '').toString().trim();
        final desig = (mm['designation'] ?? '').toString().trim();
        out.add('   • $name${desig.isNotEmpty ? ' — $desig' : ''}');
      }
    }
    return out.isEmpty ? raw : out.join('\n');
  } catch (_) {
    return raw;
  }
}

String formatActivityMatrix(String raw) {
  try {
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    final out = list.map((m) {
      final parts = [m['day'], m['time'], m['event'], m['speaker']]
          .map((e) => (e ?? '').toString().trim())
          .where((s) => s.isNotEmpty);
      return '• ${parts.join(' · ')}';
    }).where((s) => s.trim() != '•');
    return out.isEmpty ? raw : out.join('\n');
  } catch (_) {
    return raw;
  }
}
