import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../models/models.dart';
import '../widgets/skeleton_widgets.dart';
import '../utils/input_formatters.dart';
import '../features/personnel/services/personnel_service.dart';
import '../widgets/catalog_multi_select.dart';
import '../widgets/certificates_panel.dart';

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
          ? const ProfileSkeleton()
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
                const SizedBox(height: 8),

                const _SectionHeader(icon: Icons.badge_outlined, title: 'Basic Information'),
                _infoGrid(isMobile, [
                  _InfoField(label: 'First Name',   value: p.firstName),
                  _InfoField(label: 'Middle Name',  value: p.middleName),
                  _InfoField(label: 'Last Name',    value: p.lastName),
                  _InfoField(label: 'Suffix',       value: p.suffix),
                ]),

                const _SectionHeader(icon: Icons.contact_mail_outlined, title: 'Contact Information'),
                _infoGrid(isMobile, [
                  _InfoField(label: 'Email Address', value: p.email),
                  _InfoField(label: 'Phone Number',  value: p.phoneNumber),
                  _InfoField(label: 'Address',       value: p.address, span: 2),
                ]),

                const _SectionHeader(icon: Icons.family_restroom_outlined, title: 'Personal Details'),
                _infoGrid(isMobile, [
                  _InfoField(label: 'Birthdate',          value: p.birthdate),
                  _InfoField(label: 'Number of Children', value: p.numberOfChildren.toString()),
                ]),

                const _SectionHeader(icon: Icons.work_outline, title: 'Employment'),
                _infoGrid(isMobile, [
                  _InfoField(label: 'Administrative Role', value: _roleLabel(p.role)),
                  _InfoField(label: 'Date of Appointment', value: p.dateOfAppointment),
                ]),

                const _SectionHeader(icon: Icons.school_outlined, title: 'Educational Background'),
                _infoGrid(isMobile, [
                  _InfoField(label: 'Highest Educational Attainment',
                      value: p.education.highestAttainment, span: 2),
                  _InfoField(label: 'Undergraduate Degree',
                      value: p.education.undergraduateDegree, span: 2),
                  _InfoField(label: 'Area of Specialization',
                      value: p.education.specialization, span: 2),
                  _InfoField(label: 'Postgraduate Program Focus',
                      value: p.education.postgraduateFocus, span: 2),
                ]),

                const _SectionHeader(icon: Icons.workspace_premium_outlined, title: 'Certifications & Eligibility'),
                const CertificatesPanel(canUpload: true),

                const _SectionHeader(icon: Icons.psychology_outlined, title: 'Skills'),
                _chipGroup('Skills', p.skills),
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
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(14),
          boxShadow: AppTheme.cardShadow,
        ),
        child: child,
      );

  /// Fields laid out on a grid that uses the card's full width: 4 columns on
  /// wide screens, 2 on medium, 1 on phones. A field's `span` widens it.
  Widget _infoGrid(bool isMobile, List<_InfoField> fields) {
    return LayoutBuilder(builder: (context, c) {
      const gap = 32.0;
      final cols = isMobile ? 1 : c.maxWidth >= 900 ? 4 : 2;
      final colW = (c.maxWidth - gap * (cols - 1)) / cols;
      return Wrap(
        spacing: gap,
        runSpacing: 24,
        children: [
          for (final f in fields)
            SizedBox(
              width: colW * f.span.clamp(1, cols) + gap * (f.span.clamp(1, cols) - 1),
              child: f,
            ),
        ],
      );
    });
  }

  Widget _chipGroup(String label, List<String> items) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTheme.caption),
          const SizedBox(height: 6),
          if (items.isEmpty)
            Text('None added yet', style: AppTheme.bodyMd)
          else
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final t in items)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF4FA),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFD0DCEB)),
                  ),
                  child: Text(t, style: GoogleFonts.plusJakartaSans(
                      fontSize: 12.5, fontWeight: FontWeight.w500, color: AppTheme.textPrimary)),
                ),
            ]),
        ],
      );

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

/// Titled divider between groups of fields (profile view and edit dialog).
class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  /// Tighter spacing, used inside the Edit Profile dialog.
  final bool dense;
  const _SectionHeader({required this.icon, required this.title, this.dense = false});

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(top: dense ? 22 : 36, bottom: dense ? 14 : 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FA), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, size: 16, color: AppTheme.darkBanner),
            ),
            const SizedBox(width: 10),
            Text(title, style: GoogleFonts.plusJakartaSans(
                fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
          ]),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppTheme.borderColor),
        ]),
      );
}

class _InfoField extends StatelessWidget {
  final String label;
  final String? value;
  final int span;

