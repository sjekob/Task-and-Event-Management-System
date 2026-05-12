import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  User? _profile;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final profile = await ApiService.getMyProfile();
      if (mounted) setState(() { _profile = profile; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = context.read<AppState>().userRole;
    final isMobile = MediaQuery.of(context).size.width < 768;

    return Scaffold(
      backgroundColor: AppTheme.bgColor,
      appBar: AppBar(
        backgroundColor: AppTheme.bgColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppTheme.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _roleLabel(role),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppTheme.textPrimary,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.help_outline, size: 16, color: AppTheme.textMuted),
              label: Text('FAQ', style: AppTheme.labelMd.copyWith(color: AppTheme.textMuted)),
              style: TextButton.styleFrom(
                backgroundColor: AppTheme.cardColor,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.accentBlue))
          : _error != null
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline, color: AppTheme.redColor, size: 40),
                    const SizedBox(height: 12),
                    Text(_error!, style: AppTheme.bodyMd),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ))
              : _buildContent(isMobile),
    );
  }

  Widget _buildContent(bool isMobile) {
    final p = _profile!;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(isMobile ? 14 : 24, 8, isMobile ? 14 : 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Avatar card ──
          _card(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppTheme.sidebarActive,
                  backgroundImage: p.avatarUrl != null
                      ? NetworkImage(p.avatarUrl!)
                      : null,
                  child: p.avatarUrl == null
                      ? Text(
                          p.initials,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 24),
                        )
                      : null,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.fullName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 18, fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(_roleLabel(p.role), style: AppTheme.bodyMd),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ── Personal Information card ──
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('Personal Information',
                          style: GoogleFonts.plusJakartaSans(
                              fontSize: 15, fontWeight: FontWeight.w700,
                              color: AppTheme.textPrimary)),
                    ),
                    _EditButton(profile: p, onSaved: _load),
                  ],
                ),
                const SizedBox(height: 16),

                // Name row
                _infoGrid(isMobile, [
                  _InfoField(label: 'First Name',   value: p.firstName),
                  _InfoField(label: 'Middle Name',  value: p.middleName),
                  _InfoField(label: 'Last Name',    value: p.lastName),
                  _InfoField(label: 'Suffix',       value: p.suffix ?? 'none'),
                ]),
                const SizedBox(height: 14),

                // Contact
                _infoGrid(isMobile, [
                  _InfoField(label: 'Email Address',  value: p.email),
                  _InfoField(label: 'Phone Number',   value: p.phoneNumber),
                ]),
                const SizedBox(height: 14),

                _InfoField(label: 'Administrative Role', value: _roleLabel(p.role)),
                const SizedBox(height: 14),

                // Gov IDs row
                _infoGrid(isMobile, [
                  _InfoField(label: 'TIN',                 value: p.tin),
                  _InfoField(label: 'QSIS',                value: p.qsis),
                  _InfoField(label: 'HDMF',                value: p.hdmf),
                  _InfoField(label: 'PHIC',                value: p.phic),
                  _InfoField(label: 'Date of Appointment', value: p.dateOfAppointment),
                ]),
                const SizedBox(height: 14),

                _InfoField(label: 'Address', value: p.address),
              ],
            ),
          ),

          // ── Subject-grade assignment cards ──
          if (p.subjects.isNotEmpty) ...[
            const SizedBox(height: 14),
            _subjectGrid(p.subjects, isMobile),
          ],
        ],
      ),
    );
  }

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(14),
          boxShadow: AppTheme.cardShadow,
        ),
        child: child,
      );

  Widget _infoGrid(bool isMobile, List<_InfoField> fields) {
    if (isMobile) {
      return Column(
        children: fields
            .map((f) => Padding(padding: const EdgeInsets.only(bottom: 10), child: f))
            .toList(),
      );
    }
    return Wrap(
      spacing: 24,
      runSpacing: 12,
      children: fields
          .map((f) => SizedBox(width: 160, child: f))
          .toList(),
    );
  }

  Widget _subjectGrid(List<UserSubject> subjects, bool isMobile) {
    final cols = isMobile ? 1 : 2;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: cols,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 3.2,
      ),
      itemCount: subjects.length,
      itemBuilder: (_, i) {
        final s = subjects[i];
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.cardColor,
            borderRadius: BorderRadius.circular(14),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Subject-grade Assignment',
                  style: AppTheme.bodySm.copyWith(color: AppTheme.textMuted)),
              const SizedBox(height: 4),
              Text(s.subject,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 16, fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary)),
              if (s.gradeLevel != null)
                Text(s.gradeLevel!, style: AppTheme.bodyMd),
            ],
          ),
        );
      },
    );
  }

  String _roleLabel(String role) {
    switch (role) {
      case 'admin':       return 'Admin';
      case 'principal':   return 'Principal';
      case 'coordinator': return 'Coordinator';
      case 'dean':        return 'Dean';
      case 'registrar':   return 'Registrar';
      default:            return 'Teacher';
    }
  }
}

