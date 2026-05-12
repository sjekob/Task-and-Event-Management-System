import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class ApiService {
  static const String baseUrl = 'http://192.168.1.14:8000';
  static String? _token;

  static Future<String?> get token async {
    _token ??= (await SharedPreferences.getInstance()).getString('tasknet_token');
    return _token;
  }

  static Future<Map<String, String>> get _headers async {
    final t = await token;
    return {
      'Content-Type': 'application/json',
      if (t != null) 'Authorization': 'Bearer $t',
    };
  }

  static Future<void> saveToken(String t) async {
    _token = t;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('tasknet_token', t);
  }

  static Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('tasknet_token');
  }

  // ── Auth ──
  static Future<Map<String, dynamic>> login(String username, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      await saveToken(data['token']);
      return data;
    }
    throw Exception('Invalid credentials');
  }

  static Future<User> getMe() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return User.fromJson(jsonDecode(res.body));
    throw Exception('Not authenticated');
  }

  // ── Tasks ──
  static Future<List<Task>> getTasks({String search = ''}) async {
    String url = '$baseUrl/api/tasks';
    if (search.isNotEmpty) url += '?search=${Uri.encodeComponent(search)}';
    final res = await http.get(Uri.parse(url), headers: await _headers);
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((t) => Task.fromJson(t)).toList();
    }
    throw Exception('Failed to load tasks');
  }

  static Future<List<Task>> getAssignedTasks() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/tasks?assigned=1'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((t) => Task.fromJson(t)).toList();
    }
    throw Exception('Failed to load assigned tasks');
  }

  static Future<Task> getTask(int id) async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/tasks/$id'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return Task.fromJson(jsonDecode(res.body));
    throw Exception('Task not found');
  }

  static Future<void> createTask(Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/tasks'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode != 200) throw Exception('Failed to create task');
  }

  static Future<void> updateTask(int id, Map<String, dynamic> body) async {
    final res = await http.put(
      Uri.parse('$baseUrl/api/tasks/$id'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode != 200) throw Exception('Failed to update task');
  }

  static Future<void> deleteTask(int id) async {
    final res = await http.delete(
      Uri.parse('$baseUrl/api/tasks/$id'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to delete task');
  }

  // ── Report submission (teacher, registrar, dean all use this) ──
  static Future<Map<String, dynamic>> submitReport(
    int taskId, {
    required String reportTitle,
    String? reportDescription,
    String? reportType,
    String? reportLinkUrl,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/tasks/$taskId/reports'),
      headers: await _headers,
      body: jsonEncode({
        'report_title': reportTitle,
        if (reportDescription != null) 'report_description': reportDescription,
        if (reportType != null) 'report_type': reportType,
        if (reportLinkUrl != null) 'report_link_url': reportLinkUrl,
      }),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    final err = jsonDecode(res.body);
    throw Exception(err['detail'] ?? 'Failed to submit report');
  }

  // ── Task assignment ──
  static Future<void> assignTask(int taskId, List<int> userIds) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/tasks/$taskId/assign'),
      headers: await _headers,
      body: jsonEncode({'user_ids': userIds}),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['detail'] ?? 'Failed to assign users');
    }
  }

  static Future<void> unassignTask(int taskId, int userId) async {
    final res = await http.delete(
      Uri.parse('$baseUrl/api/tasks/$taskId/assign/$userId'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to unassign user');
  }

  static Future<List<User>> getAssignableUsers() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/users/assignable'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((u) => User.fromJson(u)).toList();
    }
    throw Exception('Failed to load assignable users');
  }

  // ── Reports ──
  static Future<List<Report>> getReports({int? taskId, String? status}) async {
    String url = '$baseUrl/api/reports';
    final params = <String, String>{};
    if (taskId != null) params['task_id'] = '$taskId';
    if (status != null) params['status'] = status;
    if (params.isNotEmpty) url += '?${Uri(queryParameters: params).query}';
    final res = await http.get(Uri.parse(url), headers: await _headers);
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((r) => Report.fromJson(r)).toList();
    }
    throw Exception('Failed to load reports');
  }

  static Future<void> updateReportStatus(int reportId, String status) async {
    final res = await http.put(
      Uri.parse('$baseUrl/api/reports/$reportId/status'),
      headers: await _headers,
      body: jsonEncode({'report_status': status}),
    );
    if (res.statusCode != 200) throw Exception('Failed to update report status');
  }

  // ── Task Log ──
  static Future<List<Map<String, dynamic>>> getTaskLog({int? taskId}) async {
    String url = '$baseUrl/api/task-log';
    if (taskId != null) url += '?task_id=$taskId';
    final res = await http.get(Uri.parse(url), headers: await _headers);
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    throw Exception('Failed to load task log');
  }

  // ── Submission Log ──
  static Future<List<Map<String, dynamic>>> getSubmissionLog() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/submission-log'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    throw Exception('Failed to load submission log');
  }

  // ── Comments ──
  static Future<void> addComment(int taskId, String content, String type, {int? reportId}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/tasks/$taskId/comments'),
      headers: await _headers,
      body: jsonEncode({
        'content': content,
        'comment_type': type,
        if (reportId != null) 'report_id': reportId,
      }),
    );
    if (res.statusCode != 200) throw Exception('Failed to add comment');
  }

  static Future<void> editComment(int commentId, String content) async {
    final res = await http.put(
      Uri.parse('$baseUrl/api/comments/$commentId'),
      headers: await _headers,
      body: jsonEncode({'content': content}),
    );
    if (res.statusCode != 200) throw Exception('Failed to edit comment');
  }

  static Future<void> uploadReportFile(
      int taskId, List<int> bytes, String filename) async {
    final t = await token;
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/tasks/$taskId/reports/upload'),
    );
    if (t != null) req.headers['Authorization'] = 'Bearer $t';
    req.files.add(http.MultipartFile.fromBytes('file', bytes,
        filename: filename));
    final streamed = await req.send();
    if (streamed.statusCode != 200) throw Exception('File upload failed');
  }

  static Future<void> deleteReport(int reportId) async {
    final res = await http.delete(
      Uri.parse('$baseUrl/api/reports/$reportId'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to unsubmit report');
  }

  static Future<void> deleteComment(int commentId) async {
    final res = await http.delete(
      Uri.parse('$baseUrl/api/comments/$commentId'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to delete comment');
  }

  // ── Templates ──
  static Future<void> createTemplate(Map<String, dynamic> data) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/templates'),
      headers: await _headers,
      body: jsonEncode(data),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['detail'] ?? 'Failed to create template');
    }
  }

  static Future<List<TaskTemplate>> getTemplates() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/templates'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return (jsonDecode(res.body) as List)
          .map((j) => TaskTemplate.fromJson(j as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  static Future<void> deleteTemplate(int templateId) async {
    await http.delete(
      Uri.parse('$baseUrl/api/templates/$templateId'),
      headers: await _headers,
    );
  }

  // ── Dashboard ──
  static Future<DashboardData> getDashboard() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/dashboard'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return DashboardData.fromJson(jsonDecode(res.body));
    throw Exception('Failed to load dashboard');
  }

  // ── Users ──
  static Future<List<User>> getUsers() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/users'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((u) => User.fromJson(u)).toList();
    }
    throw Exception('Failed to load users');
  }

  // ── Grade Levels ──
  static Future<List<Map<String, dynamic>>> getGradeLevels() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/grade-levels'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    return [];
  }

  // ── Profile ──
  static Future<User> getMyProfile() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/users/me/profile'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return User.fromJson(jsonDecode(res.body));
    throw Exception('Failed to load profile');
  }

  static Future<void> updateMyProfile(Map<String, dynamic> body) async {
    final res = await http.put(
      Uri.parse('$baseUrl/api/users/me/profile'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode != 200) throw Exception('Failed to update profile');
  }

  // ── Subjects ──
  static Future<List<String>> getSubjects() async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/subjects'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<String>.from(jsonDecode(res.body));
    }
    return [];
  }
}
