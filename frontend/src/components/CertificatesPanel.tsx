import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  CertificateCheck,
  CertificateFile,
  CertificateSet,
  CertificationCatalogItem,
} from '../models/models';
import { ApiService, errorMessage } from '../services/apiService';
import { AppTheme, TextStyles, ts, tsField } from '../theme/appTheme';
import { openBlob, pickFile } from '../utils/files';
import { Icon, IconName } from './ui/Icon';
import { ElevatedButton, IconButton, OutlinedButton, TextButton } from './ui/buttons';
import { DropdownField, InputDecoration, TextField } from './ui/inputs';
import { CircularProgressIndicator, Tooltip } from './ui/misc';
import { AlertDialog, Dialog, showDialog, showSnackBar } from './ui/overlay';

interface Credibility {
  label: string;
  hint: string;
  icon: IconName;
  fg: string;
  bg: string;
}

export function describeCredibility(credibility: string, authenticity: string | null): Credibility {
  switch (credibility) {
    case 'verified':
      return {
        label: 'Verified',
        hint: 'Certificate checked and verified by the principal/registrar',
        icon: 'verified',
        fg: '#15803D',
        bg: AppTheme.greenBg,
      };
    case 'submitted': {
      const strength =
        authenticity === 'high'
          ? 'passed the automated checks'
          : authenticity === 'medium' ? 'passed some automated checks' : 'failed some automated checks';
      const low = authenticity !== 'high' && authenticity !== 'medium';
      return {
        label: low ? 'Pending · doubtful' : 'Pending review',
        hint: `Certificate uploaded and ${strength}; not yet verified`,
        icon: low ? 'report_gmailerrorred' : 'hourglass_top',
        fg: low ? '#B45309' : AppTheme.accentBlue,
        bg: low ? AppTheme.amberBg : AppTheme.blueBg,
      };
    }
    case 'rejected':
      return {
        label: 'Rejected',
        hint: 'The certificate was rejected on review',
        icon: 'block',
        fg: AppTheme.redColor,
        bg: AppTheme.redBg,
      };
    default: // pending
      return {
        label: 'Not added yet',
        hint: 'Uploaded but not yet confirmed by its owner',
        icon: 'more_horiz',
        fg: AppTheme.textMuted,
        bg: '#F3F4F6',
      };
  }
}

/// How credible a held certification is, as a small colored badge:
/// verified by the principal/registrar, uploaded and awaiting review (shaded by
/// how well the file passed the automated checks), rejected, or not yet
/// confirmed by its owner. The same wording is used in task suggestions.
export function CredibilityBadge({ credibility, authenticity = null, compact = false }: {
  credibility: string;
  authenticity?: string | null;
  compact?: boolean;
}) {
  const d = describeCredibility(credibility, authenticity);
  return (
    <Tooltip message={d.hint}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: compact ? 5 : 8,
          paddingVertical: compact ? 1 : 3,
          backgroundColor: d.bg,
          borderRadius: 6,
        }}
      >
        <Icon name={d.icon} size={compact ? 11 : 13} color={d.fg} />
        <View style={{ width: 3 }} />
        <Text style={ts({ size: compact ? 10.5 : 11.5, weight: 700, color: d.fg })}>{d.label}</Text>
      </View>
    </Tooltip>
  );
}

function toast(text: string, error = false) {
  showSnackBar(text, { backgroundColor: error ? AppTheme.redColor : undefined });
}

function confirm(title: string, body: string, action: string): Promise<boolean> {
  return showDialog<boolean>((pop) => (
    <AlertDialog
      title={<Text style={TextStyles.heading3}>{title}</Text>}
      content={<Text style={TextStyles.bodyMd}>{body}</Text>}
      actions={
        <>
          <TextButton onPress={() => pop(false)}>Cancel</TextButton>
          <TextButton onPress={() => pop(true)} foregroundColor={AppTheme.redColor}>{action}</TextButton>
        </>
      }
    />
  )).then((v) => v ?? false);
}

interface CertificatesPanelProps {
  /// null means the signed-in person.
  userId?: number | null;
  canUpload?: boolean;
  canReview?: boolean;
  onChanged?: () => void;
}

