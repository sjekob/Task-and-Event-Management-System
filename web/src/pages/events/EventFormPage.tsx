import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon, Alert, Anchor, Box, Button, Checkbox, Group, Loader, Modal, NumberInput, Paper, Radio,
  ScrollArea, Stack, Stepper, Table, Text, Textarea, TextInput, Title, UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertTriangle, IconArrowLeft, IconCircleMinus, IconPlus, IconSearch, IconUsersGroup } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, canSaveAsDraft, emptyExec, emptyMaterial, emptyMatrixRow, emptyMember, emptyPhase, emptySnack,
  firstProposalIssue, isoDate, longDate, NATURES, parseEventDate, proposalFromEvent, proposalPayload,
  PROPOSAL_STEPS, qk, roleLabel, startOfDay, titleCase, useSession, type EventRecord, type ProposalForm,
  type TwgMember, type User,
} from '@tasknet/shared';
import { ErrorState, notifyError, notifySuccess, PageLoader, UserAvatar } from '../../components/ui';

export function EventFormPage() {
  const { id } = useParams();
  const existing = useQuery({ queryKey: qk.event(Number(id)), queryFn: () => api.events.get(Number(id)), enabled: !!id });
  if (id && existing.isPending) return <PageLoader />;
  if (id && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  return <ProposalEditor key={id ?? 'new'} event={existing.data ?? null} />;
}

/** Tab in a multi-line field inserts four spaces instead of moving focus. */
function tabIndent(e: KeyboardEvent<HTMLTextAreaElement>, set: (v: string) => void) {
  if (e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  const el = e.currentTarget;
  const { selectionStart: s, selectionEnd: end, value } = el;
  set(value.slice(0, s) + '    ' + value.slice(end));
  requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
}

function ProposalEditor({ event }: { event: EventRecord | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerDraftSaver } = useSession();
  const [form, setForm] = useState<ProposalForm>(() => proposalFromEvent(event));
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dateIssue, setDateIssue] = useState<string | null>(null);
  const [depedWarning, setDepedWarning] = useState<string | null>(null);
  const [checkingDate, setCheckingDate] = useState(false);
  const [linking, setLinking] = useState<{ g: number; m: number; repick: boolean } | null>(null);
  const editing = !!event;
  const draftable = canSaveAsDraft(event?.status);

  const set = <K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  /** Update item i of a list field. */
  const setItem = <K extends 'phases' | 'matrix' | 'materials' | 'snacks' | 'exec'>(
    key: K, i: number, patch: Partial<ProposalForm[K][number]>,
  ) => setForm((f) => ({ ...f, [key]: (f[key] as object[]).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const removeItem = (key: 'phases' | 'matrix' | 'materials' | 'snacks' | 'exec' | 'outputs' | 'indicators', i: number) =>
    setForm((f) => ({ ...f, [key]: (f[key] as unknown[]).filter((_, j) => j !== i) }));
  const setMember = (g: number, m: number, patch: Partial<TwgMember>) => setForm((f) => ({
    ...f, twg: f.twg.map((grp, gi) => (gi !== g ? grp
      : { ...grp, members: grp.members.map((mem, mi) => (mi === m ? { ...mem, ...patch } : mem)) })),
  }));

  // ── Draft auto-save (leaving the page, logout, token expiry) ──
  const formRef = useRef(form);
  formRef.current = form;
  const initial = useRef(JSON.stringify(form));
  const persisted = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    const save = async () => {
      const f = formRef.current;
      // Only unsaved changes: opening and leaving a proposal must not demote it to a draft.
      if (persisted.current || !draftable || !f.title.trim() || JSON.stringify(f) === initial.current) return;
      persisted.current = true;
      const payload = { ...proposalPayload(f), status: 'draft' as const };
      try {
        if (event) await api.events.update(event.id, payload);
        else await api.events.create(payload);
        void queryClient.invalidateQueries({ queryKey: qk.allEvents });
      } catch {
        persisted.current = false; // a later trigger may retry
      }
    };
    const unregister = registerDraftSaver(save);
    const onUnload = () => void save();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', onUnload);
      // Navigating away. Deferred so a StrictMode/dependency re-run (which
      // remounts at once) doesn't count as leaving.
      alive.current = false;
      setTimeout(() => { if (!alive.current) void save(); }, 0);
    };
  }, [event, draftable, registerDraftSaver, queryClient]);

  // ── Target date: taken days + server conflict check ──
  const allEvents = useQuery({ queryKey: qk.events('all'), queryFn: () => api.events.list('all') });
  const taken = useMemo(() => new Set((allEvents.data ?? [])
    .filter((e) => e.id !== event?.id && (e.status === 'approved' || e.status === 'pending_approval'))
    .map((e) => parseEventDate(e.target_date)).filter((d): d is Date => !!d).map(isoDate)), [allEvents.data, event?.id]);

  useEffect(() => {
    const text = form.targetDate.trim();
    if (!text) return;
    let stale = false;
    setCheckingDate(true);
    api.events.checkDate(text, event?.id).then((r) => {
      if (stale) return;
      setDateIssue(r.available ? null : r.message);
      setDepedWarning(r.deped_warning);
    }).catch(() => { /* the server re-checks on submit */ })
      .finally(() => { if (!stale) setCheckingDate(false); });
    return () => { stale = true; };
  }, [form.targetDate, event?.id]);

  const submit = async (asDraft: boolean) => {
    if (!asDraft) {
      const issue = firstProposalIssue(form, dateIssue);
      if (issue) {
        notifyError(new Error(issue[1]));
        setStep(issue[0]);
        return;
      }
    }
    setSubmitting(true);
    const payload = { ...proposalPayload(form), status: asDraft ? 'draft' as const : 'pending_approval' as const };
    try {
      if (event) await api.events.update(event.id, payload);
      else await api.events.create(payload);
      persisted.current = true;
      notifySuccess(asDraft ? 'Saved as draft.' : editing ? 'Event updated successfully!' : 'Event proposal submitted for approval!');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.allEvents }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard }),
        event && queryClient.invalidateQueries({ queryKey: qk.event(event.id) }),
      ]);
      navigate('/events');
    } catch (e) {
      notifyError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const today = startOfDay(new Date());
  const pickedDate = parseEventDate(form.targetDate);
  const [pA, pB] = form.participants;
  const setPax = (i: 0 | 1, patch: Partial<typeof pA>) =>
    set('participants', form.participants.map((r, j) => (j === i ? { ...r, ...patch } : r)) as ProposalForm['participants']);

  const steps: ReactNode[] = [
    // ── 1. Proposal brief ──
    <Stack key="brief" gap="md">
      <SecTitle>I. PROPOSAL BRIEF</SecTitle>
      <TextInput label="a. Title" placeholder="Enter project title" value={form.title} onChange={(e) => set('title', e.currentTarget.value)} />
      <Radio.Group label="b. Nature of Activity" value={form.nature} onChange={(v) => set('nature', v)}>
        <Group gap="lg" mt={6}>{NATURES.map((n) => <Radio key={n} value={n} label={n} color="ink.8" />)}</Group>
      </Radio.Group>
      <Group grow align="flex-start">
        <div>
          <DatePickerInput label="c. Target Date" placeholder="Select target date"
            value={pickedDate ? isoDate(pickedDate) : null} minDate={today}
            excludeDate={(d) => taken.has(typeof d === 'string' ? d.slice(0, 10) : isoDate(new Date(d)))}
            onChange={(v) => v && set('targetDate', longDate(parseEventDate(v)!))}
            valueFormat="MMMM D, YYYY" error={dateIssue}
            description={checkingDate ? 'Checking the calendar...' : !dateIssue && form.targetDate ? 'No other event is scheduled on this date.' : 'Greyed-out days already have an event'} />
          {depedWarning && !checkingDate && (
            <Alert mt={8} p="xs" color="yellow" icon={<IconAlertTriangle size={18} />}>
              <Text size="xs" fw={600} c="#92400E">{depedWarning}</Text>
              <Text size="xs" c="#92400E">You can keep this date or choose one that doesn&apos;t conflict.</Text>
            </Alert>
          )}
        </div>
        <TextInput label="d. Proposed Venue" placeholder="e.g. NCS II Pavilion" value={form.venue} onChange={(e) => set('venue', e.currentTarget.value)} />
      </Group>
      <div>
        <Text size="sm" fw={500} mb={6}>e. Target Participants</Text>
        <Table withTableBorder verticalSpacing={6}>
          <Table.Thead bg="#F7F9FC"><Table.Tr><Table.Th /><Table.Th ta="center">MALE</Table.Th><Table.Th ta="center">FEMALE</Table.Th><Table.Th ta="center">TOTAL</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {([0, 1] as const).map((i) => (
              <Table.Tr key={i}>
                <Table.Td><TextInput variant="unstyled" placeholder="Category" value={form.participants[i].category}
                  onChange={(e) => setPax(i, { category: e.currentTarget.value })} aria-label={`Participant category ${i + 1}`} /></Table.Td>
                <Table.Td><NumberInput min={0} hideControls value={form.participants[i].male} onChange={(v) => setPax(i, { male: Number(v) || 0 })} aria-label="Male" /></Table.Td>
                <Table.Td><NumberInput min={0} hideControls value={form.participants[i].female} onChange={(v) => setPax(i, { female: Number(v) || 0 })} aria-label="Female" /></Table.Td>
                <Table.Td ta="center" fw={600}>{form.participants[i].male + form.participants[i].female}</Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr fw={700}>
              <Table.Td>TOTAL</Table.Td><Table.Td ta="center">{pA.male + pB.male}</Table.Td>
              <Table.Td ta="center">{pA.female + pB.female}</Table.Td><Table.Td ta="center">{pA.male + pA.female + pB.male + pB.female}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </div>
      <div>
        <Text size="sm" fw={500} mb={6}>f. Expected Outputs</Text>
        <Stack gap={8}>
          {form.outputs.map((o, i) => (
            <Group key={i} gap={6} wrap="nowrap">
              <Text size="sm" c="dimmed" w={20}>{i + 1}.</Text>
              <TextInput style={{ flex: 1 }} placeholder="Expected output..." value={o}
                onChange={(e) => set('outputs', form.outputs.map((x, j) => (j === i ? e.currentTarget.value : x)))} />
              {form.outputs.length > 1 && <RemoveButton onClick={() => removeItem('outputs', i)} />}
            </Group>
          ))}
        </Stack>
        <AddButton onClick={() => set('outputs', [...form.outputs, ''])}>Add output</AddButton>
      </div>
      <Group grow>
        <TextInput label="g. Proposed Budget (₱)" placeholder="e.g. 3,120.00" value={form.budget} onChange={(e) => set('budget', e.currentTarget.value)} />
        <TextInput label="h. Source of Fund" placeholder="e.g. School Paper Fund/SPTA Fund" value={form.fundSource} onChange={(e) => set('fundSource', e.currentTarget.value)} />
      </Group>
      <div>
        <Text size="sm" fw={500} mb={6}>i. Focal Person</Text>
        <Group grow>
          <TextInput placeholder="Full name" value={form.focalName} onChange={(e) => set('focalName', titleCase(e.currentTarget.value))} aria-label="Focal person name" />
          <TextInput placeholder="Designation" value={form.focalRole} onChange={(e) => set('focalRole', e.currentTarget.value)} aria-label="Focal person designation" />
          <TextInput placeholder="CP # / Contact" value={form.focalContact} onChange={(e) => set('focalContact', e.currentTarget.value)} aria-label="Focal person contact" />
        </Group>
      </div>
    </Stack>,

    // ── 2. Rationale & objectives ──
    <Stack key="rationale" gap="md">
      <SecTitle>II. RATIONALE</SecTitle>
      <Textarea autosize minRows={8} placeholder="Provide the rationale for this activity..." value={form.rationale}
        onChange={(e) => set('rationale', e.currentTarget.value)} onKeyDown={(e) => tabIndent(e, (v) => set('rationale', v))} />
      <SecTitle>III. OBJECTIVES</SecTitle>
      <Text size="sm" c="#4A5568">Enter each objective on a new line. They will be numbered automatically in the printed proposal.</Text>
      <Textarea autosize minRows={8} value={form.objectives}
        placeholder={'equip young journalists with the basics of writing...\nproduce various journalistic articles...\nchoose the campus journalists who will compete...'}
        onChange={(e) => set('objectives', e.currentTarget.value)} onKeyDown={(e) => tabIndent(e, (v) => set('objectives', v))} />
    </Stack>,

    // ── 3. Methodology ──
    <Stack key="method" gap="md">
      <SecTitle>IV. METHODOLOGY</SecTitle>
      <Text size="sm" c="#4A5568">The training shall be composed of lectures, video clip viewing, sharing and games. 5E&apos;s approach shall be utilized for most of the sessions.</Text>
      <EditTable head={['Phase', 'Stage', 'Activities']}>
        {form.phases.map((r, i) => (
          <Table.Tr key={i}>
            <Table.Td w={90} fw={700} style={{ verticalAlign: 'top', paddingTop: 16 }}>Phase {i + 1}</Table.Td>
            <Table.Td style={{ verticalAlign: 'top' }}><Textarea autosize minRows={1} value={r.stage} onChange={(e) => setItem('phases', i, { stage: e.currentTarget.value })} aria-label={`Phase ${i + 1} stage`} /></Table.Td>
            <Table.Td style={{ verticalAlign: 'top' }}><Textarea autosize minRows={2} value={r.activities} onChange={(e) => setItem('phases', i, { activities: e.currentTarget.value })} aria-label={`Phase ${i + 1} activities`} /></Table.Td>
            <Table.Td w={40}><RemoveButton onClick={() => removeItem('phases', i)} /></Table.Td>
          </Table.Tr>
        ))}
      </EditTable>
      <AddButton onClick={() => set('phases', [...form.phases, emptyPhase()])}>Add phase</AddButton>
    </Stack>,

    // ── 4. Activity matrix ──
    <Stack key="matrix" gap="md">
      <SecTitle>V. ACTIVITY MATRIX</SecTitle>
      <Text size="xs" c="dimmed">Write times as e.g. &quot;4:00-5:00 PM&quot; so attendance QR scans can open at the right time.</Text>
      <EditTable head={['Day', 'Time', 'Event', 'Speaker']}>
        {form.matrix.map((r, i) => (
          <Table.Tr key={i}>
            {(['day', 'time', 'event', 'speaker'] as const).map((k) => (
              <Table.Td key={k}>
                <TextInput value={r[k]} placeholder={{ day: 'Oct. 23, 2024', time: '4:00-5:00 PM', event: 'e.g. News Writing', speaker: 'Speaker name' }[k]}
                  onChange={(e) => setItem('matrix', i, { [k]: e.currentTarget.value })} aria-label={`Row ${i + 1} ${k}`} />
              </Table.Td>
            ))}
            <Table.Td w={40}><RemoveButton onClick={() => removeItem('matrix', i)} /></Table.Td>
          </Table.Tr>
        ))}
      </EditTable>
      <AddButton onClick={() => set('matrix', [...form.matrix, emptyMatrixRow()])}>Add row</AddButton>
    </Stack>,

    // ── 5. Budget + committees ──
    <Stack key="budget" gap="md">
      <SecTitle>VII. PROPOSED BUDGET</SecTitle>
      <Text size="sm" c="#4A5568">Charged against School Paper Fund/SPTA Fund subject to usual accounting and auditing rules.</Text>
      <Text fw={600} size="sm">a. Training Materials</Text>
      <EditTable head={['Particulars', 'Quantity', 'Cost', 'Total']}>
        {form.materials.map((r, i) => (
          <Table.Tr key={i}>
            {(['item', 'qty', 'cost', 'total'] as const).map((k) => (
              <Table.Td key={k}><TextInput value={r[k]} placeholder={{ item: 'Bond paper...', qty: '1 ream', cost: '270.00', total: '270.00' }[k]}
                onChange={(e) => setItem('materials', i, { [k]: e.currentTarget.value })} aria-label={`Material ${i + 1} ${k}`} /></Table.Td>
            ))}
            <Table.Td w={40}><RemoveButton onClick={() => removeItem('materials', i)} /></Table.Td>
          </Table.Tr>
        ))}
      </EditTable>
      <AddButton onClick={() => set('materials', [...form.materials, emptyMaterial()])}>Add item</AddButton>
      <Text fw={600} size="sm">b. Snacks for Program Partners</Text>
      <EditTable head={['Particulars', 'No. of Participants', 'Cost/pax', 'Total']}>
        {form.snacks.map((r, i) => (
          <Table.Tr key={i}>
            {(['item', 'pax', 'cost', 'total'] as const).map((k) => (
              <Table.Td key={k}><TextInput value={r[k]} placeholder={{ item: 'Meals', pax: '11 pax', cost: '100.00', total: '1100.00' }[k]}
                onChange={(e) => setItem('snacks', i, { [k]: e.currentTarget.value })} aria-label={`Snack ${i + 1} ${k}`} /></Table.Td>
            ))}
            <Table.Td w={40}><RemoveButton onClick={() => removeItem('snacks', i)} /></Table.Td>
          </Table.Tr>
        ))}
      </EditTable>
      <AddButton onClick={() => set('snacks', [...form.snacks, emptySnack()])}>Add item</AddButton>

      <SecTitle>VI. WORKING COMMITTEE</SecTitle>
      <Text fw={600} size="sm">a. Executive Committee</Text>
      <EditTable head={['Name', 'Position']}>
        {form.exec.map((r, i) => (
          <Table.Tr key={i}>
            <Table.Td><TextInput value={r.name} placeholder="e.g. FREDERICK M. BALDOZA" onChange={(e) => setItem('exec', i, { name: titleCase(e.currentTarget.value) })} aria-label={`Executive ${i + 1} name`} /></Table.Td>
            <Table.Td><TextInput value={r.position} placeholder="e.g. Principal" onChange={(e) => setItem('exec', i, { position: e.currentTarget.value })} aria-label={`Executive ${i + 1} position`} /></Table.Td>
            <Table.Td w={40}><RemoveButton onClick={() => removeItem('exec', i)} /></Table.Td>
          </Table.Tr>
        ))}
      </EditTable>
      <AddButton onClick={() => set('exec', [...form.exec, emptyExec()])}>Add member</AddButton>

      <Text fw={600} size="sm">b. Technical Working Group</Text>
      {form.twg.map((g, gi) => (
        <Stack key={gi} gap={10}>
          <Group gap={8} wrap="nowrap">
            <TextInput style={{ flex: 1 }} leftSection={<IconUsersGroup size={18} />} placeholder="e.g. Supervising Committee"
              value={g.title} fw={600} aria-label={`Group ${gi + 1} name`}
              onChange={(e) => set('twg', form.twg.map((x, j) => (j === gi ? { ...x, title: e.currentTarget.value } : x)))} />
            {form.twg.length > 1 && <RemoveButton onClick={() => set('twg', form.twg.filter((_, j) => j !== gi))} />}
          </Group>
          <EditTable head={['Name', 'Designation', 'Terms of Reference', 'Output', 'Automate Special Task']}>
            {g.members.map((m, mi) => (
              <Table.Tr key={mi}>
                <Table.Td style={{ verticalAlign: 'top' }}><Textarea autosize minRows={1} value={m.name} placeholder="Full name" onChange={(e) => setMember(gi, mi, { name: titleCase(e.currentTarget.value) })} aria-label="Member name" /></Table.Td>
                <Table.Td style={{ verticalAlign: 'top' }}><Textarea autosize minRows={1} value={m.designation} placeholder="e.g. Chairperson" onChange={(e) => setMember(gi, mi, { designation: e.currentTarget.value })} aria-label="Designation" /></Table.Td>
                <Table.Td style={{ verticalAlign: 'top' }}><Textarea autosize minRows={1} value={m.tor} placeholder="e.g. Leads the Committee" onChange={(e) => setMember(gi, mi, { tor: e.currentTarget.value })} aria-label="Terms of reference" /></Table.Td>
                <Table.Td style={{ verticalAlign: 'top' }}><Textarea autosize minRows={1} value={m.output} placeholder="e.g. Checked reports" onChange={(e) => setMember(gi, mi, { output: e.currentTarget.value })} aria-label="Output" /></Table.Td>
                <Table.Td w={140} ta="center" style={{ verticalAlign: 'top' }}>
                  <Checkbox mx="auto" w="fit-content" mt={8} color="ink.8" checked={m.automate} aria-label="Automate special task"
                    onChange={(e) => (e.currentTarget.checked ? setLinking({ g: gi, m: mi, repick: false }) : setMember(gi, mi, { automate: false }))} />
                  {m.automate && m.userName && (
                    <Anchor size="11px" mt={4} display="block" onClick={() => setLinking({ g: gi, m: mi, repick: true })}>Assign to {m.userName}</Anchor>
                  )}
                </Table.Td>
                <Table.Td w={40} style={{ verticalAlign: 'top' }}>
                  <RemoveButton onClick={() => set('twg', form.twg.map((x, j) => (j === gi ? { ...x, members: x.members.filter((_, k) => k !== mi) } : x)))} />
                </Table.Td>
              </Table.Tr>
            ))}
          </EditTable>
          <AddButton onClick={() => set('twg', form.twg.map((x, j) => (j === gi ? { ...x, members: [...x.members, emptyMember()] } : x)))}>Add member</AddButton>
        </Stack>
      ))}
      <AddButton onClick={() => set('twg', [...form.twg, { title: 'New Committee', members: [emptyMember()] }])}>Add Committee Group</AddButton>
    </Stack>,

    // ── 6. Monitoring & evaluation ──
    <Stack key="me" gap="md">
      <SecTitle>VIII. MONITORING AND EVALUATION</SecTitle>
      <Textarea label="Monitoring Instructions / Evaluation Criteria" autosize minRows={6}
        placeholder="Add specific monitoring instructions or evaluation criteria..." value={form.monitoring}
        onChange={(e) => set('monitoring', e.currentTarget.value)} onKeyDown={(e) => tabIndent(e, (v) => set('monitoring', v))} />
      <SecTitle>Observation Tool Indicators</SecTitle>
      <Text size="sm" c="#4A5568">List the indicators to be observed. The Evident / Not Evident columns will be filled in on the printed evaluation form.</Text>
      <Stack gap={8}>
        {form.indicators.map((ind, i) => (
          <Group key={i} gap={6} wrap="nowrap">
            <Text size="sm" c="dimmed" w={24}>{i + 1}.</Text>
            <TextInput style={{ flex: 1 }} placeholder="Describe what will be observed..." value={ind}
              onChange={(e) => set('indicators', form.indicators.map((x, j) => (j === i ? e.currentTarget.value : x)))} />
            {form.indicators.length > 1 && <RemoveButton onClick={() => removeItem('indicators', i)} />}
          </Group>
        ))}
      </Stack>
      <AddButton onClick={() => set('indicators', [...form.indicators, ''])}>Add indicator</AddButton>
      <SecTitle>Signatories</SecTitle>
      <Text size="sm" c="#4A5568">Enter the names and positions of the signatories. These will appear in the printed proposal.</Text>
      {form.signatories.map((s, i) => (
        <div key={s.role}>
          <Text size="xs" fw={600} c="#718096" mb={6}>{s.role}</Text>
          <Group grow>
            <TextInput placeholder="Full name (e.g. Juan D. Cruz)" value={s.name} aria-label={`${s.role} name`}
              onChange={(e) => set('signatories', form.signatories.map((x, j) => (j === i ? { ...x, name: titleCase(e.currentTarget.value) } : x)))} />
            <TextInput placeholder="Position/Title" value={s.title} aria-label={`${s.role} title`}
              onChange={(e) => set('signatories', form.signatories.map((x, j) => (j === i ? { ...x, title: e.currentTarget.value } : x)))} />
          </Group>
        </div>
      ))}
    </Stack>,
  ];

  const last = step === PROPOSAL_STEPS.length - 1;
  return (
    <Box maw={1240} mx="auto">
      <Group gap={8} mb="md">
        <ActionIcon variant="subtle" color="dark" size="lg" onClick={() => navigate('/events')} aria-label="Back"><IconArrowLeft /></ActionIcon>
        <Title order={2} fz={22}>{editing ? 'Edit Event' : 'Add New Event'}</Title>
      </Group>
      <Stepper active={step} onStepClick={setStep} color="ink.8" size="sm" allowNextStepsSelect mb="md">
        {PROPOSAL_STEPS.map((t) => <Stepper.Step key={t} label={t} />)}
      </Stepper>
      <Paper p={24} radius="lg">{steps[step]}</Paper>
      <Group justify="space-between" mt="md" p="md" style={{ background: '#E1EBF8', borderRadius: 12, border: '1px solid #ACC2DF' }}>
        {step > 0 ? <Button variant="default" w={120} onClick={() => setStep(step - 1)}>Back</Button> : <span />}
        <Group gap={12}>
          {draftable && <Button variant="outline" color="ink.8" w={140} disabled={submitting} onClick={() => void submit(true)}>Save as Draft</Button>}
          <Button color="ink.8" w={160} loading={submitting} onClick={() => (last ? void submit(false) : setStep(step + 1))}>
            {!last ? 'Next →' : editing ? 'Save Changes' : 'Submit Proposal'}
          </Button>
        </Group>
      </Group>
      {linking && (
        <UserLinkModal
          initialQuery={form.twg[linking.g].members[linking.m].name}
          repick={linking.repick}
          onClose={() => setLinking(null)}
          onPick={(u) => {
            const member = form.twg[linking.g].members[linking.m];
            setMember(linking.g, linking.m, { automate: true, userId: u.id, userName: u.full_name, name: member.name.trim() ? member.name : u.full_name });
            setLinking(null);
          }} />
      )}
    </Box>
  );
}

/**
 * Links a TWG member to a TaskNet user for the automated special task. An
 * exact, unique name match links right away (unless re-picking).
 */
function UserLinkModal({ initialQuery, repick, onClose, onPick }: {
  initialQuery: string; repick: boolean; onClose: () => void; onPick: (u: User) => void;
}) {
  const users = useQuery({ queryKey: ['users'], queryFn: api.users.list });
  const [q, setQ] = useState(initialQuery.trim());
  const typed = initialQuery.trim().toLowerCase();
  const exact = (users.data ?? []).filter((u) => u.full_name.trim().toLowerCase() === typed);
  useEffect(() => {
    if (!repick && typed && exact.length === 1) onPick(exact[0]);
  }, [repick, typed, exact, onPick]);
  if (users.isError) {
    return <Modal opened onClose={onClose} title="Assign special task to"><Text c="red" size="sm">Could not load TaskNet users. Please try again.</Text></Modal>;
  }
  const list = (users.data ?? []).filter((u) => !q.trim() || u.full_name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Modal opened onClose={onClose} title={<Text fw={700}>Assign special task to</Text>}>
      <TextInput placeholder="Search name" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} data-autofocus />
      <ScrollArea h={340} mt={8}>
        {users.isPending ? <Group justify="center" py="xl"><Loader /></Group>
          : !list.length ? <Text ta="center" c="dimmed" py="xl" size="sm">No matching users</Text>
            : list.map((u) => (
              <UnstyledButton key={u.id} onClick={() => onPick(u)} w="100%" py={8} px={4} className="tn-row" style={{ borderRadius: 8 }}>
                <Group gap={10} wrap="nowrap">
                  <UserAvatar name={u.full_name} size={28} />
                  <div><Text size="sm">{u.full_name}</Text><Text size="xs" c="dimmed">{roleLabel(u.role)}</Text></div>
                </Group>
              </UnstyledButton>
            ))}
      </ScrollArea>
    </Modal>
  );
}

function SecTitle({ children }: { children: ReactNode }) {
  return <Text fw={700} size="md" mt={4}>{children}</Text>;
}

function EditTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table withTableBorder verticalSpacing={6} style={{ borderRadius: 8 }}>
        <Table.Thead bg="#F7F9FC"><Table.Tr>{head.map((h) => <Table.Th key={h}>{h}</Table.Th>)}<Table.Th w={40} /></Table.Tr></Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button variant="subtle" size="compact-sm" leftSection={<IconPlus size={16} />} onClick={onClick} w="fit-content" c="#3B82F6">{children}</Button>;
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <ActionIcon variant="subtle" color="red" onClick={onClick} aria-label="Remove"><IconCircleMinus size={20} /></ActionIcon>;
}

