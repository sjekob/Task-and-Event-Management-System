/**
 * Rich text for proposal fields: font, size, bold / italic / underline, text
 * colour, line spacing, and bulleted / numbered / check lists. Stored as HTML
 * restricted to a small whitelist (fonts and colours from fixed lists), and
 * always re-sanitized before it is rendered (the print view is same-origin).
 * The server applies the same whitelist (backend/rich_text.py).
 */

/** Relative sizes the editor steps through (em). */
export const RICH_SIZES = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];

/** The printed document's body size: 1em of a field = this many points. */
export const BASE_PT = 12;
/** Point sizes offered in the size box (stored as em = pt / BASE_PT). */
export const RICH_PT = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28];
export const MIN_EM = 0.6;
export const MAX_EM = 2.5;

/** Fonts the proponent can pick (common on school Windows PCs; the rest fall back). */
export const RICH_FONTS = [
  'Arial', 'Bookman Old Style', 'Calibri', 'Cambria', 'Century Gothic', 'Georgia', 'Tahoma', 'Times New Roman', 'Verdana',
];

/** Text colours the proponent can pick. */
export const RICH_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#000000' }, { name: 'Dark gray', hex: '#4b5563' }, { name: 'Gray', hex: '#9ca3af' },
  { name: 'Dark red', hex: '#991b1b' }, { name: 'Red', hex: '#dc2626' }, { name: 'Orange', hex: '#ea580c' },
  { name: 'Gold', hex: '#b45309' }, { name: 'Green', hex: '#15803d' }, { name: 'Blue', hex: '#1d4ed8' },
  { name: 'Navy', hex: '#1e3a8a' }, { name: 'Purple', hex: '#7e22ce' },
];

/** Line spacing choices (CSS line-height). */
export const LINE_SPACINGS: { label: string; value: string }[] = [
  { label: 'Single', value: '1.15' }, { label: '1.15', value: '1.3' }, { label: '1.5', value: '1.65' }, { label: 'Double', value: '2.2' },
];

const LEGACY_FONT_SIZES: Record<string, number> = { 1: 0.7, 2: 0.85, 3: 1, 4: 1.15, 5: 1.3, 6: 1.5, 7: 2 };
const ALIASES: Record<string, string> = { strong: 'b', em: 'i', p: 'div', font: 'span' };
const ALLOWED = new Set(['b', 'i', 'u', 'br', 'span', 'div', 'ul', 'ol', 'li']);
const BLOCKS = new Set(['div', 'li', 'ul', 'ol']);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|template|svg|math|textarea|title|noscript)\b[\s\S]*?<\/\1\s*>/gi;
const FONT_BY_KEY = new Map(RICH_FONTS.map((f) => [f.toLowerCase(), f]));
const COLOR_SET = new Set(RICH_COLORS.map((c) => c.hex));
const SPACING_SET = new Set(LINE_SPACINGS.map((s) => s.value));

/** Point size shown for an em size. */
export const ptOfEm = (em: number) => Math.round(em * BASE_PT * 2) / 2;
/** Em size stored for a point size (clamped to what's allowed). */
export const emOfPt = (pt: number) => clampSize(pt / BASE_PT) ?? 1;

