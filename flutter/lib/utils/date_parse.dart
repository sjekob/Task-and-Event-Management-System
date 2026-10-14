/// Parses an event's free-text target/event date into a [DateTime], or `null`
/// when it can't be confidently parsed — so callers must NOT fall back to
/// "today" (that's what put event dots on the current date).
///
/// Handles:
///   • ISO            "2026-10-20"
///   • Human-readable "October 20, 2026", "Oct. 20, 2026"
///   • Multi-date     "Oct. 23, 24 & 28, 2024"  → first date (Oct 23, 2024)
DateTime? parseEventDate(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  final t = raw.trim();

  final iso = DateTime.tryParse(t);
  if (iso != null) return iso;

  const months = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
  };

  // Month name + first day, and the 4-digit year (taken anywhere in the string).
  final md = RegExp(r'([A-Za-z]{3,9})\.?\s+(\d{1,2})').firstMatch(t);
  final ym = RegExp(r'(19|20)\d{2}').firstMatch(t);
  if (md != null && ym != null) {
    final mon = months[md.group(1)!.toLowerCase().substring(0, 3)];
    final day = int.tryParse(md.group(2)!);
    final year = int.tryParse(ym.group(0)!);
    if (mon != null && day != null && year != null) {
      try {
        return DateTime(year, mon, day);
      } catch (_) {}
    }
  }
  return null;
}
