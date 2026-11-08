import { AlertTriangle, CheckCircle2, Copy, Info, ShieldAlert, ShieldCheck, ShieldQuestion, XCircle } from 'lucide-react';
import { CertificatesController } from '@shared/controllers/CertificateControllers';
import { CertificateCheck, CertificateFile } from '@shared/models';

// Authenticity banner, facts and automated checks of a certificate.
export const BANNER = {
  green: ['#15803d', 'var(--green-bg)'], amber: ['#b45309', 'var(--amber-bg)'], red: ['var(--red)', 'var(--red-bg)'],
} as const;

export const BANNER_ICON = { copy: Copy, ok: ShieldCheck, shield: ShieldAlert, maybe: ShieldQuestion };

export function AuthenticityBanner({ cert }: { cert: CertificateFile }) {
  const b = CertificatesController.authenticityBanner(cert);
  const [fg, bg] = BANNER[b.tone];
  const Icon = BANNER_ICON[b.icon];
  return (
    <div className="row-top gap-12" style={{ background: bg, borderRadius: 10, padding: 12 }}>
      <Icon size={22} color={fg} style={{ flexShrink: 0 }} />
      <div><div className="label" style={{ color: fg }}>{b.title}</div><div className="body-sm" style={{ color: 'var(--text-2)' }}>{b.text}</div></div>
    </div>
  );
}

export function Facts({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <div className="mt-16">
      {facts.map((f) => (
        <div key={f.label} className="row-top gap-12" style={{ marginBottom: 10 }}>
          <span className="caption" style={{ width: 100, flexShrink: 0 }}>{f.label}</span>
          <span className="body-md" style={{ color: 'var(--text)' }}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

export const CHECK = { green: [CheckCircle2, 'var(--green)'], amber: [AlertTriangle, 'var(--amber)'], red: [XCircle, 'var(--red)'], gray: [Info, 'var(--muted)'] } as const;

export function Checks({ checks }: { checks: CertificateCheck[] }) {
  return (
    <div className="mt-16">
      <div className="label mb-8">Authenticity checks</div>
      {checks.map((k) => {
        const [Icon, color] = CHECK[CertificatesController.checkTone(k)];
        return (
          <div key={k.key} className="row-top gap-8" style={{ marginBottom: 8 }}>
            <Icon size={17} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><div style={{ fontSize: 13, fontWeight: 500 }}>{k.label}</div><div className="body-sm" style={{ color: 'var(--muted)' }}>{k.detail}</div></div>
          </div>
        );
      })}
    </div>
  );
}
