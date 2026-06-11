// ignore_for_file: deprecated_member_use, avoid_web_libraries_in_flutter
import 'dart:html' as html;

/// Encodes [htmlContent] as a Blob URL and opens it in a new browser tab.
/// The HTML itself triggers `window.print()` on load via an inline script.
///
/// Returns `true` on success, `false` if the popup was blocked.
Future<bool> triggerPrint(String htmlContent) async {
  try {
    final blob = html.Blob([htmlContent], 'text/html');
    final url  = html.Url.createObjectUrlFromBlob(blob);

    // window.open() returns WindowBase — do NOT cast it.
    // The HTML's own <script> calls window.print() after the page loads.
    html.window.open(url, '_blank');

    // Revoke blob URL after 5 minutes (enough time for print + save).
    Future<void>.delayed(const Duration(minutes: 5), () {
      html.Url.revokeObjectUrl(url);
    });

    return true;
  } catch (_) {
    return false;
  }
}
