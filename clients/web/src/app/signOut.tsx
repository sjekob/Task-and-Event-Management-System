import { ReactElement, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { SignOutBlock } from '@shared/controllers/SessionController';
import { useSession } from './AppContext';
import { Button, Modal } from '../ui/kit';

/**
 * Sign-out that doesn't cut work off: while a save or upload is still running
 * it waits (or signs out once it's done), and with an unsaved form open it
 * asks first. Returns [signOut, dialog]; render the dialog.
 */
export function useSignOut(): [() => void, ReactElement | null] {
  const { session, pendingSaves } = useSession();
  const [block, setBlock] = useState<SignOutBlock | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (waiting && pendingSaves === 0) {
      setWaiting(false);
      setBlock(null);
      // The save finished: anything else (an unsaved form) still gets asked about.
      const next = session.signOutBlock();
      if (next) setBlock(next); else void session.logout();
    }
  }, [waiting, pendingSaves, session]);

  const signOut = () => {
    const b = session.signOutBlock();
    if (b) setBlock(b); else void session.logout();
  };
  const close = () => { setBlock(null); setWaiting(false); };

  let dialog: ReactElement | null = null;
  if (block?.kind === 'saving') {
    const done = pendingSaves === 0;
    dialog = (
      <Modal title={done ? 'Saved' : 'Still saving'} icon={<Loader2 size={20} className={done ? '' : 'spin'} color="var(--amber)" />} onClose={close}
        footer={<>
          <Button variant="ghost" onClick={close}>Stay signed in</Button>
          {done
            ? <Button onClick={() => { close(); signOut(); }}>Sign out</Button>
            : <Button loading={waiting} onClick={() => setWaiting(true)}>Sign out when it's done</Button>}
        </>}>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>
          {done
            ? 'Everything has been saved. You can sign out now.'
            : 'Something you did is still being saved or uploaded. Signing out now could lose it, so wait a moment.'}
        </div>
      </Modal>
    );
  } else if (block?.kind === 'unsaved') {
    dialog = (
      <Modal title="Sign out without saving?" icon={<AlertTriangle size={20} color="var(--amber)" />} onClose={close}
        footer={<>
          <Button variant="ghost" onClick={close}>Stay</Button>
          <Button variant="ghost-danger" onClick={() => { close(); void session.logout(); }}>Discard and sign out</Button>
        </>}>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>
          You have unsaved changes to this {block.what}. If you sign out now, they'll be lost. Stay to finish it.
        </div>
      </Modal>
    );
  }
  return [signOut, dialog];
}
