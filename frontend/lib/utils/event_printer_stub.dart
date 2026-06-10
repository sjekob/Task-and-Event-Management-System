/// Non-web stub — always returns false so the caller falls back to the
/// `printing` package's native PDF dialog.
Future<bool> triggerPrint(String htmlContent) async => false;
