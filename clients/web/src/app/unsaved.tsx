import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, Modal } from '../ui/kit';
import { useApp } from './AppContext';

/**
 * True once [value] differs from what it was when the form opened. [value]
 * should hold only what the person types or picks (not loading flags).
 */
export function useDirty(value: unknown): boolean {
  const key = JSON.stringify(value, (_k, v) => (v instanceof Set ? [...v].sort() : v));
  const first = useRef(key);
  return key !== first.current;
}

/**
 * Warns before leaving a form with unsaved changes: any in-app navigation
 * (sidebar, links, Back) opens a dialog to stay, save a draft (when the form
 * has drafts) or discard; closing or reloading the tab gets the browser's own
 * warning. Call release() right before navigating away after a successful save.
 */
export function useUnsavedGuard(dirty: boolean, opts: { what: string; saveDraft?: () => Promise<boolean>; saveLabel?: string; onDiscard?: () => void }) {
  const released = useRef(false);
  const app = useApp();
  // Signing out asks about this form too (unless it's kept as a draft anyway),
  // and releases it so the way to the sign-in page isn't blocked.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => app.session.registerLeaveGuard({
    what: opts.what,
    dirty: () => dirtyRef.current && !released.current,
    asksOnSignOut: !opts.saveDraft,
    release: () => { released.current = true; },
  }), [app, opts.what, !opts.saveDraft]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !released.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (released.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const release = useCallback(() => { released.current = true; }, []);
  const [saving, setSaving] = useState(false);

  const dialog = blocker.state === 'blocked' ? (
    <Modal title="Leave without saving?" icon={<AlertTriangle size={20} color="var(--amber)" />} onClose={() => blocker.reset?.()}
      footer={<>
        <Button variant="ghost" onClick={() => blocker.reset?.()}>Stay on this page</Button>
        <Button variant="ghost-danger" onClick={() => { released.current = true; opts.onDiscard?.(); blocker.proceed?.(); }}>Discard changes</Button>
        {opts.saveDraft && (
          <Button loading={saving} onClick={async () => {
            setSaving(true);
            const ok = await opts.saveDraft!().catch(() => false);
            setSaving(false);
            if (ok) { released.current = true; blocker.proceed?.(); } else blocker.reset?.();
          }}>{opts.saveLabel ?? 'Save draft and leave'}</Button>
        )}
      </>}>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>
        You have unsaved changes to this {opts.what}. If you leave now, they'll be lost.
        {opts.saveDraft ? ' Save it as a draft to finish later, or stay to keep working.' : ' Stay to finish it, or discard the changes.'}
      </div>
    </Modal>
  ) : null;

  return { dialog, release };
}
