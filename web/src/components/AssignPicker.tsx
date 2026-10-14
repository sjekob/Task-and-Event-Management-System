import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Badge, Box, Button, Checkbox, Group, Loader, Modal, ScrollArea, Stack, Text, TextInput, Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle, IconBan, IconBolt, IconCertificate, IconCircleCheck, IconDots, IconHourglassHigh,
  IconRosetteDiscountCheck, IconSearch, IconSparkles,
} from '@tabler/icons-react';
import {
  autoSelect, certsFor, describeCredibility, fitBreakdown, fitScore, fitTone, isHighBurden, roleLabel,
  suggestionSummary, TONES, whySentence, type AssigneeSuggestion, type Tone, type User,
} from '@tasknet/shared';
import { notifyError, UserAvatar } from './ui';
import { colors } from '../theme';

function Pill({ tone, children, icon }: { tone: Tone; children: ReactNode; icon?: ReactNode }) {
  const t = TONES[tone];
  return (
    <Badge radius={6} tt="none" fw={600} size="sm" leftSection={icon} style={{ background: t.bg, color: t.fg }}>
      {children}
    </Badge>
  );
}

const CRED_ICONS = {
  verified: IconRosetteDiscountCheck, pending: IconHourglassHigh, doubtful: IconAlertTriangle,
  rejected: IconBan, unconfirmed: IconDots,
};

export function CredibilityBadge({ credibility, authenticity, compact }: {
  credibility?: string; authenticity?: string | null; compact?: boolean;
}) {
  const d = describeCredibility(credibility, authenticity);
  const Icon = CRED_ICONS[d.kind];
  const t = TONES[d.tone];
  return (
    <Tooltip label={d.hint}>
      <Badge radius={6} tt="none" fw={700} size={compact ? 'xs' : 'sm'} leftSection={<Icon size={compact ? 11 : 13} />}
        style={{ background: t.bg, color: t.fg }}>
        {d.label}
      </Badge>
    </Tooltip>
  );
}

interface Props {
  opened: boolean;
  onClose: () => void;
  users: User[];
  selected: number[];
  /** "Done" mode: hand the selection back to the form. */
  onChange?: (ids: number[]) => void;
  /** "Assign" mode: assign right away (e.g. on an existing task). */
  onConfirm?: (ids: number[]) => Promise<void>;
  /** ranked suggestions (best fit first), when available */
  suggestions?: AssigneeSuggestion[];
  suggestionsLoading?: boolean;
  /** false when the task has no title/subject/instructions yet */
  hasTaskText?: boolean;
  title?: string;
  /** extra controls under the title, e.g. the "Assign as" selector */
  header?: ReactNode;
}

/**
 * Personnel picker used when assigning a task. With suggestions, people are
 * ranked by a fit score out of 100 (competency 60 + workload 30 + life
 * context 10), each row explains why, and heavily loaded people are flagged.
 */
