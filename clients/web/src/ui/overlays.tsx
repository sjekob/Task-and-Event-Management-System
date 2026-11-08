import { ReactNode, useEffect, useRef, useState } from 'react';
import { MoreVertical, X } from 'lucide-react';
import { IconButton } from './controls';

// Dialogs, dropdown menus and the file picker.
/** Centered dialog. Closes on Escape and backdrop click (unless [locked]). */
export function Modal({ title, subtitle, onClose, children, footer, size, locked, icon }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode;
  size?: 'wide' | 'xwide'; locked?: boolean; icon?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !locked) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, locked]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div className={`modal ${size ?? ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon}
          <div className="grow">
            <h2 className="modal-title">{title}</h2>
            {subtitle && <div className="modal-sub">{subtitle}</div>}
          </div>
          {!locked && <IconButton title="Close" small onClick={onClose}><X size={18} /></IconButton>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** "⋮" button with a dropdown of actions. */
export function ActionMenu({ items, icon, align = 'right' }: {
  items: ({ label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean })[]; icon?: ReactNode; align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <IconButton title="More actions" small onClick={() => setOpen((o) => !o)}>{icon ?? <MoreVertical size={18} />}</IconButton>
      {open && (
        <div className="menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined}>
          {visible.map((i) => (
            <button key={i.label} className={i.danger ? 'danger' : ''} onClick={() => { setOpen(false); i.onClick(); }}>
              {i.icon}{i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pick files with the browser dialog. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