function escText(t: string): string {
  return t.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clampSize(em: number): number | null {
  if (!Number.isFinite(em) || em <= 0) return null;
  return Math.round(Math.min(MAX_EM, Math.max(MIN_EM, em)) * 100) / 100;
}

/** A whitelisted font name, or null ("'Times New Roman', serif" → "Times New Roman"). */
export function safeFont(raw: string | null | undefined): string | null {
  const first = (raw ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  return FONT_BY_KEY.get(first) ?? null;
}

/** A whitelisted colour as #rrggbb, or null (accepts #rgb, #rrggbb and rgb()). */
export function safeColor(raw: string | null | undefined): string | null {
  let v = (raw ?? '').trim().toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgb) v = '#' + rgb.slice(1, 4).map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
  if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v.slice(1).split('').map((c) => c + c).join('');
  return COLOR_SET.has(v) ? v : null;
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
}

/** Safe attributes for a tag: only the allowed styles, plus the checklist markers. */
function safeAttrs(raw: string, tag: string, attrs: string): string {
  const out: string[] = [];
  const css = (attr(attrs, 'style') ?? '').toLowerCase();
  if (tag === 'span' || tag === 'div' || tag === 'li') {
    let size: number | null = null;
    const fs = /font-size\s*:\s*([\d.]+)\s*(em|rem|%|px|pt)?/.exec(css);
    if (fs) {
      const v = parseFloat(fs[1]);
      const unit = fs[2] ?? 'px';
      size = clampSize(unit === '%' ? v / 100 : unit === 'px' ? v / 14.67 : unit === 'pt' ? v / 11 : v);
    }
    const legacy = raw === 'font' ? attr(attrs, 'size') : null;
    if (legacy && LEGACY_FONT_SIZES[legacy]) size = LEGACY_FONT_SIZES[legacy];
    if (size !== null && size !== 1) out.push(`font-size:${size}em`);
    if (/font-weight\s*:\s*(bold|[6-9]00)/.test(css)) out.push('font-weight:bold');
    if (/font-style\s*:\s*italic/.test(css)) out.push('font-style:italic');
    if (/text-decoration[a-z-]*\s*:[^;]*underline/.test(css)) out.push('text-decoration:underline');
    const family = safeFont(/font-family\s*:\s*([^;]+)/.exec(css)?.[1] ?? (raw === 'font' ? attr(attrs, 'face') : null));
    if (family) out.push(`font-family:'${family}'`);
    const color = safeColor(/(?:^|;)\s*color\s*:\s*([^;]+)/.exec(css)?.[1] ?? (raw === 'font' ? attr(attrs, 'color') : null));
    if (color) out.push(`color:${color}`);
  }
  if (tag === 'div' || tag === 'li') {
    const align = /text-align\s*:\s*(left|center|right|justify)/.exec(css);
    if (align) out.push(`text-align:${align[1]}`);
  }
  if (BLOCKS.has(tag)) {
    const lh = /line-height\s*:\s*([\d.]+)/.exec(css)?.[1];
    if (lh && SPACING_SET.has(lh)) out.push(`line-height:${lh}`);
  }
  let extra = '';
  if (tag === 'ul' && attr(attrs, 'data-check') !== null) extra += ' data-check="1"';
  if (tag === 'li' && attr(attrs, 'data-checked') !== null) extra += ' data-checked="1"';
  return (out.length ? ` style="${out.join(';')}"` : '') + extra;
}

/** Whitelisted, tag-balanced HTML. Anything else is dropped (its text kept, except scripts/styles). */
export function sanitizeRich(html: unknown): string {
  const src = String(html ?? '').replace(DROP_WITH_CONTENT, '').replace(/<!--[\s\S]*?-->/g, '');
  const out: string[] = [];
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out.push(escText(src.slice(last, m.index)));
    last = re.lastIndex;
    const raw = m[2].toLowerCase();
    const tag = ALIASES[raw] ?? raw;
    if (!ALLOWED.has(tag)) continue;
    if (tag === 'br') { if (!m[1]) out.push('<br>'); continue; }
    if (m[1]) {
      const i = stack.lastIndexOf(tag);
      if (i < 0) continue;
      while (stack.length > i) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (/\/\s*$/.test(m[3])) continue; // self-closing non-void tag
    stack.push(tag);
    out.push(`<${tag}${tag === 'b' || tag === 'i' || tag === 'u' ? '' : safeAttrs(raw, tag, m[3])}>`);
  }
  out.push(escText(src.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decode(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (e, k: string) => {
    if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return ENTITIES[k.toLowerCase()] ?? e;
  });
}

/**
 * Text content, with line breaks where the editor started new lines. List
 * items get their marker ("• ", "1. ", "☐ " / "☑ ") so the plain copy reads the same.
 */
export function richToPlain(html: unknown): string {
  let text = '';
  const lists: { kind: 'ul' | 'ol' | 'check'; n: number }[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const src = String(html ?? '').replace(DROP_WITH_CONTENT, '');
  const newline = () => { if (text && !text.endsWith('\n')) text += '\n'; };
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) { text += m[4]; continue; }
    const close = !!m[1];
    const tag = m[2].toLowerCase();
    if (tag === 'br') text += '\n';
    else if (tag === 'div' || tag === 'p') newline();
    else if (tag === 'ul' || tag === 'ol') {
      newline();
      if (close) lists.pop();
      else lists.push({ kind: tag === 'ol' ? 'ol' : /data-check/i.test(m[3]) ? 'check' : 'ul', n: 0 });
    } else if (tag === 'li' && !close) {
      newline();
      const l = lists[lists.length - 1];
      if (l) {
        l.n += 1;
        text += '  '.repeat(Math.max(0, lists.length - 1))
          + (l.kind === 'ol' ? `${l.n}. ` : l.kind === 'check' ? (/data-checked/i.test(m[3]) ? '☑ ' : '☐ ') : '• ');
      }
    } else if (tag === 'li') newline();
  }
  return decode(text)
    .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain text as editor HTML. */
export function plainToRich(text: unknown): string {
  return escText(String(text ?? '')).replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

/** Whether the HTML carries any formatting beyond plain lines. */
export function hasFormatting(html: unknown): boolean {
  return /<(b|i|u|ul|ol)>|<(ul|ol|li)\b|style="/.test(sanitizeRich(html));
}

/**
 * Non-empty lines as sanitized inline HTML, for one-line fields and numbered
 * items: blocks and list items each become a line (without a list marker;
 * formatting that spans a break is closed per line).
 */
export function richLines(html: unknown): string[] {
  return sanitizeRich(html)
    .replace(/<br>/g, '\n').replace(/<(div|li|ul|ol)\b[^>]*>/g, '\n').replace(/<\/(div|li|ul|ol)>/g, '\n')
    .split('\n')
    .map((l) => sanitizeRich(l).trim())
    .filter((l) => richToPlain(l).trim());
}

/**
 * The field as print-ready block HTML: lines become paragraphs (keeping their
 * line spacing and alignment), lists stay lists, checklists show their boxes.
 */
export function richBlocks(html: unknown): string {
  const src = sanitizeRich(html);
  const out: string[] = [];
  const inline: string[] = [];          // open inline tags, re-opened on each new paragraph
  const blockStyle: string[] = [];      // style of the enclosing div(s)
  let line = '';
  const flush = () => {
    if (richToPlain(line).trim()) {
      const st = blockStyle.filter(Boolean).pop();
      out.push(`<p${st ? ` style="${st}"` : ''}>${sanitizeRich(line).trim()}</p>`);
    }
    line = inline.join('');
  };
  const re = /<(\/?)([a-z]+)\b([^<>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let depthLi = 0;
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) { line += m[4]; continue; }
    const [, close, tag, attrs] = m;
    const style = /style="([^"]*)"/.exec(attrs)?.[1] ?? '';
    if (depthLi > 0 && tag !== 'li' && tag !== 'ul' && tag !== 'ol') { line += m[0]; continue; }
    if (tag === 'br') { if (depthLi > 0) line += '<br>'; else flush(); continue; }
    if (tag === 'div') {
      flush();
      if (close) blockStyle.pop(); else blockStyle.push(style);
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      if (!close) {
        if (depthLi === 0) flush();
        else { out.push(sanitizeRich(line).trim()); line = ''; }  // a sub-list: the item's own text first
      }
      out.push(close ? `</${tag}>` : `<${tag}${/data-check/.test(attrs) ? ' class="checklist"' : ''}${style ? ` style="${style}"` : ''}>`);
      continue;
    }
    if (tag === 'li') {
      if (close) {
        depthLi -= 1;
        out.push(`${sanitizeRich(line).trim()}</li>`);
        line = '';
      } else {
        depthLi += 1;
        line = '';
        out.push(`<li${/data-checked/.test(attrs) ? ' class="checked"' : ''}${style ? ` style="${style}"` : ''}>`);
      }
      continue;
    }
    // Inline tags: keep them on the line, and remember open ones for the next paragraph.
    line += m[0];
    if (close) {
      const i = inline.map((t) => t.match(/^<(\w+)/)?.[1]).lastIndexOf(tag);
      if (i >= 0) inline.splice(i, 1);
    } else inline.push(m[0]);
  }
  flush();
  return out.join('\n');
}
