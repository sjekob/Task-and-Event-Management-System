import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'core/api_constants.dart';
import 'controllers/user_controller.dart';
import 'models/user_model.dart';
import 'views/principal/user_manager_view.dart';
import 'views/shared/profile_view.dart';
import 'views/shared/setup_profile_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TaskNetApp());
}

// ─────────────────────────────────────────────────────────────────────────────
// App root
// ─────────────────────────────────────────────────────────────────────────────
class TaskNetApp extends StatelessWidget {
  const TaskNetApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TaskNet',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4A5568)),
        fontFamily: 'Roboto',
        useMaterial3: true,
      ),
      home: const _AppEntry(),
      onGenerateRoute: AppRouter.generate,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App entry — restores session from SharedPreferences on refresh/reopen
// ─────────────────────────────────────────────────────────────────────────────
class _AppEntry extends StatefulWidget {
  const _AppEntry();

  @override
  State<_AppEntry> createState() => _AppEntryState();
}

class _AppEntryState extends State<_AppEntry> {
  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');

    if (!mounted) return;

    if (token == null) {
      Navigator.pushReplacementNamed(context, '/login');
      return;
    }

    try {
      final controller = UserController(authToken: token);
      // Decode user_id from the JWT without a library (it's in the payload segment)
      final parts = token.split('.');
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final userId  = int.parse((jsonDecode(payload) as Map)['sub'].toString());
      final user    = await controller.fetchUser(userId);

      if (!mounted) return;

      if (user.firstLogin) {
        Navigator.pushReplacementNamed(context, '/setup-profile',
            arguments: {'currentUser': user, 'controller': controller});
        return;
      }

      switch (user.role) {
        case UserRole.principal:
        case UserRole.registrar:
        case UserRole.dean:
        case UserRole.coordinator:
          Navigator.pushReplacementNamed(context, '/users',
              arguments: {'currentUser': user, 'controller': controller});
        case UserRole.teacher:
          Navigator.pushReplacementNamed(context, '/profile',
              arguments: {'currentUser': user, 'profileUserId': user.id, 'controller': controller});
      }
    } catch (_) {
      // Token expired or invalid — clear it and go to login
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('auth_token');
      if (mounted) Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────
class AppRouter {
  static Route<dynamic> generate(RouteSettings settings) {
    switch (settings.name) {
      case '/login':
        return MaterialPageRoute(builder: (_) => const LoginScreen());

      case '/users':
        final args = settings.arguments as Map<String, dynamic>;
        return MaterialPageRoute(
          builder: (_) => UserManagerView(
            currentUser: args['currentUser'] as UserDetailModel,
            controller: args['controller'] as UserController,
          ),
        );

      case '/setup-profile':
        final args = settings.arguments as Map<String, dynamic>;
        return MaterialPageRoute(
          builder: (_) => SetupProfileView(
            currentUser: args['currentUser'] as UserDetailModel,
            controller: args['controller'] as UserController,
          ),
        );

      case '/profile':
        final args = settings.arguments as Map<String, dynamic>;
        return MaterialPageRoute(
          builder: (_) => ProfileView(
            currentUser: args['currentUser'] as UserDetailModel,
            profileUserId: args['profileUserId'] as int,
            controller: args['controller'] as UserController,
          ),
        );

      default:
        return MaterialPageRoute(
          builder: (_) => const Scaffold(
            body: Center(child: Text('Page not found')),
          ),
        );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Screen
// ─────────────────────────────────────────────────────────────────────────────
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      final (token, user) = await AuthService.login(
        username: _usernameCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', token);

      if (!mounted) return;
      final controller = UserController(authToken: token);

      if (user.firstLogin) {
        Navigator.pushReplacementNamed(context, '/setup-profile', arguments: {
          'currentUser': user,
          'controller': controller,
        });
        return;
      }

      switch (user.role) {
        case UserRole.principal:
        case UserRole.registrar:
        case UserRole.dean:
        case UserRole.coordinator:
          Navigator.pushReplacementNamed(context, '/users', arguments: {
            'currentUser': user,
            'controller': controller,
          });
        case UserRole.teacher:
          Navigator.pushReplacementNamed(context, '/profile', arguments: {
            'currentUser': user,
            'profileUserId': user.id,
            'controller': controller,
          });
      }
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFDDE6F0),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            elevation: 4,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.school, size: 48, color: Color(0xFF4A5568)),
                  const SizedBox(height: 8),
                  const Text('TaskNet',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                  const Text('Naga Central School II',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.black54, fontSize: 13)),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _usernameCtrl,
                    decoration: _inputDeco('Username'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordCtrl,
                    obscureText: true,
                    decoration: _inputDeco('Password'),
                    onSubmitted: (_) => _login(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                  ],
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _loading ? null : _login,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2D3748),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _loading
                        ? const SizedBox(width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Sign In', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDeco(String label) => InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.grey.shade100,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade300)),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────────────────────────────────────
class AuthService {
  static Future<(String, UserDetailModel)> login({
    required String username,
    required String password,
  }) async {
    final res = await http.post(
      Uri.parse(ApiConstants.authToken),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: {'username': username, 'password': password},
    );

    if (res.statusCode != 200) {
      final body = json.decode(res.body) as Map<String, dynamic>;
      throw Exception(body['detail'] ?? 'Login failed');
    }

    final data = json.decode(res.body) as Map<String, dynamic>;
    final token = data['access_token'] as String;
    final controller = UserController(authToken: token);
    final user = await controller.fetchUser(data['user_id'] as int);
    return (token, user);
  }
}
