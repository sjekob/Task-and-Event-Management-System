import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Box, Button, Center, List, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck, IconMapPinOff, IconRefresh } from '@tabler/icons-react';
import {
  api, distanceMeters, formatDistance, insidePerimeter, type AttendanceActivity, type VenueLocation,
} from '@tasknet/shared';
import { notifySuccess } from '../../components/ui';
import { VenueMap } from '../../components/VenueMap';
import { colors } from '../../theme';

type Step = 'loading' | 'locating' | 'submitting' | 'done' | 'error' | 'outside' | 'no-location';
type Fix = { lat: number; lng: number; accuracy: number };
type LocationProblem = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** The device's position, or why it couldn't be had. */
function locate(fresh: boolean): Promise<{ fix: Fix } | { problem: LocationProblem }> {
  if (!('geolocation' in navigator)) return Promise.resolve({ problem: 'unsupported' });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ fix: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (err) => resolve({
        problem: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable',
      }),
      // A pinned venue needs a fresh, precise fix; otherwise it's only logged.
      { enableHighAccuracy: true, timeout: fresh ? 15000 : 8000, maximumAge: fresh ? 0 : 60_000 },
    );
  });
}

const PROBLEM_TEXT: Record<LocationProblem, { title: string; steps: string[] }> = {
  denied: {
    title: 'Location access is blocked for this site',
    steps: [
      'Tap the lock or settings icon next to the address bar and set Location to Allow.',
      'On a phone, also check that the browser itself may use location (phone Settings → Apps → your browser → Permissions).',
      'Then tap Try again.',
    ],
  },
  unavailable: {
    title: "Your location couldn't be found",
    steps: ["Turn on your phone's Location/GPS.", 'Step outside or near a window if you are deep inside a building.', 'Then tap Try again.'],
  },
  timeout: {
    title: 'Finding your location took too long',
    steps: ["Make sure Location/GPS is on and you have signal.", 'Wait a few seconds, then tap Try again.'],
  },
  unsupported: {
    title: "This browser can't share your location",
    steps: ['Open the QR link in Chrome, Safari or the TaskNet app instead.'],
  },
};

/**
 * Landing page of an attendance QR (Time In or Time Out for one Activity
 * Matrix row). The backend accepts the scan only inside its time window and,
 * when the venue is pinned, only from inside its perimeter. A successful Time
 * Out goes straight to the activity evaluation.
 */
