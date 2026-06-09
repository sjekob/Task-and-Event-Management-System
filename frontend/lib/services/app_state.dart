import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';

class AppState extends ChangeNotifier {
  User? currentUser;
  bool isLoading = false;
  String? error;

  bool get isLoggedIn => currentUser != null;
  bool get isAdmin => currentUser?.isAdmin ?? false;
  bool get isPrincipal => currentUser?.isPrincipal ?? false;
  bool get isCoordinator => currentUser?.isCoordinator ?? false;
  bool get isDean => currentUser?.isDean ?? false;
  bool get isTeacher => currentUser?.isTeacher ?? false;
  bool get isRegistrar => currentUser?.isRegistrar ?? false;
  bool get canManageTasks => currentUser?.isManager ?? false;
  bool get canReviewSubmissions => currentUser?.canReviewSubmissions ?? false;
  bool get canAssign => currentUser?.canAssign ?? false;

  String get userRole => currentUser?.role ?? '';

  Future<bool> tryAutoLogin() async {
    try {
      currentUser = await ApiService.getMe();
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> login(String username, String password) async {
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final data = await ApiService.login(username, password);
      currentUser = User.fromJson(data['user']);
      isLoading = false;
      notifyListeners();
    } catch (e) {
      error = e.toString();
      isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    await ApiService.clearToken();
    currentUser = null;
    notifyListeners();
  }
}
