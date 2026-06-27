import 'dart:html' as html;

void copyToClipboard(String text) {
  // Use the synchronous textarea method as it guarantees execution inside the user gesture callback
  final textArea = html.TextAreaElement()
    ..value = text
    ..style.position = 'fixed'
    ..style.left = '0'
    ..style.top = '0'
    ..style.opacity = '0';
  
  html.document.body?.append(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    html.document.execCommand('copy');
  } catch (e) {
    // Fallback attempt with modern API if possible, though execCommand is highly compatible
    if (html.window.navigator.clipboard != null) {
      html.window.navigator.clipboard!.writeText(text);
    }
  }
  
  textArea.remove();
}
