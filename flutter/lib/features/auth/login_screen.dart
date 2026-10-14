import 'package:flutter/material.dart';
import '../appraisal/appraisal_screen.dart';
import '../../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;

  void _handleLogin() {
    final username = _usernameController.text.trim().toLowerCase();
    String? role;

    if (username.startsWith('principal.')) {
      role = 'principal';
    } else if (username.startsWith('coord.')) {
      role = 'coordinator';
    } else if (username.startsWith('dean.')) {
      role = 'dean';
    } else if (username.startsWith('teacher.')) {
      role = 'teacher';
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

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => AppraisalScreen(
          username: _usernameController.text.trim(),
          role: role,
        ),
      ),
    );
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
                        onPressed: _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2C2C2C),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          elevation: 0,
                        ),
                        child: const Text(
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
