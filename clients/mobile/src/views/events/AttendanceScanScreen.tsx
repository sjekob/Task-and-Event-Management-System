import { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AttendanceScanController, LOCATION_HELP, Locate } from '@shared/controllers/AttendanceScanController';
import { formatDistance } from '@shared/utils/geo';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Card, Icon, Screen, Spinner, T } from '../../ui/kit';

/** The phone's position, or why it couldn't be had. A pinned venue needs a fresh, precise fix. */
const locate: Locate = async (precise) => {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { problem: 'denied' };
    if (!(await Location.hasServicesEnabledAsync())) return { problem: 'unavailable' };
    const p = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: precise ? Location.Accuracy.Highest : Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), precise ? 15000 : 8000)),
    ]);
    if (!p) return { problem: 'timeout' };
    return { fix: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy ?? null } };
  } catch {
    return { problem: 'unavailable' };
  }
};

/**
 * /attendance/[eventId]/[index]/scan?action=…&code=… — records Time In / Time
 * Out for one activity. When the venue is pinned, only from inside its perimeter.
 */
export default function AttendanceScanScreen() {
  const { eventId = '', index = '', action = '', code = '' } = useLocalSearchParams<{ eventId: string; index: string; action?: string; code?: string }>();
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new AttendanceScanController(services, Number(eventId), Number(index), action, code), [eventId, index, action, code]);

  const after = (toEvaluation: boolean) => {
    if (!toEvaluation) return;
    fb.toast(c.state.message, 'success');
    router.replace({ pathname: '/attendance/[eventId]/[index]/evaluate', params: { eventId, index } });
  };
  useEffect(() => { void c.start(locate).then(after); }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const pin = c.pin;
  const info = s.info;
  const retry = <Button icon="refresh-cw" onPress={() => void c.retry(locate).then(after)}>Try again</Button>;
  let body: ReactNode;
  if (s.step === 'loading' || s.step === 'locating' || s.step === 'submitting') {
    body = (
      <>
        <Spinner />
        <T size={13} color={C.muted} center>
          {s.step === 'loading' ? 'Loading activity…' : s.step === 'locating' ? (pin ? 'Checking that you are at the venue…' : 'Getting your location for the record…') : `Recording your ${c.label}…`}
        </T>
      </>
    );
  } else if (s.step === 'outside') {
    body = (
      <>
        <Icon name="alert-triangle" size={50} color="#c2410c" />
        <T size={17} weight={700} center>You are outside the event perimeter</T>
        <T size={13} color={C.muted} center>
          You are about {c.distance != null ? formatDistance(c.distance) : '—'} from {info?.venue || 'the venue'}. {c.label} is accepted only within {pin?.radius_m} m. Go to the venue, then try again.
        </T>
        {s.fix?.accuracy != null && s.fix.accuracy > 50 ? (
          <T size={12} color={C.muted} center>Your phone's location is only accurate to about {formatDistance(s.fix.accuracy)}. Turning on precise location or moving near a window can help.</T>
        ) : null}
        {retry}
      </>
    );
  } else if (s.step === 'no-location') {
    const help = LOCATION_HELP[s.problem ?? 'unavailable'];
    body = (
      <>
        <Icon name="map-pin" size={50} color={C.red} />
        <T size={17} weight={700} center>Location needed for {c.label}</T>
        <T size={13} color={C.muted} center>This event only accepts attendance at {info?.venue || 'the venue'} (within {pin?.radius_m} m), so TaskNet needs your location to confirm you are there.</T>
        <View style={{ alignSelf: 'stretch', backgroundColor: '#fefce8', borderRadius: 10, padding: 12, gap: 4 }}>
          <T size={13.5} weight={700}>{help.title}</T>
          {help.steps.map((t) => <T key={t} size={12.5}>• {t}</T>)}
        </View>
        {retry}
      </>
    );
  } else {
    const ok = s.step === 'done';
    body = (
      <>
        <Icon name={ok ? 'check-circle' : 'alert-circle'} size={54} color={ok ? C.green : C.red} />
        <T size={17} weight={700}>{c.label} {ok ? 'recorded' : 'not recorded'}</T>
        <T size={13} color={C.muted} center>{s.message}</T>
        {ok ? <Button variant="ghost" onPress={() => router.replace('/dashboard')}>Go to dashboard</Button> : retry}
      </>
    );
  }

  const tone = c.isTimeIn ? C.green : C.accent;
  return (
    <Screen style={{ justifyContent: 'center', flexGrow: 1 }}>
      <Stack.Screen options={{ title: 'Attendance' }} />
      <Card style={{ alignItems: 'center', gap: 6, padding: 22 }}>
        <View style={{ backgroundColor: `${tone}22`, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}><T weight={700} color={tone}>Attendance · {c.label}</T></View>
        {info && (
          <>
            <T size={18} weight={700} center style={{ marginTop: 8 }}>{info.activity.event?.trim() || `Activity ${info.activity_index + 1}`}</T>
            <T size={13} color={C.muted} center>{info.event_title}</T>
            <T size={12} color={C.muted} center>{[info.activity.time, info.venue].filter(Boolean).join('  ·  ')}</T>
            {c.window ? <T size={12} weight={600} center>{c.label} window: {c.window}</T> : null}
            {pin ? <T size={12} color="#1d4ed8" center>Must be within {pin.radius_m} m of the venue</T> : null}
          </>
        )}
        <View style={{ alignItems: 'center', gap: 8, marginTop: 18, alignSelf: 'stretch' }}>{body}</View>
      </Card>
    </Screen>
  );
}
