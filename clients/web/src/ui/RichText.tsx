import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { AArrowDown, AArrowUp, Bold, Italic, Underline } from 'lucide-react';
import { RICH_SIZES } from '@shared/utils/richText';

type Mark = 'bold' | 'italic' | 'underline';

const MARKS: [Mark, typeof Bold, string][] = [
  ['bold', Bold, 'Bold (Ctrl+B)'],
  ['italic', Italic, 'Italic (Ctrl+I)'],
  ['underline', Underline, 'Underline (Ctrl+U)'],
];

/**
 * A text field whose selection can be made bold, italic, underlined, smaller
 * or bigger. The value is HTML; it is sanitized when saved and printed.
 */
export function RichText({ value, onChange, placeholder, multiline = false, rows = 1 }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Enter starts a new line (else it is ignored, like a one-line input). */
  multiline?: boolean;
  rows?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<Mark, boolean>>({ bold: false, italic: false, underline: false });

  // Only write the DOM when the value changed from outside (typing keeps the caret).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      const sel = document.getSelection();
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    // A field emptied by deleting keeps a stray <br>; clear it so the placeholder shows.
    if (!el.textContent && !el.querySelector('br + *, div')) el.innerHTML = '';
    onChange(el.innerHTML);
  };

  const mark = (m: Mark) => {
    ref.current?.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(m);
    emit();
  };

  /** One step smaller / bigger than the size at the start of the selection. */
  const resize = (dir: 1 | -1) => {
    const el = ref.current;
    const sel = document.getSelection();
    if (!el || !sel || sel.isCollapsed || !el.contains(sel.anchorNode)) return;
    const node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode as Element : sel.anchorNode?.parentElement;
    const base = parseFloat(getComputedStyle(el).fontSize);
    const now = node ? parseFloat(getComputedStyle(node).fontSize) / base : 1;
    const idx = RICH_SIZES.reduce((best, s, i) => (Math.abs(s - now) < Math.abs(RICH_SIZES[best] - now) ? i : best), 2);
    const next = RICH_SIZES[Math.min(RICH_SIZES.length - 1, Math.max(0, idx + dir))];
    // execCommand marks the selection with <font size="7">; swap those for an em-sized span.
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    el.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      if (next !== 1) span.style.fontSize = `${next}em`;
      span.append(...Array.from(f.childNodes));
      f.replaceWith(span);
      span.querySelectorAll('span').forEach((inner) => { inner.style.fontSize = ''; if (!inner.getAttribute('style')) inner.removeAttribute('style'); });
    });
    emit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !multiline) e.preventDefault();
    if (e.key === 'Tab' && multiline) { e.preventDefault(); document.execCommand('insertText', false, '    '); }
  };

  return (
    <div className="rt">
      <div className="rt-bar" onMouseDown={(e) => e.preventDefault()}>
        {MARKS.map(([m, Icon, title]) => (
          <button key={m} type="button" title={title} className={active[m] ? 'on' : ''} onClick={() => mark(m)}><Icon size={15} /></button>
        ))}
        <span className="rt-sep" />
        <button type="button" title="Smaller text" onClick={() => resize(-1)}><AArrowDown size={16} /></button>
        <button type="button" title="Bigger text" onClick={() => resize(1)}><AArrowUp size={16} /></button>
      </div>
      <div
        ref={ref}
        className={`pf-in rt-edit ${multiline ? 'multi' : ''}`}
        style={multiline ? { minHeight: `${rows * 1.5 + 1.2}em` } : undefined}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={multiline}
        data-placeholder={placeholder}
        onInput={emit}
        onKeyDown={onKeyDown}
        // Pasted text arrives unformatted; formatting is applied with the toolbar.
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n\s*/g, ' '));
        }}
        onDrop={(e) => e.preventDefault()}
      />
    </div>
  );
}
