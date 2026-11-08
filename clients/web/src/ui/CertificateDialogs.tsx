import { BadgeCheck, ExternalLink } from 'lucide-react';
import { CertificateResultController, CertificateReviewController } from '@shared/controllers/CertificateControllers';
import { CertificateFile } from '@shared/models';
import { useServices } from '../app/AppContext';
import { useScreenController } from '../app/hooks';
import { Button, Field, Modal, Select, TextArea } from './kit';
import { CredibilityBadge } from './CredibilityBadge';
import { AuthenticityBanner, Checks, Facts } from './CertificateParts';

// Upload result (confirm / discard) and review (verify / reject) dialogs.
/** What was read from a fresh upload; "Add to my profile" or "Discard". */
export function CertificateResultDialog({ cert, onClose }: { cert: CertificateFile; onClose: (added: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new CertificateResultController(services, cert), [cert.id]);
  return (
    <Modal title="Certificate read" subtitle={cert.originalName} onClose={() => onClose(false)} locked={s.busy}
      footer={
        <>
          <Button variant="ghost-danger" disabled={s.busy} onClick={async () => { await c.discard(); onClose(false); }}>Discard</Button>
          <Button variant="primary" disabled={!c.canAdd} loading={s.busy} onClick={async () => { if (await c.add()) onClose(true); }}>Add to my profile</Button>
        </>
      }>
      <AuthenticityBanner cert={cert} />
      <Facts facts={c.facts} />
      <Field label={cert.certificationId === null ? 'Which certification is this?' : 'Not right? Change it'}>
        <Select value={s.selectedId ?? ''} disabled={s.busy} onChange={(e) => c.select(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose…</option>
          {s.catalog.map((x) => <option key={x.id} value={x.id}>{x.issuer ? `${x.name} · ${x.issuer}` : x.name}</option>)}
        </Select>
      </Field>
      <Checks checks={cert.checks} />
      {s.error && <div className="body-sm" style={{ color: 'var(--red)' }}>{s.error}</div>}
    </Modal>
  );
}

/** A certificate on a profile; the principal/registrar verifies or rejects it. */
export function CertificateDetailDialog({ cert, canReview, onClose }: { cert: CertificateFile; canReview: boolean; onClose: (changed: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new CertificateReviewController(services, cert, canReview), [cert.id]);
  const open = async () => {
    const win = window.open('', '_blank');
    try {
      const blob = await c.file();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      win?.close();
    }
  };
  const decide = async (st: 'verified' | 'rejected') => { if (await c.decide(st)) onClose(true); };
  return (
    <Modal title={cert.title ?? 'Certificate'} subtitle={cert.originalName} onClose={() => onClose(false)}
      icon={<span style={{ order: 2 }}><CredibilityBadge credibility={cert.status} authenticity={cert.authenticity} /></span>}
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>Close</Button>
          {canReview && cert.status !== 'rejected' && <Button variant="outline-muted" style={{ color: 'var(--red)' }} disabled={s.busy} onClick={() => void decide('rejected')}>Reject</Button>}
          {canReview && cert.status !== 'verified' && <Button variant="success" icon={<BadgeCheck size={16} />} loading={s.busy} onClick={() => void decide('verified')}>Verify</Button>}
        </>
      }>
      <AuthenticityBanner cert={cert} />
      <Facts facts={c.facts} />
      <Button variant="outline" size="sm" icon={<ExternalLink size={16} />} disabled={s.opening} onClick={() => void open()}>
        {s.opening ? 'Opening…' : 'View certificate file'}
      </Button>
      <Checks checks={cert.checks} />
      {canReview && (
        <Field label="Note (required when rejecting)" className="mt-12">
          <TextArea rows={2} maxLength={500} value={s.note} onChange={(e) => c.setNote(e.target.value)} />
        </Field>
      )}
      {s.error && <div className="body-sm mt-8" style={{ color: 'var(--red)' }}>{s.error}</div>}
    </Modal>
  );
}
