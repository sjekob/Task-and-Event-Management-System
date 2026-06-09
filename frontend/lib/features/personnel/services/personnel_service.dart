import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../services/api_service.dart';
import '../../../models/models.dart';

class PersonnelService {
  static String get _base => ApiService.baseUrl;

  static Future<Map<String, String>> get _h async {
    final token = await ApiService.token;
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<List<User>> list({String search = ''}) async {
    final q = Uri.encodeQueryComponent(search);
    final res = await http.get(
      Uri.parse('$_base/api/personnel?search=$q'),
      headers: await _h,
    );
    if (res.statusCode == 200) {
      return (jsonDecode(res.body) as List)
          .map((e) => User.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to load personnel');
  }

  static Future<User> create(Map<String, dynamic> data) async {
    final res = await http.post(
      Uri.parse('$_base/api/personnel'),
      headers: await _h,
      body: jsonEncode(data),
    );
    if (res.statusCode == 201) return User.fromJson(jsonDecode(res.body));
    throw Exception(
        (jsonDecode(res.body) as Map)['detail'] ?? 'Failed to create');
  }

  static Future<User> update(int id, Map<String, dynamic> data) async {
    final res = await http.put(
      Uri.parse('$_base/api/personnel/$id'),
      headers: await _h,
      body: jsonEncode(data),
    );
    if (res.statusCode == 200) return User.fromJson(jsonDecode(res.body));
    throw Exception(
        (jsonDecode(res.body) as Map)['detail'] ?? 'Failed to update');
  }

  static Future<void> updateSubjects(
      int id, List<Map<String, dynamic>> subjects) async {
    final res = await http.put(
      Uri.parse('$_base/api/personnel/$id/subjects'),
      headers: await _h,
      body: jsonEncode({'subjects': subjects}),
    );
    if (res.statusCode != 200) {
      throw Exception(
          (jsonDecode(res.body) as Map)['detail'] ?? 'Failed to update subjects');
    }
  }

  static Future<void> toggleStatus(int id) async {
    final res = await http.patch(
      Uri.parse('$_base/api/personnel/$id/status'),
      headers: await _h,
    );
    if (res.statusCode != 200) throw Exception('Failed to update status');
  }

  static Future<List<Map<String, dynamic>>> gradeLevelsMeta() async {
    final res = await http.get(
      Uri.parse('$_base/api/personnel/meta/grade-levels'),
      headers: await _h,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    return [];
  }

  static Future<List<Map<String, dynamic>>> subjectsMeta() async {
    final res = await http.get(
      Uri.parse('$_base/api/personnel/meta/subjects'),
      headers: await _h,
    );
    if (res.statusCode == 200) {
      return List<Map<String, dynamic>>.from(jsonDecode(res.body));
    }
    return [];
  }
}
