import React, { createContext, useContext, useSyncExternalStore } from 'react';
import { User } from '../models/models';
import { ApiService } from './apiService';

type DraftAutosave = () => Promise<void>;

function decodeBase64(input: string): string {
  if (typeof atob === 'function') return atob(input);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of input.replace(/=+$/, '')) {
    buffer = (buffer << 6) | chars.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

export class AppState {
  currentUser: User | null = null;
  isLoading = false;
  error: string | null = null;

  /// Set when the session ends because the token expired (vs. a manual logout),
  /// so the login screen can tell the user their work was auto-saved.
  sessionExpired = false;

  private listeners = new Set<() => void>();
  private version = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): number => this.version;

  private notifyListeners(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  get isLoggedIn(): boolean { return this.currentUser != null; }
  get isAdmin(): boolean { return this.currentUser?.isAdmin ?? false; }
  get isPrincipal(): boolean { return this.currentUser?.isPrincipal ?? false; }
  get isCoordinator(): boolean { return this.currentUser?.isCoordinator ?? false; }
  get isDean(): boolean { return this.currentUser?.isDean ?? false; }
  get isTeacher(): boolean { return this.currentUser?.isTeacher ?? false; }
  get isRegistrar(): boolean { return this.currentUser?.isRegistrar ?? false; }
  get canManageTasks(): boolean { return this.currentUser?.isManager ?? false; }
  get canReviewSubmissions(): boolean { return this.currentUser?.canReviewSubmissions ?? false; }
  get canAssign(): boolean { return this.currentUser?.canAssign ?? false; }

  /// Server-granted permission check for showing/hiding UI. The backend
  /// enforces the same permissions on every request.
  can(permission: string): boolean { return this.currentUser?.can(permission) ?? false; }

  /// Roles this session may assign tasks to, as decided by the backend.
  get assignableRoles(): string[] { return this.currentUser?.assignableRoles ?? []; }

  get userRole(): string { return this.currentUser?.role ?? ''; }

  // ── Draft auto-save hook ────────────────────────────────────────────────────
  // A screen with unsaved, draftable work (e.g. AddEventScreen) registers a
  // callback here. It runs — while the token is still valid — right before a
  // logout or a token-expiry, so the work is persisted as a draft.
  private draftAutosave: DraftAutosave | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  registerDraftAutosave(cb: DraftAutosave): void { this.draftAutosave = cb; }
  unregisterDraftAutosave(cb: DraftAutosave): void {
    if (this.draftAutosave === cb) this.draftAutosave = null;
  }

  private async runDraftAutosave(): Promise<void> {
    const cb = this.draftAutosave;
    if (cb == null) return;
    try {
      await cb();
    } catch {/* best-effort */}
  }

  private cancelExpiryTimer(): void {
    if (this.expiryTimer != null) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
  }

  async tryAutoLogin(): Promise<boolean> {
    try {
      this.currentUser = await ApiService.getMe();
      this.notifyListeners();
      await this.scheduleExpiryAutosave();
      return true;
    } catch {
      return false;
    }
  }

  /// Returns the list of available roles when the account holds more than one
  /// and no role was chosen yet (caller must prompt, then call again with
  /// [role]). Returns null once the user is fully logged in.
  async login(username: string, password: string, role?: string | null): Promise<string[] | null> {
    this.isLoading = true;
    this.error = null;
    this.sessionExpired = false;
    this.notifyListeners();
    try {
      const data = await ApiService.login(username, password, role);
      if (data.needs_role_selection === true) {
        this.isLoading = false;
        this.notifyListeners();
        return ((data.available_roles ?? []) as unknown[]).map((e) => String(e));
      }
      this.currentUser = User.fromJson(data.user);
      this.isLoading = false;
      this.notifyListeners();
      await this.scheduleExpiryAutosave();
      return null;
    } catch (e) {
      this.error = String(e);
      this.isLoading = false;
      this.notifyListeners();
      throw e;
    }
  }

  async logout(): Promise<void> {
    this.cancelExpiryTimer();
    await this.runDraftAutosave(); // save in-progress draft while token is still valid
    await ApiService.clearToken();
    this.currentUser = null;
    this.notifyListeners();
  }

  /// Fired by the expiry timer: persist the draft, then end the session.
  private expireSession = async (): Promise<void> => {
    this.cancelExpiryTimer();
    await this.runDraftAutosave();
    await ApiService.clearToken();
    this.currentUser = null;
    this.sessionExpired = true;
    this.notifyListeners();
  };

  /// Schedule a one-shot timer to fire ~1 minute before the JWT expires, so the
  /// draft can be saved with a still-valid token before the session is dropped.
  private async scheduleExpiryAutosave(): Promise<void> {
    this.cancelExpiryTimer();
    const token = await ApiService.token();
    const expMs = AppState.jwtExpiryMs(token);
    if (expMs == null) return;
    const delay = expMs - 60 * 1000 - Date.now();
    if (delay < 0) {
      // Already expired or about to — save and end now.
      await this.expireSession();
      return;
    }
    // setTimeout overflows past ~24.8 days; a token that long-lived needs no timer yet.
    if (delay > 0x7fffffff) return;
    this.expiryTimer = setTimeout(this.expireSession, delay);
  }

  /// Decode the `exp` claim (seconds) from a JWT, returning epoch milliseconds.
  private static jwtExpiryMs(token: string | null): number | null {
    if (token == null) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4 !== 0) payload += '=';
      const utf8 = decodeBase64(payload)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('');
      const map = JSON.parse(decodeURIComponent(utf8)) as Record<string, unknown>;
      const exp = map.exp;
      return typeof exp === 'number' && Number.isInteger(exp) ? exp * 1000 : null;
    } catch {
      return null;
    }
  }
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ value, children }: { value: AppState; children: React.ReactNode }) {
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/// The shared app state, re-rendering the caller whenever it changes
/// (re-renders whenever the state changes).
export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (state == null) throw new Error('useAppState must be used inside AppStateProvider');
  useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot);
  return state;
}
