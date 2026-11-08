import { BaseController } from './BaseController';
import { Services } from '../services';

/** Add a new account (principal/admin). */
export class AddUserController extends BaseController<{ email: string; username: string; password: string; show: boolean; saving: boolean; error: string | null }> {
  constructor(private readonly services: Services) {
    super({ email: '', username: '', password: '', show: false, saving: false, error: null });
  }

  set(patch: Partial<{ email: string; username: string; password: string }>) { this.setState({ ...patch, error: null }); }
  toggleShow() { this.setState((s) => ({ show: !s.show })); }

  get canSubmit() {
    const s = this.state;
    return !s.saving && !!s.email.trim() && !!s.username.trim() && s.password.length >= 6;
  }

  get passwordError(): string | null {
    const p = this.state.password;
    return p && p.length < 6 ? 'Min. 6 characters' : null;
  }

  async submit(): Promise<boolean> {
    if (!this.canSubmit) return false;
    this.setState({ saving: true, error: null });
    try {
      const username = this.state.username.trim();
      await this.services.personnel.create({
        email: this.state.email.trim(), username, password: this.state.password, first_name: username, last_name: '', role: 'teacher',
      });
      return true;
    } catch (e) {
      this.setState({ error: BaseController.messageOf(e) });
      return false;
    } finally {
      this.setState({ saving: false });
    }
  }
}
