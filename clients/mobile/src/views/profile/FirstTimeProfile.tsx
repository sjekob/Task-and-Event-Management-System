import { View } from 'react-native';
import { ProfileController } from '@shared/controllers/ProfileControllers';
import { useApp } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Spinner, T } from '../../ui/kit';
import { EditProfileDialog } from './EditProfileDialog';

/**
 * Shown instead of the app while a teacher's required personal details are
 * missing (their first sign-in). Saving refreshes the session, which lets them in.
 */
export function FirstTimeProfile() {
  const app = useApp();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => {
    const ctl = new ProfileController(app.services, app.session);
    void ctl.load();
    return ctl;
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24, gap: 12 }}>
      {s.profile
        ? <EditProfileDialog firstTime profile={s.profile} onClose={(saved) => { if (saved) fb.toast('Profile saved. Welcome to TaskNet!', 'success'); }} />
        : s.error
          ? <><T color={C.red} center>{s.error}</T><Button onPress={() => void c.load()}>Try again</Button></>
          : <Spinner />}
    </View>
  );
}
