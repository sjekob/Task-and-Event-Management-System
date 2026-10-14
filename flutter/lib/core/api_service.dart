import 'package:dio/dio.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late final Dio dio;

  ApiService._internal() {
    const baseUrl = String.fromEnvironment('API_BASE', defaultValue: 'http://127.0.0.1:8000');
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: Duration(milliseconds: 5000),
      receiveTimeout: Duration(milliseconds: 5000),
    ));
  }
}

class SpecialTasksApi {
  final Dio _dio = ApiService().dio;

  Future<List<dynamic>> listTasks() async {
    final res = await _dio.get('/special-tasks');
    return res.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getTaskDetails(String id) async {
    final res = await _dio.get('/special-tasks/$id');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> evaluateTask(String id, Map<String, dynamic> payload) async {
    final res = await _dio.post('/special-tasks/$id/evaluate', data: payload);
    return res.data as Map<String, dynamic>;
  }
}

class EventsApi {
  final Dio _dio = ApiService().dio;

  Future<List<dynamic>> listEvents() async {
    final res = await _dio.get('/events');
    return res.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getEventDetails(String id) async {
    final res = await _dio.get('/events/$id');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> evaluateEvent(String id, Map<String, dynamic> payload) async {
    final res = await _dio.post('/events/$id/evaluate', data: payload);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getEventResults(String id) async {
    final res = await _dio.get('/events/$id/results');
    return res.data as Map<String, dynamic>;
  }
}

class DashboardApi {
  final Dio _dio = ApiService().dio;

  Future<Map<String, dynamic>> getTeacherDashboard(int personnelId) async {
    final res = await _dio.get('/dashboard/teacher/$personnelId');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getDeanDashboard(int personnelId) async {
    final res = await _dio.get('/dashboard/dean/$personnelId');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getCoordinatorDashboard(
    int personnelId, {
    String? area,
  }) async {
    final params = <String, dynamic>{};
    if (area != null) params['area'] = area;
    final res = await _dio.get(
      '/dashboard/coordinator/$personnelId',
      queryParameters: params,
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getPrincipalDashboard(int personnelId) async {
    final res = await _dio.get('/dashboard/principal', queryParameters: {
      'personnel_id': personnelId,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getEscalationAlerts({
    String? role,
    int? personnelId,
    String? area,
  }) async {
    final params = <String, dynamic>{};
    if (role != null) params['role'] = role;
    if (personnelId != null) params['personnel_id'] = personnelId;
    if (area != null) params['area'] = area;
    final res = await _dio.get(
      '/escalation-alerts',
      queryParameters: params,
    );
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> exportPerformanceSummary({
    required String period,
    required String role,
    int? personnelId,
    String? area,
  }) async {
    final params = <String, dynamic>{
      'period': period,
      'role': role,
    };
    if (personnelId != null) params['personnel_id'] = personnelId;
    if (area != null) params['area'] = area;
    final res = await _dio.get(
      '/export-performance-summary',
      queryParameters: params,
    );
    return res.data as Map<String, dynamic>;
  }
}