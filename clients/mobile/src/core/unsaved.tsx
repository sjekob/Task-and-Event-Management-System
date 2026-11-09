import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
import { Button, C, Modal, T } from '../ui/kit';

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
 * Warns before leaving a form with unsaved changes: the header back arrow,
 * Android's back button and the swipe-back gesture all ask first, to stay,
 * save a draft (when the form has drafts) or discard. Call release() right
 * before leaving after a successful save. Same choices as the web version.
 */
export function useUnsavedGuard(dirty: boolean, opts: { what: string; saveDraft?: () => Promise<boolean>; saveLabel?: string; onDiscard?: () => void }) {
  const navigation = useNavigation();
  const released = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [pending, setPending] = useState<{ action: unknown } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => navigation.addListener('beforeRemove', (e: any) => {
    if (!dirtyRef.current || released.current) return;
    e.preventDefault();
    setPending({ action: e.data.action });
  }), [navigation]);

  const release = useCallback(() => { released.current = true; }, []);
  const go = () => {
    const p = pending;
    released.current = true;
    setPending(null);
    if (p) navigation.dispatch(p.action as never);
  };

  const dialog = pending ? (
    <Modal title="Leave without saving?" icon="alert-triangle" onClose={() => setPending(null)}
      footer={<>
        <Button variant="ghost" onPress={() => setPending(null)}>Stay</Button>
        <Button variant="ghost-danger" onPress={() => { opts.onDiscard?.(); go(); }}>Discard</Button>
        {opts.saveDraft && (
          <Button loading={saving} onPress={async () => {
            setSaving(true);
            const ok = await opts.saveDraft!().catch(() => false);
            setSaving(false);
            if (ok) go(); else setPending(null);
          }}>{opts.saveLabel ?? 'Save draft'}</Button>
        )}
      </>}>
      <T size={14} color={C.text2}>
        You have unsaved changes to this {opts.what}. If you leave now, they'll be lost.
        {opts.saveDraft ? ' Save it as a draft to finish later, or stay to keep working.' : ' Stay to finish it, or discard the changes.'}
      </T>
    </Modal>
  ) : null;

  return { dialog, release };
}