/// A person's certifications with their credibility. The owner uploads
/// certificates here ([canUpload]); the principal/registrar verifies or
/// rejects them ([canReview]).
export function CertificatesPanel({ userId = null, canUpload = false, canReview = false, onChanged }: CertificatesPanelProps) {
  const [set, setSet] = useState<CertificateSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const s = await ApiService.getCertificates(userId);
      if (mounted.current) {
        setSet(s);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const showResult = async (cert: CertificateFile) => {
    const added = await showDialog<boolean>((pop) => <CertificateResultDialog certificate={cert} pop={pop} />, {
      barrierDismissible: false,
    });
    if (added === true && mounted.current) {
      toast('Certificate added. The principal or registrar will verify it.');
    }
  };

  const upload = async () => {
    const file = await pickFile(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
    if (file == null) return;
    if ((file.size ?? 0) > 10 * 1024 * 1024) {
      toast('The file is larger than 10 MB.', true);
      return;
    }
    setUploading(true);
    try {
      const result = await ApiService.analyzeCertificate(file);
      if (!mounted.current) return;
      await showResult(result);
    } catch (e) {
      if (mounted.current) toast(errorMessage(e), true);
    } finally {
      if (mounted.current) setUploading(false);
      changed();
    }
  };

  const remove = async (c: CertificateFile) => {
    const ok = await confirm(
      'Remove certificate?',
      `Remove "${c.title ?? c.originalName ?? 'this certificate'}" from your profile?`,
      'Remove',
    );
    if (!ok) return;
    try {
      await ApiService.deleteCertificate(c.id!);
      changed();
    } catch (e) {
      toast(errorMessage(e), true);
    }
  };

  const review = async (c: CertificateFile) => {
    const updated = await showDialog<boolean>((pop) => (
      <CertificateDetailDialog certificate={c} canReview={canReview} pop={pop} />
    ));
    if (updated === true) changed();
  };

  const s = set;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[TextStyles.bodySm, { flex: 1 }]}>
          {canUpload
            ? 'Upload a PDF or photo of each certificate. It is read and checked automatically, ' +
              'then verified by the principal or registrar. Verified certificates count most ' +
              'when you are suggested for tasks.'
            : 'Certificates count toward task suggestions by how credible they are.'}
        </Text>
        {canUpload && (
          <>
            <View style={{ width: 12 }} />
            <ElevatedButton
              onPress={uploading ? null : upload}
              icon={
                uploading ? (
                  <CircularProgressIndicator size={14} strokeWidth={2} color="#FFFFFF" />
                ) : (
                  <Icon name="upload_file" size={16} color="#FFFFFF" />
                )
              }
            >
              {uploading ? 'Reading…' : 'Upload certificate'}
            </ElevatedButton>
          </>
        )}
      </View>
      <View style={{ height: 12 }} />
      {error != null ? (
        <Text style={[TextStyles.bodySm, { color: AppTheme.redColor }]}>{error}</Text>
      ) : s == null ? (
        <View style={{ padding: 12, alignItems: 'center' }}>
          <CircularProgressIndicator size={20} strokeWidth={2} />
        </View>
      ) : s.isEmpty ? (
        <View style={styles.empty}>
          <Icon name="workspace_premium_outlined" color={AppTheme.textMuted} />
          <View style={{ width: 10 }} />
          <Text style={[TextStyles.bodyMd, { flex: 1 }]}>
            {canUpload
              ? 'No certificates yet. Upload one to be suggested for matching tasks.'
              : 'No certificates on file.'}
          </Text>
        </View>
      ) : (
        <>
          {canUpload &&
            s.pending.map((p, i) => (
              <CertificateTile
                key={`p${p.id ?? i}`}
                cert={p}
                onOpen={() => showResult(p).then(() => changed())}
                actionLabel="Finish adding"
                onRemove={() => remove(p)}
              />
            ))}
          {s.certificates.map((c, i) => (
            <CertificateTile
              key={`c${c.id ?? i}`}
              cert={c}
              onOpen={() => review(c)}
              actionLabel={canReview && c.status === 'submitted' ? 'Review' : 'Details'}
              onRemove={canUpload ? () => remove(c) : undefined}
            />
          ))}
        </>
      )}
    </View>
  );
}

