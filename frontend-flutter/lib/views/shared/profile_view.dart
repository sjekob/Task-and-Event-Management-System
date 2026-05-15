// TaskNet - User Profile View
// File: frontend-flutter/lib/views/shared/profile_view.dart
//
// Features:
//   • Displays personal info, ID numbers, address
//   • Edit button toggles inline editing of all fields
//   • Tappable avatar opens image picker to upload a new photo

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api_constants.dart';
import '../../core/responsive.dart';
import '../../controllers/user_controller.dart';
import '../../models/user_model.dart';
import '../../widgets/date_picker_field.dart';

const _kPageBg    = Color(0xFFDDE6F0);
const _kRowBorder = Color(0xFFD0DCEB);
const _kAccent    = Color(0xFF4A5568);
const _kErrorRed  = Color(0xFFE53E3E);

class ProfileView extends StatefulWidget {
  final UserDetailModel currentUser;
  final int profileUserId;
  final UserController controller;

  const ProfileView({
    super.key,
    required this.currentUser,
    required this.profileUserId,
    required this.controller,
  });

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  UserDetailModel? _profile;
  bool _loading   = true;
  bool _saving    = false;
  bool _editing   = false;
  String? _error;

  // Edit controllers
  final _firstNameCtrl      = TextEditingController();
  final _middleNameCtrl     = TextEditingController();
  final _lastNameCtrl       = TextEditingController();
  final _suffixCtrl         = TextEditingController();
  final _contactCtrl        = TextEditingController();
  final _birthdateCtrl      = TextEditingController();
  final _tinCtrl            = TextEditingController();
  final _gsisCtrl           = TextEditingController();
  final _pagibigCtrl        = TextEditingController();
  final _philhealthCtrl     = TextEditingController();
  final _appointmentCtrl    = TextEditingController();
  final _addressCtrl        = TextEditingController();

