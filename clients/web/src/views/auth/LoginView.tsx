import { Eye, EyeOff, Info, User as UserIcon } from 'lucide-react';
import { LoginController } from '@shared/controllers/LoginController';
import { Navigation } from '@shared/controllers/Navigation';
import { useApp, useSession } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { Button, Modal } from '../../ui/kit';
import './login.css';

export default function LoginView() {
  const app = useApp();
  const { sessionExpired } = useSession();
  const [c, s] = useScreenController(() => new LoginController(app.session));

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void c.submit();
  };

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={submit}>
        <div className="row gap-12">
          <img src="/images/tasknet-logo.png" alt="" width={36} height={36} />
          <span style={{ fontSize: 18, fontWeight: 800 }}>TaskNet</span>
        </div>
        <h1 className="login-title">Sign in</h1>

        {sessionExpired && (
          <div className="alert amber mb-16">
            <Info size={16} />
            <span>Your session expired. Any in-progress event was saved as a draft.</span>
          </div>
        )}

        <div className="login-input">
          <input
            autoFocus
            placeholder="Username"
            autoComplete="username"
            value={s.username}
            onChange={(e) => c.setUsername(e.target.value)}
          />
          <UserIcon size={20} color="var(--light)" />
        </div>
        <div className="login-input mt-12">
          <input
            placeholder="Password"
            type={s.showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={s.password}
            onChange={(e) => c.setPassword(e.target.value)}
          />
          <button type="button" className="icon-btn-plain" style={{ color: 'var(--light)' }} onClick={() => c.toggleShowPassword()}
            aria-label={s.showPassword ? 'Hide password' : 'Show password'}>
            {s.showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {s.error && <div className="login-error">{s.error}</div>}

        <Button type="submit" block size="lg" loading={s.submitting} className="mt-12" style={{ padding: 15, fontSize: 16, borderRadius: 10 }}>
          {s.submitting ? '' : 'Log In'}
        </Button>
        <div className="caption" style={{ textAlign: 'center', marginTop: 12 }}>Forgot password? Ask the registrar to reset it.</div>
      </form>

      {s.roleChoices && (
        <Modal title="Log in as" subtitle="This account has more than one role. Choose which to use." onClose={() => c.cancelRoleChoice()}>
          <div className="col">
            {s.roleChoices.map((r) => (
              <Button key={r} variant="outline-muted" block onClick={() => void c.submit(r)} style={{ justifyContent: 'flex-start', padding: 14 }}>
                {Navigation.roleTitle(r)}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
