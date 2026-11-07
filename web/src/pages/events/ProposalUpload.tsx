import { useRef, useState, type DragEvent } from 'react';
import {
  Anchor, Badge, Box, Button, Checkbox, Collapse, FileButton, Group, Loader, Paper, Stack, Table, Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertTriangle, IconCheck, IconChevronDown, IconCircleCheck, IconCircleDashed, IconChevronUp, IconFileText, IconLink, IconPhoto, IconUpload, IconUsersGroup,
} from '@tabler/icons-react';
import {
  api, parseEventDate, startOfDay, type ProposalForm, type ProposalReading, type SavedReading, type TwgMember,
} from '@tasknet/shared';
import { notifyError } from '../../components/ui';

const ACCEPT = '.docx,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp';
const IMAGE = /\.(png|jpe?g|webp)$/i;

/** Wizard step for each section the reader reports (Working Committee lives in Budget). */
const STEP_OF: Record<string, number> = {
  'Proposal Brief': 0, 'Rationale & Objectives': 1, Methodology: 2, 'Activity Matrix': 3,
  Budget: 4, 'Working Committee': 4, 'Monitoring & Evaluation': 5,
};

const METHOD_LABEL: Record<string, string> = {
  docx: 'Word document', 'pdf-text': 'PDF', ocr: 'photo / scanned copy (OCR)',
};