  bool get _isSelf => widget.currentUser.id == widget.profileUserId;

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    if (mounted) Navigator.pushReplacementNamed(context, '/login');
  }

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    for (final c in [
      _firstNameCtrl, _middleNameCtrl, _lastNameCtrl, _suffixCtrl,
      _contactCtrl, _birthdateCtrl, _tinCtrl, _gsisCtrl,
      _pagibigCtrl, _philhealthCtrl, _appointmentCtrl, _addressCtrl,
    ]) { c.dispose(); }
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await widget.controller.fetchUser(widget.profileUserId);
      _populateControllers(data);
      setState(() { _profile = data; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _populateControllers(UserDetailModel p) {
    _firstNameCtrl.text   = p.firstName;
    _middleNameCtrl.text  = p.middleName ?? '';
    _lastNameCtrl.text    = p.lastName;
    _suffixCtrl.text      = p.suffix ?? '';
    _contactCtrl.text     = p.contactNumber ?? '';
    _birthdateCtrl.text   = p.birthdate ?? '';
    _tinCtrl.text         = p.tinNumber ?? '';
    _gsisCtrl.text        = p.gsisNumber ?? '';
    _pagibigCtrl.text     = p.pagibigNumber ?? '';
    _philhealthCtrl.text  = p.philhealthNumber ?? '';
    _appointmentCtrl.text = p.dateOfAppointment ?? '';
    _addressCtrl.text     = p.address ?? '';
  }

  void _startEdit() => setState(() => _editing = true);

  void _cancelEdit() {
    _populateControllers(_profile!);
    setState(() => _editing = false);
  }

  Future<void> _saveEdit() async {
    setState(() => _saving = true);
    try {
      final updated = await widget.controller.updateUser(widget.profileUserId, {
        'first_name':         _firstNameCtrl.text.trim(),
        'middle_name':        _middleNameCtrl.text.trim().isEmpty ? null : _middleNameCtrl.text.trim(),
        'last_name':          _lastNameCtrl.text.trim(),
        'suffix':             _suffixCtrl.text.trim().isEmpty ? null : _suffixCtrl.text.trim(),
        'contact_number':     _contactCtrl.text.trim().isEmpty ? null : _contactCtrl.text.trim(),
        'birthdate':          _birthdateCtrl.text.trim().isEmpty ? null : _birthdateCtrl.text.trim(),
        'tin_number':         _tinCtrl.text.trim().isEmpty ? null : _tinCtrl.text.trim(),
        'gsis_number':        _gsisCtrl.text.trim().isEmpty ? null : _gsisCtrl.text.trim(),
        'pagibig_number':     _pagibigCtrl.text.trim().isEmpty ? null : _pagibigCtrl.text.trim(),
        'philhealth_number':  _philhealthCtrl.text.trim().isEmpty ? null : _philhealthCtrl.text.trim(),
        'date_of_appointment': _appointmentCtrl.text.trim().isEmpty ? null : _appointmentCtrl.text.trim(),
        'address':            _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
      });
      setState(() { _profile = updated; _editing = false; _saving = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated'), backgroundColor: _kAccent),
        );
      }
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: _kErrorRed),
        );
      }
    }
  }

  Future<void> _pickAndUploadAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;

    final bytes    = await picked.readAsBytes();
    final filename = picked.name;

    setState(() => _saving = true);
    try {
      final updated = await widget.controller.uploadAvatar(
          widget.profileUserId, bytes, filename);
      setState(() { _profile = updated; _saving = false; });
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: _kErrorRed),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kPageBg,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final p    = _profile!;
    final hPad = Responsive.value(context, mobile: 16.0, desktop: 80.0);

    return SingleChildScrollView(
      padding: EdgeInsets.symmetric(horizontal: hPad, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top bar: back + logout
          Row(
            children: [
              TextButton.icon(
                icon: const Icon(Icons.arrow_back, size: 16),
                label: const Text('Back to Dashboard'),
                onPressed: () => Navigator.pop(context),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.black87,
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(color: Colors.grey.shade300),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
              const Spacer(),
              TextButton.icon(
                icon: const Icon(Icons.logout, size: 16),
                label: const Text('Logout'),
                onPressed: _logout,
                style: TextButton.styleFrom(
                  foregroundColor: Colors.black87,
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(color: Colors.grey.shade300),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── Avatar + name card ───────────────────────────────────────────
          _Card(
            child: Row(
              children: [
                // Tappable avatar
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: Colors.grey.shade300,
                      backgroundImage: p.avatarUrl != null
                          ? NetworkImage(ApiConstants.staticUrl(p.avatarUrl!))
                          : null,
                      child: p.avatarUrl == null
                          ? const Icon(Icons.person, size: 40, color: Colors.white)
                          : null,
                    ),
                    if (_isSelf)
                      Positioned(
                        bottom: 0, right: 0,
                        child: GestureDetector(
                          onTap: _saving ? null : _pickAndUploadAvatar,
                          child: Container(
                            width: 26, height: 26,
                            decoration: BoxDecoration(
                              color: _kAccent,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                            child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 20),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.fullName,
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(p.role.displayName,
                        style: const TextStyle(color: Colors.black54, fontSize: 15)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Personal Information card ────────────────────────────────────
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('Personal Information',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const Spacer(),
                    if (_editing) ...[
                      TextButton(
                        onPressed: _saving ? null : _cancelEdit,
                        child: const Text('Cancel', style: TextStyle(color: Colors.black54)),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _saving ? null : _saveEdit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _kAccent,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        ),
                        child: _saving
                            ? const SizedBox(width: 14, height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Save'),
                      ),
                    ] else
                      OutlinedButton(
                        onPressed: _startEdit,
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        ),
                        child: const Text('Edit'),
                      ),
                  ],
                ),
                const SizedBox(height: 20),

                // Personal fields
                _ResponsiveGrid(children: [
                  _field('First Name',  _firstNameCtrl,  p.firstName),
                  _field('Middle Name', _middleNameCtrl, p.middleName ?? '—'),
                  _field('Last Name',   _lastNameCtrl,   p.lastName),
                  _field('Suffix',      _suffixCtrl,     p.suffix ?? 'none'),
                  _readOnly('Email Address',      p.email),
                  _field('Phone Number', _contactCtrl,   p.contactNumber ?? '—'),
                  _readOnly('Administrative Role', p.role.displayName),
                  _dateField('Birthdate', _birthdateCtrl, p.birthdate ?? '—'),
                ]),
                const SizedBox(height: 16),

                // ID numbers
                _ResponsiveGrid(children: [
                  _field('TIN',  _tinCtrl,           p.tinNumber ?? '—'),
                  _field('GSIS', _gsisCtrl,          p.gsisNumber ?? '—'),
                  _field('HDMF', _pagibigCtrl,       p.pagibigNumber ?? '—'),
                  _field('PHIC', _philhealthCtrl,    p.philhealthNumber ?? '—'),
                  _dateField('Date of Appointment', _appointmentCtrl, p.dateOfAppointment ?? '—'),
                ]),
                const SizedBox(height: 16),

                // Address
                _editing
                    ? _EditField(label: 'Address', ctrl: _addressCtrl, maxLines: 3)
                    : _LV('Address', p.address ?? '—'),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Department card (Dean) ───────────────────────────────────────
          if (p.role == UserRole.dean && p.department != null)
            _DeptCard(department: p.department!),

          // ── Grade level cards (Teacher / Coordinator) ────────────────────
          if ((p.role == UserRole.teacher || p.role == UserRole.coordinator) &&
              p.gradeLevels.isNotEmpty)
            Wrap(
              spacing: 12, runSpacing: 12,
              children: p.gradeLevels.map((g) => _GradeLevelCard(gradeLevel: g)).toList(),
            ),
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, String displayValue) {
    if (_editing) return _EditField(label: label, ctrl: ctrl);
    return _LV(label, displayValue);
  }

  Widget _dateField(String label, TextEditingController ctrl, String displayValue) {
    if (_editing) return DatePickerEditField(label: label, ctrl: ctrl);
    return _LV(label, displayValue);
  }

  Widget _readOnly(String label, String value) => _LV(label, value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-widgets
// ─────────────────────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kRowBorder),
      ),
      child: child,
    );
  }
}

class _LV extends StatelessWidget {
  final String label;
  final String value;
  const _LV(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.black45, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ],
    );
  }
}

class _EditField extends StatelessWidget {
  final String label;
  final TextEditingController ctrl;
  final int maxLines;
  const _EditField({required this.label, required this.ctrl, this.maxLines = 1});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.black45, fontSize: 12)),
        const SizedBox(height: 4),
        TextField(
          controller: ctrl,
          maxLines: maxLines,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            filled: true,
            fillColor: const Color(0xFFF7FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: _kAccent),
            ),
          ),
        ),
      ],
    );
  }
}

