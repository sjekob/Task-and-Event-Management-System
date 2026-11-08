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
}

/**
 * The signed-in session (port of the Flutter AppState). Shared by every
 * screen: who is signed in, what they may do, and sign-in / sign-out.
 */
export class SessionController extends BaseController<SessionState> {
  private draftAutosave: (() => Promise<void>) | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly services: Services) {
    super({ user: null, restoring: true, loading: false, error: null, sessionExpired: false });
    services.api.onUnauthorized = () => {
      if (this.state.user) void this.expire();
    };
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
    this.setState({ loading: true, error: null, sessionExpired: false });
    try {
      const r = await this.services.auth.login(username.trim(), password, role);
      if (r.kind === 'chooseRole') {
        this.setState({ loading: false });
        return r.roles;
      }
      this.setState({ user: r.user, loading: false });
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
    await this.runDraftAutosave(); // save in-progress drafts while the token is valid
    await this.services.auth.logout();
    this.setState({ user: null, sessionExpired: false });
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

  private async expire() {
    this.clearTimer();
    await this.runDraftAutosave();
    await this.services.auth.logout();
    this.setState({ user: null, sessionExpired: true });
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