/** "Upload the proposal" drop area shown before the wizard of a new proposal. */
export function ProposalDropArea({ onRead, onSkip }: {
  onRead: (reading: ProposalReading, files: string[]) => void;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const resetRef = useRef<() => void>(null);

  const read = async (files: File[]) => {
    if (!files.length) return;
    const images = files.filter((f) => IMAGE.test(f.name));
    if (files.length > 1 && images.length !== files.length) {
      notifyError(new Error('Upload one Word or PDF file, or several photos (one per page), not a mix.'));
      return;
    }
    // Page photos are read in file-name order (IMG_001, IMG_002 …).
    const ordered = files.length > 1 ? [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : files;
    setBusy(ordered.length > 1 ? `Reading ${ordered.length} page photos…` : `Reading ${ordered[0].name}…`);
    try {
      const reading = await api.events.readProposal(ordered.map((f) => ({ file: f, filename: f.name })));
      onRead(reading, ordered.map((f) => f.name));
    } catch (e) {
      notifyError(e, 'Could not read the proposal file');
    } finally {
      setBusy(null);
      resetRef.current?.();
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void read(Array.from(e.dataTransfer.files));
  };

  return (
    <Paper radius="lg" p={{ base: 16, sm: 24 }} mt="md">
      <Box
        className="tn-dropzone" data-over={over || undefined}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)} onDrop={onDrop}
      >
        {busy ? (
          <Stack align="center" gap={8} py="lg">
            <Loader color="ink.8" />
            <Text fw={600}>{busy}</Text>
            <Text size="xs" c="dimmed">Photos and scans take longer: each page is read with OCR.</Text>
          </Stack>
        ) : (
          <Stack align="center" gap={10} py="md">
            <ThemeIcon size={52} radius="xl" variant="light" color="blue"><IconUpload size={26} /></ThemeIcon>
            <Text fw={700} size="lg" ta="center">Upload your event proposal</Text>
            <Text size="sm" c="dimmed" ta="center" maw={520}>
              TaskNet reads the title, date, venue, schedule, budget and working committee from the file
              and fills in the proposal for you to check.
            </Text>
            <FileButton onChange={(f) => void read(f)} accept={ACCEPT} multiple resetRef={resetRef}>
              {(props) => <Button {...props} color="ink.8" leftSection={<IconFileText size={18} />}>Choose file</Button>}
            </FileButton>
            <Text size="xs" c="dimmed" ta="center">
              Word (.docx) or PDF works best. For a printed copy, select a photo of every page (PNG or JPG). Up to 15 MB each.
            </Text>
          </Stack>
        )}
      </Box>
      <Group justify="center" mt="sm">
        <Anchor size="sm" onClick={onSkip} c="dimmed">No file? Fill in the proposal by hand</Anchor>
      </Group>
    </Paper>
  );
}

/**
 * What was read from the file: sections found or missing (click to open that
 * step), warnings, and the committee members, where the proponent chooses
 * which special tasks to automate.
 */
export function ReadingSummary({ reading, form, onMember, onLink, onJump, onReplace }: {
  /** saved with the proposal, so a reopened draft shows the same panel */
  reading: SavedReading;
  form: ProposalForm;
  onMember: (g: number, m: number, patch: Partial<TwgMember>) => void;
  /** open the account picker; `automate` ticks the member once linked */
  onLink: (g: number, m: number, automate: boolean) => void;
  onJump: (step: number) => void;
  onReplace: () => void;
}) {
  const [open, setOpen] = useState(true);
  const found = reading.sections.filter((s) => s.found).length;
  const files = reading.files.length ? reading.files : ['the proposal file'];
  // Warnings about things the proponent can fix in the form are worked out from
  // the form as it is now, not as it was read (they'd go stale once fixed).
  const stale = /didn't match a TaskNet account|has already passed/i;
  const unlinked = form.twg.flatMap((g) => g.members).filter((m) => m.name.trim() && m.userId == null).map((m) => m.name);
  const target = parseEventDate(form.targetDate);
  const tableRef = useRef<HTMLDivElement>(null);
  const toCheck: { text: string; action?: { label: string; run: () => void } }[] = [
    ...(unlinked.length ? [{
      text: `${unlinked.length} committee member${unlinked.length === 1 ? ' has' : 's have'} no linked TaskNet account`,
      action: { label: 'Link accounts', run: () => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    }] : []),
    ...(target && target < startOfDay(new Date()) ? [{
      text: `The target date, ${form.targetDate}, has already passed`,
      action: { label: 'Change date', run: () => { setOpen(false); onJump(0); } },
    }] : []),
    ...reading.warnings.filter((w) => !stale.test(w)).map((text) => ({ text })),
    ...reading.notes.map((text) => ({ text })),
  ];
  const missing = reading.sections.filter((x) => !x.found);
  const members = form.twg.flatMap((g, gi) => g.members.map((m, mi) => ({ g, gi, m, mi })))
    .filter(({ m }) => m.name.trim());
  const automated = members.filter(({ m }) => m.automate).length;
  const credited = members.filter(({ m }) => !m.automate && m.userId != null).length;
  const uncredited = members.filter(({ m }) => !m.automate && m.userId == null).length;

  return (
    <Paper radius="lg" p={{ base: 14, sm: 18 }} mt="md" withBorder className="tn-reading">
      <Group justify="space-between" gap="sm">
        <Group gap={10} wrap="nowrap" style={{ minWidth: 0, flex: '1 1 260px' }}>
          <ThemeIcon size={36} radius="md" variant="light" color={reading.method === 'ocr' ? 'orange' : 'green'}>
            {reading.method === 'ocr' ? <IconPhoto size={20} /> : <IconFileText size={20} />}
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text fw={700} size="sm" truncate title={files.join(', ')}>
              {files.length > 1 ? `${files.length} page photos` : files[0]}
            </Text>
            <Text size="xs" c="dimmed">
              Filled in from this {METHOD_LABEL[reading.method] ?? 'file'} · {found} of {reading.sections.length} sections found
            </Text>
          </div>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Button size="xs" variant="default" leftSection={<IconUpload size={14} />} onClick={onReplace}>Upload another</Button>
          <Button size="xs" variant="subtle" color="dark" onClick={() => setOpen((o) => !o)}
            rightSection={open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}>
            {open ? 'Hide' : 'Details'}
          </Button>
        </Group>
      </Group>

      <Collapse expanded={open}>
        <Stack gap="md" mt="md">
          <Box className="tn-reading-box">
            <Group gap={8} wrap="nowrap" align="flex-start" className="tn-reading-line">
              {missing.length
                ? <IconCircleDashed size={16} color="#94A3B8" style={{ flexShrink: 0, marginTop: 2 }} />
                : <IconCircleCheck size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />}
              <Text size="sm" style={{ flex: 1 }}>
                {missing.length ? (
                  <>
                    Not in the file:{' '}
                    {missing.map((x, i) => (
                      <span key={x.label}>
                        {i > 0 && ', '}
                        <Anchor size="sm" fw={600} onClick={() => { setOpen(false); onJump(STEP_OF[x.label] ?? 0); }}>{x.label}</Anchor>
                      </span>
                    ))}
                    <Text span size="sm" c="dimmed">{missing.length === 1 ? '. Fill it in by hand.' : '. Fill them in by hand.'}</Text>
                  </>
                ) : 'Every section of the proposal was found in the file.'}
              </Text>
            </Group>
            {toCheck.map((w) => (
              <Group key={w.text} gap={8} wrap="nowrap" align="flex-start" className="tn-reading-line">
                <IconAlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <Text size="sm" style={{ flex: 1 }}>{w.text}</Text>
                {w.action && <Anchor size="sm" fw={600} onClick={w.action.run} style={{ whiteSpace: 'nowrap' }}>{w.action.label}</Anchor>}
              </Group>
            ))}
          </Box>

          <div ref={tableRef} style={{ scrollMarginTop: 80 }}>
            <Text fw={700} size="sm">Working committee: choose the tasks to automate</Text>
            <Text size="xs" c="dimmed" mb={8}>
              Ticked members get a special task in TaskNet when the event is approved, rated after the event.
              Members you leave unticked get no task and are credited the top score (100/100) on approval.
            </Text>
            {members.length === 0 ? (
              <Text size="sm" c="dimmed">
                No committee members were found in the file. <Anchor size="sm" onClick={() => onJump(4)}>Add them in the Budget step</Anchor>.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={820}>
                <Table withTableBorder fz="sm" className="tn-committee-table" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 84 }} />
                    <col style={{ width: '24%' }} />
                    <col />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: 190 }} />
                  </colgroup>
                  <Table.Thead bg="#F7F9FC">
                    <Table.Tr>
                      <Table.Th ta="center">Automate</Table.Th>
                      <Table.Th>Member</Table.Th>
                      <Table.Th>Terms of Reference</Table.Th>
                      <Table.Th>Output (task title)</Table.Th>
                      <Table.Th>Result on approval</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {form.twg.map((g, gi) => {
                      const rows = g.members.map((m, mi) => ({ m, mi })).filter(({ m }) => m.name.trim());
                      if (!rows.length) return null;
                      return [
                        <Table.Tr key={`g${gi}`} className="tn-committee-group">
                          <Table.Td colSpan={5}>
                            <Group gap={8} wrap="nowrap">
                              <IconUsersGroup size={16} color="#64748B" />
                              <Text size="sm" fw={700} truncate>{g.title || 'Committee'}</Text>
                              <Text size="xs" c="dimmed">· {rows.length} member{rows.length === 1 ? '' : 's'}</Text>
                            </Group>
                          </Table.Td>
                        </Table.Tr>,
                        ...rows.map(({ m, mi }) => (
                          <Table.Tr key={`${gi}-${mi}`}>
                            <Table.Td ta="center">
                              <Checkbox mx="auto" w="fit-content" mt={2} color="ink.8" checked={m.automate}
                                aria-label={`Automate a special task for ${m.name}`}
                                onChange={(e) => (e.currentTarget.checked
                                  ? (m.userId == null ? onLink(gi, mi, true) : onMember(gi, mi, { automate: true }))
                                  : onMember(gi, mi, { automate: false }))} />
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={600} lh={1.35}>{m.name}</Text>
                              {m.designation && <Text size="xs" c="dimmed" mt={2}>{m.designation}</Text>}
                            </Table.Td>
                            <Table.Td>
                              {m.tor
                                ? <Text size="sm" lh={1.45} className="tn-prewrap" lineClamp={4} title={m.tor}>{m.tor}</Text>
                                : <Text size="sm" c="dimmed">Not stated</Text>}
                            </Table.Td>
                            <Table.Td>
                              {m.output
                                ? <Text size="sm" lh={1.45} lineClamp={3} title={m.output}>{m.output}</Text>
                                : <Text size="sm" c="dimmed">Not stated</Text>}
                            </Table.Td>
                            <Table.Td>
                              <Badge size="sm" radius="sm" tt="none" fw={600} variant="light"
                                color={m.automate ? 'blue' : m.userId != null ? 'green' : 'red'}>
                                {m.automate ? 'Special task' : m.userId != null ? 'Top score' : 'Needs account'}
                              </Badge>
                              <Box mt={6}><MemberAccount member={m} onLink={() => onLink(gi, mi, false)} /></Box>
                            </Table.Td>
                          </Table.Tr>
                        )),
                      ];
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
            {members.length > 0 && (
              <Text size="xs" c="dimmed" mt={6}>
                {automated} to automate · {credited} top score
                {uncredited ? ` · ${uncredited} need${uncredited === 1 ? 's' : ''} a linked account to be credited` : ''}
              </Text>
            )}
          </div>

          <Group justify="flex-end">
            <Button size="sm" color="ink.8" onClick={() => { setOpen(false); onJump(0); }}>Review the proposal →</Button>
          </Group>
        </Stack>
      </Collapse>
    </Paper>
  );
}

/** The member's linked TaskNet account, or a prompt to link one. */
export function MemberAccount({ member, onLink }: { member: TwgMember; onLink: () => void }) {
  if (member.userId != null) {
    return (
      <Group gap={4} wrap="nowrap">
        <IconCheck size={14} color="#16A34A" />
        <Text size="xs" truncate maw={150}>{member.userName}</Text>
        <Anchor size="xs" onClick={onLink}>change</Anchor>
      </Group>
    );
  }
  return (
    <Anchor size="xs" onClick={onLink} c="red.7">
      <Group gap={4} wrap="nowrap" component="span"><IconLink size={13} />Link account</Group>
    </Anchor>
  );
}

