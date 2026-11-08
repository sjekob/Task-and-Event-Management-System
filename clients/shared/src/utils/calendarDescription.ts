/**
 * Descriptions for calendar tasks. A task can't be posted without one, so a
 * task the principal types in gets one written from its title, route and due
 * date (until they write their own), and a scanned task's description keeps
 * its dates in step when the principal moves them.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09-21" → "September 21, 2026" (the form the server writes). */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : iso;
}

const TO: Record<string, string> = {
  'subject>adviser': " to the section's adviser",
  'adviser>dean': ' to your dean',
  'dean>registrar': ' to the registrar',
  'teacher>dean': ' to your dean',
  'teacher>principal': ' to the principal',
  'dean>principal': ' to the principal',
  'coordinator>principal': ' to the principal',
};

/** A description written from what the principal typed. */
export function describeTask(title: string, route: string, endDate: string, entry?: { source: string; date: string }): string {
  const t = title.trim();
  if (!t) return '';
  const to = TO[route] ?? '';
  const by = `on or before ${longDate(endDate)}, 5:00 PM`;
  let m: RegExpMatchArray | null;
  let first: string;
  if ((m = t.match(/^(?:submission|submitting) of (?:the )?(.+)/i))) first = `Submit the ${m[1]}${to} ${by}.`;
  else if ((m = t.match(/^preparation of (?:the )?(.+)/i))) first = `Prepare the ${m[1]} and submit it${to} for checking ${by}.`;
  else if (/narrative report/i.test(t)) first = `Submit the ${t} with photos and the attendance${to} ${by}.`;
  else if (/^(?:attend|attendance)/i.test(t)) first = `${t}, then submit your certificate of attendance${to} ${by}.`;
  else first = `Complete the ${t} and submit your output${to} ${by}.`;
  const basis = entry?.source ? `\n\nBasis: ${entry.source}${entry.date ? ` (${entry.date})` : ''} in the school calendar.` : '';
  return `${first}\n\nAttach your file or link in TaskNet when you submit.${basis}`;
}

/** [text] with a changed date rewritten wherever it was spelled out. */
export function moveDates(text: string, from: { start: string; end: string }, to: { start: string; end: string }): string {
  let out = text;
  if (from.end !== to.end) out = out.split(longDate(from.end)).join(longDate(to.end));
  if (from.start !== to.start && from.start !== from.end) out = out.split(longDate(from.start)).join(longDate(to.start));
  return out;
}
