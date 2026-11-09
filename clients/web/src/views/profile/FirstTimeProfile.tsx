import { ProfileController } from '@shared/controllers/ProfileControllers';
import { useApp } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Spinner } from '../../ui/kit';
import { EditProfileDialog } from './EditProfileDialog';

/**
 * Shown instead of the app while a teacher's required personal details are
 * missing (their first sign-in). Saving refreshes the session, which lets
 * them in.
 */
export function FirstTimeProfile() {
  const app = useApp();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => {
    const ctl = new ProfileController(app.services, app.session);
    void ctl.load();
    return ctl;
  }, []);
  if (s.profile) {
    return <EditProfileDialog firstTime profile={s.profile} onClose={(saved) => { if (saved) fb.toast('Profile saved. Welcome to TaskNet!'); }} />;
  }
  return (
    <div className="center-fill" style={{ padding: 40 }}>
      {s.error ? (
        <div className="col gap-12" style={{ alignItems: 'center' }}>
          <div className="alert red">{s.error}</div>
          <Button onClick={() => void c.load()}>Try again</Button>
        </div>
      ) : <Spinner />}
    </div>
  );
}
