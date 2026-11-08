import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, DependencyList } from 'react';
import { BaseController } from '@shared/controllers/BaseController';
import { startLiveRefresh } from '@shared/utils/live';

/** Re-render the view whenever the controller's state changes; returns that state. */
export function useControllerState<S extends object>(controller: BaseController<S>): S {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

/**
 * Create a screen controller for this view's lifetime (re-created when deps
 * change) and dispose it when the view goes away. Returns [controller, state].
 */
export type StateOf<C> = C extends BaseController<infer S> ? S : never;

export function useScreenController<C extends BaseController<any>>(
  factory: () => C,
  deps: DependencyList = [],
): [C, StateOf<C>] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controller = useMemo(factory, deps);
  useEffect(() => () => controller.dispose(), [controller]);
  const state = useControllerState(controller) as StateOf<C>;
  return [controller, state];
}

/** Calls [onEnd] when the element scrolls into view (infinite scroll sentinel). */
export function useInfiniteScroll(onEnd: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onEnd);
  cb.current = onEnd;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) cb.current();
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

/** Debounced value (e.g. a search box). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  const set = useCallback((n: T) => setV(() => n), []);
  useEffect(() => {
    const t = setTimeout(() => set(value), ms);
    return () => clearTimeout(t);
  }, [value, ms, set]);
  return v;
}

/** Window width < 768px. */
export function useIsMobile(): boolean {
  const query = '(max-width: 767px)';
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Reloads [reload] every 30 s while the tab is visible, and at once when the person comes back to it. */
export function useLiveRefresh(reload: () => void, enabled = true) {
  const cb = useRef(reload);
  cb.current = reload;
  useEffect(() => {
    if (!enabled) return;
    return startLiveRefresh(() => cb.current(), (onResume, onPause) => {
      const onVisibility = () => (document.visibilityState === 'visible' ? onResume() : onPause());
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    });
  }, [enabled]);
}
