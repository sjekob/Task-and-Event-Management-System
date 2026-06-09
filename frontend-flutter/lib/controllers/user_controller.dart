// TaskNet - User Controller (API Communication)
// File: frontend-flutter/lib/controllers/user_controller.dart
//
// This class is the ONLY place in the UI layer that speaks HTTP.
// Views call methods here; they never build URLs themselves.

import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../core/api_constants.dart';
import '../models/user_model.dart';

class UserController {
  final String _authToken;

  UserController({required String authToken}) : _authToken = authToken;

  // ── Private helpers ──────────────────────────────────────────────────────
  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_authToken',
      };

  Future<Map<String, dynamic>> _get(String url) async {
    final res = await http.get(Uri.parse(url), headers: _headers);
    _assertOk(res);
    return json.decode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _post(String url, Map<String, dynamic> body) async {
    final res = await http.post(Uri.parse(url), headers: _headers, body: json.encode(body));
    _assertOk(res);
    return json.decode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _patch(String url, Map<String, dynamic> body) async {
    final res = await http.patch(Uri.parse(url), headers: _headers, body: json.encode(body));
    _assertOk(res);
    return json.decode(res.body) as Map<String, dynamic>;
  }

  void _assertOk(http.Response res) {
    if (res.statusCode >= 400) {
      final detail = (json.decode(res.body) as Map<String, dynamic>)['detail'] ?? 'Unknown error';
      throw ApiException(res.statusCode, detail.toString());
    }
  }

  // ── User CRUD ────────────────────────────────────────────────────────────

  Future<UserListResponse> fetchUsers({String? search}) async {
    final url = search != null && search.isNotEmpty
        ? '${ApiConstants.users}?search=${Uri.encodeComponent(search)}'
        : ApiConstants.users;
    return UserListResponse.fromJson(await _get(url));
  }

  Future<UserDetailModel> fetchUser(int id) async {
    return UserDetailModel.fromJson(await _get(ApiConstants.user(id)));
  }

  Future<UserDetailModel> quickCreateUser({
    required String email,
    required String username,
    required String password,
  }) async {
    return UserDetailModel.fromJson(await _post(ApiConstants.usersQuickCreate, {
      'email': email,
      'username': username,
      'password': password,
    }));
  }

  Future<UserDetailModel> createUser(Map<String, dynamic> payload) async {
    return UserDetailModel.fromJson(await _post(ApiConstants.users, payload));
  }

  Future<UserDetailModel> updateUser(int id, Map<String, dynamic> payload) async {
    return UserDetailModel.fromJson(await _patch(ApiConstants.user(id), payload));
  }

  Future<UserDetailModel> setUserStatus(int id, UserStatus newStatus) async {
    return UserDetailModel.fromJson(
      await _patch(ApiConstants.userStatus(id), {'status': newStatus.name}),
    );
  }

  Future<List<DelegationHistoryItem>> fetchDelegationHistory(int userId) async {
    final data = await _get(ApiConstants.userDelegationHistory(userId));
    return (data['items'] as List)
        .map((e) => DelegationHistoryItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<UserDetailModel> uploadAvatar(int id, Uint8List bytes, String filename) async {
    final request = http.MultipartRequest('POST', Uri.parse(ApiConstants.userAvatar(id)));
    request.headers['Authorization'] = 'Bearer $_authToken';
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    _assertOk(res);
    return UserDetailModel.fromJson(json.decode(res.body) as Map<String, dynamic>);
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  Future<List<GradeLevelModel>> fetchGradeLevels() async {
    final data = await _get(ApiConstants.gradeLevels);
    return (data['items'] as List)
        .map((e) => GradeLevelModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<SubjectModel>> fetchSubjects() async {
    final data = await _get(ApiConstants.subjects);
    return (data['items'] as List)
        .map((e) => SubjectModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<DepartmentModel>> fetchDepartments() async {
    final data = await _get(ApiConstants.departments);
    return (data['items'] as List)
        .map((e) => DepartmentModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<CoordinatorTypeModel>> fetchCoordinatorTypes() async {
    final data = await _get(ApiConstants.coordinatorTypes);
    return (data['items'] as List)
        .map((e) => CoordinatorTypeModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

// ---------------------------------------------------------------------------
// Typed exception so Views can show user-friendly messages
// ---------------------------------------------------------------------------
class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}
