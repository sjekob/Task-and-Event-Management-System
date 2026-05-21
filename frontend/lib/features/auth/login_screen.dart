import 'package:flutter/material.dart';
import '../appraisal/appraisal_screen.dart';
import '../../shared/utils/platform_utils.dart';
import '../../core/api_service.dart';
import 'package:dio/dio.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  Future<void> _handleLogin() async {
    if (_isLoading) return;

    final username = _usernameController.text.trim().toLowerCase();
    final password = _passwordController.text;

    if (password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Access Denied: Please enter a password.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    // Intercept root administrator credentials
    if (username == 'admin') {
      if (password != 'password') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Access Denied: Invalid administrator credentials.'),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }
    } else {
      String? role;
      String? prefix;

      if (username.startsWith('principal.')) {
        role = 'principal';
        prefix = 'principal.';
      } else if (username.startsWith('coord.')) {
        role = 'coordinator';
        prefix = 'coord.';
      } else if (username.startsWith('dean.')) {
        role = 'dean';
        prefix = 'dean.';
      } else if (username.startsWith('teacher.')) {
        role = 'teacher';
        prefix = 'teacher.';
      }

      if (role == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Access Denied: Only Principal, Coordinator, Dean, and Teacher accounts are allowed.'),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }

      // Validate that a non-empty name follows the role prefix
      if (prefix != null) {
        final namePart = username.substring(prefix.length).trim();
        if (namePart.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Access Denied: Please provide a name after the prefix (e.g., coord.username).'),
              backgroundColor: Colors.redAccent,
            ),
          );
          return;
        }
      }
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final response = await AuthApi().login(username, password);
      final token = response['access_token'] as String?;
      if (token == null) {
        throw Exception('Token not found in login response');
      }
      ApiService.jwtToken = token;

      if (username == 'admin') {
        redirectToAdmin();
      } else {
        final backendRole = response['role'] as String?;
        final backendUsername = response['username'] as String?;
        
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (context) => AppraisalScreen(
              username: backendUsername ?? _usernameController.text.trim(),
              role: backendRole,
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      String errorMessage = 'Failed to connect to authentication server.';
      if (e is DioException) {
        if (e.response != null && e.response!.data != null) {
          final detail = e.response!.data['detail'];
          if (detail != null) {
            errorMessage = detail.toString();
          }
        } else if (e.message != null) {
          errorMessage = e.message!;
        }
      } else {
        errorMessage = e.toString();
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Login Failed: $errorMessage'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFB4C5D6), // Light blue-grey
              Color(0xFFF3EAC2), // Light yellow
              Color(0xFF6B8DB5), // Deeper blue-grey
            ],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // Logo at top left
            Positioned(
              top: 40,
              left: 40,
              child: Row(
                children: [
                  const Icon(Icons.psychology, color: Colors.white, size: 32),
                  const SizedBox(width: 8),
                  Text(
                    'TaskNet',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                      shadows: [
                        Shadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Login Card
            Center(
              child: Container(
                width: 400,
                padding: const EdgeInsets.all(40),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2EAF4), // Light bluish-white card background
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Sign in',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 32),
                    
                    // Username Field
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Username',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _usernameController,
                          decoration: InputDecoration(
                            hintText: 'Username',
                            hintStyle: const TextStyle(color: Colors.black38),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide.none,
                            ),
                            suffixIcon: const Icon(Icons.account_circle, color: Colors.black54),
                          ),
                          onSubmitted: (_) => _handleLogin(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    
                    // Password Field
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Password',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            hintText: 'Password',
                            hintStyle: const TextStyle(color: Colors.black38),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide.none,
                            ),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword ? Icons.visibility : Icons.visibility_off,
                                color: Colors.black54,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                          ),
                          onSubmitted: (_) => _handleLogin(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    
                    // Login Button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2C2C2C),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Text(
                                'Log In',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    
                    // Forgot password link
                    TextButton(
                      onPressed: () {},
                      child: const Text(
                        'Forgot password?',
                        style: TextStyle(
                          color: Colors.black87,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // Question mark at bottom right
            Positioned(
              bottom: 24,
              right: 24,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.6),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text(
                    '?',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
