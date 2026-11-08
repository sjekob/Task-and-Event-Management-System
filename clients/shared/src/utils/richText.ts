/**
 * Lightweight rich text for proposal fields: bold, italic, underline, font
 * size and line breaks. Stored as HTML restricted to a small whitelist, and
 * always re-sanitized before it is rendered (the print view is same-origin).
 */

/** Relative sizes the editor steps through (em). */
export const RICH_SIZES = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];

const LEGACY_FONT_SIZES: Record<string, number> = { 1: 0.7, 2: 0.85, 3: 1, 4: 1.15, 5: 1.3, 6: 1.5, 7: 2 };
const ALIASES: Record<string, string> = { strong: 'b', em: 'i', p: 'div', font: 'span' };
const ALLOWED = new Set(['b', 'i', 'u', 'br', 'span', 'div']);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|template|svg|math|textarea|title|noscript)\b[\s\S]*?<\/\1\s*>/gi;

function escText(t: string): string {
  return t.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clampSize(em: number): number | null {
  if (!Number.isFinite(em) || em <= 0) return null;
  return Math.round(Math.min(2.5, Math.max(0.6, em)) * 100) / 100;
}

/** Safe inline style from a tag's attributes: only size / weight / slant / underline / alignment. */
function safeStyle(tag: string, attrs: string): string {
  const out: string[] = [];
  const style = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
  const css = (style?.[2] ?? style?.[3] ?? '').toLowerCase();
  let size: number | null = null;
  const fs = /font-size\s*:\s*([\d.]+)\s*(em|rem|%|px|pt)?/.exec(css);
  if (fs) {
    const v = parseFloat(fs[1]);
    const unit = fs[2] ?? 'px';
    size = clampSize(unit === '%' ? v / 100 : unit === 'px' ? v / 14.67 : unit === 'pt' ? v / 11 : v);
  }
  const legacy = /\bsize\s*=\s*["']?(\d)/i.exec(attrs);
  if (tag === 'font' && legacy) size = LEGACY_FONT_SIZES[legacy[1]] ?? null;
  if (size !== null && size !== 1) out.push(`font-size:${size}em`);
  if (/font-weight\s*:\s*(bold|[6-9]00)/.test(css)) out.push('font-weight:bold');
  if (/font-style\s*:\s*italic/.test(css)) out.push('font-style:italic');
  if (/text-decoration[a-z-]*\s*:[^;]*underline/.test(css)) out.push('text-decoration:underline');
  const align = /text-align\s*:\s*(left|center|right|justify)/.exec(css);
  if (align && (tag === 'div' || tag === 'p')) out.push(`text-align:${align[1]}`);
  return out.length ? ` style="${out.join(';')}"` : '';
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
    out.push(`<${tag}${tag === 'span' || tag === 'div' ? safeStyle(raw, m[3]) : ''}>`);
  }
  out.push(escText(src.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Text content, with line breaks where the editor started new lines. */
export function richToPlain(html: unknown): string {
  let text = '';
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const src = String(html ?? '').replace(DROP_WITH_CONTENT, '');
  while ((m = re.exec(src))) {
    if (m[3] !== undefined) { text += m[3]; continue; }
    const tag = m[2].toLowerCase();
    if (tag === 'br') text += '\n';
    else if ((tag === 'div' || tag === 'p') && text && !text.endsWith('\n')) text += '\n';
  }
  return text
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (e, k: string) => {
      if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
      return ENTITIES[k.toLowerCase()] ?? e;
    })
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
  return /<(b|i|u)>|style="/.test(sanitizeRich(html));
}

/** Non-empty lines as sanitized HTML (formatting that spans a break is closed per line). */
export function richLines(html: unknown): string[] {
  return sanitizeRich(html)
    .replace(/<br>/g, '\n').replace(/<div[^>]*>/g, '\n').replace(/<\/div>/g, '\n')
    .split('\n')
    .map((l) => sanitizeRich(l).trim())
    .filter((l) => richToPlain(l).trim());
}
