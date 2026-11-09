import { BaseController } from './BaseController';
import { Services } from '../services';
import { User } from '../models';

export interface SessionState {
  user: User | null;
  /** True until the stored token has been checked at start-up. */
  restoring: boolean;
  loading: boolean;
  error: string | null;
  /** The session ended because the token expired (not a manual logout). */
  sessionExpired: boolean;
  /** Why it ended, shown on the sign-in screen (e.g. signed out after inactivity). */
  endReason: string | null;
  /** Seconds until the idle sign-out, while the "Are you still there?" warning is up; else null. */
  idleWarning: number | null;
  /** Saves and uploads still in flight: sign-out waits for them. */
  pendingSaves: number;
}

/** A form with unsaved work, asked about before signing out (e.g. a task being created). */
export interface LeaveGuard {
  /** What's being edited, e.g. "task" ("You have unsaved changes to this task"). */
  what: string;
  dirty: () => boolean;
  /** False when the work is kept anyway on sign-out (event proposals become drafts). Default true. */
  asksOnSignOut?: boolean;
  /** Stop guarding (the session is ending), so leaving for the sign-in page isn't blocked. */
  release?: () => void;
}

/** Why signing out should wait, or null when it can go ahead. */
export type SignOutBlock =
  | { kind: 'saving'; count: number }
  | { kind: 'unsaved'; what: string };

/** How often the idle clock is checked, the warning lead time, and the heartbeat spacing. */
const IDLE_CHECK_MS = 1_000;  // cheap (date maths); keeps the warning countdown smooth
const IDLE_WARN_MS = 60_000;
const HEARTBEAT_EVERY_MS = 2 * 60_000;

/**
 * The signed-in session (port of the Flutter AppState). Shared by every
 * screen: who is signed in, what they may do, and sign-in / sign-out.
 */
export class SessionController extends BaseController<SessionState> {
  private draftAutosave: (() => Promise<void>) | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivity = Date.now();
  private lastHeartbeat = 0;

  constructor(private readonly services: Services) {
    super({ user: null, restoring: true, loading: false, error: null, sessionExpired: false, endReason: null, idleWarning: null, pendingSaves: 0 });
    services.api.onUnauthorized = (reason) => {
      if (this.state.user) void this.expire(reason);
    };
    services.api.onPendingChange = (pendingSaves) => this.setState({ pendingSaves });
  }

  // ── Signing out in the middle of something ──
  private leaveGuards = new Set<LeaveGuard>();

  /** A form registers while it's open; returns the unregister function. */
  registerLeaveGuard(g: LeaveGuard): () => void {
    this.leaveGuards.add(g);
    return () => { this.leaveGuards.delete(g); };
  }

  /**
   * What should stop a sign-out right now: a save or upload still running
   * (wait for it), or a form with unsaved changes (ask first). Event
   * proposals aren't listed: they're saved as a draft on sign-out anyway.
   */
  signOutBlock(): SignOutBlock | null {
    if (this.services.api.pendingWrites > 0) return { kind: 'saving', count: this.services.api.pendingWrites };
    for (const g of this.leaveGuards) if (g.asksOnSignOut !== false && g.dirty()) return { kind: 'unsaved', what: g.what };
    return null;
  }

  private releaseLeaveGuards() {
    for (const g of this.leaveGuards) g.release?.();
  }

  // ── Idle sign-out ──
  // The platform reports input (clicks, keys, touches) through activity().
  // Background refreshes don't count. Real use is passed on to the server as
  // an occasional heartbeat, which enforces the same limit on its side.

  /** Milliseconds without activity before signing out (the server's setting). */
  get idleTimeoutMs() { return this.services.auth.idleTimeoutMinutes * 60_000; }

  /** The person did something (at [at], e.g. in another tab). */
  activity(at = Date.now()) {
    if (!this.state.user || at <= this.lastActivity) return;
    this.lastActivity = at;
    if (this.state.idleWarning !== null) this.setState({ idleWarning: null });
    if (at - this.lastHeartbeat >= HEARTBEAT_EVERY_MS) {
      this.lastHeartbeat = at;
      this.services.auth.heartbeat().catch(() => undefined);  // a 401 ends the session via onUnauthorized
    }
  }

  /** "Stay signed in" on the warning. */
  stayActive() {
    this.lastHeartbeat = 0;  // tell the server right away
    this.activity(Date.now());
  }

  /** Checks the idle clock now (also after the app returns from the background or the computer wakes). */
  checkIdle() {
    if (!this.state.user) return;
    const idle = Date.now() - this.lastActivity;
    const limit = this.idleTimeoutMs;
    if (idle >= limit) {
      const minutes = Math.round(limit / 60_000);
      void this.expire(`You were signed out after ${minutes} minute${minutes === 1 ? '' : 's'} of inactivity.`);
    } else if (idle >= limit - IDLE_WARN_MS) {
      this.setState({ idleWarning: Math.ceil((limit - idle) / 1000) });
    } else if (this.state.idleWarning !== null) {
      this.setState({ idleWarning: null });
    }
  }

