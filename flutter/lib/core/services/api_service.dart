import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'http://127.0.0.1:8000/api/v1';

  // ── Token management ──────────────────────────────────
  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', token);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
  }

  // ── Headers ───────────────────────────────────────────
  static Future<Map<String, String>> _authHeaders() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // ── Auth ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> login(
      String username, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'password': password,
      }),
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      await saveToken(data['access_token']);
      return {'success': true, 'data': data};
    }
    return {
      'success': false,
      'message': 'Invalid username or password'
    };
  }

  static Future<void> logout() async {
    await clearToken();
  }

  static Future<Map<String, dynamic>?> getMe() async {
    final response = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: await _authHeaders(),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  // ── Events ────────────────────────────────────────────
  static Future<List<dynamic>> getEvents() async {
    final response = await http.get(
      Uri.parse('$baseUrl/events/'),
      headers: await _authHeaders(),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return [];
  }

  static Future<Map<String, dynamic>?> createEvent(
      Map<String, dynamic> eventData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/events/'),
      headers: await _authHeaders(),
      body: jsonEncode(eventData),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    return null;
  }

  static Future<bool> disableEvent(int eventId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/events/$eventId/disable'),
      headers: await _authHeaders(),
    );
    return response.statusCode == 200;
  }

  static Future<bool> enableEvent(int eventId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/events/$eventId/enable'),
      headers: await _authHeaders(),
    );
    return response.statusCode == 200;
  }

  static Future<bool> deleteEvent(int eventId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/events/$eventId'),
      headers: await _authHeaders(),
    );
    return response.statusCode == 204;
  }

  // ── Dashboard Stats ───────────────────────────────────
  static Future<Map<String, dynamic>?> getDashboardStats() async {
    final response = await http.get(
      Uri.parse('$baseUrl/dashboard/stats'),
      headers: await _authHeaders(),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  // ── Tasks ─────────────────────────────────────────────
  static Future<List<dynamic>> getTasks() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tasks/'),
      headers: await _authHeaders(),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return [];
  }
}