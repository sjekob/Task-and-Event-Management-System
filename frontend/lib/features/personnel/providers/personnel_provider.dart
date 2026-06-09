import 'package:flutter/foundation.dart';
import '../../../models/models.dart';
import '../services/personnel_service.dart';

class PersonnelProvider extends ChangeNotifier {
  List<User> _personnel = [];
  bool _loading = false;
  String _search = '';
  int _tabIndex = 0;

  List<User> get personnel => List.unmodifiable(_personnel);
  List<User> get active => _personnel.where((u) => u.isActive).toList();
  List<User> get inactive => _personnel.where((u) => !u.isActive).toList();
  bool get loading => _loading;
  int get tabIndex => _tabIndex;

  Future<void> load() async {
    _loading = true;
    notifyListeners();
    try {
      _personnel = await PersonnelService.list(search: _search);
    } finally {
      _loading = false;
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
