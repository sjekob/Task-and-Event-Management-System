import 'package:flutter/material.dart';
import '../../controllers/user_controller.dart';
import '../../models/user_model.dart';
import '../../widgets/date_picker_field.dart';

const _kBg      = Color(0xFFDDE6F0);
const _kAccent  = Color(0xFF2D3748);
const _kError   = Color(0xFFE53E3E);

class SetupProfileView extends StatefulWidget {
  final UserDetailModel currentUser;
  final UserController controller;

  const SetupProfileView({
    super.key,
    required this.currentUser,
    required this.controller,
  });

  @override
  State<SetupProfileView> createState() => _SetupProfileViewState();
}

class _SetupProfileViewState extends State<SetupProfileView> {
  final _formKey       = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _midNameCtrl   = TextEditingController();
  final _lastNameCtrl  = TextEditingController();
  final _suffixCtrl    = TextEditingController();
  final _contactCtrl   = TextEditingController();
  final _birthdateCtrl = TextEditingController();
  final _newPassCtrl   = TextEditingController();
  final _confirmCtrl   = TextEditingController();

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _firstNameCtrl, _midNameCtrl, _lastNameCtrl, _suffixCtrl,
      _contactCtrl, _birthdateCtrl, _newPassCtrl, _confirmCtrl,
    ]) { c.dispose(); }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });

    final payload = <String, dynamic>{
      'first_name': _firstNameCtrl.text.trim(),
      'last_name':  _lastNameCtrl.text.trim(),
      if (_midNameCtrl.text.trim().isNotEmpty) 'middle_name': _midNameCtrl.text.trim(),
      if (_suffixCtrl.text.trim().isNotEmpty)  'suffix':      _suffixCtrl.text.trim(),
      if (_contactCtrl.text.trim().isNotEmpty) 'contact_number': _contactCtrl.text.trim(),
      if (_birthdateCtrl.text.trim().isNotEmpty) 'birthdate': _birthdateCtrl.text.trim(),
      if (_newPassCtrl.text.isNotEmpty) 'new_password': _newPassCtrl.text,
    };

    try {
      final updated = await widget.controller.updateUser(widget.currentUser.id, payload);
      if (!mounted) return;
      _redirectAfterSetup(updated);
    } catch (e) {
      setState(() { _saving = false; _error = e.toString(); });
    }
  }

  void _redirectAfterSetup(UserDetailModel user) {
    switch (user.role) {
      case UserRole.principal:
      case UserRole.registrar:
      case UserRole.dean:
      case UserRole.coordinator:
        Navigator.pushReplacementNamed(context, '/users', arguments: {
          'currentUser': user,
          'controller': widget.controller,
        });
      case UserRole.teacher:
        Navigator.pushReplacementNamed(context, '/profile', arguments: {
          'currentUser': user,
          'profileUserId': user.id,
          'controller': widget.controller,
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Card(
            elevation: 4,
            margin: const EdgeInsets.all(24),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.person_outline, size: 48, color: _kAccent),
                    const SizedBox(height: 12),
                    const Text(
                      'Complete Your Profile',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Welcome, ${widget.currentUser.email}! Please fill in your information to get started.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.black54, fontSize: 13),
                    ),
                    const SizedBox(height: 28),

                    // ── Name ──────────────────────────────────────────────────
                    const _SectionLabel('Personal Information'),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(child: _Field('First Name', _firstNameCtrl, required: true)),
                      const SizedBox(width: 12),
                      Expanded(child: _Field('Middle Name', _midNameCtrl)),
                    ]),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _Field('Last Name', _lastNameCtrl, required: true)),
                      const SizedBox(width: 12),
                      SizedBox(width: 100, child: _Field('Suffix', _suffixCtrl)),
                    ]),
                    const SizedBox(height: 12),
                    _Field('Contact Number', _contactCtrl),
                    const SizedBox(height: 12),
                    DatePickerField('Birthdate', _birthdateCtrl),

                    const SizedBox(height: 24),

                    // ── Password ──────────────────────────────────────────────
                    const _SectionLabel('Set Your Password'),
                    const SizedBox(height: 10),
                    _Field('New Password', _newPassCtrl, obscure: true, required: true),
                    const SizedBox(height: 12),
                    _Field(
                      'Confirm Password',
                      _confirmCtrl,
                      obscure: true,
                      required: true,
                      validator: (v) {
                        if (v != _newPassCtrl.text) return 'Passwords do not match';
                        return null;
                      },
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: _kError, fontSize: 12)),
                    ],

                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kAccent,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Save & Continue',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.black87),
      );
}

class _Field extends StatelessWidget {
  final String label;
  final TextEditingController ctrl;
  final bool obscure;
  final bool required;
  final String? Function(String?)? validator;

  const _Field(this.label, this.ctrl, {
    this.obscure = false,
    this.required = false,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: ctrl,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.grey.shade100,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade300)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.grey.shade300)),
      ),
      validator: validator ?? (required
          ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
          : null),
    );
  }
}