function CertificateTile({ cert: c, onOpen, actionLabel, onRemove }: {
  cert: CertificateFile;
  onOpen?: () => void;
  actionLabel?: string;
  onRemove?: () => void;
}) {
  const sub = [c.issuerLabel, c.category].filter((x): x is string => x != null).join(' · ');
  const narrow = useWindowDimensions().width < 600;
  const actions = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {onOpen != null && actionLabel != null && <TextButton onPress={onOpen}>{actionLabel}</TextButton>}
      {onRemove != null && (
        <IconButton
          tooltip="Remove"
          onPress={onRemove}
          size={18}
          icon={<Icon name="delete_outline" size={18} color={AppTheme.textMuted} />}
        />
      )}
    </View>
  );
  return (
    <View style={styles.tile}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={styles.tileIcon}>
          <Icon name="description_outlined" size={18} color={AppTheme.darkBanner} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 }}>
            <Text style={TextStyles.labelMd}>
              {c.title ?? c.detectedTitle ?? c.originalName ?? 'Unidentified certificate'}
            </Text>
            <CredibilityBadge credibility={c.status} authenticity={c.authenticity} />
          </View>
          {sub.length > 0 && (
            <>
              <View style={{ height: 2 }} />
              <Text style={TextStyles.bodySm}>{sub}</Text>
            </>
          )}
          {c.description.length > 0 && (
            <>
              <View style={{ height: 4 }} />
              <Text style={TextStyles.caption}>{c.description}</Text>
            </>
          )}
          {c.status === 'rejected' && c.reviewNote != null && (
            <>
              <View style={{ height: 4 }} />
              <Text style={[TextStyles.caption, { color: AppTheme.redColor }]}>{`Reason: ${c.reviewNote}`}</Text>
            </>
          )}
        </View>
        {!narrow && actions}
      </View>
      {narrow && <View style={{ alignItems: 'flex-end' }}>{actions}</View>}
    </View>
  );
}

