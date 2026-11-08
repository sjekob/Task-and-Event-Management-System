/**
 * Event screens (lists, details, calendars, attendance) stay current: they
 * reload every EVENT_REFRESH_MS while shown, and at once when the person comes
 * back to the tab or app. Polling pauses while it's in the background. Not for
 * forms being edited.
 */
export const EVENT_REFRESH_MS = 30_000;

/** Calls [onResume] when the page/app comes back to the foreground; returns the unsubscribe. */
export type ResumeSource = (onResume: () => void, onPause: () => void) => () => void;

/** Starts reloading with [reload]; returns a stop function (for a React effect's cleanup). */
export function startLiveRefresh(reload: () => void, resume: ResumeSource, ms = EVENT_REFRESH_MS): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const run = () => { if (!timer) timer = setInterval(reload, ms); };
  const halt = () => { if (timer) { clearInterval(timer); timer = null; } };
  run();
  const unsubscribe = resume(() => { reload(); run(); }, halt);
  return () => { halt(); unsubscribe(); };
}
