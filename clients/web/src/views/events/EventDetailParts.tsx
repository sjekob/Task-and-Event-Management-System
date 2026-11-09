import { ReactNode } from 'react';
import { EventItem, Json } from '@shared/models';

// Building blocks of the proposal view.
export function StatusBadge({ e }: { e: EventItem }) {
  const [color, label] = [e.statusColor, e.isPending ? 'Pending' : e.statusLabel];
  return <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{label}</span>;
}

export function Meta({ icon, text }: { icon: ReactNode; text: string }) {
  return <span className="row gap-6" style={{ fontSize: 13.5, color: 'var(--text-2)' }}><span style={{ color: 'var(--muted)', display: 'flex' }}>{icon}</span>{text}</span>;
}

export function Card({ icon, title, children, style }: { icon: ReactNode; title: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ev-panel" style={style}>
      <div className="row gap-8 mb-12"><span style={{ color: 'var(--text-2)', display: 'flex' }}>{icon}</span><span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span></div>
      {children}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{label}</div>
      <div className="pre-wrap" style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export function Bullets({ items, small }: { items: string[]; small?: boolean }) {
  return <div>{items.map((l, i) => <div key={i} className="row-top" style={{ marginBottom: small ? 3 : 4, fontSize: small ? 13 : 14.5, lineHeight: 1.5 }}><span style={{ color: 'var(--muted)' }}>•&nbsp;&nbsp;</span><span>{l}</span></div>)}</div>;
}

export function Table({ rows, cols, footer, raw }: { rows: Json[] | null; cols: [string, string][]; footer?: unknown[]; raw?: unknown }) {
  if (!rows) return raw ? <div className="ev-li">{String(raw)}</div> : null;
  return (
    <div className="ev-table-wrap">
      <table className="ev-table">
        <thead><tr>{cols.map(([, h]) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{cols.map(([k]) => <td key={k}>{String(r[k] ?? '')}</td>)}</tr>)}
          {footer && <tr className="total">{footer.map((v, i) => <td key={i}>{String(v ?? '')}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}
