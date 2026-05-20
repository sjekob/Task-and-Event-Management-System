// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

/// Web specific implementation using dart:html to change window.location.
void redirectToAdmin() {
  final origin = html.window.location.origin;
  html.window.location.href = 'http://127.0.0.1:8001/?auth=success&return_to=${Uri.encodeComponent(origin)}';
}