// ── Info field widget ──────────────────────────────────────────────────────────

class _InfoField extends StatelessWidget {
  final String label;
  final String? value;

  const _InfoField({required this.label, this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 11, fontWeight: FontWeight.w500,
                color: AppTheme.textLight)),
        const SizedBox(height: 2),
        Text(
          value?.isNotEmpty == true ? value! : '—',
          style: GoogleFonts.plusJakartaSans(
              fontSize: 13, fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary),
        ),
      ],
    );
  }
}

// ── Edit button + dialog ───────────────────────────────────────────────────────

class _EditButton extends StatelessWidget {
  final User profile;
  final VoidCallback onSaved;

  const _EditButton({required this.profile, required this.onSaved});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: () => _showEditDialog(context),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppTheme.textMuted,
        side: const BorderSide(color: AppTheme.borderColor),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Text('Edit', style: AppTheme.labelMd),
    );
  }

  void _showEditDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => _EditProfileDialog(profile: profile, onSaved: onSaved),
    );
  }
}

class _EditProfileDialog extends StatefulWidget {
  final User profile;
  final VoidCallback onSaved;

  const _EditProfileDialog({required this.profile, required this.onSaved});

  @override
  State<_EditProfileDialog> createState() => _EditProfileDialogState();
}

class _EditProfileDialogState extends State<_EditProfileDialog> {
  late final Map<String, TextEditingController> _ctrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.profile;
    _ctrl = {
      'first_name':          TextEditingController(text: p.firstName ?? ''),
      'middle_name':         TextEditingController(text: p.middleName ?? ''),
      'last_name':           TextEditingController(text: p.lastName ?? ''),
      'suffix':              TextEditingController(text: p.suffix ?? ''),
      'email':               TextEditingController(text: p.email ?? ''),
      'phone_number':        TextEditingController(text: p.phoneNumber ?? ''),
      'tin':                 TextEditingController(text: p.tin ?? ''),
      'qsis':                TextEditingController(text: p.qsis ?? ''),
      'hdmf':                TextEditingController(text: p.hdmf ?? ''),
      'phic':                TextEditingController(text: p.phic ?? ''),
      'date_of_appointment': TextEditingController(text: p.dateOfAppointment ?? ''),
      'address':             TextEditingController(text: p.address ?? ''),
    };
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) c.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final body = {
        for (final e in _ctrl.entries)
          if (e.value.text.trim().isNotEmpty) e.key: e.value.text.trim()
      };
      await ApiService.updateMyProfile(body);
      if (mounted) {
        Navigator.pop(context);
        widget.onSaved();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: AppTheme.redColor,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, maxHeight: 600),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Edit Profile',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 16, fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary)),
              const SizedBox(height: 16),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      _row([_field('first_name', 'First Name'), _field('middle_name', 'Middle Name')]),
                      _row([_field('last_name', 'Last Name'), _field('suffix', 'Suffix')]),
                      _row([_field('email', 'Email'), _field('phone_number', 'Phone Number')]),
                      _row([_field('tin', 'TIN'), _field('qsis', 'QSIS')]),
                      _row([_field('hdmf', 'HDMF'), _field('phic', 'PHIC')]),
                      _row([_field('date_of_appointment', 'Date of Appointment')]),
                      _row([_field('address', 'Address')]),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text('Cancel', style: AppTheme.labelMd),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(width: 16, height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(List<Widget> children) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: children
              .map((c) => Expanded(child: Padding(padding: const EdgeInsets.only(right: 8), child: c)))
              .toList(),
        ),
      );

  Widget _field(String key, String label) => TextFormField(
        controller: _ctrl[key],
        style: GoogleFonts.plusJakartaSans(fontSize: 13),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: AppTheme.bodySm,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppTheme.borderColor),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppTheme.borderColor),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppTheme.accentBlue, width: 1.5),
          ),
        ),
      );
}
