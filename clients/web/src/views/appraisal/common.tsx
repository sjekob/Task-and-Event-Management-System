import { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, RefreshCw, Star } from 'lucide-react';
import { statusChip } from '@shared/controllers/AppraisalControllers';
import { Bone, Button } from '../../ui/kit';

// Building blocks shared by the appraisal tabs.
export const TONE = { green: '#16a34a', orange: '#ea580c', red: '#ef4444', blue: '#3b82f6', yellow: '#ca8a04', text: 'var(--text)' };

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty">
      <AlertCircle size={48} color="var(--red)" />
      <div className="strong" style={{ fontSize: 16, color: 'var(--text)' }}>Failed to load data</div>
      <div className="body-md">{message}</div>
      <Button icon={<RefreshCw size={16} />} onClick={onRetry}>Retry</Button>
    </div>
  );
}

export const TabSkeleton = () => <div className="col gap-12"><div className="grid-3"><Bone h={96} r={12} /><Bone h={96} r={12} /><Bone h={96} r={12} /></div><Bone h={300} r={12} /></div>;

export function Stat({ value, label, sub, icon, color, bg, valueColor }: { value: string; label: string; sub?: string; icon: ReactNode; color: string; bg: string; valueColor?: string }) {
  return (
    <div className="ap-card row gap-12" style={{ padding: 20 }}>
      <div className="grow">
        <div style={{ fontSize: 28, fontWeight: 800, color: valueColor ?? 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
      </div>
      <span className="avatar" style={{ width: 42, height: 42, background: bg, color }}>{icon}</span>
    </div>
  );
}

/** Dropdown with an "All" entry that resets the filter. */
export function FilterDropdown({ icon, label, options, selected, onSelect }: { icon?: ReactNode; label: string; options: string[]; selected: string | null; onSelect: (v: string | null) => void }) {
  return (
    <label className="ap-filter">
      {icon}
      <select value={selected ?? ''} disabled={!options.length} onChange={(e) => onSelect(e.target.value || null)}>
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}

export function Chip({ status }: { status: string }) {
  const c = statusChip(status);
  return <span className="ap-chip" style={{ color: c.color, background: `${c.color}1f` }}>{c.icon && <CheckCircle2 size={12} />}{c.label}</span>;
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="row" style={{ gap: onChange ? 6 : 0 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} type="button" disabled={!onChange} onClick={() => onChange?.(v)} className="icon-btn-plain" style={{ padding: 0, cursor: onChange ? 'pointer' : 'default' }} aria-label={`${v} star${v > 1 ? 's' : ''}`}>
          <Star size={size} fill={v <= value ? '#fbbf24' : 'none'} color={v <= value ? '#fbbf24' : '#cbd5e1'} />
        </button>
      ))}
    </div>
  );
}

export function Mini({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="ap-card row gap-8" style={{ padding: 14 }}>
      <span style={{ color: 'var(--muted)', display: 'flex' }}>{icon}</span>
      <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div></div>
    </div>
  );
}
