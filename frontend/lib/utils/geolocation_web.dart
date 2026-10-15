import 'dart:html' as html;

import 'geolocation_stub.dart' show GeoFix;
export 'geolocation_stub.dart' show GeoFix;

/// One high-accuracy fix from `navigator.geolocation.getCurrentPosition`.
/// Throws an Exception with a user-facing reason (denied, unavailable, timeout).
Future<GeoFix> getCurrentPosition() async {
  final geo = html.window.navigator.geolocation;
  try {
    final pos = await geo.getCurrentPosition(
      enableHighAccuracy: true,
      timeout: const Duration(seconds: 20),
      maximumAge: Duration.zero,
    );
    final c = pos.coords!;
    return GeoFix(c.latitude!.toDouble(), c.longitude!.toDouble(), c.accuracy?.toDouble());
  } on html.PositionError catch (e) {
    switch (e.code) {
      case 1:
        throw Exception('Location permission was denied. Allow location access for this '
            'site in your browser settings, then try again.');
      case 3:
        throw Exception('Getting your location took too long. Move to an open area and try again.');
      default:
        throw Exception('Your location is unavailable right now. Turn on location services and try again.');
    }
  } catch (e) {
    if (e is Exception) rethrow;
    throw Exception('Could not get your location. Make sure the site is opened over HTTPS.');
  }
}
