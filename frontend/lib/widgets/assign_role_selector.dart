import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// Roles a user may assign tasks *as* (the identity the assignees receive the
/// task under), following the hierarchy enforced by the backend
/// (auth.ASSIGNABLE_TO): principal/admin → anyone; coordinator and registrar →
/// deans and teachers; dean → teachers.
List<String> assignableRoles(String assignerRole) {
  switch (assignerRole) {
    case 'admin':
    case 'principal':   return ['teacher', 'dean', 'coordinator', 'registrar'];
    case 'coordinator': return ['teacher', 'dean'];
    case 'registrar':   return ['teacher', 'dean'];
    case 'dean':        return ['teacher'];
    default:            return ['teacher'];
  }
}

String assignRoleLabel(String role) => switch (role) {
      'teacher' => 'Teacher',
      'dean' => 'Dean',
      'coordinator' => 'Coordinator',
      'registrar' => 'Registrar',
      _ => role,
    };

/// "Assign as" choice chips. Renders nothing when there is only one option.
class AssignRoleSelector extends StatelessWidget {
  final List<String> options;
  final String? value;
  final ValueChanged<String> onChanged;
  const AssignRoleSelector({super.key, required this.options, required this.value,
      required this.onChanged});

  @override
  Widget build(BuildContext context) {
    if (options.length < 2) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final r in options)
        Semantics(
          button: true,
          selected: r == value,
          label: 'Assign as ${assignRoleLabel(r)}',
          child: InkWell(
            onTap: () => onChanged(r),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: r == value ? AppTheme.darkBanner : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: r == value ? AppTheme.darkBanner : AppTheme.borderColor),
              ),
              child: Text(assignRoleLabel(r), style: GoogleFonts.plusJakartaSans(
                  fontSize: 13, fontWeight: FontWeight.w600,
                  color: r == value ? Colors.white : AppTheme.textMuted)),
            ),
          ),
        ),
    ]);
  }
}
