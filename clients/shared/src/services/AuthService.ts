import { ApiClient } from './ApiClient';
import { User } from '../models';

export type LoginResult =
  | { kind: 'signedIn'; user: User; token: string }
  | { kind: 'chooseRole'; roles: string[] };

export class AuthService {
  constructor(private readonly api: ApiClient) {}

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
    return { kind: 'signedIn', user: User.fromJson(data.user), token: data.token };
  }

  async me(): Promise<User> {
    return User.fromJson(await this.api.get('/api/auth/me', { timeoutMs: 10000, fallback: 'Not authenticated' }));
  }

  logout(): Promise<void> {
    return this.api.clearToken();
  }
}
