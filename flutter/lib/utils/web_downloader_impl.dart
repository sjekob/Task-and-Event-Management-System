import 'dart:html' as html;

void webDownload(String url, String filename) {
  final anchor = html.AnchorElement()
    ..href = url
    ..setAttribute('download', filename)
    ..click();
}

void webOpenUrl(String url) {
  html.window.open(url, '_blank');
}

/// Open in-memory file bytes (e.g. a PDF fetched with auth headers) in a new tab.
void webOpenBytes(List<int> bytes, String mime) {
  final url = html.Url.createObjectUrlFromBlob(html.Blob([bytes], mime));
  html.window.open(url, '_blank');
  Future.delayed(const Duration(minutes: 1), () => html.Url.revokeObjectUrl(url));
}
