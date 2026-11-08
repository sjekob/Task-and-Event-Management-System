import { BaseController } from './BaseController';
import { SessionController } from './SessionController';

export interface LoginState {
  username: string;
  password: string;
  showPassword: boolean;
  submitting: boolean;
  error: string | null;
  /** Set when the account holds several roles: the view asks which to use. */
  roleChoices: string[] | null;
}

/** The sign-in form. */
export class LoginController extends BaseController<LoginState> {
  constructor(private readonly session: SessionController) {
    super({ username: '', password: '', showPassword: false, submitting: false, error: null, roleChoices: null });
  }

  setUsername(username: string) { this.setState({ username, error: null }); }
  setPassword(password: string) { this.setState({ password, error: null }); }
  toggleShowPassword() { this.setState((s) => ({ showPassword: !s.showPassword })); }
  cancelRoleChoice() { this.setState({ roleChoices: null }); }

  /** Returns true once signed in. */
  async submit(role?: string): Promise<boolean> {
    const { username, password } = this.state;
    if (!username.trim() || !password) {
      this.setState({ error: 'Enter your username and password.' });
      return false;
    }
    this.setState({ submitting: true, error: null, roleChoices: null });
    try {
      const roles = await this.session.login(username, password, role);
      if (roles) {
        this.setState({ submitting: false, roleChoices: roles });
        return false;
      }
      this.setState({ submitting: false });
      return true;
    } catch (e) {
      this.setState({ submitting: false, error: BaseController.messageOf(e, 'Invalid username or password') });
      return false;
    }
  }
}
