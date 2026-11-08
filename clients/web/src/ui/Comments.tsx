import { useState } from 'react';
import { ArrowUp, MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';
import { Comment } from '@shared/models';
import { Format } from '@shared/utils/format';
import { ActionMenu, Avatar } from './kit';

export function CommentItem({ comment, onEdit, onDelete }: { comment: Comment; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="row-top gap-12" style={{ marginBottom: 12 }}>
      <Avatar initials={comment.fullName.charAt(0).toUpperCase() || '?'} size={32} />
      <div className="grow">
        <div className="row gap-6">
          <span className="ellipsis" style={{ fontSize: 12, fontWeight: 600 }}>{comment.fullName}</span>
          <span className="body-sm">{Format.date(comment.createdAt, '')}</span>
          {(onEdit || onDelete) && (
            <ActionMenu icon={<MoreHorizontal size={18} />} items={[
              { label: 'Edit', icon: <Pencil size={15} />, onClick: () => onEdit?.(), hidden: !onEdit },
              { label: 'Delete', icon: <Trash2 size={15} />, onClick: () => onDelete?.(), danger: true, hidden: !onDelete },
            ]} />
          )}
        </div>
        <div className="body-md pre-wrap" style={{ color: 'var(--text-2)' }}>{comment.content}</div>
      </div>
    </div>
  );
}

/** Multi-line comment box with a Send button. */
export function CommentInput({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<void> | void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { await onSend(t); setText(''); } finally { setBusy(false); }
  };
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: '100%', border: 0, outline: 'none', resize: 'vertical', padding: '12px 14px 8px', fontSize: 13, borderRadius: 10 }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); }} />
      <div className="row end" style={{ padding: '6px 10px 8px', borderTop: '1px solid var(--border)' }}>
        <button className="btn sm" onClick={() => void send()} disabled={busy || !text.trim()}><Send size={15} />Send</button>
      </div>
    </div>
  );
}

/** Rounded single-line input with a circular send button. */
export function InlineCommentInput({ initials, avatarUrl, onSend, placeholder = 'Add a private comment…' }: {
  initials: string; avatarUrl?: string | null; onSend: (text: string) => Promise<void> | void; placeholder?: string;
}) {
  const [text, setText] = useState('');
  const active = text.trim().length > 0;
  const send = async () => {
    if (!active) return;
    const t = text.trim();
    setText('');
    await onSend(t);
  };
  return (
    <div className="row gap-12" style={{ padding: '10px 12px 12px' }}>
      <Avatar url={avatarUrl} initials={initials} size={40} />
      <div className="row grow" style={{ height: 40, background: '#f1f3f7', borderRadius: 20, padding: '0 5px 0 14px' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontSize: 12.5, minWidth: 0 }} />
        <button onClick={() => void send()} disabled={!active} aria-label="Send"
          style={{ width: 30, height: 30, borderRadius: '50%', border: 0, background: active ? 'var(--accent)' : '#d7dbe3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: active ? 'pointer' : 'default' }}>
          <ArrowUp size={17} />
        </button>
      </div>
    </div>
  );
}
