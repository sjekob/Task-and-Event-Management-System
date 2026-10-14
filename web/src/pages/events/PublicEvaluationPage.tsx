import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Center, Divider, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput,
  ThemeIcon, UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle, IconBuildingBank, IconCircleCheck, IconCircleCheckFilled, IconCircleXFilled, IconListCheck, IconLock,
} from '@tabler/icons-react';
import { api, titleCase, type AttendanceActivity, type PublicEvent } from '@tasknet/shared';
import { notifyError } from '../../components/ui';
import { colors } from '../../theme';

const ROLE_OPTIONS = ['student', 'teacher', 'parent', 'visitor', 'dean', 'coordinator', 'principal', 'registrar'];
const SEX = ['Male', 'Female', 'Prefer not to say'];
const AGE = ['17 and below', '18-24', '25-34', '35-44', '45-54', '55 and above'];
const validEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

type View = { kind: 'loading' } | { kind: 'error' | 'locked'; message: string } | { kind: 'form' } | { kind: 'submitted' };

/**
 * DepEd observation tool reached by scanning an event's QR code (no login):
 * each of the proposal's indicators is marked Evident / Not Evident.
 * On /attendance/:eventId/:index/evaluate it is the signed-in attendee's
 * evaluation of one activity, which may auto-complete its Special Task.
 */