  /** Starts the idle clock once per sign-in (opening the app counts as activity). */
  private startIdleClock() {
    if (this.idleTimer) return;
    this.lastActivity = this.lastHeartbeat = Date.now();
    this.services.auth.heartbeat().catch(() => undefined);
    this.idleTimer = setInterval(() => this.checkIdle(), IDLE_CHECK_MS);
  }

  private stopIdleClock() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
  }

  get user() { return this.state.user; }
  get isLoggedIn() { return this.state.user !== null; }
  get role() { return this.state.user?.role ?? ''; }

  /** Server-granted permission check for showing/hiding UI. */
  can(permission: string): boolean {
    return this.state.user?.can(permission) ?? false;
  }

  get assignableRoles(): string[] {
    return this.state.user?.assignableRoles ?? [];
  }

  /** Restore the session from a stored token. */
  async restore(): Promise<boolean> {
    const token = await this.services.api.getToken();
    if (!token) {
      this.setState({ restoring: false });
      return false;
    }
    const ok = await this.refreshUser();
    this.setState({ restoring: false });
    return ok;
  }

  /** Reload the signed-in user (e.g. after a profile photo change). */
  async refreshUser(): Promise<boolean> {
    try {
      const user = await this.services.auth.me();
      this.setState({ user });
      this.startIdleClock();
      await this.scheduleExpiryAutosave();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the available roles when the account holds more than one and no
   * role was chosen yet (the view prompts, then calls again with [role]).
   * Returns null once signed in. Throws with a readable message on failure.
   */
  async login(username: string, password: string, role?: string): Promise<string[] | null> {
    this.setState({ loading: true, error: null, sessionExpired: false, endReason: null });
    try {
      const r = await this.services.auth.login(username.trim(), password, role);
      if (r.kind === 'chooseRole') {
        this.setState({ loading: false });
        return r.roles;
      }
      this.setState({ user: r.user, loading: false });
      this.startIdleClock();
      await this.scheduleExpiryAutosave();
      return null;
    } catch (e) {
      const error = BaseController.messageOf(e, 'Invalid username or password');
      this.setState({ loading: false, error });
      throw new Error(error);
    }
  }

  async logout(): Promise<void> {
    this.clearTimer();
    this.stopIdleClock();
    await this.runDraftAutosave(); // save in-progress drafts while the token is valid
    this.releaseLeaveGuards();
    await this.services.auth.logout();
    this.setState({ user: null, sessionExpired: false, endReason: null, idleWarning: null });
  }

  // ── Draft auto-save hook ──
  // A screen with unsaved, draftable work (e.g. the event proposal form)
  // registers a callback that runs right before logout or token expiry.
  registerDraftAutosave(cb: () => Promise<void>) {
    this.draftAutosave = cb;
  }

  unregisterDraftAutosave(cb: () => Promise<void>) {
    if (this.draftAutosave === cb) this.draftAutosave = null;
  }

  private async runDraftAutosave() {
    const cb = this.draftAutosave;
    if (!cb) return;
    try {
      await cb();
    } catch {
      /* best effort */
    }
  }

  private ending = false;

  /** Ends the session without the person asking (token expired, idle, signed out elsewhere). */
  private async expire(reason?: string) {
    if (this.ending) return;
    this.ending = true;
    try {
      this.clearTimer();
      this.stopIdleClock();
      this.setState({ idleWarning: null });
      await this.runDraftAutosave(); // the server allows a few minutes' grace, so this still saves
      this.releaseLeaveGuards();
      await this.services.auth.logout();
      this.setState({ user: null, sessionExpired: true, endReason: reason ?? null });
    } finally {
      this.ending = false;
    }
  }

  /** Fire ~1 minute before the JWT expires so drafts are saved with a valid token. */
  private async scheduleExpiryAutosave() {
    this.clearTimer();
    const exp = SessionController.jwtExpiryMs(await this.services.api.getToken());
    if (exp === null) return;
    const delay = exp - 60_000 - Date.now();
    if (delay <= 0) {
      await this.expire();
      return;
    }
    // setTimeout overflows above ~24.8 days; tokens are much shorter-lived.
    this.expiryTimer = setTimeout(() => void this.expire(), Math.min(delay, 2_000_000_000));
  }

  private clearTimer() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
  }

  /** The `exp` claim of a JWT, as epoch milliseconds. */
  static jwtExpiryMs(token: string | null): number | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const json = JSON.parse(base64UrlDecode(parts[1]));
      return typeof json.exp === 'number' ? json.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  override dispose() {
    this.clearTimer();
    this.stopIdleClock();
    super.dispose();
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64url → UTF-8 string, without relying on atob (absent on some RN engines). */
function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}
