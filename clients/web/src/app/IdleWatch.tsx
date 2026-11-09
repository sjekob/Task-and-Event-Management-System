import { useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useSession } from './AppContext';
import { Button, Modal } from '../ui/kit';

const SHARED_KEY = 'tasknet.lastActivity';
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'] as const;

/**
 * Reports input to the session's idle clock and shows the "still there?"
 * warning before the idle sign-out. Activity in one tab keeps the others
 * signed in too (shared through localStorage). Mount once inside the shell.
 */
export function IdleWatch() {
  const { session, idleWarning } = useSession();
  const lastShared = useRef(0);

  useEffect(() => {
    const onInput = () => {
      const now = Date.now();
      session.activity(now);
      if (now - lastShared.current > 15_000) {  // mousemove fires a lot: share at most every 15 s
        lastShared.current = now;
        try { localStorage.setItem(SHARED_KEY, String(now)); } catch { /* storage blocked */ }
      }
    };
    const onOtherTab = (e: StorageEvent) => {
      if (e.key === SHARED_KEY && e.newValue) session.activity(Number(e.newValue));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') session.checkIdle(); };
    for (const ev of EVENTS) window.addEventListener(ev, onInput, { passive: true, capture: true });
    window.addEventListener('storage', onOtherTab);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      for (const ev of EVENTS) window.removeEventListener(ev, onInput, { capture: true });
      window.removeEventListener('storage', onOtherTab);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session]);

  if (idleWarning === null) return null;
  return (
    <Modal title="Are you still there?" icon={<Clock size={20} color="var(--amber)" />} onClose={() => session.stayActive()}
      footer={<>
        <Button variant="ghost" onClick={() => void session.logout()}>Sign out</Button>
        <Button onClick={() => session.stayActive()}>Stay signed in</Button>
      </>}>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>
        For your security, you'll be signed out in <b style={{ color: 'var(--text)' }}>{idleWarning} second{idleWarning === 1 ? '' : 's'}</b> because
        there's been no activity. Unsaved event proposals are kept as drafts.
      </div>
    </Modal>
  );
}
