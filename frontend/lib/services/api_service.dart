import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

/// Token-bucket limiter: smooths request bursts so a runaway loop or rapid
/// double-submits can't flood the backend. Excess requests are *delayed*, not
/// failed, so normal use is unaffected.
class _TokenBucket {
  final double _ratePerSec;
  final int _capacity;
  double _tokens;
  DateTime _last = DateTime.now();

  _TokenBucket({double ratePerSec = 10, int burst = 20})
      : _ratePerSec = ratePerSec,
        _capacity = burst,
        _tokens = burst.toDouble();

  Future<void> acquire() async {
    while (true) {
      final now = DateTime.now();
      final elapsed = now.difference(_last).inMicroseconds / 1e6;
      _last = now;
      _tokens = (_tokens + elapsed * _ratePerSec).clamp(0.0, _capacity.toDouble());
      if (_tokens >= 1) {
        _tokens -= 1;
        return;
      }
      final waitMs = ((1 - _tokens) / _ratePerSec * 1000).ceil();
      await Future.delayed(Duration(milliseconds: waitMs));
    }
  }
}

/// Wraps an [http.Client] and throttles every outgoing request through a shared
/// token bucket. All requests (incl. multipart) funnel through send().
class _RateLimitedClient extends http.BaseClient {
  final http.Client _inner;
  final _TokenBucket _bucket = _TokenBucket();
  _RateLimitedClient(this._inner);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    await _bucket.acquire();
    return _inner.send(request);
  }
}

class ApiService {
  // Reads the --dart-define=API_BASE=... passed at build/run time (needed when
  // serving to other devices, e.g. --dart-define=API_BASE=http://192.168.8.34:8000).
  // Falls back to localhost for normal local development.
  static const String baseUrl =
      String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:8000');