export function AssignPicker({
  opened, onClose, users, selected, onChange, onConfirm, suggestions, suggestionsLoading = false,
  hasTaskText = true, title = 'Select Personnel', header,
}: Props) {
  const [local, setLocal] = useState<Set<number>>(() => new Set(selected));
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const ranked = useMemo(() => new Map((suggestions ?? []).map((s) => [s.id, s])), [suggestions]);
  const ordered = useMemo(() => {
    if (!ranked.size) return users;
    const byId = new Map(users.map((u) => [u.id, u]));
    return [...[...ranked.keys()].filter((id) => byId.has(id)).map((id) => byId.get(id)!),
      ...users.filter((u) => !ranked.has(u.id))];
  }, [users, ranked]);

  const q = search.trim().toLowerCase();
  const filtered = q ? ordered.filter((u) => {
    const s = ranked.get(u.id);
    return u.full_name.toLowerCase().includes(q)
      || (s?.skills ?? []).some((k) => k.toLowerCase().includes(q))
      || (s?.certifications ?? []).some((k) => k.toLowerCase().includes(q));
  }) : ordered;

  const toggle = (id: number) => setLocal((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const burdened = [...local].map((id) => ranked.get(id)).filter((s): s is AssigneeSuggestion => !!s && isHighBurden(s));
  const topId = suggestions?.[0]?.id;

  const confirm = async () => {
    if (!onConfirm) {
      onChange?.([...local]);
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onConfirm([...local]);
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} size={600} title={<Text fw={600}>{title}</Text>}
      styles={{ body: { paddingBottom: 12 } }}>
      <Stack gap="sm">
        {header}
        {suggestions !== undefined || suggestionsLoading ? (
          <Group wrap="nowrap" gap={8} p="xs" style={{ background: colors.blueBg, borderRadius: 10 }}>
            <IconSparkles size={16} color={colors.accent} style={{ flexShrink: 0 }} />
            <Text size="xs" style={{ flex: 1 }}>
              {suggestionSummary({ loading: suggestionsLoading, hasTaskText, ranked: suggestions ?? [] })}
            </Text>
            {suggestionsLoading ? <Loader size={16} /> : !!suggestions?.length && (
              <Tooltip label={suggestions.some((s) => s.is_match)
                ? 'Select everyone whose profile matches, skipping high-burden people'
                : 'Select the top-ranked person without a high burden'}>
                <Button size="compact-sm" variant="subtle" leftSection={<IconBolt size={16} />}
                  onClick={() => setLocal((prev) => new Set([...prev, ...autoSelect(suggestions)]))}>
                  Auto-select
                </Button>
              </Tooltip>
            )}
          </Group>
        ) : null}
        <TextInput placeholder="Search by name or skill..." leftSection={<IconSearch size={16} />}
          value={search} onChange={(e) => setSearch(e.currentTarget.value)} />

        <ScrollArea.Autosize mah="52vh" offsetScrollbars>
          {filtered.length === 0 ? <Text ta="center" c="dimmed" py="xl" size="sm">No personnel found</Text>
            : filtered.map((u) => {
              const s = ranked.get(u.id);
              const checked = local.has(u.id);
              const score = s ? fitScore(s) : 0;
              return (
                <Box key={u.id} onClick={() => toggle(u.id)} py={10} px={4}
                  style={{ borderBottom: '1px solid var(--tn-border)', cursor: 'pointer' }}>
                  <Group wrap="nowrap" align="flex-start" gap="sm">
                    <UserAvatar name={u.full_name} size={36} />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={6}>
                        <Text size="sm" fw={500}>{u.full_name}</Text>
                        {s && <Pill tone={fitTone(score)}>Fit {score}/100</Pill>}
                        {s?.is_match && (u.id === topId
                          ? <Pill tone="green">Best fit</Pill> : <Pill tone="blue">Match</Pill>)}
                        {s && s.burden !== 'low' && (
                          <Tooltip label={s.load_factors.join(' · ') || 'Workload'}>
                            {isHighBurden(s)
                              ? <span><Pill tone="red" icon={<IconAlertTriangle size={12} />}>High burden</Pill></span>
                              : <span><Pill tone="amber">Moderate load</Pill></span>}
                          </Tooltip>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">{roleLabel(u.role)}{u.grade_level ? ` · ${u.grade_level}` : ''}</Text>
                      {s && (
                        <Box mt={6} p={8} style={{
                          background: colors.bg, borderRadius: 8,
                          border: `1px solid ${isHighBurden(s) ? 'rgba(239,68,68,0.35)' : colors.border}`,
                        }}>
                          <Text size="11px" fw={700}>{fitBreakdown(s)}</Text>
                          <Text size="xs" c="dimmed" mt={4}>{whySentence(s)}</Text>
                          {certsFor(s).length > 0 && (
                            <Group gap={4} mt={6}>
                              {certsFor(s).map(({ cert, matched }) => (
                                <Tooltip key={cert.name} label={[cert.issuer_acronym ?? cert.issuer, cert.category,
                                  matched && 'fits this task'].filter(Boolean).join(' · ') || cert.name}>
                                  <Group gap={3} wrap="nowrap" px={6} py={2} style={{
                                    background: 'white', borderRadius: 7,
                                    border: `1px solid ${matched ? 'rgba(34,197,94,0.6)' : colors.border}`,
                                  }}>
                                    <IconCertificate size={12} color={matched ? colors.green : colors.textMuted} />
                                    <Text size="11px" fw={600} truncate maw={160}>{cert.name}</Text>
                                    <CredibilityBadge credibility={cert.credibility} authenticity={cert.authenticity} compact />
                                  </Group>
                                </Tooltip>
                              ))}
                            </Group>
                          )}
                        </Box>
                      )}
                    </Box>
                    <Checkbox checked={checked} onChange={() => toggle(u.id)} onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${u.full_name}`} mt={8} />
                  </Group>
                </Box>
              );
            })}
        </ScrollArea.Autosize>

        {burdened.length > 0 && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} p="sm"
            title={burdened.length === 1 ? `High burden: ${burdened[0].full_name}` : `High burden: ${burdened.length} selected people`}>
            {burdened.map((p) => (
              <Text key={p.id} size="xs">{burdened.length > 1 ? `${p.full_name}: ` : ''}{p.load_factors.join(', ')}</Text>
            ))}
            <Text size="xs" mt={2}>Consider someone with a lighter load, or keep them if this task needs them.</Text>
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button color="ink.8" loading={busy} disabled={!!onConfirm && local.size === 0}
            leftSection={<IconCircleCheck size={16} />} onClick={() => void confirm()}>
            {onConfirm ? `Assign${local.size ? ` (${local.size})` : ''}` : `Done (${local.size})`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** "Assign as" choice. Renders nothing when there is only one option. */
export function AssignRoleSelector({ options, value, onChange }: {
  options: string[]; value: string | null; onChange: (role: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <Group gap={8}>
      {options.map((r) => (
        <Button key={r} size="sm" variant={r === value ? 'filled' : 'default'} color="ink.8"
          onClick={() => onChange(r)} aria-pressed={r === value}>
          {roleLabel(r)}
        </Button>
      ))}
    </Group>
  );
}
