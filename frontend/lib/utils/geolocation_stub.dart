/// A device location fix.
class GeoFix {
  final double latitude;
  final double longitude;
  final double? accuracy; // metres
  const GeoFix(this.latitude, this.longitude, this.accuracy);
}

/// Location is only wired up for the web build (browser geolocation).
Future<GeoFix> getCurrentPosition() async =>
    throw Exception('Location is only available in the web app.');
