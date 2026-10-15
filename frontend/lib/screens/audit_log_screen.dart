import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/audit_history.dart';
import '../widgets/common_widgets.dart';

/// Principal/admin page listing the audit trail: account and delegation
/// changes, certificate reviews, school-year changes, event approvals and task
/// assignments, each with who did it and when. Entries can't be edited or
/// deleted (enforced by the database).
class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key});
  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

const _categories = <String, String?>{
  'All activity': null,
  'Accounts': 'account',
  'Roles & delegation': 'personnel',
  'Certificates': 'certificate',
  'School years': 'school_year',
  'Events': 'event',
  'Task assignments': 'task',
};

class _AuditLogScreenState extends State<AuditLogScreen> {
  static const _pageSize = 50;
  final List<AuditEntry> _items = [];
  int _total = 0;
  bool _loading = true;
  String? _error;
  String _category = 'All activity';
  String _query = '';
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final r = await ApiService.getAuditLog(
        action: _categories[_category],
        query: _query,
        limit: _pageSize,
        offset: reset ? 0 : _items.length,
      );
      if (!mounted) return;
      setState(() {
        if (reset) _items.clear();
        _items.addAll(r.items);
        _total = r.total;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() { _loading = false; _error = '$e'.replaceFirst('Exception: ', ''); });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(isMobile ? 16 : 24, 8, isMobile ? 16 : 24, 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const AppBanner(
          title: 'Audit Log',
          subtitle: 'Every change to accounts, roles and delegations, certificate reviews, '
              'school years, event approvals and task assignments, with who made it and when. '
              'Entries cannot be edited or deleted.',
        ),
        const SizedBox(height: 16),
        Wrap(spacing: 12, runSpacing: 12, crossAxisAlignment: WrapCrossAlignment.center, children: [
          SizedBox(
            width: isMobile ? double.infinity : 340,
            child: TextField(
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), () {
                  _query = v.trim();
                  _load(reset: true);
                });
              },
              decoration: InputDecoration(
                hintText: 'Search by person or description…',
                hintStyle: AppTheme.bodyMd,
                prefixIcon: const Icon(Icons.search, size: 18, color: AppTheme.textMuted),
                filled: true, fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
          ),
          for (final c in _categories.keys)
            ChoiceChip(
              label: Text(c),
              selected: _category == c,
              onSelected: (_) {
                setState(() => _category = c);
                _load(reset: true);
              },
              labelStyle: GoogleFonts.plusJakartaSans(
                  fontSize: 12.5, fontWeight: FontWeight.w600,
                  color: _category == c ? Colors.white : AppTheme.textPrimary),
              selectedColor: AppTheme.darkBanner,
              backgroundColor: Colors.white,
              showCheckmark: false,
              side: const BorderSide(color: AppTheme.borderColor),
            ),
        ]),
        const SizedBox(height: 16),
        if (_error != null)
          Text(_error!, style: AppTheme.bodyMd.copyWith(color: AppTheme.redColor))
        else if (_items.isEmpty && _loading)
          const Padding(padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator()))
        else if (_items.isEmpty)
          Padding(
            padding: const EdgeInsets.all(32),
            child: Center(child: Text('No matching activity.', style: AppTheme.bodyMd)),
          )
        else ...[
          Text('$_total ${_total == 1 ? 'entry' : 'entries'}', style: AppTheme.caption),
          const SizedBox(height: 8),
          for (final e in _items) AuditEntryTile(entry: e),
          if (_items.length < _total)
            Center(
              child: TextButton(
                onPressed: _loading ? null : () => _load(),
                child: Text(_loading ? 'Loading…' : 'Load more'),
              ),
            ),
        ],
      ]),
    );
  }
}
