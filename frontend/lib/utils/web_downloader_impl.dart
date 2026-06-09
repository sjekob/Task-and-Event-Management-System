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
