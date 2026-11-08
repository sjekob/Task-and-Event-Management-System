import { useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack } from 'expo-router';
import { Button, C, Empty, Screen, T } from '../../ui/kit';

/**
 * In-app QR scanner for attendance codes. A code holds the web scan link
 * (…/attendance/<event>/<index>/scan?action=…&code=…); it opens the same
 * screen inside the app.
 */
export default function QrScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  const onCode = (data: string) => {
    if (handled) return;
    const m = /\/attendance\/(\d+)\/(\d+)\/scan\?(.*)$/.exec(data);
    if (!m) { setError('That QR code is not a TaskNet attendance code.'); return; }
    setHandled(true);
    const q = new URLSearchParams(m[3]);
    router.replace({ pathname: '/attendance/[eventId]/[index]/scan', params: { eventId: m[1], index: m[2], action: q.get('action') ?? '', code: q.get('code') ?? '' } });
  };

  const header = <Stack.Screen options={{ title: 'Scan Attendance QR' }} />;
  if (!permission) return <Screen>{header}</Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        {header}
        <Empty icon="camera" title="Camera access is needed to scan attendance codes.">
          <Button onPress={() => void requestPermission()}>Allow camera</Button>
        </Empty>
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {header}
      <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handled ? undefined : ({ data }) => onCode(data)} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
        <View style={{ width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)' }} />
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 32, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 14 }}>
        <T color="#fff" center>{error ?? 'Point the camera at the attendance QR code of the activity.'}</T>
        {error && <Button variant="ghost" onPress={() => { setError(null); setHandled(false); }} style={{ alignSelf: 'center' }}><T color={C.blueBg} weight={600}>Try again</T></Button>}
      </View>
    </View>
  );
}
