import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon, Alert, Anchor, Badge, Box, Button, Center, Divider, Grid, Group, Loader, Modal, Paper,
  SimpleGrid, Stack, Table, Text, ThemeIcon, Title, Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft, IconBan, IconBulb, IconCalendarEvent, IconCategory, IconChecklist, IconCircleCheck,
  IconFlag, IconHierarchy2, IconId, IconListCheck, IconMapPin, IconPencil, IconPigMoney, IconPrinter,
  IconQrcode, IconRoute, IconSignature, IconTimeline, IconUser, IconUsersGroup, IconWallet, IconCash,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  api, formatMoney, hasContent, listItems, parseJson, parseParticipants, qk, useSession, useUser, type EventRecord,
} from '@tasknet/shared';
import { ErrorState, PageLoader } from '../../components/ui';
import { EventStatusPill, useEventActions } from './EventsPage';
import { colors } from '../../theme';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const has = hasContent;
type Row = Record<string, unknown>;

function Panel({ children }: { children: ReactNode }) {
  return <Paper p={20} radius="lg" withBorder>{children}</Paper>;
}

function DetailCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Panel>
      <Group gap={8} mb={14} c="#4A5568">{icon}<Text fw={700} c={colors.dark}>{title}</Text></Group>
      {children}
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (!has(value)) return null;
  return (
    <Box mb={8}>
      <Text size="xs" fw={500} c="#718096">{label}</Text>
      <Text fw={600} className="tn-prewrap">{String(value)}</Text>
    </Box>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <Text size="sm" fw={700} c="#4A5568" mb={8}>{children}</Text>;
}

