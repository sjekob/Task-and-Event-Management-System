import { View } from 'react-native';
import { CertificateResultController, CertificateReviewController, CertificatesController } from '@shared/controllers/CertificateControllers';
import { CertificateCheck, CertificateFile } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, FeatherName, Field, Icon, Input, Modal, Row, Select, T, TONES } from '../../ui/kit';
import { openBlob } from '../../ui/files';
import { CredibilityBadge } from './AssignPicker';

// Upload result (confirm / discard) and review (verify / reject) dialogs, with the authenticity checks.
const BANNER_ICON: Record<string, FeatherName> = { copy: 'copy', ok: 'shield', shield: 'alert-octagon', maybe: 'help-circle' };
const CHECK: Record<string, [FeatherName, string]> = { green: ['check-circle', C.green], amber: ['alert-triangle', C.amber], red: ['x-circle', C.red], gray: ['info', C.muted] };

function AuthenticityBanner({ cert }: { cert: CertificateFile }) {
  const b = CertificatesController.authenticityBanner(cert);
  const t = TONES[b.tone];
  return (
    <Row gap={10} style={{ alignItems: 'flex-start', backgroundColor: t.bg, borderRadius: 10, padding: 12 }}>
      <Icon name={BANNER_ICON[b.icon] ?? 'shield'} size={21} color={t.fg} />
      <View style={{ flex: 1 }}><T weight={700} color={t.fg}>{b.title}</T><T size={12.5} color={C.text2}>{b.text}</T></View>
    </Row>
  );
}

function Facts({ facts }: { facts: { label: string; value: string }[] }) {
  return <View style={{ gap: 6 }}>{facts.map((f) => <Row key={f.label} gap={10} style={{ alignItems: 'flex-start' }}><T size={12} color={C.muted} style={{ width: 96 }}>{f.label}</T><T size={13.5} style={{ flex: 1 }}>{f.value}</T></Row>)}</View>;
}

function Checks({ checks }: { checks: CertificateCheck[] }) {
  return (
    <View style={{ gap: 8 }}>
      <T weight={600}>Authenticity checks</T>
      {checks.map((k) => {
        const [icon, color] = CHECK[CertificatesController.checkTone(k)];
        return (
          <Row key={k.key} gap={8} style={{ alignItems: 'flex-start' }}>
            <Icon name={icon} size={16} color={color} />
            <View style={{ flex: 1 }}><T size={13} weight={500}>{k.label}</T><T size={12} color={C.muted}>{k.detail}</T></View>
          </Row>
        );
      })}
    </View>
  );
}

/** What was read from a fresh upload; "Add to my profile" or "Discard". */
export function CertificateResultDialog({ cert, onClose }: { cert: CertificateFile; onClose: (added: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new CertificateResultController(services, cert), [cert.id]);
  return (
    <Modal title="Certificate read" subtitle={cert.originalName ?? undefined} locked={s.busy} onClose={() => onClose(false)}
      footer={<>
        <Button variant="ghost-danger" disabled={s.busy} onPress={async () => { await c.discard(); onClose(false); }}>Discard</Button>
        <Button variant="primary" disabled={!c.canAdd} loading={s.busy} onPress={async () => { if (await c.add()) onClose(true); }}>Add to my profile</Button>
      </>}>
      <AuthenticityBanner cert={cert} />
      <Facts facts={c.facts} />
      <Field label={cert.certificationId === null ? 'Which certification is this?' : 'Not right? Change it'}>
        <Select<number | null> value={s.selectedId} placeholder="Choose…" disabled={s.busy}
          options={s.catalog.map((x) => ({ value: x.id, label: x.name, hint: x.issuer ?? undefined }))} onChange={(v) => c.select(v)} />
      </Field>
      <Checks checks={cert.checks} />
      {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
    </Modal>
  );
}

/** A certificate on a profile; the principal/registrar verifies or rejects it. */
export function CertificateDetailDialog({ cert, canReview, onClose }: { cert: CertificateFile; canReview: boolean; onClose: (changed: boolean) => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new CertificateReviewController(services, cert, canReview), [cert.id]);
  const open = async () => {
    try { await openBlob(await c.file(), cert.originalName ?? 'certificate'); } catch (e) { fb.error(e); }
  };
  const decide = async (st: 'verified' | 'rejected') => { if (await c.decide(st)) onClose(true); };
  return (
    <Modal title={cert.title ?? 'Certificate'} subtitle={<CredibilityBadge credibility={cert.status} authenticity={cert.authenticity} />} onClose={() => onClose(false)}
      footer={<>
        <Button variant="ghost" onPress={() => onClose(false)}>Close</Button>
        {canReview && cert.status !== 'rejected' && <Button variant="outline-muted" disabled={s.busy} onPress={() => void decide('rejected')}><T weight={600} color={C.red}>Reject</T></Button>}
        {canReview && cert.status !== 'verified' && <Button variant="success" icon="check-circle" loading={s.busy} onPress={() => void decide('verified')}>Verify</Button>}
      </>}>
      <AuthenticityBanner cert={cert} />
      <Facts facts={c.facts} />
      <Button variant="outline" size="sm" icon="external-link" loading={s.opening} style={{ alignSelf: 'flex-start' }} onPress={() => void open()}>View certificate file</Button>
      <Checks checks={cert.checks} />
      {canReview && <Field label="Note (required when rejecting)"><Input multiline rows={2} maxLength={500} value={s.note} onChangeText={(v) => c.setNote(v)} /></Field>}
      {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
    </Modal>
  );
}
