import { ReactNode, useEffect } from 'react';
import { AppState, View } from 'react-native';
import { useSession } from './AppModel';
import { Button, Modal, Row, T, C } from '../ui/kit';

/**
 * Wraps the app: every touch counts as activity for the session's idle clock
 * (without taking the touch from the screen underneath), time spent in the
 * background counts as idle, and the "still there?" warning shows before the
 * idle sign-out.
 */
export function IdleWatch({ children }: { children: ReactNode }) {
  const { session, idleWarning, user } = useSession();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') session.checkIdle(); });
    return () => sub.remove();
  }, [session]);

  return (
    <View style={{ flex: 1 }} onTouchStart={() => session.activity()}>
      {children}
      {user && idleWarning !== null && (
        <Modal title="Are you still there?" icon="clock" onClose={() => session.stayActive()}
          footer={<Row gap={8}>
            <Button variant="outline" style={{ flex: 1 }} onPress={() => void session.logout()}>Sign out</Button>
            <Button style={{ flex: 1 }} onPress={() => session.stayActive()}>Stay signed in</Button>
          </Row>}>
          <T size={14} color={C.text2}>
            For your security, you'll be signed out in {idleWarning} second{idleWarning === 1 ? '' : 's'} because there's been no activity.
            Unsaved event proposals are kept as drafts.
          </T>
        </Modal>
      )}
    </View>
  );
}
