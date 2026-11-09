import { PointerEvent, ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Phones: the submission as a bottom sheet, like Google Classroom's "Your
 * work". Collapsed, a bar pinned to the bottom shows who and their status;
 * tapping it (or someone in the list) slides the sheet up over the page.
 * Drag the handle down, tap it, or tap outside to put it away.
 */
export function WorkSheet({ open, onOpenChange, summary, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The collapsed bar's content (title, person, status). */
  summary: ReactNode;
  children: ReactNode;
}) {
  const [drag, setDrag] = useState(0);              // px the sheet is pulled from where it rests
  const start = useRef<{ y: number; t: number } | null>(null);
  const moved = useRef(false);

  // The page behind doesn't scroll while the sheet is up; Escape puts it away.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open, onOpenChange]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { y: e.clientY, t: performance.now() };
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dy) > 4) moved.current = true;
    // Open: only downward pulls move it; closed: only upward.
    setDrag(open ? Math.max(0, dy) : Math.min(0, dy));
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    const fast = Math.abs(dy) / Math.max(1, performance.now() - start.current.t) > 0.5;  // a flick
    start.current = null;
    setDrag(0);
    if (!moved.current) { onOpenChange(!open); return; }      // a tap toggles
    if (open && (dy > 90 || (fast && dy > 0))) onOpenChange(false);
    if (!open && (dy < -40 || (fast && dy < 0))) onOpenChange(true);
  };

  return (
    <>
      {open && <div className="ws-backdrop" onClick={() => onOpenChange(false)} />}
      <section className={`ws ${open ? 'open' : ''} ${drag ? 'dragging' : ''}`} aria-label="Submission"
        style={drag ? { transform: open ? `translateY(${drag}px)` : `translateY(calc(100% - var(--ws-peek) + ${drag}px))` } : undefined}>
        <div className="ws-grab" role="button" tabIndex={0} aria-expanded={open}
          aria-label={open ? 'Hide the submission' : 'Show the submission'}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDrag(0); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChange(!open); } }}>
          <span className="ws-handle" />
          <div className="ws-summary">{summary}</div>
        </div>
        <div className="ws-body">{children}</div>
      </section>
    </>
  );
}
