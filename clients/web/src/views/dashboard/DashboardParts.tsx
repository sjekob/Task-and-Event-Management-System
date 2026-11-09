import { ArrowRight, CalendarDays, ChevronRight } from 'lucide-react';
import { Tone } from '@shared/controllers/DashboardController';
import { Format } from '@shared/utils/format';
import { Bone } from '../../ui/kit';

// KPI tiles, section cards and row pieces of the dashboard.
export const TONES: Record<Tone, { fg: string; bg: string }> = {
  red: { fg: '#b91c1c', bg: 'var(--red-bg)' },
  amber: { fg: '#b45309', bg: 'var(--amber-bg)' },
  blue: { fg: 'var(--accent)', bg: 'var(--blue-bg)' },
  gray: { fg: 'var(--muted)', bg: 'var(--surface-3)' },
  green: { fg: '#16a34a', bg: 'var(--green-bg)' },
};

export const DOT: Record<Tone, string> = { red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--accent)', gray: 'var(--light)', green: 'var(--green)' };

export function Kpi({ value, label, caption, icon, tone, alert, onClick }: {
  value: number; label: string; caption: string; icon: React.ReactNode; tone: Tone; alert?: boolean; onClick: () => void;
}) {
  const t = TONES[tone];
  return (
    <button className="dash-card dash-kpi" onClick={onClick}>
      <span className="dash-kpi-icon" style={{ background: t.bg, color: t.fg }}>{icon}</span>
      <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
        <span className="row gap-8" style={{ alignItems: 'baseline' }}>
          <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, color: alert ? t.fg : 'var(--text)' }}>{value}</span>
          <span className="ellipsis" style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        </span>
        <span className="caption ellipsis" style={{ display: 'block' }}>{caption}</span>
      </span>
      <ChevronRight size={20} color="var(--light)" />
    </button>
  );
}

export function Section({ icon, title, count, action, onAction, empty, footer, children }: {
  icon: React.ReactNode; title: string; count: number; action: string; onAction: () => void;
  empty?: { icon: React.ReactNode; text: string }; footer?: string; children?: React.ReactNode;
}) {
  return (
    <div className="dash-card" style={{ padding: 0 }}>
      <div className="row" style={{ padding: '14px 10px 12px 18px' }}>
        <span className="dash-sec-icon">{icon}</span>
        <div className="row grow gap-8" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          {count > 0 && <span className="dash-count">{count}</span>}
        </div>
        <button className="btn ghost sm dash-action" onClick={onAction}>{action}<ArrowRight size={16} /></button>
      </div>
      <hr className="divider" style={{ margin: 0 }} />
      {empty ? (
        <div className="row gap-12" style={{ padding: '20px 18px', color: 'var(--light)' }}>
          {empty.icon}<span className="body-md">{empty.text}</span>
        </div>
      ) : <div className="dash-rows">{children}</div>}
      {footer && <div className="caption" style={{ padding: '4px 18px 14px' }}>{footer}</div>}
    </div>
  );
}

export function Row({ leading, title, meta, trailing, onClick }: {
  leading: React.ReactNode; title: string; meta: string; trailing: React.ReactNode; onClick: () => void;
}) {
  return (
    <button className="dash-row" onClick={onClick}>
      {leading}
      <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
        <span className="ellipsis" style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{title}</span>
        {meta && <span className="caption ellipsis" style={{ display: 'block' }}>{meta}</span>}
      </span>
      {trailing}
    </button>
  );
}

export function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return <span className="badge" style={{ background: t.bg, color: t.fg, fontSize: 12 }}>{children}</span>;
}

export function StatusDot({ tone }: { tone: Tone }) {
  const c = DOT[tone];
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 0 3px color-mix(in srgb, ${c} 25%, transparent)`, flexShrink: 0 }} />;
}

export function MiniProgress({ done, total }: { done: number; total: number }) {
  const complete = done >= total;
  return (
    <span style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: complete ? '#16a34a' : 'var(--muted)' }}>{done}/{total} submitted</span>
      <span className="progress" style={{ width: '100%', background: 'var(--tint)' }}>
        <span style={{ display: 'block', height: '100%', borderRadius: 6, width: `${total ? (done / total) * 100 : 0}%`, background: complete ? 'var(--green)' : 'var(--accent)' }} />
      </span>
    </span>
  );
}

export function DateTile({ date, compact }: { date: Date | null; compact?: boolean }) {
  const size = compact ? 38 : 44;
  return (
    <span className="dash-date" style={{ width: size, height: size }}>
      {date ? (
        <>
          <span style={{ fontSize: compact ? 9 : 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.4, lineHeight: 1.1 }}>
            {Format.months[date.getMonth()].toUpperCase()}
          </span>
          <span style={{ fontSize: compact ? 14 : 16, fontWeight: 800, lineHeight: 1.15 }}>{date.getDate()}</span>
        </>
      ) : <CalendarDays size={18} color="var(--muted)" />}
    </span>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="col gap-16">
      <Bone h={96} r={14} />
      <div className="grid-3"><Bone h={78} r={14} /><Bone h={78} r={14} /><Bone h={78} r={14} /></div>
      <div className="dash-grid">
        <div className="col gap-16"><Bone h={220} r={14} /><Bone h={160} r={14} /></div>
        <Bone h={380} r={14} />
      </div>
    </div>
  );
}
