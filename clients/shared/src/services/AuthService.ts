import { ApiClient } from './ApiClient';
import { User } from '../models';

export type LoginResult =
  | { kind: 'signedIn'; user: User; token: string }
  | { kind: 'chooseRole'; roles: string[] };

export class AuthService {
  /** Minutes without activity before the server ends a session (it says so at sign-in and in /me). */
  idleTimeoutMinutes = 30;

  constructor(private readonly api: ApiClient) {}

  private readIdle(data: any) {
    const n = Number(data?.idle_timeout_minutes);
    if (Number.isFinite(n) && n > 0) this.idleTimeoutMinutes = n;
  }

  /**
   * Signs in. A multi-role account first gets {kind: 'chooseRole'}; call again
   * with the chosen [role].
   */
  async login(username: string, password: string, role?: string): Promise<LoginResult> {
    const data = await this.api.post('/api/auth/login', {
      body: { username, password, ...(role ? { role } : {}) },
      anonymous: true,
      timeoutMs: 10000,
      fallback: 'Invalid username or password',
    }).catch((e) => {
      if (e?.status === 401 || e?.status === 400) throw new Error('Invalid username or password');
      throw e;
    });
    if (data?.needs_role_selection === true) {
      return { kind: 'chooseRole', roles: (data.available_roles ?? []).map(String) };
    }
    await this.api.saveToken(data.token);
    this.readIdle(data);
    return { kind: 'signedIn', user: User.fromJson(data.user), token: data.token };
  }

  async me(): Promise<User> {
    const data = await this.api.get('/api/auth/me', { timeoutMs: 10000, fallback: 'Not authenticated' });
    this.readIdle(data);
    return User.fromJson(data);
  }

  /** Tells the server the person is using the app, so the session doesn't time out. */
  async heartbeat(): Promise<void> {
    this.readIdle(await this.api.post('/api/auth/heartbeat', { timeoutMs: 10000, background: true }));
  }

  /** Ends the session on the server (best effort), then forgets the token here. */
  async logout(): Promise<void> {
    if (await this.api.getToken()) {
      await this.api.post('/api/auth/logout', { quiet401: true, background: true, timeoutMs: 5000, ok: [204, 200] }).catch(() => undefined);
    }
    await this.api.clearToken();
  }
}
