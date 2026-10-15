import 'package:flutter/services.dart';

/// Capitalizes names as the user types: the first letter of each word is
/// uppercased (e.g. "mark p. fuentes" → "Mark P. Fuentes"). The other letters
/// are left as typed so names like "McArthur", "John Paul II" or "dela Cruz"
/// (once corrected by the user) are not mangled.
///
/// Case-only transformation preserves length, so the caret position from
/// [newValue] stays valid.
class TitleCaseTextInputFormatter extends TextInputFormatter {
  const TitleCaseTextInputFormatter();

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    return TextEditingValue(
      text: titleCase(newValue.text),
      selection: newValue.selection,
      composing: TextRange.empty,
    );
  }

  /// Uppercases the first letter of each whitespace- or hyphen-separated word,
  /// leaving the remaining letters unchanged.
  static String titleCase(String input) {
    final buffer = StringBuffer();
    var startOfWord = true;
    for (final ch in input.split('')) {
      if (ch == ' ' || ch == '\t' || ch == '-' || ch == '\n') {
        startOfWord = true;
        buffer.write(ch);
      } else {
        buffer.write(startOfWord ? ch.toUpperCase() : ch);
        startOfWord = false;
      }
    }
    return buffer.toString();
  }
}
