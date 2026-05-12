import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/app_state.dart';
import '../widgets/common_widgets.dart';
import 'main_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _userFocus = FocusNode();
  final _passFocus = FocusNode();
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    _userFocus.dispose();
    _passFocus.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() => _error = null);
    final state = context.read<AppState>();
    try {
      await state.login(_userCtrl.text.trim(), _passCtrl.text);
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MainShell()),
        );
      }
    } catch (_) {
      setState(() => _error = 'Invalid username or password');
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
              Color(0xFFC8D5EA),
              Color(0xFFA8BCD6),
              Color(0xFFD4E0F0),
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Container(
              width: 400,
              padding: const EdgeInsets.all(36),
              decoration: BoxDecoration(
                color: AppTheme.bgColor,
                borderRadius: BorderRadius.circular(20),
                boxShadow: AppTheme.shadowLg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo row
                  Row(
                    children: [
                      const TaskNetLogo(size: 36),
                      const SizedBox(width: 10),
                      Text('TaskNet',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.textPrimary)),
                    ],
                  ),
                  const SizedBox(height: 28),

                  // Title
                  Text('Sign in',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.textPrimary)),
                  const SizedBox(height: 28),

                  // Username
                  _InputBox(
                    controller: _userCtrl,
                    focusNode: _userFocus,
                    placeholder: 'Username',
                    onSubmit: () => _passFocus.requestFocus(),
                    suffix: const Icon(Icons.person_outline,
                        size: 20, color: AppTheme.textLight),
                  ),
                  const SizedBox(height: 12),

                  // Password
                  _InputBox(
                    controller: _passCtrl,
                    focusNode: _passFocus,
                    placeholder: 'Password',
                    obscure: _obscure,
                    onSubmit: _login,
                    suffix: GestureDetector(
                      onTap: () => setState(() => _obscure = !_obscure),
                      child: Icon(
                        _obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        size: 20,
                        color: AppTheme.textLight,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Error
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(_error!,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 13, color: AppTheme.redColor)),
                    ),

                  // Login Button
                  Consumer<AppState>(
                    builder: (_, state, __) => ElevatedButton(
                      onPressed: state.isLoading ? null : _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.darkBanner,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      child: state.isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : Text('Log In',
                              style: GoogleFonts.plusJakartaSans(
                                  fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Forgot password
                  GestureDetector(
                    onTap: () {},
                    child: Text('Forgot password?',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 13, color: AppTheme.textMuted)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InputBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final String placeholder;
  final bool obscure;
  final Widget? suffix;
  final VoidCallback? onSubmit;

  const _InputBox({
    required this.controller,
    required this.focusNode,
    required this.placeholder,
    this.obscure = false,
    this.suffix,
    this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              obscureText: obscure,
              style: GoogleFonts.plusJakartaSans(fontSize: 15),
              textInputAction:
                  onSubmit != null ? TextInputAction.next : TextInputAction.done,
              onSubmitted: (_) => onSubmit?.call(),
              decoration: InputDecoration(
                hintText: placeholder,
                hintStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 15, color: AppTheme.textLight),
                border: InputBorder.none,
                isDense: true,
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          if (suffix != null) suffix!,
        ],
      ),
    );
  }
}