  const _InfoField({required this.label, this.value, this.span = 1});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, fontWeight: FontWeight.w500,
                color: AppTheme.textLight)),
        const SizedBox(height: 6),
        Text(
          value?.isNotEmpty == true ? value! : '—',
          style: GoogleFonts.plusJakartaSans(
              fontSize: 14, fontWeight: FontWeight.w600,
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
  // DepEd education dropdowns; options come from the server.
  Map<String, List<String>> _eduOptions = {};
  late final Map<String, String?> _edu;
  late List<String> _skills;
  List<CatalogOption> _skillOptions = [];

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
      'birthdate':           TextEditingController(text: p.birthdate ?? ''),
      'number_of_children':  TextEditingController(text: p.numberOfChildren.toString()),
      'date_of_appointment': TextEditingController(text: p.dateOfAppointment ?? ''),
      'address':             TextEditingController(text: p.address ?? ''),
      'postgraduate_focus':  TextEditingController(text: p.education.postgraduateFocus ?? ''),
    };
    _edu = {
      'highest_attainment':   p.education.highestAttainment,
      'undergraduate_degree': p.education.undergraduateDegree,
      'specialization':       p.education.specialization,
    };
    _skills = List.of(p.skills);
    PersonnelService.educationOptions().then((o) {
      if (mounted) setState(() => _eduOptions = o);
    });
    PersonnelService.skillsMeta().then((r) {
      if (!mounted) return;
      setState(() {
        _skillOptions = r
            .map((m) => CatalogOption(m['skill_name'] as String,
                group: m['category_name'] as String?))
            .toList();
      });
    });
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) c.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final appState = context.read<AppState>();
    try {
      final body = <String, dynamic>{
        for (final e in _ctrl.entries)
          if (e.key != 'number_of_children' &&
              e.key != 'postgraduate_focus' && e.value.text.trim().isNotEmpty)
            e.key: e.value.text.trim(),
        'number_of_children':
            int.tryParse(_ctrl['number_of_children']!.text.trim()) ?? 0,
        // Always sent so entries can be cleared.
        'skills': _skills,
        'education': Education(
          highestAttainment: _edu['highest_attainment'],
          undergraduateDegree: _edu['undergraduate_degree'],
          specialization: _edu['specialization'],
          postgraduateFocus: _ctrl['postgraduate_focus']!.text.trim().isEmpty
              ? null
              : _ctrl['postgraduate_focus']!.text.trim(),
        ).toJson(),
      };
      await ApiService.updateMyProfile(body);
      // Re-fetch the current user so the header/sidebar/avatar reflect the new
      // name immediately (they read full_name from AppState.currentUser).
      await appState.tryAutoLogin();
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
        constraints: BoxConstraints(
            maxWidth: 820,
            maxHeight: MediaQuery.of(context).size.height * 0.88),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 24, 28, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Edit Profile',
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 20, fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary)),
              const SizedBox(height: 4),
              Text('Your education and skills are used to suggest you for matching tasks. '
                  'Certifications are added by uploading the certificate on your profile.',
                  style: AppTheme.bodySm),
              const SizedBox(height: 4),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(right: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _SectionHeader(dense: true, icon: Icons.badge_outlined, title: 'Basic Information'),
                      _row([_field('first_name', 'First Name'), _field('middle_name', 'Middle Name')]),
                      _row([_field('last_name', 'Last Name'), _field('suffix', 'Suffix')]),
                      const _SectionHeader(dense: true, icon: Icons.contact_mail_outlined, title: 'Contact Information'),
                      _row([_field('email', 'Email'), _field('phone_number', 'Phone Number')]),
                      _row([_field('address', 'Address')]),
                      const _SectionHeader(dense: true, icon: Icons.family_restroom_outlined, title: 'Personal Details'),
                      _row([_field('birthdate', 'Birthdate (YYYY-MM-DD)'),
                            _field('number_of_children', 'Number of Children')]),
                      const _SectionHeader(dense: true, icon: Icons.work_outline, title: 'Employment'),
                      _row([_field('date_of_appointment', 'Date of Appointment')]),
                      const _SectionHeader(dense: true, icon: Icons.school_outlined, title: 'Educational Background'),
                      _row([_eduDropdown('highest_attainment', 'Highest Educational Attainment'),
                            _eduDropdown('undergraduate_degree', 'Undergraduate Degree')]),
                      _row([_eduDropdown('specialization', 'Area of Specialization'),
                            _field('postgraduate_focus', 'Postgraduate Program Focus')]),
                      const _SectionHeader(dense: true, icon: Icons.psychology_outlined, title: 'Skills'),
                      _row([_catalogSelect('Skills', _skills, _skillOptions,
                          (v) => setState(() => _skills = v))]),
                    ],
                  ),
                ),
              ),
              const Divider(height: 24, color: AppTheme.borderColor),
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

  static const _nameKeys = {'first_name', 'middle_name', 'last_name', 'suffix'};

  Widget _catalogSelect(String label, List<String> selected,
          List<CatalogOption> options, ValueChanged<List<String>> onChanged) =>
      CatalogMultiSelect(
        label: label,
        selected: selected,
        options: options,
        onChanged: onChanged,
        decoration: InputDecoration(
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
        ),
      );

  Widget _eduDropdown(String key, String label) {
    final options = _eduOptions[key] ?? const <String>[];
    final value = _edu[key];
    return DropdownButtonFormField<String>(
      key: ValueKey('$key-${options.length}'),
      isExpanded: true,
      initialValue: options.contains(value) ? value : null,
      style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppTheme.textPrimary),
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
      ),
      items: [
        const DropdownMenuItem<String>(value: null, child: Text('— None —')),
        ...options.map((o) => DropdownMenuItem(
            value: o, child: Text(o, overflow: TextOverflow.ellipsis))),
      ],
      onChanged: (v) => setState(() => _edu[key] = v),
    );
  }

  Widget _field(String key, String label) => TextFormField(
        controller: _ctrl[key],
        keyboardType: key == 'number_of_children' ? TextInputType.number : null,
        inputFormatters: _nameKeys.contains(key)
            ? const [TitleCaseTextInputFormatter()]
            : key == 'number_of_children'
                ? [FilteringTextInputFormatter.digitsOnly,
                   LengthLimitingTextInputFormatter(2)]
                : null,
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
