import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Box, Button, FileButton, Group, Loader, Modal, Select, Stack, Text, Textarea, ThemeIcon, Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconAlertTriangle, IconCircleCheckFilled, IconCircleXFilled, IconCopy, IconExternalLink, IconFileDescription,
  IconInfoCircle, IconRosetteDiscountCheck, IconShield, IconShieldCheck, IconShieldQuestion, IconTrash, IconUpload,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qk, type CertificateCheck, type CertificateFile } from '@tasknet/shared';
import { CredibilityBadge } from './AssignPicker';
import { notifyError, notifySuccess } from './ui';
import { colors } from '../theme';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * A person's certifications with their credibility. The owner uploads
 * certificates (canUpload); the principal/registrar verifies or rejects them
 * (canReview). userId omitted = the signed-in person.
 */
export function CertificatesPanel({ userId, canUpload = false, canReview = false, onChanged }: {
  userId?: number; canUpload?: boolean; canReview?: boolean; onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const set = useQuery({ queryKey: qk.certificates(userId), queryFn: () => api.certificates.list(userId) });
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CertificateFile | null>(null);
  const [detail, setDetail] = useState<CertificateFile | null>(null);

  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: qk.certificates(userId) });
    onChanged?.();
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return notifyError(new Error('The file is larger than 10 MB.'));
    setUploading(true);
    try {
      setResult(await api.certificates.analyze(file, file.name));
    } catch (e) {
      notifyError(e);
    } finally {
      setUploading(false);
      changed();
    }
  };

  const remove = (c: CertificateFile) => modals.openConfirmModal({
    title: 'Remove certificate?',
    children: <Text size="sm">Remove &quot;{c.title ?? c.original_name ?? 'this certificate'}&quot; from your profile?</Text>,
    labels: { confirm: 'Remove', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        await api.certificates.remove(c.id!);
        changed();
      } catch (e) {
        notifyError(e);
      }
    },
  });

  const s = set.data;
  return (
    <Stack gap="sm">
      <Group wrap="nowrap" align="center">
        <Text size="xs" c="dimmed" style={{ flex: 1 }}>
          {canUpload
            ? 'Upload a PDF or photo of each certificate. It is read and checked automatically, then verified by the principal or registrar. Verified certificates count most when you are suggested for tasks.'
            : 'Certificates count toward task suggestions by how credible they are.'}
        </Text>
        {canUpload && (
          <FileButton onChange={(f) => void upload(f)} accept="application/pdf,image/png,image/jpeg,image/webp">
            {(props) => (
              <Button {...props} color="ink.8" leftSection={<IconUpload size={16} />} loading={uploading}>
                {uploading ? 'Reading…' : 'Upload certificate'}
              </Button>
            )}
          </FileButton>
        )}
      </Group>
      {set.isError ? <Text size="xs" c="red">{(set.error as Error).message}</Text>
        : !s ? <Group justify="center" p={12}><Loader size="sm" /></Group>
          : !s.certificates.length && !s.pending.length ? (
            <Group wrap="nowrap" p={14} style={{ background: colors.bg, borderRadius: 10, border: `1px solid ${colors.border}` }}>
              <IconRosetteDiscountCheck color={colors.textMuted} />
              <Text size="sm" c="dimmed">{canUpload ? 'No certificates yet. Upload one to be suggested for matching tasks.' : 'No certificates on file.'}</Text>
            </Group>
          ) : (
            <>
              {canUpload && s.pending.map((p) => (
                <CertificateTile key={`p${p.id}`} cert={p} actionLabel="Finish adding" onOpen={() => setResult(p)} onRemove={() => remove(p)} />
              ))}
              {s.certificates.map((c) => (
                <CertificateTile key={c.id ?? c.title} cert={c} onOpen={c.id ? () => setDetail(c) : undefined}
                  actionLabel={canReview && c.status === 'submitted' ? 'Review' : 'Details'}
                  onRemove={canUpload && c.id ? () => remove(c) : undefined} />
              ))}
            </>
          )}
      {result && (
        <ResultModal cert={result} onClose={(added) => {
          setResult(null);
          changed();
          if (added) notifySuccess('Certificate added. The principal or registrar will verify it.');
        }} />
      )}
      {detail && <DetailModal cert={detail} canReview={canReview} onClose={(updated) => { setDetail(null); if (updated) changed(); }} />}
    </Stack>
  );
}

