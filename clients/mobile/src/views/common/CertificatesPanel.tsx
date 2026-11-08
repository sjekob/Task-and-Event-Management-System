import { useState } from 'react';
import { View } from 'react-native';
import { CertificatesController } from '@shared/controllers/CertificateControllers';
import { CertificateFile } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Icon, IconButton, IconTile, Loading, Row, T } from '../../ui/kit';
import { pickFile } from '../../ui/files';
import { CredibilityBadge } from './AssignPicker';
import { CertificateDetailDialog, CertificateResultDialog } from './CertificateDialogs';

const CERT_TYPES = ['application/pdf', 'image/*'];

/** A person's certificates. userId null = the signed-in person's own. */
export function CertificatesPanel({ userId = null, canUpload = false, canReview = false, onChanged }: {
  userId?: number | null; canUpload?: boolean; canReview?: boolean; onChanged?: () => void;
}) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new CertificatesController(services, userId, canUpload, canReview, onChanged), [userId, canUpload, canReview]);
  const [result, setResult] = useState<CertificateFile | null>(null);
  const [detail, setDetail] = useState<CertificateFile | null>(null);

  const upload = async () => {
    const f = await pickFile(CERT_TYPES);
    if (!f) return;
    try { setResult(await c.upload(f)); } catch (e) { fb.error(e); }
  };
  const remove = async (cert: CertificateFile) => {
    const ok = await fb.confirm({ title: 'Remove certificate?', message: `Remove "${cert.title ?? cert.originalName ?? 'this certificate'}" from your profile?`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    try { await c.remove(cert); } catch (e) { fb.error(e); }
  };
  const set = s.set;

  return (
    <View style={{ gap: 10 }}>
      <T size={12.5} color={C.muted}>{c.intro}</T>
      {canUpload && <Button icon="upload" loading={s.uploading} style={{ alignSelf: 'flex-start' }} onPress={() => void upload()}>{s.uploading ? 'Reading…' : 'Upload certificate'}</Button>}
      {s.error ? <T size={13} color={C.red}>{s.error}</T>
        : !set ? <Loading />
        : set.isEmpty ? <Row gap={10} style={{ backgroundColor: C.surface2, borderRadius: 10, padding: 12 }}><Icon name="award" size={19} color={C.muted} /><T size={13} color={C.text2} style={{ flex: 1 }}>{c.emptyText}</T></Row>
        : (
          <View style={{ gap: 8 }}>
            {canUpload && set.pending.map((p) => <CertTile key={`p${p.id}`} cert={p} actionLabel="Finish adding" onOpen={() => setResult(p)} onRemove={() => void remove(p)} />)}
            {set.certificates.map((x) => (
              <CertTile key={`c${x.id ?? x.title}`} cert={x} actionLabel={x.id ? c.actionLabel(x) : undefined}
                onOpen={x.id ? () => setDetail(x) : undefined} onRemove={canUpload && x.id ? () => void remove(x) : undefined} />
            ))}
          </View>
        )}
      {result && (
        <CertificateResultDialog cert={result} onClose={(added) => {
          setResult(null);
          c.changed();
          if (added) fb.toast('Certificate added. The principal or registrar will verify it.', 'success');
        }} />
      )}
      {detail && <CertificateDetailDialog cert={detail} canReview={canReview} onClose={(changed) => { setDetail(null); if (changed) c.changed(); }} />}
    </View>
  );
}

function CertTile({ cert, actionLabel, onOpen, onRemove }: { cert: CertificateFile; actionLabel?: string; onOpen?: () => void; onRemove?: () => void }) {
  const sub = CertificatesController.subtitle(cert);
  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 }}>
      <IconTile name="file-text" tone="gray" size={36} />
      <View style={{ flex: 1, gap: 4 }}>
        <T weight={600}>{CertificatesController.displayTitle(cert)}</T>
        <CredibilityBadge credibility={cert.status} authenticity={cert.authenticity} />
        {sub ? <T size={12} color={C.muted}>{sub}</T> : null}
        {cert.description ? <T size={12} color={C.muted}>{cert.description}</T> : null}
        {cert.status === 'rejected' && cert.reviewNote ? <T size={12} color={C.red}>Reason: {cert.reviewNote}</T> : null}
        {onOpen && actionLabel ? <Button variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={onOpen}>{actionLabel}</Button> : null}
      </View>
      {onRemove && <IconButton name="trash-2" size={18} label="Remove" color={C.muted} onPress={onRemove} />}
    </View>
  );
}
