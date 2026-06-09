// Reusable date field used across all forms.
// Typing auto-formats to yyyy-MM-dd. Calendar icon opens the date picker.
// Value stored in the controller as 'yyyy-MM-dd'.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

final _fmt = DateFormat('yyyy-MM-dd');

// Auto-inserts hyphens: 19991207 → 1999-12-07
class _DateFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll('-', '');
    if (digits.length > 8) return oldValue;

    final buf = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i == 4 || i == 6) buf.write('-');
      buf.write(digits[i]);
    }

    final str = buf.toString();
    return TextEditingValue(
      text: str,
      selection: TextSelection.collapsed(offset: str.length),
    );
  }
}

Future<void> _openPicker(
    BuildContext context, TextEditingController ctrl) async {
  DateTime initial;
  try {
    initial =
        ctrl.text.length == 10 ? _fmt.parse(ctrl.text) : DateTime.now();
  } catch (_) {
    initial = DateTime.now();
  }

  final picked = await showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: DateTime(1900),
    lastDate: DateTime(2100),
  );
  if (picked != null) ctrl.text = _fmt.format(picked);
}

// ── For use inside forms (_FormRow in user_manager_view) ─────────────────────
class DatePickerField extends StatelessWidget {
  final String label;
  final TextEditingController ctrl;
  final bool required;

  const DatePickerField(this.label, this.ctrl,
      {this.required = false, super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(color: Colors.black54, fontSize: 11)),
        const SizedBox(height: 4),
        TextFormField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          inputFormatters: [_DateFormatter()],
          validator: required
              ? (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null
              : null,
          decoration: InputDecoration(
            hintText: 'yyyy-MM-dd',
            suffixIcon: IconButton(
              icon: Icon(Icons.calendar_today_outlined,
                  size: 16, color: Colors.grey.shade500),
              onPressed: () => _openPicker(context, ctrl),
              splashRadius: 16,
            ),
            filled: true,
            fillColor: Colors.white,
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
              borderSide: const BorderSide(color: Color(0xFF4A5568)),
            ),
          ),
        ),
      ],
    );
  }
}

// ── For inline editing inside ProfileView ────────────────────────────────────
class DatePickerEditField extends StatelessWidget {
  final String label;
  final TextEditingController ctrl;

  const DatePickerEditField(
      {required this.label, required this.ctrl, super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(color: Colors.black45, fontSize: 12)),
        const SizedBox(height: 4),
        TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          inputFormatters: [_DateFormatter()],
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: 'yyyy-MM-dd',
            suffixIcon: IconButton(
              icon: Icon(Icons.calendar_today_outlined,
                  size: 16, color: Colors.grey.shade500),
              onPressed: () => _openPicker(context, ctrl),
              splashRadius: 16,
            ),
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
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
              borderSide: const BorderSide(color: Color(0xFF4A5568)),
            ),
          ),
        ),
      ],
    );
  }
}
