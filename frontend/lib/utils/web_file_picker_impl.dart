import 'dart:async';
import 'dart:html' as html;
import 'dart:typed_data';

Future<Map<String, dynamic>?> pickWebFile() async {
  final completer = Completer<Map<String, dynamic>?>();
  final input = html.FileUploadInputElement()..accept = '*/*';
  input.click();
  input.onChange.listen((_) async {
    final files = input.files;
    if (files != null && files.isNotEmpty) {
      final file = files[0];
      final reader = html.FileReader();
      reader.readAsArrayBuffer(file);
      await reader.onLoad.first;
      completer.complete({
        'name': file.name,
        'bytes': (reader.result as Uint8List).toList(),
      });
    } else {
      completer.complete(null);
    }
  });
  return completer.future;
}
