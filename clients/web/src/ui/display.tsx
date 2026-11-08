import { ReactNode, useEffect, useState } from 'react';
import { useMediaUrl } from '../app/AppContext';
import { Button } from './controls';

// Status and loading displays.
export type BadgeColor = 'blue' | 'green' | 'red' | 'amber' | 'gray' | 'purple' | 'dark' | 'solid-green';

export function Badge({ color = 'gray', children, icon, title }: { color?: BadgeColor; children: ReactNode; icon?: ReactNode; title?: string }) {
  return <span className={`badge ${color}`} title={title}>{icon}{children}</span>;
}

export function Spinner({ small, light }: { small?: boolean; light?: boolean }) {
  return <span className={`spinner ${small ? 'sm' : ''} ${light ? 'light' : ''}`} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="center-fill col center">
      <Spinner />
      {label && <span className="caption">{label}</span>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <div className="strong" style={{ color: 'var(--text)' }}>{title}</div>
      {children && <div className="caption">{children}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert red row between">
      <span>{message}</span>
      {onRetry && <Button size="sm" variant="outline-muted" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Avatar({ url, initials, size = 40, bg }: { url?: string | null; initials: string; size?: number; bg?: string }) {
  const media = useMediaUrl();
  const src = media(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: bg }}>
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : initials}
    </span>
  );
}

export function Bone({ w = '100%', h = 14, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="bone" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function Progress({ value, color }: { value: number; color?: string }) {
  return <div className="progress"><div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} /></div>;
}