  // All HTTP goes through this rate-limited client.
  static final http.Client _client = _RateLimitedClient(http.Client());

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
    final res = await _client.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    ).timeout(const Duration(seconds: 10),
        onTimeout: () => throw Exception('Cannot reach server. Check your network.'));
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      await saveToken(data['token']);
      return data;
    }
    throw Exception('Invalid username or password');
  }

  static Future<User> getMe() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: await _headers,
    ).timeout(const Duration(seconds: 10), onTimeout: () => throw Exception('Timeout'));
    if (res.statusCode == 200) return User.fromJson(jsonDecode(res.body));
    throw Exception('Not authenticated');
  }

  // ── Tasks ──
  static Future<List<Task>> getTasks({String search = '', String scope = 'mine'}) async {
    final params = <String>[];
    if (search.isNotEmpty) params.add('search=${Uri.encodeComponent(search)}');
    if (scope != 'mine') params.add('scope=$scope');
    final url = '$baseUrl/api/tasks${params.isEmpty ? '' : '?${params.join('&')}'}';
    final res = await _client.get(Uri.parse(url), headers: await _headers);
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((t) => Task.fromJson(t)).toList();
    }
    throw Exception('Failed to load tasks');
  }

  static Future<List<Task>> getAssignedTasks() async {
    final res = await _client.get(
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
    final res = await _client.get(
      Uri.parse('$baseUrl/api/tasks/$id'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return Task.fromJson(jsonDecode(res.body));
    throw Exception('Task not found');
  }

  static Future<void> createTask(Map<String, dynamic> body) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/tasks'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode != 200) throw Exception('Failed to create task');
  }

  static Future<void> updateTask(int id, Map<String, dynamic> body) async {
    final res = await _client.put(
      Uri.parse('$baseUrl/api/tasks/$id'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode != 200) throw Exception('Failed to update task');
  }

  static Future<void> deleteTask(int id) async {
    final res = await _client.delete(
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
    final res = await _client.post(
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
    final res = await _client.post(
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
    final res = await _client.delete(
      Uri.parse('$baseUrl/api/tasks/$taskId/assign/$userId'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to unassign user');
  }

  static Future<List<User>> getAssignableUsers() async {
    final res = await _client.get(
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
    final res = await _client.get(Uri.parse(url), headers: await _headers);
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((r) => Report.fromJson(r)).toList();
    }
    throw Exception('Failed to load reports');
  }

  static Future<void> updateReportStatus(int reportId, String status) async {
    final res = await _client.put(
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
    final res = await _client.get(Uri.parse(url), headers: await _headers);
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    throw Exception('Failed to load task log');
  }

  // ── Submission Log ──
  static Future<List<Map<String, dynamic>>> getSubmissionLog() async {
    final res = await _client.get(
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
    final res = await _client.post(
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
    final res = await _client.put(
      Uri.parse('$baseUrl/api/comments/$commentId'),
      headers: await _headers,
      body: jsonEncode({'content': content}),
    );
    if (res.statusCode != 200) throw Exception('Failed to edit comment');
  }

  static Future<Map<String, String>> uploadAttachmentFile(
      List<int> bytes, String filename) async {
    final t = await token;
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/upload'),
    );
    if (t != null) req.headers['Authorization'] = 'Bearer $t';
    req.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final streamed = await _client.send(req);
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode != 200) throw Exception('File upload failed');
    final json = jsonDecode(body) as Map<String, dynamic>;
    return {
      'url': '$baseUrl${json['url']}',
      'name': json['name'] as String? ?? filename,
    };
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
    final streamed = await _client.send(req);
    if (streamed.statusCode != 200) throw Exception('File upload failed');
  }

  static Future<void> deleteReport(int reportId) async {
    final res = await _client.delete(
      Uri.parse('$baseUrl/api/reports/$reportId'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to unsubmit report');
  }

  static Future<void> deleteComment(int commentId) async {
    final res = await _client.delete(
      Uri.parse('$baseUrl/api/comments/$commentId'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to delete comment');
  }

  // ── Templates ──
  static Future<void> createTemplate(Map<String, dynamic> data) async {
    final res = await _client.post(
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
    final res = await _client.get(
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
    await _client.delete(
      Uri.parse('$baseUrl/api/templates/$templateId'),
      headers: await _headers,
    );
  }

  // ── Dashboard ──
  static Future<DashboardData> getDashboard() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/dashboard'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return DashboardData.fromJson(jsonDecode(res.body));
    throw Exception('Failed to load dashboard');
  }

  // ── Users ──
  static Future<List<User>> getUsers() async {
    final res = await _client.get(
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
    final res = await _client.get(
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
    final res = await _client.get(
      Uri.parse('$baseUrl/api/users/me/profile'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return User.fromJson(jsonDecode(res.body));
    throw Exception('Failed to load profile');
  }

  static Future<void> updateMyProfile(Map<String, dynamic> body) async {
    final res = await _client.put(
      Uri.parse('$baseUrl/api/users/me/profile'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode != 200) throw Exception('Failed to update profile');
  }

  // ── Subjects ──
  static Future<List<String>> getSubjects() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/subjects'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<String>.from(jsonDecode(res.body));
    }
    return [];
  }

  // ── Personnel Management ──────────────────────────────────────────────────

  static Future<List<User>> getPersonnel({String search = ''}) async {
    String url = '$baseUrl/api/personnel';
    if (search.isNotEmpty) url += '?search=${Uri.encodeComponent(search)}';
    final res = await _client.get(Uri.parse(url), headers: await _headers);
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((u) => User.fromJson(u as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load personnel');
  }

  static Future<User> getPersonnelById(int id) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/personnel/$id'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return User.fromJson(jsonDecode(res.body));
    throw Exception('User not found');
  }

  static Future<User> createPersonnel(Map<String, dynamic> data) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/personnel'),
      headers: await _headers,
      body: jsonEncode(data),
    );
    if (res.statusCode == 201) return User.fromJson(jsonDecode(res.body));
    throw Exception(jsonDecode(res.body)['detail'] ?? 'Failed to create personnel');
  }

  static Future<User> updatePersonnel(int id, Map<String, dynamic> data) async {
    final res = await _client.put(
      Uri.parse('$baseUrl/api/personnel/$id'),
      headers: await _headers,
      body: jsonEncode(data),
    );
    if (res.statusCode == 200) return User.fromJson(jsonDecode(res.body));
    throw Exception(jsonDecode(res.body)['detail'] ?? 'Failed to update personnel');
  }

  static Future<void> togglePersonnelStatus(int id) async {
    final res = await _client.patch(
      Uri.parse('$baseUrl/api/personnel/$id/status'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to update status');
  }

  static Future<List<Map<String, dynamic>>> getGradeLevelsMeta() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/personnel/meta/grade-levels'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    return [];
  }

  static Future<List<Map<String, dynamic>>> getSubjectsMeta() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/personnel/meta/subjects'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    return [];
  }

  static Future<void> updatePersonnelSubjects(
      int id, List<Map<String, dynamic>> subjects) async {
    final res = await _client.put(
      Uri.parse('$baseUrl/api/personnel/$id/subjects'),
      headers: await _headers,
      body: jsonEncode({'subjects': subjects}),
    );
    if (res.statusCode != 200) {
      throw Exception(
          jsonDecode(res.body)['detail'] ?? 'Failed to update subjects');
    }
  }

  // ── Appraisal Management ──────────────────────────────────────────────────

  static Future<List<SpecialTask>> getSpecialTasks() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/appraisal/special-tasks'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((t) => SpecialTask.fromJson(t as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load special tasks');
  }

  static Future<SpecialTask> evaluateSpecialTask(
      int taskId, Map<String, dynamic> scores) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/appraisal/special-tasks/$taskId/evaluate'),
      headers: await _headers,
      body: jsonEncode(scores),
    );
    if (res.statusCode == 200) {
      return SpecialTask.fromJson(jsonDecode(res.body));
    }
    throw Exception('Failed to evaluate task');
  }

  static Future<List<Map<String, dynamic>>> getReportSubmissions() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/appraisal/report-submissions'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    throw Exception('Failed to load report submissions');
  }

  static Future<List<EventForAppraisal>> getEventsForAppraisal() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/appraisal/events'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      final List data = jsonDecode(res.body);
      return data.map((e) => EventForAppraisal.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load events');
  }

  static Future<EventForAppraisal> evaluateEvent(
      int eventId, Map<String, dynamic> evalData) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/appraisal/events/$eventId/evaluate'),
      headers: await _headers,
      body: jsonEncode(evalData),
    );
    if (res.statusCode == 201) {
      return EventForAppraisal.fromJson(jsonDecode(res.body));
    }
    throw Exception('Failed to submit evaluation');
  }

  // ── Public Event Evaluation (reached by scanning the event's QR code;
  // no login required, all gating/validation happens server-side) ──────────

  static Future<Map<String, dynamic>> getPublicEvent(String eventId) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/appraisal/public/events/$eventId'),
      headers: const {'Content-Type': 'application/json'},
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception(jsonDecode(res.body)['detail'] ?? 'Event not found.');
  }

  static Future<void> submitPublicEvaluation(
      String eventId, Map<String, dynamic> evalData) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/appraisal/public/events/$eventId/evaluate'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(evalData),
    );
    if (res.statusCode == 201) return;
    throw Exception(jsonDecode(res.body)['detail'] ?? 'Failed to submit evaluation.');
  }

  // ── Event Management ──────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getEvents() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/events'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    throw Exception('Failed to load events');
  }

  static Future<Map<String, dynamic>?> getEvent(int id) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/events/$id'),
      headers: await _headers,
    );
    if (res.statusCode == 200) return jsonDecode(res.body) as Map<String, dynamic>;
    return null;
  }

  static Future<Map<String, dynamic>?> createEvent(Map<String, dynamic> payload) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/events'),
      headers: await _headers,
      body: jsonEncode(payload),
    );
    if (res.statusCode == 201) return jsonDecode(res.body) as Map<String, dynamic>;
    return null;
  }

  static Future<Map<String, dynamic>?> updateEvent(int id, Map<String, dynamic> payload) async {
    final res = await _client.put(
      Uri.parse('$baseUrl/api/events/$id'),
      headers: await _headers,
      body: jsonEncode(payload),
    );
    if (res.statusCode == 200) return jsonDecode(res.body) as Map<String, dynamic>;
    return null;
  }

  static Future<void> approveEvent(int id) async {
    final res = await _client.patch(
      Uri.parse('$baseUrl/api/events/$id/approve'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to approve event');
  }

  static Future<void> disableEvent(int id) async {
    final res = await _client.patch(
      Uri.parse('$baseUrl/api/events/$id/disable'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to disable event');
  }

  static Future<void> enableEvent(int id) async {
    final res = await _client.patch(
      Uri.parse('$baseUrl/api/events/$id/enable'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to enable event');
  }

  static Future<void> deleteEvent(int id) async {
    final res = await _client.delete(
      Uri.parse('$baseUrl/api/events/$id'),
      headers: await _headers,
    );
    if (res.statusCode != 200) throw Exception('Failed to delete event');
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getNotifications() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/notifications'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    throw Exception('Failed to load notifications');
  }

  static Future<int> getUnreadNotificationCount() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/notifications/unread-count'),
      headers: await _headers,
    );
    if (res.statusCode == 200) {
      return (jsonDecode(res.body) as Map<String, dynamic>)['count'] as int;
    }
    return 0;
  }

  static Future<void> markNotificationRead(int id) async {
    await _client.post(
      Uri.parse('$baseUrl/api/notifications/$id/read'),
      headers: await _headers,
    );
  }

  static Future<void> markAllNotificationsRead() async {
    await _client.post(
      Uri.parse('$baseUrl/api/notifications/read-all'),
      headers: await _headers,
    );
  }

  static Future<void> deleteNotification(int id) async {
    await _client.delete(
      Uri.parse('$baseUrl/api/notifications/$id'),
      headers: await _headers,
    );
  }
}
