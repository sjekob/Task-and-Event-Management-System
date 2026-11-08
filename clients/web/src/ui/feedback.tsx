import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Button, Field, Modal, TextArea } from './kit';

type ToastKind = 'info' | 'error' | 'success';
interface Toast { id: number; text: string; kind: ToastKind }

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Ask for a note; the promise then resolves with the text (or null when cancelled). */
  input?: { label: string; placeholder?: string; required?: boolean; initial?: string };
}

interface Feedback {
  toast: (text: string, kind?: ToastKind) => void;
  error: (e: unknown) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: ConfirmOptions) => Promise<string | null>;
}

const Ctx = createContext<Feedback | null>(null);

/** Snackbars and confirmation dialogs for every screen. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: string | null) => void }) | null>(null);
  const [text, setText] = useState('');
  const seq = useRef(0);

  const toast = useCallback((t: string, kind: ToastKind = 'info') => {
    const id = ++seq.current;
    setToasts((l) => [...l, { id, text: t, kind }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3800);
  }, []);

  const error = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong';
    toast(msg.replace(/^Exception: /, ''), 'error');
  }, [toast]);

  const prompt = useCallback((o: ConfirmOptions) => new Promise<string | null>((resolve) => {
    setText(o.input?.initial ?? '');
    setDialog({ ...o, resolve });
  }), []);

  const confirm = useCallback(async (o: ConfirmOptions) => (await prompt(o)) !== null, [prompt]);

  const close = (v: string | null) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, error, confirm, prompt }}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title}
          onClose={() => close(null)}
          footer={
            <>
              <Button variant="outline-muted" onClick={() => close(null)}>{dialog.cancelLabel ?? 'Cancel'}</Button>
              <Button
                variant={dialog.danger ? 'danger' : 'primary'}
                disabled={!!dialog.input?.required && !text.trim()}
                onClick={() => close(dialog.input ? text.trim() : '')}
              >
                {dialog.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          {dialog.message && <div className="text-2" style={{ fontSize: 14 }}>{dialog.message}</div>}
          {dialog.input && (
            <Field label={dialog.input.label} className="mt-12">
              <TextArea autoFocus value={text} placeholder={dialog.input.placeholder} onChange={(e) => setText(e.target.value)} />
            </Field>
          )}
        </Modal>
      )}
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}

export function useFeedback(): Feedback {
  const f = useContext(Ctx);
  if (!f) throw new Error('FeedbackProvider missing');
  return f;
}
