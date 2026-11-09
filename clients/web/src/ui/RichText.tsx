import { KeyboardEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { Bold, ChevronDown, Italic, List, ListChecks, ListOrdered, Minus, Plus, Underline } from 'lucide-react';
import {
  LINE_SPACINGS, RICH_COLORS, RICH_FONTS, RICH_PT, emOfPt, ptOfEm, safeColor, safeFont,
} from '@shared/utils/richText';

type Mark = 'bold' | 'italic' | 'underline';
type ListKind = 'ul' | 'ol' | 'check';
type Menu = 'font' | 'color' | 'spacing' | null;

const MARKS: [Mark, typeof Bold, string][] = [
  ['bold', Bold, 'Bold (Ctrl+B)'],
  ['italic', Italic, 'Italic (Ctrl+I)'],
  ['underline', Underline, 'Underline (Ctrl+U)'],
];

interface Current { marks: Record<Mark, boolean>; font: string | null; pt: number; color: string | null; list: ListKind | null; spacing: string | null }
const NONE: Current = { marks: { bold: false, italic: false, underline: false }, font: null, pt: 12, color: null, list: null, spacing: null };

/**
 * A text field formatted like a document: select text, then change its font,
 * size, bold / italic / underline or colour; multi-line fields also get line
 * spacing and bulleted, numbered and check lists. The value is HTML; it is
 * sanitized (to the same whitelist) when saved and when printed.
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
  const saved = useRef<Range | null>(null);
  const [cur, setCur] = useState<Current>(NONE);
  const [menu, setMenu] = useState<Menu>(null);
  const [ptText, setPtText] = useState('12');

  // Only write the DOM when the value changed from outside (typing keeps the caret).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  // Track the selection: what the toolbar shows, and where to apply a change made from the size box.
  useEffect(() => {
    const update = () => {
      const el = ref.current;
      const sel = document.getSelection();
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode) || !sel.rangeCount) return;
      saved.current = sel.getRangeAt(0).cloneRange();
      const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode as Element : sel.anchorNode.parentElement!;
      const cs = getComputedStyle(node);
      const base = parseFloat(getComputedStyle(el).fontSize) || 14;
      const pt = ptOfEm(parseFloat(cs.fontSize) / base);
      const listEl = node.closest('li')?.parentElement;
      const block = node.closest('li, div:not(.rt-edit)') as HTMLElement | null;
      setCur({
        marks: { bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') },
        font: safeFont(cs.fontFamily),
        pt,
        color: safeColor(cs.color),
        list: !listEl || !el.contains(listEl) ? null : listEl.tagName === 'OL' ? 'ol' : listEl.hasAttribute('data-check') ? 'check' : 'ul',
        spacing: block && el.contains(block) ? block.style.lineHeight || null : null,
      });
      setPtText(String(pt));
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    // A field emptied by deleting keeps a stray <br>; clear it so the placeholder shows.
    if (!el.textContent && !el.querySelector('br + *, div, li')) el.innerHTML = '';
    onChange(el.innerHTML);
  };

  /** Focuses the field with the last selection back in place (after using the size box or a menu). */
  const restore = () => {
    const el = ref.current;
    if (!el) return null;
    el.focus();
    const sel = document.getSelection();
    if (sel && saved.current && el.contains(saved.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
    return sel;
  };

  /** execCommand writes <font size|face|color>; turn those into the styled spans the whitelist keeps. */
  const fontsToSpans = (sizeEm?: number) => {
    ref.current?.querySelectorAll('font').forEach((f) => {
      const span = document.createElement('span');
      const sized = f.getAttribute('size') === '7' && sizeEm !== undefined;
      if (sized && sizeEm !== 1) span.style.fontSize = `${sizeEm}em`;
      const face = f.getAttribute('face');
      if (face) span.style.fontFamily = `'${face}'`;
      const color = f.getAttribute('color');
      if (color) span.style.color = color;
      span.append(...Array.from(f.childNodes));
      if (sized) {
        // The new size replaces sizes set earlier inside the selection.
        span.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((inner) => {
          inner.style.fontSize = '';
          if (!inner.getAttribute('style')) inner.removeAttribute('style');
        });
      }
      f.replaceWith(span);
    });
  };

  const run = (cmd: string, arg?: string) => {
    const sel = restore();
    if (!sel) return;
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(cmd, false, arg);
  };

  const mark = (m: Mark) => { run(m); emit(); };

  const setSize = (em: number) => {
    const sel = restore();
    if (!sel || sel.isCollapsed) return;
    run('fontSize', '7');
    fontsToSpans(em);
    emit();
    setPtText(String(ptOfEm(em)));
  };

  /** One step down / up the point sizes from the current one. */
  const step = (dir: 1 | -1) => {
    const now = cur.pt;
    const next = dir > 0 ? RICH_PT.find((p) => p > now) ?? RICH_PT[RICH_PT.length - 1] : [...RICH_PT].reverse().find((p) => p < now) ?? RICH_PT[0];
    setSize(emOfPt(next));
  };

  const applyPtText = () => {
    const n = parseFloat(ptText);
    if (Number.isFinite(n) && n > 0) setSize(emOfPt(n));
    else setPtText(String(cur.pt));
  };

  const setFont = (family: string) => { setMenu(null); run('fontName', family); fontsToSpans(); emit(); };
  const setColor = (hex: string) => { setMenu(null); run('foreColor', hex); fontsToSpans(); emit(); };

  /** Line spacing for the paragraphs or list items the selection touches. */
  const setSpacing = (lh: string) => {
    setMenu(null);
    const el = ref.current;
    let sel = restore();
    if (!el || !sel?.rangeCount) return;
    const inList = !!(sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode as Element : sel.anchorNode.parentElement)?.closest('li'));
    if (!inList) {
      document.execCommand('formatBlock', false, 'div');  // put loose lines into paragraphs
      sel = document.getSelection();
      if (!sel?.rangeCount) return;
    }
    const range = sel.getRangeAt(0);
    el.querySelectorAll<HTMLElement>(inList ? 'li' : 'div').forEach((b) => {
      if (range.intersectsNode(b)) b.style.lineHeight = lh;
    });
    emit();
  };

  const setList = (kind: ListKind) => {
    const el = ref.current;
    if (cur.list === kind || (kind !== 'ol' && cur.list === (kind === 'ul' ? 'check' : 'ul'))) {
      // Same kind again turns it off; bullets ⇄ checklist just switches the marker.
      if (cur.list !== kind) {
        const listEl = ref.current && restore()?.anchorNode;
        const ul = (listEl?.nodeType === 1 ? listEl as Element : listEl?.parentElement)?.closest('ul');
        if (ul) { if (kind === 'check') ul.setAttribute('data-check', '1'); else ul.removeAttribute('data-check'); emit(); }
        return;
      }
    }
    run(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
    if (kind === 'check' && cur.list !== 'check') {
      const node = document.getSelection()?.anchorNode;
      const ul = (node?.nodeType === 1 ? node as Element : node?.parentElement)?.closest('ul');
      if (ul && el?.contains(ul)) ul.setAttribute('data-check', '1');
    }
    emit();
  };

  /** Ticks a checklist item when its box (the left gutter) is clicked. */
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const li = (e.target as Element).closest('li');
    if (!li || !li.parentElement?.hasAttribute('data-check')) return;
    if (e.clientX - li.getBoundingClientRect().left > 22) return;
    li.toggleAttribute('data-checked');
    if (li.hasAttribute('data-checked')) li.setAttribute('data-checked', '1');
    emit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !multiline) e.preventDefault();
    if (e.key === 'Tab' && multiline) {
      e.preventDefault();
      if (cur.list) { document.execCommand(e.shiftKey ? 'outdent' : 'indent'); emit(); }
      else document.execCommand('insertText', false, '    ');
    }
  };

  const toggle = (m: Menu) => setMenu((x) => (x === m ? null : m));
  const swatch = cur.color ?? '#000000';

  return (
    <div className="rt" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(null); }}>
      <div className="rt-bar" role="toolbar" aria-label="Text formatting"
        // Keep the text selected while using the toolbar (except when typing a size).
        onMouseDown={(e) => { if (!(e.target as Element).closest('input')) e.preventDefault(); }}>
        <div className="rt-pop-wrap">
          <button type="button" className="rt-select" title="Font" onClick={() => toggle('font')} style={{ fontFamily: cur.font ?? undefined }}>
            <span className="ellipsis">{cur.font ?? 'Default font'}</span><ChevronDown size={13} />
          </button>
          {menu === 'font' && (
            <div className="rt-pop">
              {RICH_FONTS.map((f) => (
                <button key={f} type="button" className={`rt-item ${cur.font === f ? 'on' : ''}`} style={{ fontFamily: `'${f}'` }} onClick={() => setFont(f)}>{f}</button>
              ))}
            </div>
          )}
        </div>
        <span className="rt-sep" />
        <button type="button" title="Decrease font size" onClick={() => step(-1)}><Minus size={14} /></button>
        <input className="rt-size" aria-label="Font size (pt)" value={ptText} inputMode="decimal"
          onChange={(e) => setPtText(e.target.value.replace(/[^\d.]/g, '').slice(0, 4))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPtText(); } }}
          onBlur={() => setPtText(String(cur.pt))} />
        <button type="button" title="Increase font size" onClick={() => step(1)}><Plus size={14} /></button>
        <span className="rt-sep" />
        {MARKS.map(([m, Icon, title]) => (
          <button key={m} type="button" title={title} aria-pressed={cur.marks[m]} className={cur.marks[m] ? 'on' : ''} onClick={() => mark(m)}><Icon size={15} /></button>
        ))}
        <div className="rt-pop-wrap">
          <button type="button" title="Text colour" onClick={() => toggle('color')} className="rt-color">
            <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1 }}>A</span>
            <span className="rt-color-bar" style={{ background: swatch }} />
          </button>
          {menu === 'color' && (
            <div className="rt-pop rt-swatches">
              {RICH_COLORS.map((c) => (
                <button key={c.hex} type="button" title={c.name} aria-label={c.name} className={`rt-swatch ${cur.color === c.hex ? 'on' : ''}`}
                  style={{ background: c.hex }} onClick={() => setColor(c.hex)} />
              ))}
            </div>
          )}
        </div>
        {multiline && <>
          <span className="rt-sep" />
          <div className="rt-pop-wrap">
            <button type="button" title="Line spacing" onClick={() => toggle('spacing')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 6h10M11 12h10M11 18h10M4 8l2-3 2 3M4 16l2 3 2-3M6 5v14" />
              </svg>
            </button>
            {menu === 'spacing' && (
              <div className="rt-pop">
                {LINE_SPACINGS.map((s) => (
                  <button key={s.value} type="button" className={`rt-item ${cur.spacing === s.value ? 'on' : ''}`} onClick={() => setSpacing(s.value)}>{s.label}</button>
                ))}
              </div>
            )}
          </div>
          <button type="button" title="Checklist" aria-pressed={cur.list === 'check'} className={cur.list === 'check' ? 'on' : ''} onClick={() => setList('check')}><ListChecks size={16} /></button>
          <button type="button" title="Bulleted list" aria-pressed={cur.list === 'ul'} className={cur.list === 'ul' ? 'on' : ''} onClick={() => setList('ul')}><List size={16} /></button>
          <button type="button" title="Numbered list" aria-pressed={cur.list === 'ol'} className={cur.list === 'ol' ? 'on' : ''} onClick={() => setList('ol')}><ListOrdered size={16} /></button>
        </>}
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
        onClick={onClick}
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
