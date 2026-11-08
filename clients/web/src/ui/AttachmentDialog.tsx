import { useState } from 'react';
import { ATTACHMENT_KINDS, Attachment, AttachmentKind, makeLinkAttachment } from '@shared/controllers/TaskFormController';
import { Button, Field, Modal, TextInput } from './kit';

/** Asks for a link (URL + optional name) of the given kind. */
export function AttachmentDialog({ kind, onClose, onAdd }: { kind: AttachmentKind; onClose: () => void; onAdd: (a: Attachment) => void }) {
  const meta = ATTACHMENT_KINDS.find((k) => k.kind === kind)!;
  const [url, setUrl] = useState('https://');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const confirm = () => {
    const r = makeLinkAttachment(kind, url, name);
    if (typeof r === 'string') { setError(r); return; }
    onAdd(r);
    onClose();
  };
  return (
    <Modal title={meta.title} onClose={onClose}
      footer={<><Button variant="outline-muted" onClick={onClose}>Cancel</Button><Button onClick={confirm}>Add</Button></>}>
      <div className="col gap-12">
        <Field label="URL" error={error}>
          <TextInput autoFocus value={url} placeholder={meta.hint} invalid={!!error}
            onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirm()} />
        </Field>
        <Field label="Name (optional)">
          <TextInput value={name} placeholder="Label for this attachment" onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirm()} />
        </Field>
      </div>
    </Modal>
  );
}