/// The analysis of a freshly uploaded certificate: what it is, who issued it,
/// the automated authenticity checks, and a list to correct what it was read
/// as. "Add to my profile" confirms it; "Discard" deletes the upload.
/// Pops true when added.
export function CertificateResultDialog({ certificate: c, pop }: {
  certificate: CertificateFile;
  pop: (result?: boolean) => void;
}) {
  const [catalog, setCatalog] = useState<CertificationCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(c.certificationId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duplicate = c.checks.some((k) => k.key === 'duplicate' && k.status === 'fail');

  useEffect(() => {
    let mounted = true;
    ApiService.getCertificationCatalog()
      .then((list) => {
        if (mounted) setCatalog(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const sel = catalog.find((x) => x.id === selectedId) ?? null;

  const add = async () => {
    if (selectedId == null) return;
    setBusy(true);
    setError(null);
    try {
      await ApiService.confirmCertificate(c.id!, selectedId);
      pop(true);
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e));
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await ApiService.deleteCertificate(c.id!);
    } catch {}
    pop(false);
  };

  const title = sel?.name ?? c.title;
  const issuer = sel?.issuer ?? c.issuerLabel;
  const category = sel?.category ?? c.category;
  const description = sel != null ? sel.description : c.description;

  return (
    <DialogFrame
      title="Certificate read"
      subtitle={c.originalName}
      body={
        <>
          <AuthenticityBanner authenticity={c.authenticity} duplicate={duplicate} />
          <View style={{ height: 16 }} />
          <Fact label="Title" value={title ?? 'Not identified — choose it below'} />
          <Fact label="Issued by" value={issuer ?? 'Issuer not recognized'} />
          <Fact label="What it is" value={description.length > 0 ? description : '—'} />
          {category != null && <Fact label="Category" value={category} />}
          <View style={{ height: 8 }} />
          <DropdownField<number>
            isExpanded
            value={sel != null ? selectedId : null}
            decoration={inputDecoration(
              c.certificationId == null ? 'Which certification is this?' : 'Not right? Change it',
            )}
            textStyle={tsField({ size: 13, color: AppTheme.textPrimary })}
            items={catalog.map((x) => ({
              value: x.id,
              label: x.issuer != null ? `${x.name} · ${x.issuer}` : x.name,
            }))}
            onChanged={busy ? null : setSelectedId}
          />
          <View style={{ height: 18 }} />
          <Text style={TextStyles.labelMd}>Authenticity checks</Text>
          <View style={{ height: 8 }} />
          {c.checks.map((k, i) => (
            <CheckRow key={i} check={k} />
          ))}
          {error != null && (
            <>
              <View style={{ height: 8 }} />
              <Text style={[TextStyles.bodySm, { color: AppTheme.redColor }]}>{error}</Text>
            </>
          )}
        </>
      }
      actions={
        <>
          <TextButton onPress={busy ? null : discard} foregroundColor={AppTheme.redColor}>Discard</TextButton>
          <View style={{ width: 8 }} />
          <ElevatedButton onPress={busy || duplicate || selectedId == null ? null : add}>
            {busy ? <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" /> : 'Add to my profile'}
          </ElevatedButton>
        </>
      }
    />
  );
}

/// A certificate on someone's profile: what it is, its checks, the file, and —
/// for the principal/registrar — Verify / Reject. Pops true when reviewed.
export function CertificateDetailDialog({ certificate: c, canReview = false, pop }: {
  certificate: CertificateFile;
  canReview?: boolean;
  pop: (result?: boolean) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFile = async () => {
    setOpening(true);
    try {
      const blob = await ApiService.getCertificateBytes(c.id!);
      if (!openBlob(blob)) setError('Open the certificate file from the web app.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setOpening(false);
    }
  };

  const decide = async (status: string) => {
    if (status === 'rejected' && note.trim().length === 0) {
      setError('Give a reason so the owner knows what to fix.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ApiService.reviewCertificate(c.id!, status, note.trim());
      pop(true);
    } catch (e) {
      setBusy(false);
      setError(errorMessage(e));
    }
  };

  const reviewed = c.status === 'verified' || c.status === 'rejected';
  return (
    <DialogFrame
      title={c.title ?? 'Certificate'}
      subtitle={c.originalName}
      trailing={<CredibilityBadge credibility={c.status} authenticity={c.authenticity} />}
      body={
        <>
          <AuthenticityBanner
            authenticity={c.authenticity}
            duplicate={c.checks.some((k) => k.key === 'duplicate' && k.status === 'fail')}
          />
          <View style={{ height: 16 }} />
          <Fact label="Issued by" value={c.issuerLabel ?? 'Issuer not recognized'} />
          <Fact label="What it is" value={c.description.length > 0 ? c.description : '—'} />
          {c.category != null && <Fact label="Category" value={c.category} />}
          {reviewed && (
            <Fact
              label={c.status === 'verified' ? 'Verified by' : 'Rejected by'}
              value={[c.reviewedByName ?? '—', ...(c.reviewNote != null ? [`“${c.reviewNote}”`] : [])].join(' — ')}
            />
          )}
          <View style={{ alignItems: 'flex-start' }}>
            <OutlinedButton onPress={opening ? null : openFile} icon="open_in_new" iconSize={16}>
              {opening ? 'Opening…' : 'View certificate file'}
            </OutlinedButton>
          </View>
          <View style={{ height: 18 }} />
          <Text style={TextStyles.labelMd}>Authenticity checks</Text>
          <View style={{ height: 8 }} />
          {c.checks.map((k, i) => (
            <CheckRow key={i} check={k} />
          ))}
          {canReview && (
            <>
              <View style={{ height: 14 }} />
              <TextField
                value={note}
                onChangeText={setNote}
                maxLength={500}
                decoration={{ ...inputDecoration('Note (required when rejecting)'), counterText: `${note.length}/500` }}
                textStyle={tsField({ size: 13 })}
              />
            </>
          )}
          {error != null && <Text style={[TextStyles.bodySm, { color: AppTheme.redColor }]}>{error}</Text>}
        </>
      }
      actions={
        <>
          <TextButton onPress={() => pop(false)}>Close</TextButton>
          {canReview && (
            <>
              <View style={{ width: 8 }} />
              {c.status !== 'rejected' && (
                <OutlinedButton onPress={busy ? null : () => decide('rejected')} foregroundColor={AppTheme.redColor}>
                  Reject
                </OutlinedButton>
              )}
              {c.status !== 'verified' && (
                <>
                  <View style={{ width: 8 }} />
                  <ElevatedButton
                    onPress={busy ? null : () => decide('verified')}
                    icon="verified"
                    iconSize={16}
                    backgroundColor={AppTheme.greenColor}
                  >
                    Verify
                  </ElevatedButton>
                </>
              )}
            </>
          )}
        </>
      }
    />
  );
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

const inputDecoration = (label: string): InputDecoration => ({
  labelText: label,
  labelStyle: TextStyles.bodySm,
  contentPadding: [12, 10],
  radius: 8,
  borderColor: AppTheme.borderColor,
  borderWidth: 1,
  focusedBorderWidth: 1.5,
});

function DialogFrame({ title, subtitle, trailing, body, actions }: {
  title: string;
  subtitle?: string | null;
  trailing?: React.ReactNode;
  body: React.ReactNode;
  actions: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  return (
    <Dialog backgroundColor="#FFFFFF" radius={16}>
      <View
        style={{
          maxWidth: 600,
          maxHeight: height * 0.88,
          paddingLeft: 24,
          paddingTop: 22,
          paddingRight: 24,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={ts({ size: 19, weight: 700, color: AppTheme.textPrimary })}>{title}</Text>
            {subtitle != null && subtitle.length > 0 && (
              <Text numberOfLines={1} style={TextStyles.bodySm}>{subtitle}</Text>
            )}
          </View>
          {trailing != null && (
            <>
              <View style={{ width: 10 }} />
              {trailing}
            </>
          )}
        </View>
        <View style={{ height: 14 }} />
        <ScrollView style={{ flexShrink: 1, flexGrow: 0 }}>{body}</ScrollView>
        <View style={{ height: 24, justifyContent: 'center' }}>
          <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', rowGap: 8 }}>
          {actions}
        </View>
      </View>
    </Dialog>
  );
}

function AuthenticityBanner({ authenticity, duplicate = false }: { authenticity: string | null; duplicate?: boolean }) {
  const [icon, fg, bg, title, text]: [IconName, string, string, string, string] = duplicate
    ? [
        'content_copy',
        AppTheme.redColor,
        AppTheme.redBg,
        "Already on someone else's profile",
        "This exact file was uploaded by another person, so it can't be added.",
      ]
    : authenticity === 'high'
      ? [
          'verified_user_outlined',
          '#15803D',
          AppTheme.greenBg,
          'Looks authentic',
          'The certificate passed the automated checks. The principal or registrar still verifies it.',
        ]
      : authenticity === 'medium'
        ? [
            'shield_outlined',
            '#B45309',
            AppTheme.amberBg,
            'Partly confirmed',
            "Some details couldn't be confirmed automatically. Review the checks below.",
          ]
        : [
            'gpp_maybe_outlined',
            AppTheme.redColor,
            AppTheme.redBg,
            'Doubtful',
            'Several checks failed. It will count little until the principal or registrar verifies it.',
          ];
  return (
    <View style={{ padding: 12, backgroundColor: bg, borderRadius: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
      <Icon name={icon} color={fg} size={22} />
      <View style={{ width: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={[TextStyles.labelMd, { color: fg }]}>{title}</Text>
        <View style={{ height: 2 }} />
        <Text style={TextStyles.bodySm}>{text}</Text>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
      <Text style={[TextStyles.caption, { width: 100 }]}>{label}</Text>
      <Text style={[TextStyles.bodyMd, { color: AppTheme.textPrimary, flex: 1 }]}>{value}</Text>
    </View>
  );
}

function CheckRow({ check }: { check: CertificateCheck }) {
  const [icon, color]: [IconName, string] =
    check.status === 'pass'
      ? ['check_circle', AppTheme.greenColor]
      : check.status === 'warn'
        ? ['warning_amber_rounded', AppTheme.amberColor]
        : check.status === 'fail' ? ['cancel', AppTheme.redColor] : ['info_outline', AppTheme.textMuted];
  return (
    <View style={{ paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
      <Icon name={icon} size={17} color={color} />
      <View style={{ width: 8 }} />
      <View style={{ flex: 1 }}>
        <Text style={[TextStyles.labelMd, { fontSize: 13 }]}>{check.label}</Text>
        <Text style={TextStyles.bodySm}>{check.detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: AppTheme.bgColor,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.borderColor,
  },
  tile: {
    marginBottom: 8,
    paddingLeft: 14,
    paddingTop: 12,
    paddingRight: 6,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.borderColor,
  },
  tileIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#EEF2FA',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
