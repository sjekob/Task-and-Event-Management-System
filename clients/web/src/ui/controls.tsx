import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'dark' | 'primary' | 'danger' | 'success' | 'outline' | 'outline-muted' | 'ghost' | 'ghost-danger';

export function Button({
  variant = 'dark', size, block, loading, icon, children, className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: 'sm' | 'lg'; block?: boolean; loading?: boolean; icon?: ReactNode;
}) {
  const cls = ['btn', variant === 'dark' ? '' : variant, size ?? '', block ? 'block' : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className={`spinner sm ${['dark', 'primary', 'danger', 'success'].includes(variant) ? 'light' : ''}`} /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ title, children, small, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { small?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} className={`icon-btn ${small ? 'sm' : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', onClick, pad16, flat, style }: {
  children: ReactNode; className?: string; onClick?: () => void; pad16?: boolean; flat?: boolean; style?: React.CSSProperties;
}) {
  const cls = ['card', pad16 ? 'pad-16' : '', flat ? 'flat' : '', onClick ? 'clickable' : '', className].filter(Boolean).join(' ');
  return <div className={cls} onClick={onClick} style={style}>{children}</div>;
}

export function Banner({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="banner">
      <div className="row between wrap gap-16">
        <div>
          <h1 className="banner-title">{title}</h1>
          {subtitle && <div className="banner-sub">{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, required, help, error, children, className = '' }: {
  label?: ReactNode; required?: boolean; help?: ReactNode; error?: string | null; children: ReactNode; className?: string;
}) {
  return (
    <label className={`field ${className}`} onClick={(e) => { if ((e.target as HTMLElement).tagName === 'LABEL') e.preventDefault(); }}>
      {label && <span className="field-label">{label}{required && <span className="req">*</span>}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : help ? <span className="field-help">{help}</span> : null}
    </label>
  );
}

export function TextInput({ invalid, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={`input ${invalid ? 'invalid' : ''} ${className}`} {...rest} />;
}

export function TextArea({ invalid, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={`textarea ${invalid ? 'invalid' : ''} ${className}`} {...rest} />;
}

export function Select({ invalid, className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select className={`select ${invalid ? 'invalid' : ''} ${className}`} {...rest}>{children}</select>;
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: {
  value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; icon?: ReactNode }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function BackLink({ onClick, label = 'Back', icon }: { onClick: () => void; label?: string; icon: ReactNode }) {
  return <button className="back-link" onClick={onClick}>{icon}{label}</button>;
}