export function PublicEvaluationPage() {
  const { eventId = '', index } = useParams();
  const navigate = useNavigate();
  const attendee = index !== undefined;
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [activity, setActivity] = useState<AttendanceActivity | null>(null);
  const [marks, setMarks] = useState<(boolean | null)[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [sex, setSex] = useState<string | null>(null);
  const [age, setAge] = useState<string | null>(null);
  const [affiliation, setAffiliation] = useState('');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [specialTask, setSpecialTask] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ev = await api.appraisal.publicEvent(eventId);
        let open = ev.is_open;
        let reason = ev.lock_reason;
        if (attendee) {
          // Attendance, not the public date gate, decides whether this is open.
          const a = await api.events.attendanceActivity(Number(eventId), Number(index));
          setActivity(a);
          reason = a.record?.evaluated_at ? 'You have already evaluated this activity.'
            : !a.record?.time_out_at ? 'Scan the Time Out QR of this activity before evaluating it.' : null;
          open = !reason;
        }
        setEvent(ev);
        setMarks(ev.indicators.map(() => null));
        setView(open ? { kind: 'form' } : { kind: 'locked', message: reason || 'This event is not open for evaluation yet.' });
      } catch (e) {
        setView({ kind: 'error', message: e instanceof Error ? e.message : 'Event not found.' });
      }
    })();
  }, [eventId, index, attendee]);

  const opts = (key: 'sex' | 'age_group' | 'evaluator_role', fallback: string[]) => event?.demographic_options?.[key] ?? fallback;

  const submit = async () => {
    if (!attendee && !validEmail(email.trim())) return notifyError(new Error('Please enter a valid email address.'));
    if (!sex || !age) return notifyError(new Error('Please select your sex and age group.'));
    if (marks.some((m) => m == null)) return notifyError(new Error('Please mark every indicator as Evident or Not Evident.'));
    const indicators = event!.indicators.map((label, i) => ({ label, evident: !!marks[i] }));
    const common = { sex, age_group: age, affiliation: affiliation.trim() || null, indicators, comments: comments.trim() || null };
    setBusy(true);
    try {
      if (attendee) {
        const res = await api.events.evaluateActivity(Number(eventId), Number(index), common);
        setSpecialTask(res.special_task ?? null);
      } else {
        await api.appraisal.submitPublicEvaluation(eventId, {
          ...common, evaluator_name: name.trim() || null, evaluator_email: email.trim(), evaluator_role: role,
        });
      }
      setView({ kind: 'submitted' });
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (view.kind === 'loading') body = <Center h={200}><Loader /></Center>;
  else if (view.kind === 'error') body = <Status icon={<IconAlertCircle size={56} color={colors.red} />} title="Unable to load event" text={view.message} />;
  else if (view.kind === 'locked') body = <Status icon={<IconLock size={56} color={colors.amber} />} title={event?.title || 'Event Evaluation'} text={view.message} />;
  else if (view.kind === 'submitted') {
    body = (
      <Stack align="center">
        <Status icon={<IconCircleCheck size={56} color={colors.green} />} title="Evaluation Submitted!"
          text="Thank you for your response. Your feedback helps improve our future events." />
        {specialTask && (
          <Group w="100%" wrap="nowrap" p={14} style={{ background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
            <IconListCheck color={colors.green} />
            <div>
              <Text size="xs" fw={700} c={colors.green}>Special task completed</Text>
              <Text size="sm" fw={600}>{String(specialTask.title ?? '')}</Text>
              <Text size="xs" c="dimmed">Added to My Special Tasks</Text>
            </div>
          </Group>
        )}
        {attendee && (
          <Button variant="subtle" onClick={() => navigate(specialTask ? '/my-special-tasks' : '/dashboard')}>
            {specialTask ? 'View My Special Tasks' : 'Go to dashboard'}
          </Button>
        )}
      </Stack>
    );
  } else {
    const e = event!;
    body = (
      <Stack gap="md">
        <Group gap={12} wrap="nowrap">
          <ThemeIcon size={44} radius="xl" color="#0F2C59"><IconBuildingBank size={24} /></ThemeIcon>
          <div>
            <Text fw={800} c="#0F172A">Kagawaran ng Edukasyon</Text>
            <Text size="xs" c="#475569">Performance Observation Tool</Text>
          </div>
        </Group>
        <Divider size={2} color="#0F172A" />
        <Box p={14} style={{ background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <Text fw={700} c="#0F172A">{e.title || 'Event Evaluation'}</Text>
          {attendee && activity?.activity.event && <Text size="sm" fw={600} c="#334155">Activity: {activity.activity.event}</Text>}
          <Text size="xs" c="#475569" mt={4}>
            {[e.target_date && `Date: ${e.target_date}`, e.organizer_name && `Organizer: ${e.organizer_name}`, e.venue && `Venue: ${e.venue}`].filter(Boolean).join('  ·  ')}
          </Text>
        </Box>
        {e.monitoring_criteria?.trim() && (
          <div>
            <Text size="xs" fw={700}>Monitoring & Evaluation Criteria</Text>
            <Text size="xs" c="dimmed" className="tn-prewrap">{e.monitoring_criteria}</Text>
          </div>
        )}

        {!attendee && (
          <>
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <TextInput label="Name (optional)" value={name} onChange={(x) => setName(titleCase(x.currentTarget.value))} />
              <Select label="I am a..." allowDeselect={false} value={role} onChange={(v) => v && setRole(v)}
                data={opts('evaluator_role', ROLE_OPTIONS).map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))} />
            </SimpleGrid>
            <TextInput label="Email (required)" type="email" description="Each email can submit this evaluation only once."
              value={email} onChange={(x) => setEmail(x.currentTarget.value)} />
          </>
        )}

        <div>
          <Text fw={800} size="sm">About you</Text>
          <Text size="xs" c="dimmed">Used only to summarize who evaluated the event.</Text>
        </div>
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <Select label="Sex (required)" data={opts('sex', SEX)} value={sex} onChange={setSex} />
          <Select label="Age group (required)" data={opts('age_group', AGE)} value={age} onChange={setAge} />
        </SimpleGrid>
        <TextInput label="School / office / organization (optional)" value={affiliation} onChange={(x) => setAffiliation(x.currentTarget.value)} />

        <div>
          <Text fw={800} size="sm">Observation Indicators</Text>
          <Text size="xs" c="dimmed">Mark each indicator as Evident or Not Evident based on what you observed.</Text>
        </div>
        {e.indicators.map((label, i) => (
          <Box key={i} p={12} style={{ background: '#FAFBFC', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <Text size="sm" fw={600}>{i + 1}. {label}</Text>
            <Group grow mt={10} gap={8}>
              {[true, false].map((v) => {
                const selected = marks[i] === v;
                const color = v ? colors.green : colors.red;
                return (
                  <UnstyledButton key={String(v)} py={8} onClick={() => setMarks(marks.map((m, j) => (j === i ? v : m)))}
                    aria-pressed={selected} style={{
                      borderRadius: 8, textAlign: 'center', background: selected ? `${color}1F` : 'white',
                      border: `${selected ? 1.4 : 0.8}px solid ${selected ? color : '#CBD5E1'}`,
                    }}>
                    <Group gap={6} justify="center">
                      {v ? <IconCircleCheckFilled size={15} color={selected ? color : '#94A3B8'} /> : <IconCircleXFilled size={15} color={selected ? color : '#94A3B8'} />}
                      <Text size="xs" fw={600} c={selected ? color : 'dimmed'}>{v ? 'Evident' : 'Not Evident'}</Text>
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Group>
          </Box>
        ))}
        <Textarea label="Overall comments (optional)" autosize minRows={3} value={comments} onChange={(x) => setComments(x.currentTarget.value)} />
        <Button fullWidth size="md" color="#0F2C59" loading={busy} onClick={() => void submit()}>Submit Evaluation</Button>
      </Stack>
    );
  }

  return (
    <Center mih="100dvh" p="md" bg="#F1F5F9">
      <Paper w="100%" maw={720} p={24} radius="lg" shadow="md" my="lg">{body}</Paper>
    </Center>
  );
}

function Status({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Stack align="center" gap={8}>
      {icon}
      <Text fw={700} size="xl" ta="center" mt={8}>{title}</Text>
      <Text size="sm" c="dimmed" ta="center">{text}</Text>
    </Stack>
  );
}
