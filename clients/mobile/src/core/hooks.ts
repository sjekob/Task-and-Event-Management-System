import { DependencyList, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { BaseController } from '@shared/controllers/BaseController';
import { startLiveRefresh } from '@shared/utils/live';

export type StateOf<C> = C extends BaseController<infer S> ? S : never;

/** Re-render whenever the controller's state changes. */
export function useControllerState<S extends object>(controller: BaseController<S>): S {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

/** A controller for this screen's lifetime; disposed on unmount. Returns [controller, state]. */
export function useScreenController<C extends BaseController<any>>(factory: () => C, deps: DependencyList = []): [C, StateOf<C>] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controller = useMemo(factory, deps);
  useEffect(() => () => controller.dispose(), [controller]);
  return [controller, useControllerState(controller) as StateOf<C>];
}

/** Reloads [reload] every 30 s while the app is in the foreground, and at once when the person returns to it. */
export function useLiveRefresh(reload: () => void, enabled = true) {
  const cb = useRef(reload);
  cb.current = reload;
  useEffect(() => {
    if (!enabled) return;
    return startLiveRefresh(() => cb.current(), (onResume, onPause) => {
      const sub = AppState.addEventListener('change', (st) => (st === 'active' ? onResume() : onPause()));
      return () => sub.remove();
    });
  }, [enabled]);
}
