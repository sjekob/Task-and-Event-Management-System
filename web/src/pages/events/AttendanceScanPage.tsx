import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Center, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconCircleCheck, IconRefresh } from '@tabler/icons-react';
import { api, type AttendanceActivity } from '@tasknet/shared';
import { notifySuccess } from '../../components/ui';
import { colors } from '../../theme';

type Step = 'loading' | 'locating' | 'submitting' | 'done' | 'error';

/** Best effort: the location is logged with the scan, never required. */
function currentPosition(): Promise<GeolocationCoordinates | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 });
  });
}

/**
 * Landing page of an attendance QR (Time In or Time Out for one Activity
 * Matrix row). The backend accepts the scan only inside its time window; a
 * successful Time Out goes straight to the activity evaluation.
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
      setStep('locating');
      const pos = await currentPosition();
      setStep('submitting');
      const res = await api.events.scanAttendance(ev, {
        activity_index: idx, action, code, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null,
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
  }, [action, code, ev, idx, info, label, navigate]);

  useEffect(() => {
    // Record the scan once, even under StrictMode's double effects.
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const window = info?.windows?.[action as 'time_in' | 'time_out']?.label;
  const tone = isTimeIn ? colors.green : colors.accent;

  let body: ReactNode;
  if (step === 'loading' || step === 'locating' || step === 'submitting') {
    body = (
      <Stack align="center" gap="md" mt="sm">
        <Loader />
        <Text size="sm" c="dimmed" ta="center">
          {step === 'loading' ? 'Loading activity…' : step === 'locating' ? 'Getting your location for the record…' : `Recording your ${label}…`}
        </Text>
      </Stack>
    );
  } else {
    const ok = step === 'done';
    body = (
      <Stack align="center" gap={6}>
        {ok ? <IconCircleCheck size={56} color={colors.green} /> : <IconAlertCircle size={56} color={colors.red} />}
        <Text fw={700} size="lg" ta="center">{label} {ok ? 'recorded' : 'not recorded'}</Text>
        <Text size="sm" c="dimmed" ta="center">{message}</Text>
        {ok ? <Button variant="subtle" mt="md" onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
          : <Button mt="md" color="#0F2C59" leftSection={<IconRefresh size={18} />} onClick={() => void run()}>Try again</Button>}
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
            </>
          )}
        </Stack>
        <Stack mt={20}>{body}</Stack>
      </Paper>
    </Center>
  );
}
