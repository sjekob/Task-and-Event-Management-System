import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal as RNModal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseController } from '@shared/controllers/BaseController';
import { Button, Field, Input } from './controls';
import { Icon } from './icons';
import { T } from './text';
import { C } from './theme';

type ToastKind = 'info' | 'error' | 'success';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Ask for a note; prompt() then resolves with the text (or null when cancelled). */
  input?: { label: string; placeholder?: string; required?: boolean; initial?: string };
}

export interface Feedback {
  toast: (text: string, kind?: ToastKind) => void;
  error: (e: unknown) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: ConfirmOptions) => Promise<string | null>;
}

const Ctx = createContext<Feedback | null>(null);

const TOAST_COLOR: Record<ToastKind, string> = { info: C.dark, error: C.redDark, success: C.greenDark };

/** Snackbars and confirmation dialogs for every screen. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ text: string; kind: ToastKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: string | null) => void }) | null>(null);
  const [text, setText] = useState('');

  const show = useCallback((t: string, kind: ToastKind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text: t, kind });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const ask = useCallback((o: ConfirmOptions) => new Promise<string | null>((resolve) => {
    setText(o.input?.initial ?? '');
    setDialog({ ...o, resolve });
  }), []);

  const api = useMemo<Feedback>(() => ({
    toast: show,
    error: (e) => show(BaseController.messageOf(e), 'error'),
    confirm: async (o) => (await ask(o)) !== null,
    prompt: ask,
  }), [show, ask]);

  const close = (v: string | null) => { dialog?.resolve(v); setDialog(null); };
  const needsText = !!dialog?.input?.required && !text.trim();

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast && (
        <Pressable onPress={() => setToast(null)}
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 20, backgroundColor: TOAST_COLOR[toast.kind], borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 }}>
          <Icon name={toast.kind === 'error' ? 'alert-circle' : toast.kind === 'success' ? 'check-circle' : 'info'} size={18} color="#fff" />
          <T size={13.5} weight={500} color="#fff" style={{ flex: 1 }}>{toast.text}</T>
        </Pressable>
      )}
      {dialog && (
        <RNModal visible transparent animationType="fade" onRequestClose={() => close(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 }}>
              <T size={17} weight={700}>{dialog.title}</T>
              {dialog.message ? <T size={14} color={C.text2}>{dialog.message}</T> : null}
              {dialog.input && (
                <Field label={dialog.input.label}>
                  <Input multiline rows={3} value={text} onChangeText={setText} placeholder={dialog.input.placeholder} autoFocus />
                </Field>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <Button variant="ghost" onPress={() => close(null)}>{dialog.cancelLabel ?? 'Cancel'}</Button>
                <Button variant={dialog.danger ? 'danger' : 'dark'} disabled={needsText} onPress={() => close(dialog.input ? text.trim() : '')}>
                  {dialog.confirmLabel ?? 'OK'}
                </Button>
              </View>
            </View>
          </View>
        </RNModal>
      )}
    </Ctx.Provider>
  );
}

export function useFeedback(): Feedback {
  const f = useContext(Ctx);
  if (!f) throw new Error('useFeedback outside FeedbackProvider');
  return f;
}
