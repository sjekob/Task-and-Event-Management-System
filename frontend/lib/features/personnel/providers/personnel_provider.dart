import 'package:flutter/foundation.dart';
import '../../../models/models.dart';
import '../services/personnel_service.dart';

class PersonnelProvider extends ChangeNotifier {
  static const _pageSize = 30;

  final List<User> _personnel = [];
  bool _loading = false;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  String _search = '';
  int _tabIndex = 0;

  List<User> get personnel => List.unmodifiable(_personnel);
  List<User> get active => _personnel.where((u) => u.isActive).toList();
  List<User> get inactive => _personnel.where((u) => !u.isActive).toList();
  bool get loading => _loading;
  bool get loadingMore => _loadingMore;
  bool get hasMore => _hasMore;
  int get tabIndex => _tabIndex;

  Future<void> load() async {
    _loading = true;
    _offset = 0;
    _hasMore = true;
    notifyListeners();
    try {
      final page = await PersonnelService.listPage(
          search: _search, limit: _pageSize, offset: 0);
      _personnel
        ..clear()
        ..addAll(page.items);
      _offset = _personnel.length;
      _hasMore = page.hasMore;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Append the next page (infinite scroll). No-op if already loading or done.
  Future<void> loadMore() async {
    if (_loadingMore || _loading || !_hasMore) return;
    _loadingMore = true;
    notifyListeners();
    try {
      final page = await PersonnelService.listPage(
          search: _search, limit: _pageSize, offset: _offset);
      _personnel.addAll(page.items);
      _offset = _personnel.length;
      _hasMore = page.hasMore;
    } finally {
      _loadingMore = false;
      notifyListeners();
    }
  }

  void search(String query) {
    _search = query;
    load();
  }

  void setTabIndex(int index) {
    _tabIndex = index;
    notifyListeners();
  }

  Future<void> toggleStatus(int userId) async {
    await PersonnelService.toggleStatus(userId);
    await load();
  }
}
