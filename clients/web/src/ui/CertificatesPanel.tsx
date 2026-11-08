import { useState } from 'react';
import { FileText, Award, Trash2, Upload } from 'lucide-react';
import { CERT_EXTENSIONS, CertificatesController } from '@shared/controllers/CertificateControllers';
import { CertificateFile } from '@shared/models';
import { useServices } from '../app/AppContext';
import { useScreenController } from '../app/hooks';
import { useFeedback } from './feedback';
import { Button, Spinner, pickFiles } from './kit';
import { CredibilityBadge } from './CredibilityBadge';
import { CertificateDetailDialog, CertificateResultDialog } from './CertificateDialogs';

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
    const [f] = await pickFiles(CERT_EXTENSIONS.map((e) => `.${e}`).join(','));
    if (!f) return;
    try {
      setResult(await c.upload({ name: f.name, type: f.type, blob: f, size: f.size }));
    } catch (e) {
      fb.error(e);
    }
  };
  const remove = async (cert: CertificateFile) => {
    const ok = await fb.confirm({
      title: 'Remove certificate?', message: `Remove "${cert.title ?? cert.originalName ?? 'this certificate'}" from your profile?`,
      confirmLabel: 'Remove', danger: true,
    });
    if (!ok) return;
    try { await c.remove(cert); } catch (e) { fb.error(e); }
  };

  const set = s.set;
  return (
    <div className="col gap-12">
      <div className="row-top gap-12">
        <div className="body-sm grow" style={{ color: 'var(--muted)' }}>{c.intro}</div>
        {canUpload && (
          <Button icon={s.uploading ? <Spinner small light /> : <Upload size={16} />} disabled={s.uploading} onClick={() => void upload()}>
            {s.uploading ? 'Reading…' : 'Upload certificate'}
          </Button>
        )}
      </div>
      {s.error ? <div className="body-sm" style={{ color: 'var(--red)' }}>{s.error}</div>
        : !set ? <div className="center-fill" style={{ padding: 12 }}><Spinner /></div>
        : set.isEmpty ? (
          <div className="panel row gap-12"><Award size={20} color="var(--muted)" /><span className="body-md">{c.emptyText}</span></div>
        ) : (
          <div>
            {canUpload && set.pending.map((p) => (
              <CertTile key={`p${p.id}`} cert={p} actionLabel="Finish adding" onOpen={() => setResult(p)} onRemove={() => void remove(p)} />
            ))}
            {set.certificates.map((x) => (
              <CertTile key={`c${x.id ?? x.title}`} cert={x} actionLabel={x.id ? c.actionLabel(x) : undefined}
                onOpen={x.id ? () => setDetail(x) : undefined} onRemove={canUpload && x.id ? () => void remove(x) : undefined} />
            ))}
          </div>
        )}
      {result && (
        <CertificateResultDialog cert={result} onClose={(added) => {
          setResult(null);
          c.changed();
          if (added) fb.toast('Certificate added. The principal or registrar will verify it.');
        }} />
      )}
      {detail && <CertificateDetailDialog cert={detail} canReview={canReview} onClose={(changed) => { setDetail(null); if (changed) c.changed(); }} />}
    </div>
  );
}

function CertTile({ cert, actionLabel, onOpen, onRemove }: { cert: CertificateFile; actionLabel?: string; onOpen?: () => void; onRemove?: () => void }) {
  const sub = CertificatesController.subtitle(cert);
  return (
    <div className="row-top gap-12" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 6px 12px 14px', marginBottom: 8, flexWrap: 'wrap' }}>
      <span className="att-icon" style={{ width: 36, height: 36, background: '#eef2fa', color: 'var(--dark)' }}><FileText size={18} /></span>
      <div className="grow" style={{ minWidth: 180 }}>
        <div className="row wrap gap-8">
          <span className="label">{CertificatesController.displayTitle(cert)}</span>
          <CredibilityBadge credibility={cert.status} authenticity={cert.authenticity} />
        </div>
        {sub && <div className="body-sm mt-4">{sub}</div>}
        {cert.description && <div className="caption mt-4">{cert.description}</div>}
        {cert.status === 'rejected' && cert.reviewNote && <div className="caption mt-4" style={{ color: 'var(--red)' }}>Reason: {cert.reviewNote}</div>}
      </div>
      <div className="row gap-4" style={{ marginLeft: 'auto' }}>
        {onOpen && actionLabel && <Button variant="ghost" size="sm" onClick={onOpen}>{actionLabel}</Button>}
        {onRemove && <button className="icon-btn sm" title="Remove" onClick={onRemove}><Trash2 size={18} /></button>}
      </div>
    </div>
  );
}

export { CertificateDetailDialog, CertificateResultDialog } from './CertificateDialogs';
