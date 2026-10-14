import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { api, formatDateTime, parseTimestamp, qk, type AttendanceScanResult } from '@tasknet/shared';
import { ActivityEvaluation } from '@/components/ActivityEvaluation';
import { Button, Card, Loading, Screen, T } from '@/components/ui';
import { colors } from '@/theme';

type Parsed =
  | { kind: 'attendance'; eventId: number; index: number; action: 'time_in' | 'time_out'; code: string }
  | { kind: 'evaluation'; url: string };

/** Reads the URLs printed on TaskNet QR codes (attendance time in/out, or the public evaluation form). */
function parseQr(data: string): Parsed | null {
  let url: URL;
  try { url = new URL(data.trim()); } catch { return null; }
  // Older Flutter-era codes used hash routes: /#/attendance/…
  const path = url.hash.startsWith('#/') ? url.hash.slice(1).split('?')[0] : url.pathname;
  const params = url.hash.includes('?') ? new URLSearchParams(url.hash.split('?')[1]) : url.searchParams;
  const att = /^\/attendance\/(\d+)\/(\d+)\/scan\/?$/.exec(path);
  if (att) {
    const action = params.get('action');
    const code = params.get('code');
    if ((action === 'time_in' || action === 'time_out') && code) {
      return { kind: 'attendance', eventId: Number(att[1]), index: Number(att[2]), action, code };
    }
  }
  if (/^\/eval\/\d+\/?$/.test(path)) return { kind: 'evaluation', url: data.trim() };
  return null;
}

/** Best effort: the server uses it to confirm presence, but a scan still counts without it. */
async function currentPosition() {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return pos.coords;
  } catch {
    return null;
  }
}

type State =
  | { step: 'scanning' }
  | { step: 'working' }
  | { step: 'result'; result: AttendanceScanResult; eventId: number; index: number }
  | { step: 'evaluate'; eventId: number; index: number }
  | { step: 'message'; ok: boolean; title: string; text: string };

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ step: 'scanning' });
  const handled = useRef(false);
  const qc = useQueryClient();

  const reset = () => { handled.current = false; setState({ step: 'scanning' }); };

  const onScan = async ({ data }: BarcodeScanningResult) => {
    // The camera reports the same code many times a second; act on the first.
    if (handled.current) return;
    handled.current = true;
    const qr = parseQr(data);
    if (!qr) {
      setState({ step: 'message', ok: false, title: 'Not a TaskNet code', text: 'This QR code is not a TaskNet attendance or evaluation code.' });
      return;
    }
    if (qr.kind === 'evaluation') {
      await WebBrowser.openBrowserAsync(qr.url);
      reset();
      return;
    }
    setState({ step: 'working' });
    try {
      const pos = await currentPosition();
      const result = await api.events.scanAttendance(qr.eventId, {
        activity_index: qr.index, action: qr.action, code: qr.code,
        latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null,
      });
      void qc.invalidateQueries({ queryKey: qk.attendance(qr.eventId, qr.index) });
      setState({ step: 'result', result, eventId: qr.eventId, index: qr.index });
    } catch (e) {
      setState({ step: 'message', ok: false, title: 'Scan not recorded', text: e instanceof Error ? e.message : 'Could not record your attendance.' });
    }
  };

  if (state.step === 'evaluate') {
    return (
      <Screen>
        <ActivityEvaluation eventId={state.eventId} index={state.index} onDone={(text) => {
          void qc.invalidateQueries({ queryKey: qk.allTasks });
          setState({ step: 'message', ok: true, title: 'Evaluation submitted', text });
        }} />
      </Screen>
    );
  }
  if (state.step === 'result' || state.step === 'message') {
    const ok = state.step === 'result' ? state.result.success : state.ok;
    const title = state.step === 'result' ? (state.result.action === 'time_in' ? 'Timed in' : 'Timed out') : state.title;
    const text = state.step === 'result' ? state.result.message : state.text;
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
          <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={64} color={ok ? colors.green : colors.red} />
          <T v="h2">{title}</T>
          <T v="muted" style={{ textAlign: 'center' }}>{text}</T>
          {state.step === 'result' && <T v="small">{formatDateTime(parseTimestamp(state.result.timestamp))}</T>}
        </Card>
        <View style={{ gap: 8, marginTop: 14 }}>
          {state.step === 'result' && state.result.redirect_to_evaluation && (
            <Button title="Evaluate this activity" icon="star-outline"
              onPress={() => setState({ step: 'evaluate', eventId: state.eventId, index: state.index })} />
          )}
          <Button title="Scan another code" kind="outline" icon="qr-code-outline" onPress={reset} />
        </View>
      </Screen>
    );
  }

  if (!permission) return <Loading />;
  if (!permission.granted) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <Ionicons name="camera-outline" size={48} color={colors.muted} />
          <T v="h3">Camera access needed</T>
          <T v="muted" style={{ textAlign: 'center' }}>TaskNet uses the camera to scan event attendance QR codes.</T>
          <Button title={permission.canAskAgain ? 'Allow camera' : 'Open settings to allow camera'}
            onPress={() => void (permission.canAskAgain ? requestPermission() : Linking.openSettings())} />
        </Card>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={state.step === 'scanning' ? (r) => void onScan(r) : undefined} />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.frame} />
        <T style={{ color: '#fff', marginTop: 20, fontWeight: '600', textAlign: 'center' }}>
          {state.step === 'working' ? 'Recording your attendance…' : 'Point the camera at the Time In or Time Out QR code'}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  frame: { width: 250, height: 250, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
});
