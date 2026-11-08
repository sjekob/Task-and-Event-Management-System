import { ReactElement, cloneElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dark hover tooltip (multi-line text) shown after a short delay, positioned
 * above the target and kept inside the viewport.
 */
export function Tooltip({ text, children, delay = 200 }: { text: string | null | undefined; children: ReactElement<any>; delay?: number }) {
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Keep the bubble on screen horizontally once its width is known.
  useEffect(() => {
    if (!pos || !tip.current) return;
    const r = tip.current.getBoundingClientRect();
    const margin = 8;
    if (r.left < margin) setShift(margin - r.left);
    else if (r.right > window.innerWidth - margin) setShift(window.innerWidth - margin - r.right);
  }, [pos]);

  if (!text) return children;

  const show = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      const below = r.top < 120;
      setShift(0);
      setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below });
    }, delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  };

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { children.props.onMouseEnter?.(e); show(e); },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { children.props.onMouseLeave?.(e); hide(); },
        onFocus: (e: React.FocusEvent<HTMLElement>) => { children.props.onFocus?.(e); show(e as unknown as React.MouseEvent<HTMLElement>); },
        onBlur: (e: React.FocusEvent<HTMLElement>) => { children.props.onBlur?.(e); hide(); },
        'aria-label': text,
      })}
      {pos && createPortal(
        <div ref={tip} role="tooltip" className="tooltip" style={{
          left: pos.x + shift, top: pos.y,
          transform: `translate(-50%, ${pos.below ? '0' : '-100%'})`,
        }}>
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
