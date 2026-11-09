import { Json } from '../../models';
import { richBlocks, richLines, sanitizeRich } from '../richText';
import { _bulletList, _esc, _numberedList, _paragraphs, str } from './sections';

/** The proponent's formatted fields (comments.rich), as rendered HTML with plain-text fallbacks. */
export function richFields(event: Json) {
  let rich: Json = {};
  try {
    const c = event.comments ? JSON.parse(str(event.comments)) : null;
    if (c && typeof c.rich === 'object' && c.rich) rich = c.rich;
  } catch { /* legacy free text */ }
  const has = (k: string) => typeof rich[k] === 'string' && rich[k].trim() !== '';
  const inline = (k: string, plain: unknown) => (has(k) ? richLines(rich[k]).join('<br>') : _esc(plain ?? ''));
  const list = (tag: 'ul' | 'ol', lines: string[]) => `<${tag}>${lines.map((l) => `<li>${l}</li>`).join('\n')}</${tag}>`;
  const outs: string[] = Array.isArray(rich.outputs) ? rich.outputs.map((o: unknown) => sanitizeRich(o)).filter((o: string) => richLines(o).length) : [];
  return {
    /** Bold unless the proponent formatted it themselves. */
    titleHtml: has('title') ? inline('title', '') : `<strong>${_esc(event.title ?? 'Untitled Event')}</strong>`,
    venueHtml: inline('venue', event.venue),
    focalRoleHtml: inline('focalRole', event.focal_role),
    outputsHtml: outs.length ? list('ul', outs.map((o) => richLines(o).join('<br>'))) : _bulletList(str(event.expected_outputs)),
    rationaleHtml: has('rationale') ? richBlocks(rich.rationale) : _paragraphs(str(event.rationale)),
    objectivesHtml: has('objectives') ? list('ol', richLines(rich.objectives)) : _numberedList(str(event.objectives)),
    /** Empty when neither form has text (the template then uses its default). */
    monitoringHtml: has('monitoring') ? richBlocks(rich.monitoring) : _paragraphs(str(event.monitoring_criteria)),
  };
}
