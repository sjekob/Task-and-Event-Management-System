import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';

class AppState extends ChangeNotifier {
  User? currentUser;
  bool isLoading = false;
  String? error;

  /// Set when the session ends because the token expired (vs. a manual logout),
  /// so the login screen can tell the user their work was auto-saved.
  bool sessionExpired = false;

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

  // ── Draft auto-save hook ────────────────────────────────────────────────────
  // A screen with unsaved, draftable work (e.g. AddEventScreen) registers a
  // callback here. It runs — while the token is still valid — right before a
  // logout or a token-expiry, so the work is persisted as a draft.
  Future<void> Function()? _draftAutosave;
  Timer? _expiryTimer;

  void registerDraftAutosave(Future<void> Function() cb) => _draftAutosave = cb;
  void unregisterDraftAutosave(Future<void> Function() cb) {
    if (identical(_draftAutosave, cb)) _draftAutosave = null;
  }

  Future<void> _runDraftAutosave() async {
    final cb = _draftAutosave;
    if (cb == null) return;
    try {
      await cb();
    } catch (_) {/* best-effort */}
  }

  Future<bool> tryAutoLogin() async {
    try {
      currentUser = await ApiService.getMe();
      notifyListeners();
      await _scheduleExpiryAutosave();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> login(String username, String password) async {
    isLoading = true;
    error = null;
    sessionExpired = false;
    notifyListeners();
    try {
      final data = await ApiService.login(username, password);
      currentUser = User.fromJson(data['user']);
      isLoading = false;
      notifyListeners();
      await _scheduleExpiryAutosave();
    } catch (e) {
      error = e.toString();
      isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    _expiryTimer?.cancel();
    await _runDraftAutosave(); // save in-progress draft while token is still valid
    await ApiService.clearToken();
    currentUser = null;
    notifyListeners();
  }

  /// Fired by the expiry timer: persist the draft, then end the session.
  Future<void> _expireSession() async {
    _expiryTimer?.cancel();
    await _runDraftAutosave();
    await ApiService.clearToken();
    currentUser = null;
    sessionExpired = true;
    notifyListeners();
  }

  /// Schedule a one-shot timer to fire ~1 minute before the JWT expires, so the
  /// draft can be saved with a still-valid token before the session is dropped.
  Future<void> _scheduleExpiryAutosave() async {
    _expiryTimer?.cancel();
    final token = await ApiService.token;
    final expMs = _jwtExpiryMs(token);
    if (expMs == null) return;
    final fireAt = DateTime.fromMillisecondsSinceEpoch(expMs)
        .subtract(const Duration(seconds: 60));
    final delay = fireAt.difference(DateTime.now());
    if (delay.isNegative) {
      // Already expired or about to — save and end now.
      await _expireSession();
      return;
    }
    _expiryTimer = Timer(delay, _expireSession);
  }

  /// Decode the `exp` claim (seconds) from a JWT, returning epoch milliseconds.
  static int? _jwtExpiryMs(String? token) {
    if (token == null) return null;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      while (payload.length % 4 != 0) {
        payload += '=';
      }
      final map = jsonDecode(utf8.decode(base64.decode(payload))) as Map<String, dynamic>;
      final exp = map['exp'];
      return exp is int ? exp * 1000 : null;
    } catch (_) {
      return null;
    }
  }
}