class _ResponsiveGrid extends StatelessWidget {
  final List<Widget> children;
  const _ResponsiveGrid({required this.children});

  @override
  Widget build(BuildContext context) {
    final cols  = Responsive.value(context, mobile: 2, desktop: 4);
    final width = (MediaQuery.sizeOf(context).width - 80) / cols - 24;
    return Wrap(
      spacing: 24, runSpacing: 16,
      children: children.map((c) => SizedBox(width: width.clamp(120, 280), child: c)).toList(),
    );
  }
}

class _DeptCard extends StatelessWidget {
  final DepartmentModel department;
  const _DeptCard({required this.department});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kRowBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Department Assignment',
              style: TextStyle(color: Colors.black54, fontSize: 13)),
          const SizedBox(height: 8),
          Text(department.name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          if (department.gradeRange != null)
            Text(department.gradeRange!,
                style: const TextStyle(color: Colors.black54, fontSize: 13)),
        ],
      ),
    );
  }
}

class _GradeLevelCard extends StatelessWidget {
  final GradeLevelModel gradeLevel;
  const _GradeLevelCard({required this.gradeLevel});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kRowBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Grade Handled', style: TextStyle(color: Colors.black45, fontSize: 12)),
          const SizedBox(height: 4),
          Text(gradeLevel.name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }
}
