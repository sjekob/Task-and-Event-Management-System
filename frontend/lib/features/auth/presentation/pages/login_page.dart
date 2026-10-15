import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/app_router.dart';
import '../bloc/auth_bloc.dart';
import '../widgets/auth_text_field.dart';
import '../widgets/mesh_gradient_painter.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _usernameFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _obscurePassword = true;

  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 10.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 10.0, end: -8.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -8.0, end: 8.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8.0, end: 0.0), weight: 1),
    ]).animate(
        CurvedAnimation(parent: _shakeController, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _usernameFocus.dispose();
    _passwordFocus.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  void _submit(BuildContext blocContext) {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    blocContext.read<AuthBloc>().add(LoginSubmitted(
          username: _usernameController.text.trim(),
          password: _passwordController.text,
        ));
  }

  void _shakeCard() {
    _shakeController.forward(from: 0);
    _passwordController.clear();
    Future.delayed(
        const Duration(milliseconds: 80), () => _passwordFocus.requestFocus());
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => AuthBloc(),
      child: Builder(
        builder: (blocContext) {
          return BlocConsumer<AuthBloc, AuthState>(
            listener: (context, state) {
              if (state is AuthSuccess) context.go(AppRoutes.dashboard);
              if (state is AuthFailure) _shakeCard();
            },
            builder: (context, state) => Scaffold(
              body: Stack(
                fit: StackFit.expand,
                children: [
                  CustomPaint(painter: MeshGradientPainter()),
                  SafeArea(
                    child: Stack(
                      children: [
                        const Positioned(top: 20, left: 24, child: _Logo()),
                        const Positioned(
                            bottom: 20, right: 20, child: _HelpButton()),
                        Center(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 24, vertical: 80),
                            child: AnimatedBuilder(
                              animation: _shakeAnimation,
                              builder: (_, child) => Transform.translate(
                                  offset: Offset(_shakeAnimation.value, 0),
                                  child: child),
                              child: _SignInCard(
                                formKey: _formKey,
                                usernameController: _usernameController,
                                passwordController: _passwordController,
                                usernameFocus: _usernameFocus,
                                passwordFocus: _passwordFocus,
                                obscurePassword: _obscurePassword,
                                isLoading: state is AuthLoading,
                                errorMessage:
                                    state is AuthFailure ? state.message : null,
                                onTogglePassword: () => setState(
                                    () => _obscurePassword = !_obscurePassword),
                                onSubmit: () => _submit(blocContext),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
} // ← END of _LoginPageState

// ─── Logo ─────────────────────────────────────────────────────────────────────
class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            border: Border.all(
                color: Colors.white.withValues(alpha: 0.8), width: 1.5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(Icons.grid_view_rounded,
              color: Colors.white, size: 20),
        ),
        const SizedBox(width: 10),
        const Text('TaskNet',
            style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3)),
      ],
    );
  }
}

// ─── Help Button ──────────────────────────────────────────────────────────────
class _HelpButton extends StatelessWidget {
  const _HelpButton();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0xFF7A8FA8).withValues(alpha: 0.65),
        shape: BoxShape.circle,
      ),
      child: const Center(
          child: Text('?',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600))),
    );
  }
}

// ─── Sign-in Card ─────────────────────────────────────────────────────────────
class _SignInCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController usernameController;
  final TextEditingController passwordController;
  final FocusNode usernameFocus;
  final FocusNode passwordFocus;
  final bool obscurePassword;
  final bool isLoading;
  final String? errorMessage;
  final VoidCallback onTogglePassword;
  final VoidCallback onSubmit;

  const _SignInCard({
    required this.formKey,
    required this.usernameController,
    required this.passwordController,
    required this.usernameFocus,
    required this.passwordFocus,
    required this.obscurePassword,
    required this.isLoading,
    required this.errorMessage,
    required this.onTogglePassword,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Container(
        padding: const EdgeInsets.fromLTRB(36, 42, 36, 32),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EBF8).withValues(alpha: 0.86),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 32,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Center(
                  child: Text('Sign in',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0D0D0D),
                        letterSpacing: -0.3,
                      ))),
              const SizedBox(height: 28),
              if (errorMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEECEC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: const Color(0xFFE57373).withValues(alpha: 0.45)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.error_outline,
                        color: Color(0xFFD32F2F), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(errorMessage!,
                            style: const TextStyle(
                                color: Color(0xFFD32F2F), fontSize: 13))),
                  ]),
                ),
                const SizedBox(height: 16),
              ],
              _label('Username'),
              const SizedBox(height: 6),
              AuthTextField(
                controller: usernameController,
                focusNode: usernameFocus,
                hint: 'Username',
                textInputAction: TextInputAction.next,
                onFieldSubmitted: (_) => passwordFocus.requestFocus(),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'Please enter your username'
                    : null,
                suffixIcon: const Padding(
                    padding: EdgeInsets.only(right: 12),
                    child: Icon(Icons.account_circle_outlined,
                        size: 22, color: Color(0xFF555555))),
              ),
              const SizedBox(height: 18),
              _label('Password'),
              const SizedBox(height: 6),
              AuthTextField(
                controller: passwordController,
                focusNode: passwordFocus,
                hint: 'Password',
                obscureText: obscurePassword,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => onSubmit(),
                validator: (v) => (v == null || v.isEmpty)
                    ? 'Please enter your password'
                    : null,
                suffixIcon: GestureDetector(
                    onTap: onTogglePassword,
                    child: Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Icon(
                          obscurePassword
                              ? Icons.remove_red_eye_outlined
                              : Icons.visibility_off_outlined,
                          size: 22,
                          color: const Color(0xFF555555),
                        ))),
              ),
              const SizedBox(height: 26),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: isLoading ? null : onSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E2126),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFF3A3F47),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  child: isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.2, color: Colors.white))
                      : const Text('Log In',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.2)),
                ),
              ),
              const SizedBox(height: 14),
              Center(
                child: TextButton(
                  onPressed: () {},
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF444444),
                    textStyle: const TextStyle(fontSize: 13),
                  ),
                  child: const Text('Forgot password?'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: Color(0xFF1A1A2E),
      ));
}