function DataTable({ head, rows, total }: { head: string[]; rows: unknown[][]; total?: unknown[] }) {
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table withTableBorder withColumnBorders striped={false} verticalSpacing={8} style={{ borderRadius: 10 }}>
        <Table.Thead bg="#F8FAFC"><Table.Tr>{head.map((h) => <Table.Th key={h}>{h}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => <Table.Tr key={i}>{r.map((c, j) => <Table.Td key={j}>{String(c ?? '')}</Table.Td>)}</Table.Tr>)}
          {total && <Table.Tr bg="#EFF6FF">{total.map((c, j) => <Table.Td key={j} fw={600}>{String(c ?? '')}</Table.Td>)}</Table.Tr>}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function Participants({ raw }: { raw: string }) {
  const data = parseParticipants(raw);
  if (!data) return <Text className="tn-prewrap">{raw}</Text>;
  if (!data.rows.length) return null;
  const t = data.totals;
  return (
    <DataTable head={['Category', 'Male', 'Female', 'Total']}
      rows={data.rows.map((r) => [r.category, r.male, r.female, r.total])}
      total={t ? ['Total', t.male, t.female, t.total] : undefined} />
  );
}

function Methodology({ raw }: { raw: string }) {
  const steps = parseJson<Row[] | null>(raw, null);
  if (!Array.isArray(steps)) return <Text className="tn-prewrap">{raw}</Text>;
  const shown = steps.filter((s) => has(s.stage) || has(s.activities));
  return (
    <Stack gap={14}>
      {shown.map((s, i) => (
        <Group key={i} wrap="nowrap" align="flex-start" gap={12}>
          <Center w={26} h={26} style={{ borderRadius: '50%', background: '#EEF2FA', flexShrink: 0 }}>
            <Text size="xs" fw={700}>{i + 1}</Text>
          </Center>
          <div>
            {has(s.stage) && <Text fw={700} size="sm">{String(s.stage)}</Text>}
            {String(s.activities ?? '').split('\n').filter((l) => l.trim()).map((l, j) => (
              <Text key={j} size="sm" c="#4A5568" mt={3}>• {l.trim()}</Text>
            ))}
          </div>
        </Group>
      ))}
    </Stack>
  );
}

function Bullets({ items }: { items: string[] }) {
  return <Stack gap={4}>{items.map((s, i) => <Text key={i} size="sm">•&nbsp; {s}</Text>)}</Stack>;
}

function Committee({ raw }: { raw: string }) {
  const members = parseJson<Row[] | null>(raw, null);
  if (!Array.isArray(members)) return <Text size="xs" c="#4A5568" className="tn-prewrap">{raw}</Text>;
  return (
    <Stack gap={4}>
      {members.map((m, i) => {
        const pos = String(m.position ?? m.designation ?? '');
        return <Text key={i} size="xs" c="#4A5568">• {String(m.name ?? '')}{pos ? ` — ${pos}` : ''}</Text>;
      })}
    </Stack>
  );
}

function Twg({ raw }: { raw: string }) {
  const data = parseJson<unknown>(raw, null);
  const groups: [string, Row[]][] = Array.isArray(data)
    ? (data as Row[]).map((g) => [String(g.title ?? ''), (g.members as Row[]) ?? []])
    : data && typeof data === 'object' ? Object.entries(data as Record<string, Row[]>) : [];
  if (!groups.length) return <Text size="xs" c="#4A5568" className="tn-prewrap">{raw}</Text>;
  return (
    <Stack gap={4}>
      {groups.map(([title, members], i) => (
        <div key={i}>
          {title && <Text size="11px" fw={600} c="#718096" mt={6} mb={4}>{title.replace(/_/g, ' ')}</Text>}
          {members.map((m, j) => (
            <Text key={j} size="xs" c="#4A5568" ml={8}>• {String(m.name ?? '')}{has(m.designation) ? ` — ${String(m.designation)}` : ''}</Text>
          ))}
        </div>
      ))}
    </Stack>
  );
}

function Signatories({ raw }: { raw: string }) {
  const decoded = parseJson<unknown>(raw, null);
  const list = (decoded && !Array.isArray(decoded) && typeof decoded === 'object'
    ? (decoded as { signatories?: Row[] }).signatories : decoded) as Row[] | null;
  if (!Array.isArray(list)) return <Text size="xs" c="#4A5568" className="tn-prewrap">{raw}</Text>;
  const shown = list.filter((s) => has(s.role) || has(s.name) || has(s.title));
  return (
    <Group gap={12}>
      {shown.map((s, i) => (
        <Box key={i} w={240} p={14} style={{ background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          {has(s.role) && <Text size="10.5px" fw={700} c="#718096" tt="uppercase" lts={0.5}>{String(s.role)}</Text>}
          <Text fw={700} size="sm" mt={6}>{has(s.name) ? String(s.name) : '—'}</Text>
          {has(s.title) && <Text size="xs" c="#4A5568">{String(s.title)}</Text>}
        </Box>
      ))}
    </Group>
  );
}

function Indicators({ raw }: { raw: string }) {
  const list = parseJson<unknown[] | null>(raw, null);
  if (!Array.isArray(list)) return <Text size="xs" c="#4A5568" className="tn-prewrap">{raw}</Text>;
  const items = list.map((e) => String(e && typeof e === 'object' ? (e as Row).label ?? '' : e)).filter((s) => s.trim());
  return <Stack gap={3}>{items.map((s, i) => <Text key={i} size="xs" c="#4A5568">{i + 1}. {s}</Text>)}</Stack>;
}

/** Full proposal view with the actions that fit the event's status. */
export function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useUser();
  const { can } = useSession();
  const actions = useEventActions();
  const [qrOpen, setQrOpen] = useState(false);
  const event = useQuery({ queryKey: qk.event(Number(id)), queryFn: () => api.events.get(Number(id)) });

  if (event.isPending) return <PageLoader />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  const e: EventRecord = event.data;

  const canManage = can('manage_events');
  const canApprove = can('approve_events');
  const pending = e.status === 'pending_approval';
  const showApprove = canApprove && pending;
  const showDisable = canApprove && !canManage && pending;
  const showEdit = canManage && (pending || e.status === 'draft') && e.created_by === user.id;
  const showQr = e.status === 'approved' && (canApprove || e.created_by === user.id);

  const sections: [string, ReactNode, ReactNode][] = [];
  if (has(e.rationale)) sections.push(['Rationale', <IconBulb size={18} />, <Text className="tn-prewrap" lh={1.65}>{e.rationale}</Text>]);
  if (has(e.objectives)) sections.push(['Objectives', <IconFlag size={18} />, <Bullets items={listItems(e.objectives)} />]);
  if (has(e.phase1) || has(e.phase2) || has(e.phase3)) {
    sections.push(['Methodology / Work plan', <IconRoute size={18} />, (
      <Stack gap="xs">
        {has(e.phase1) && <Methodology raw={e.phase1!} />}
        <Field label="Phase 2" value={e.phase2} />
        <Field label="Phase 3" value={e.phase3} />
      </Stack>
    )]);
  }
  const matrix = parseJson<Row[] | null>(e.activity_matrix, null);
  if (has(e.activity_matrix)) {
    sections.push(['Activity matrix', <IconTimeline size={18} />, Array.isArray(matrix)
      ? <DataTable head={['Day', 'Time', 'Activity', 'Speaker/Facilitator']} rows={matrix.map((r) => [r.day, r.time, r.event, r.speaker])} />
      : <Text size="xs" className="tn-prewrap">{e.activity_matrix}</Text>]);
  }
  if (has(e.training_materials) || has(e.snacks)) {
    const mats = parseJson<Row[]>(e.training_materials, []);
    const snacks = parseJson<Row[]>(e.snacks, []);
    sections.push(['Budget', <IconCash size={18} />, (
      <Stack gap="md">
        {mats.length > 0 && <div><SubHeading>Training materials</SubHeading>
          <DataTable head={['Item', 'Qty', 'Cost', 'Total']} rows={mats.map((r) => [r.item, r.qty, r.cost, r.total])} /></div>}
        {snacks.length > 0 && <div><SubHeading>Meals / snacks</SubHeading>
          <DataTable head={['Item', 'Participants', 'Cost/Day', 'Total']} rows={snacks.map((r) => [r.item, r.pax, r.cost, r.total])} /></div>}
      </Stack>
    )]);
  }
  if (has(e.exec_committee) || has(e.twg_groups)) {
    sections.push(['Committees', <IconHierarchy2 size={18} />, (
      <Stack gap="md">
        {has(e.exec_committee) && <div><SubHeading>Executive committee</SubHeading><Committee raw={e.exec_committee!} /></div>}
        {has(e.twg_groups) && <div><SubHeading>Technical working groups</SubHeading><Twg raw={e.twg_groups!} /></div>}
      </Stack>
    )]);
  }
  if (has(e.monitoring_criteria) || has(e.indicators)) {
    sections.push(['Monitoring & evaluation', <IconChecklist size={18} />, (
      <Stack gap="xs">
        {has(e.monitoring_criteria) && <Text className="tn-prewrap" lh={1.65}>{e.monitoring_criteria}</Text>}
        {has(e.indicators) && <div><SubHeading>Indicators</SubHeading><Indicators raw={e.indicators!} /></div>}
      </Stack>
    )]);
  }
  if (has(e.comments)) sections.push(['Signatories', <IconSignature size={18} />, <Signatories raw={e.comments!} />]);

  const facts: [string, ReactNode, string][] = [
    ['Nature', <IconCategory size={19} />, e.nature ?? ''],
    ['Venue', <IconMapPin size={19} />, e.venue ?? ''],
    ['Proposed budget', <IconWallet size={19} />, formatMoney(e.proposed_budget)],
    ['Fund source', <IconPigMoney size={19} />, e.fund_source ?? ''],
  ];

  return (
    <Box maw={1100} mx="auto">
      <Panel>
        <Group align="flex-start" wrap="nowrap" gap={14}>
          <Tooltip label="Back to events">
            <ActionIcon variant="light" color="gray" size={40} radius="xl" onClick={() => navigate('/events')} aria-label="Back to events">
              <IconArrowLeft size={20} />
            </ActionIcon>
          </Tooltip>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="11px" fw={700} lts={0.8} c="#718096">EVENT PROPOSAL</Text>
            <Title order={2} fz={24} fw={800} lh={1.2} mt={4}>{e.title}</Title>
          </Box>
          <EventStatusPill status={e.status} />
        </Group>
        <Group gap={22} mt={16}>
          {e.creator_name && <Meta icon={<IconUser size={16} />} text={`Proposed by ${e.creator_name}`} />}
          {has(e.target_date) && <Meta icon={<IconCalendarEvent size={16} />} text={e.target_date!} />}
          {has(e.venue) && <Meta icon={<IconMapPin size={16} />} text={e.venue!} />}
        </Group>
        <Divider my={16} />
        <Group gap={10}>
          {showApprove && <Button color="green" leftSection={<IconCircleCheck size={18} />} onClick={() => void actions.approve(e)}>Approve event</Button>}
          {showDisable && <Button variant="outline" color="red" leftSection={<IconBan size={18} />} onClick={() => actions.disable(e)}>Disable event</Button>}
          {showEdit && <Button variant="default" leftSection={<IconPencil size={18} />} onClick={() => navigate(`/events/${e.id}/edit`)}>Edit proposal</Button>}
          {showQr && <Button variant="default" leftSection={<IconQrcode size={18} />} onClick={() => setQrOpen(true)}>Attendance QR codes</Button>}
          <Button variant="default" leftSection={<IconPrinter size={18} />} onClick={() => void actions.print(e)}>Print proposal</Button>
        </Group>
      </Panel>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={12} mt="md">
        {facts.map(([label, icon, value]) => (
          <Paper key={label} p={16} radius="md" withBorder>
            <Group wrap="nowrap" gap={12}>
              <ThemeIcon size={38} radius={10} style={{ background: '#EEF2FA', color: colors.dark }}>{icon}</ThemeIcon>
              <Box style={{ minWidth: 0 }}>
                <Text size="xs" c="#718096">{label}</Text>
                <Text fw={700} lineClamp={2}>{value.trim() || '—'}</Text>
              </Box>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      {(has(e.focal_name) || has(e.participants)) && (
        <Grid gap="md" mt="md">
          {has(e.focal_name) && (
            <Grid.Col span={{ base: 12, md: has(e.participants) ? 4 : 12 }}>
              <DetailCard icon={<IconId size={18} />} title="Focal person">
                <Field label="Name" value={e.focal_name} />
                <Field label="Role" value={e.focal_role} />
                <Field label="Contact" value={e.focal_contact} />
              </DetailCard>
            </Grid.Col>
          )}
          {has(e.participants) && (
            <Grid.Col span={{ base: 12, md: has(e.focal_name) ? 8 : 12 }}>
              <DetailCard icon={<IconUsersGroup size={18} />} title="Target participants"><Participants raw={e.participants!} /></DetailCard>
            </Grid.Col>
          )}
        </Grid>
      )}

      {has(e.expected_outputs) && (
        <Box mt="md"><DetailCard icon={<IconListCheck size={18} />} title="Expected outputs"><Bullets items={listItems(e.expected_outputs)} /></DetailCard></Box>
      )}

      {sections.map(([title, icon, body], i) => (
        <Box key={title} mt="md">
          <Panel>
            <Group gap={10} mb={14}>
              <Badge color="ink.8" radius={6} variant="filled" fw={800}>{ROMAN[i + 1] ?? i + 2}</Badge>
              <Box c="#4A5568">{icon}</Box>
              <Text fw={700}>{title}</Text>
            </Group>
            {body}
          </Panel>
        </Box>
      ))}

      {qrOpen && <AttendanceQrModal eventId={e.id} onClose={() => setQrOpen(false)} />}
    </Box>
  );
}

function Meta({ icon, text }: { icon: ReactNode; text: string }) {
  return <Group gap={6} wrap="nowrap" c="#718096">{icon}<Text size="sm" c="#4A5568">{text}</Text></Group>;
}

/**
 * Time In / Time Out QR codes for every Activity Matrix row. Each QR opens the
 * attendance scan page; the code inside is signed by the server.
 */
function AttendanceQrModal({ eventId, onClose }: { eventId: number; onClose: () => void }) {
  const qr = useQuery({ queryKey: ['attendance-qr', eventId], queryFn: () => api.events.attendanceQrCodes(eventId) });
  const url = (index: number, action: string, code: string) =>
    `${window.location.origin}/attendance/${eventId}/${index}/scan?action=${action}&code=${encodeURIComponent(code)}`;
  return (
    <Modal opened onClose={onClose} size={620} title={<Text fw={700}>Attendance QR Codes</Text>}>
      {qr.isPending ? <Center p="xl"><Loader /></Center>
        : qr.isError ? <Text c="red" ta="center" size="sm">{(qr.error as Error).message}</Text> : (
          <Stack>
            <Text size="sm" c="dimmed">{qr.data.title}</Text>
            {!qr.data.activities.length && <Notice text="This event has no Activity Matrix rows." />}
            {qr.data.activities.map((a) => (
              <Box key={a.index} pb="md" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <Text fw={700} size="sm">{a.event?.trim() || `Activity ${a.index + 1}`}</Text>
                <Text size="xs" c="dimmed">{[a.day, a.time].filter(Boolean).join('  ·  ')}</Text>
                {a.special_task_title?.trim() && <Text size="xs" c={colors.green} mt={4}>Automated special task: {a.special_task_title}</Text>}
                {!a.schedule_readable && (
                  <Notice text={'This row\'s day/time can\'t be read (use e.g. "4:00-5:00 PM"), so its scans will be rejected.'} />
                )}
                <Group gap={16} mt={10} align="flex-start">
                  {([['Time In', 'time_in', a.time_in_code], ['Time Out', 'time_out', a.time_out_code]] as const).map(([label, action, code]) => {
                    const link = url(a.index, action, code);
                    return (
                      <Stack key={action} w={250} align="center" gap={6}>
                        <Text fw={700} size="sm">{label}</Text>
                        <Box p={10} bg="white" style={{ border: '1px solid #E5E7EB', borderRadius: 10 }}>
                          <QRCodeSVG value={link} size={170} />
                        </Box>
                        <Anchor href={link} size="9px" ta="center" style={{ wordBreak: 'break-all' }}>{link}</Anchor>
                      </Stack>
                    );
                  })}
                </Group>
              </Box>
            ))}
          </Stack>
        )}
    </Modal>
  );
}

function Notice({ text }: { text: string }) {
  return <Alert color="yellow" p={10} my={6}><Text size="xs" c="#92400E">{text}</Text></Alert>;
}
