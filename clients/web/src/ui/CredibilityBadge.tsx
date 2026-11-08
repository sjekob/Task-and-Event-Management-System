import { Ban, BadgeCheck, Hourglass, MoreHorizontal, ShieldAlert } from 'lucide-react';
import { describeCredibility } from '@shared/controllers/AssignPickerController';

const TONE = {
  green: { fg: '#15803d', bg: 'var(--green-bg)' },
  blue: { fg: 'var(--accent)', bg: 'var(--blue-bg)' },
  amber: { fg: '#b45309', bg: 'var(--amber-bg)' },
  red: { fg: 'var(--red)', bg: 'var(--red-bg)' },
  gray: { fg: 'var(--muted)', bg: '#f3f4f6' },
};
const ICON = { verified: BadgeCheck, pending: Hourglass, doubtful: ShieldAlert, rejected: Ban, more: MoreHorizontal };

/** Verified / Pending review / Pending · doubtful / Rejected. */
export function CredibilityBadge({ credibility, authenticity, compact }: {
  credibility: string; authenticity?: string | null; compact?: boolean;
}) {
  const d = describeCredibility(credibility, authenticity);
  const t = TONE[d.tone];
  const Icon = ICON[d.icon];
  return (
    <span title={d.hint} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 6, background: t.bg, color: t.fg,
      padding: compact ? '1px 5px' : '3px 8px', fontSize: compact ? 10.5 : 11.5, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <Icon size={compact ? 11 : 13} />{d.label}
    </span>
  );
}