function CertificateTile({ cert: c, onOpen, actionLabel, onRemove }: {
  cert: CertificateFile; onOpen?: () => void; actionLabel?: string; onRemove?: () => void;
}) {
  const sub = [c.issuer ?? c.issuer_acronym, c.category].filter(Boolean).join(' · ');
  return (
    <Group wrap="nowrap" align="flex-start" p={12} pr={6} bg="white" style={{ borderRadius: 10, border: `1px solid ${colors.border}` }}>
      <ThemeIcon size={36} radius={8} style={{ background: '#EEF2FA', color: colors.dark }}><IconFileDescription size={18} /></ThemeIcon>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Group gap={8}>
          <Text size="sm" fw={500}>{c.title ?? c.detected_title ?? c.original_name ?? 'Unidentified certificate'}</Text>
          <CredibilityBadge credibility={c.status} authenticity={c.authenticity} />
        </Group>
        {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
        {c.description && <Text size="xs" c="dimmed" mt={4}>{c.description}</Text>}
        {c.status === 'rejected' && c.review_note && <Text size="xs" c="red" mt={4}>Reason: {c.review_note}</Text>}
      </Box>
      {onOpen && actionLabel && <Button variant="subtle" size="compact-sm" onClick={onOpen}>{actionLabel}</Button>}
      {onRemove && (
        <Tooltip label="Remove"><ActionIcon variant="subtle" color="gray" onClick={onRemove} aria-label="Remove certificate"><IconTrash size={18} /></ActionIcon></Tooltip>
      )}
    </Group>
  );
}

function AuthenticityBanner({ authenticity, duplicate }: { authenticity?: string | null; duplicate: boolean }) {
  const [Icon, fg, bg, title, text]: [typeof IconShield, string, string, string, string] = duplicate
    ? [IconCopy, colors.red, colors.redBg, "Already on someone else's profile", "This exact file was uploaded by another person, so it can't be added."]
    : authenticity === 'high'
      ? [IconShieldCheck, '#15803D', colors.greenBg, 'Looks authentic', 'The certificate passed the automated checks. The principal or registrar still verifies it.']
      : authenticity === 'medium'
        ? [IconShield, '#B45309', colors.amberBg, 'Partly confirmed', "Some details couldn't be confirmed automatically. Review the checks below."]
        : [IconShieldQuestion, colors.red, colors.redBg, 'Doubtful', 'Several checks failed. It will count little until the principal or registrar verifies it.'];
  return (
    <Group wrap="nowrap" align="flex-start" p={12} style={{ background: bg, borderRadius: 10 }}>
      <Icon size={22} color={fg} />
      <div><Text size="sm" fw={500} c={fg}>{title}</Text><Text size="xs" c="dimmed" mt={2}>{text}</Text></div>
    </Group>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Group wrap="nowrap" align="flex-start" mb={10}>
      <Text size="xs" c="dimmed" w={100} style={{ flexShrink: 0 }}>{label}</Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

function CheckRow({ check }: { check: CertificateCheck }) {
  const [Icon, color] = check.status === 'pass' ? [IconCircleCheckFilled, colors.green]
    : check.status === 'warn' ? [IconAlertTriangle, colors.amber]
      : check.status === 'fail' ? [IconCircleXFilled, colors.red] : [IconInfoCircle, colors.textMuted];
  return (
    <Group wrap="nowrap" align="flex-start" gap={8} mb={8}>
      <Icon size={17} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div><Text size="sm" fw={500}>{check.label}</Text><Text size="xs" c="dimmed">{check.detail}</Text></div>
    </Group>
  );
}

const isDuplicate = (c: CertificateFile) => c.checks.some((k) => k.key === 'duplicate' && k.status === 'fail');

/**
 * A freshly uploaded certificate: what it was read as, the automated checks,
 * and a list to correct it. "Add to my profile" confirms; "Discard" deletes.
 */
function ResultModal({ cert: c, onClose }: { cert: CertificateFile; onClose: (added: boolean) => void }) {
  const catalog = useQuery({ queryKey: qk.certificationCatalog, queryFn: api.certificates.catalog });
  const [selectedId, setSelectedId] = useState<string | null>(c.certification_id ? String(c.certification_id) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sel = catalog.data?.find((x) => String(x.id) === selectedId);
  const duplicate = isDuplicate(c);
  const description = sel ? sel.description ?? '' : c.description ?? '';

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.certificates.confirm(c.id!, Number(selectedId));
      onClose(true);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Could not add the certificate');
    }
  };
  const discard = async () => {
    setBusy(true);
    try {
      await api.certificates.remove(c.id!);
    } catch { /* already gone */ }
    onClose(false);
  };

  return (
    <Modal opened onClose={() => onClose(false)} closeOnClickOutside={false} size={600}
      title={<div><Text fw={700} size="lg">Certificate read</Text>{c.original_name && <Text size="xs" c="dimmed">{c.original_name}</Text>}</div>}>
      <Stack gap="sm">
        <AuthenticityBanner authenticity={c.authenticity} duplicate={duplicate} />
        <Box mt={6}>
          <Fact label="Title" value={sel?.cert_name ?? c.title ?? 'Not identified — choose it below'} />
          <Fact label="Issued by" value={sel?.issuer_name ?? sel?.acronym ?? c.issuer ?? c.issuer_acronym ?? 'Issuer not recognized'} />
          <Fact label="What it is" value={description || '—'} />
          {(sel?.category_name ?? c.category) && <Fact label="Category" value={sel?.category_name ?? c.category} />}
        </Box>
        <Select searchable label={c.certification_id == null ? 'Which certification is this?' : 'Not right? Change it'}
          value={selectedId} onChange={setSelectedId} disabled={busy}
          data={(catalog.data ?? []).map((x) => ({ value: String(x.id), label: x.issuer_name || x.acronym ? `${x.cert_name} · ${x.issuer_name ?? x.acronym}` : x.cert_name }))} />
        <Text size="sm" fw={500} mt="sm">Authenticity checks</Text>
        {c.checks.map((k) => <CheckRow key={k.key} check={k} />)}
        {error && <Text size="xs" c="red">{error}</Text>}
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="red" disabled={busy} onClick={() => void discard()}>Discard</Button>
          <Button color="ink.8" loading={busy} disabled={duplicate || !selectedId} onClick={() => void add()}>Add to my profile</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** A certificate on someone's profile, with Verify / Reject for reviewers. */
function DetailModal({ cert: c, canReview, onClose }: { cert: CertificateFile; canReview: boolean; onClose: (updated: boolean) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewed = c.status === 'verified' || c.status === 'rejected';

  const openFile = async () => {
    setOpening(true);
    try {
      // The file needs the token, so fetch it and open a blob URL.
      const res = await api.certificates.file(c.id!);
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the certificate');
    } finally {
      setOpening(false);
    }
  };

  const decide = async (status: 'verified' | 'rejected') => {
    if (status === 'rejected' && !note.trim()) return setError('Give a reason so the owner knows what to fix.');
    setBusy(true);
    setError(null);
    try {
      await api.certificates.review(c.id!, status, note.trim());
      onClose(true);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Could not save the review');
    }
  };

  return (
    <Modal opened onClose={() => onClose(false)} size={600} title={(
      <Group gap="sm">
        <div><Text fw={700} size="lg">{c.title ?? 'Certificate'}</Text>{c.original_name && <Text size="xs" c="dimmed">{c.original_name}</Text>}</div>
        <CredibilityBadge credibility={c.status} authenticity={c.authenticity} />
      </Group>
    )}>
      <Stack gap="sm">
        <AuthenticityBanner authenticity={c.authenticity} duplicate={isDuplicate(c)} />
        <Box mt={6}>
          <Fact label="Issued by" value={c.issuer ?? c.issuer_acronym ?? 'Issuer not recognized'} />
          <Fact label="What it is" value={c.description || '—'} />
          {c.category && <Fact label="Category" value={c.category} />}
          {reviewed && <Fact label={c.status === 'verified' ? 'Verified by' : 'Rejected by'}
            value={[c.reviewed_by_name ?? '—', c.review_note && `“${c.review_note}”`].filter(Boolean).join(' — ')} />}
        </Box>
        <Button variant="default" w="fit-content" leftSection={<IconExternalLink size={16} />} loading={opening} onClick={() => void openFile()}>
          View certificate file
        </Button>
        <Text size="sm" fw={500} mt="sm">Authenticity checks</Text>
        {c.checks.map((k) => <CheckRow key={k.key} check={k} />)}
        {canReview && <Textarea label="Note (required when rejecting)" maxLength={500} value={note} onChange={(e) => setNote(e.currentTarget.value)} />}
        {error && <Text size="xs" c="red">{error}</Text>}
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={() => onClose(false)}>Close</Button>
          {canReview && c.status !== 'rejected' && <Button variant="outline" color="red" disabled={busy} onClick={() => void decide('rejected')}>Reject</Button>}
          {canReview && c.status !== 'verified' && (
            <Button color="green" leftSection={<IconRosetteDiscountCheck size={16} />} loading={busy} onClick={() => void decide('verified')}>Verify</Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
