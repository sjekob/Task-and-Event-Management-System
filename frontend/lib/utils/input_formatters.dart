import 'package:flutter/services.dart';

/// Title-cases input as the user types: the first letter of each word is
/// uppercased and the rest lowercased (e.g. "mARK fuentes" → "Mark Fuentes").
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

  /// Uppercases the first letter of each whitespace- or hyphen-separated word
  /// and lowercases the remaining letters.
  static String titleCase(String input) {
    final buffer = StringBuffer();
    var startOfWord = true;
    for (final ch in input.split('')) {
      if (ch == ' ' || ch == '\t' || ch == '-' || ch == '\n') {
        startOfWord = true;
        buffer.write(ch);
      } else {
        buffer.write(startOfWord ? ch.toUpperCase() : ch.toLowerCase());
        startOfWord = false;
      }
    }
    return buffer.toString();
  }
}
