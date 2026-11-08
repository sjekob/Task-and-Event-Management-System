export type Listener = () => void;

/**
 * Base of every controller (the C in MVC). A controller owns a screen's state
 * and the actions that change it; views only render `state` and call methods.
 * State is immutable: each update replaces the object, so React views can
 * subscribe with useSyncExternalStore.
 */
export abstract class BaseController<S extends object> {
  private _state: S;
  private readonly listeners = new Set<Listener>();
  private disposed = false;

  protected constructor(initial: S) {
    this._state = initial;
  }

  get state(): S {
    return this._state;
  }

  /** Subscribe to state changes; returns the unsubscribe function. */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): S => this._state;

  protected setState(patch: Partial<S> | ((s: S) => Partial<S>)): void {
    if (this.disposed) return;
    const next = typeof patch === 'function' ? patch(this._state) : patch;
    this._state = { ...this._state, ...next };
    this.listeners.forEach((l) => l());
  }

  get isDisposed() {
    return this.disposed;
  }

  /** Stop notifying views (the screen was closed). Pending requests are ignored. */
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  /** Readable message for any thrown value. */
  static messageOf(e: unknown, fallback = 'Something went wrong'): string {
    if (e instanceof Error && e.message) return e.message.replace(/^Exception: /, '');
    if (typeof e === 'string' && e) return e;
    return fallback;
  }
}

/** Common shape for screens that load data once and may fail. */
export interface LoadState {
  loading: boolean;
  error: string | null;
}