export function AttendanceScanPage() {
  const { eventId, index } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const action = params.get('action') ?? '';
  const code = params.get('code') ?? '';
  const ev = Number(eventId);
  const idx = Number(index);
  const isTimeIn = action === 'time_in';
  const label = isTimeIn ? 'Time In' : 'Time Out';
  const [step, setStep] = useState<Step>('loading');
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState<AttendanceActivity | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    if ((action !== 'time_in' && action !== 'time_out') || !code) {
      setStep('error');
      setMessage('This attendance QR code is incomplete. Please scan it again.');
      return;
    }
    try {
      setStep('loading');
      const activity = info ?? await api.events.attendanceActivity(ev, idx);
      setInfo(activity);
      const pin = activity.venue_location ?? null;
      const alreadyOut = !isTimeIn && !!activity.record?.time_out_at;

      setStep('locating');
      const got = await locate(!!pin);
      const here = 'fix' in got ? got.fix : null;
      setFix(here);
      if (pin && !alreadyOut) {
        if (!here) {
          setProblem('problem' in got ? got.problem : 'unavailable');
          setStep('no-location');
          return;
        }
        const d = distanceMeters(here.lat, here.lng, pin.latitude, pin.longitude);
        if (!insidePerimeter(d, pin.radius_m, here.accuracy, activity.gps_tolerance_max_m)) {
          setStep('outside');
          return;
        }
      }

      setStep('submitting');
      const res = await api.events.scanAttendance(ev, {
        activity_index: idx, action, code,
        latitude: here?.lat ?? null, longitude: here?.lng ?? null, accuracy: here?.accuracy ?? null,
      });
      if (res.redirect_to_evaluation) {
        notifySuccess(res.message || 'Time Out recorded.');
        navigate(`/attendance/${ev}/${idx}/evaluate`, { replace: true });
        return;
      }
      setStep('done');
      setMessage(res.message || `${label} recorded.`);
    } catch (e) {
      setStep('error');
      setMessage(e instanceof Error ? e.message : 'Could not record your attendance');
    }
  }, [action, code, ev, idx, info, isTimeIn, label, navigate]);

  useEffect(() => {
    // Record the scan once, even under StrictMode's double effects.
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const window = info?.windows?.[action as 'time_in' | 'time_out']?.label;
  const tone = isTimeIn ? colors.green : colors.accent;
  const pin: VenueLocation | null = info?.venue_location ?? null;
  const distance = pin && fix ? distanceMeters(fix.lat, fix.lng, pin.latitude, pin.longitude) : null;
  const map = pin && (
    <Box mt="sm" w="100%">
      <VenueMap pin={{ lat: pin.latitude, lng: pin.longitude }} radius={pin.radius_m} label={info?.venue ?? 'Venue'}
        you={fix ? { lat: fix.lat, lng: fix.lng } : null} height={240} />
      <Text size="11px" c="dimmed" ta="center" mt={4}>Blue circle: the venue perimeter ({pin.radius_m} m). Orange dot: you.</Text>
    </Box>
  );
  const retry = <Button mt="md" color="#0F2C59" leftSection={<IconRefresh size={18} />} onClick={() => void run()}>Try again</Button>;

  let body: ReactNode;
  if (step === 'loading' || step === 'locating' || step === 'submitting') {
    body = (
      <Stack align="center" gap="md" mt="sm">
        <Loader />
        <Text size="sm" c="dimmed" ta="center">
          {step === 'loading' ? 'Loading activity…'
            : step === 'locating' ? (pin ? 'Checking that you are at the venue…' : 'Getting your location for the record…')
              : `Recording your ${label}…`}
        </Text>
        {step === 'locating' && pin && <Text size="xs" c="dimmed" ta="center">Allow location access if your browser asks.</Text>}
      </Stack>
    );
  } else if (step === 'outside') {
    body = (
      <Stack align="center" gap={6}>
        <Alert w="100%" color="orange" variant="light" icon={<IconAlertTriangle size={20} />}
          title={<Text fw={700}>You are outside the event perimeter</Text>}>
          <Text size="sm">
            You are about <b>{distance != null ? formatDistance(distance) : '—'}</b> from {info?.venue || 'the venue'}.
            {' '}{label} is accepted only within {pin?.radius_m} m. Go to the venue, then tap Try again.
          </Text>
          {fix && fix.accuracy > 50 && (
            <Text size="xs" c="dimmed" mt={6}>
              Your phone&apos;s location is only accurate to about {formatDistance(fix.accuracy)}. Turning on precise location or moving near a window can help.
            </Text>
          )}
        </Alert>
        {map}
        {retry}
      </Stack>
    );
  } else if (step === 'no-location') {
    const p = PROBLEM_TEXT[problem ?? 'unavailable'];
    body = (
      <Stack align="center" gap={6}>
        <IconMapPinOff size={52} color={colors.red} />
        <Text fw={700} size="lg" ta="center">Location needed for {label}</Text>
        <Text size="sm" c="dimmed" ta="center">
          This event only accepts attendance at {info?.venue || 'the venue'} (within {pin?.radius_m} m), so TaskNet needs your location to confirm you are there.
        </Text>
        <Alert w="100%" mt="xs" color="yellow" variant="light" title={<Text fw={700} size="sm">{p.title}</Text>}>
          <List size="sm" spacing={4}>{p.steps.map((s) => <List.Item key={s}>{s}</List.Item>)}</List>
        </Alert>
        {retry}
        <Text size="xs" c="dimmed" ta="center" mt={4}>Still stuck? Open the QR link on a phone with GPS turned on (laptops often can&apos;t find their location).</Text>
      </Stack>
    );
  } else {
    const ok = step === 'done';
    body = (
      <Stack align="center" gap={6}>
        {ok ? <IconCircleCheck size={56} color={colors.green} /> : <IconAlertCircle size={56} color={colors.red} />}
        <Text fw={700} size="lg" ta="center">{label} {ok ? 'recorded' : 'not recorded'}</Text>
        <Text size="sm" c="dimmed" ta="center">{message}</Text>
        {pin && fix && map}
        {ok ? <Button variant="subtle" mt="md" onClick={() => navigate('/dashboard')}>Go to dashboard</Button> : retry}
      </Stack>
    );
  }

  return (
    <Center mih="100dvh" p="md" bg="#F1F5F9">
      <Paper w="100%" maw={480} p={24} radius="lg" shadow="md">
        <Stack align="center" gap={2}>
          <Badge radius="xl" tt="none" size="lg" style={{ background: `${tone}1A`, color: tone }}>Attendance · {label}</Badge>
          {info && (
            <>
              <Title order={3} fz={18} ta="center" mt={12}>{info.activity.event?.trim() || `Activity ${idx + 1}`}</Title>
              <Text size="sm" c="dimmed" ta="center">{info.event_title}</Text>
              <Text size="xs" c="dimmed" ta="center" mt={6}>{[info.activity.time, info.venue].filter(Boolean).join('  ·  ')}</Text>
              {window && <Text size="xs" fw={600} ta="center" mt={4}>{label} window: {window}</Text>}
              {pin && <Text size="xs" c="blue.7" ta="center" mt={2}>Must be within {pin.radius_m} m of the venue</Text>}
            </>
          )}
        </Stack>
        <Stack mt={20}>{body}</Stack>
      </Paper>
    </Center>
  );
}
