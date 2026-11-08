import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Comment } from '@shared/models';
import { Format } from '@shared/utils/format';
import { ActionMenu, Avatar, Button, C, FONT, Icon, Input, T } from '../../ui/kit';

export function CommentItem({ comment, onEdit, onDelete }: { comment: Comment; onEdit?: () => void; onDelete?: () => void }) {
  const items = [
    ...(onEdit ? [{ label: 'Edit', icon: 'edit-2' as const, onPress: onEdit }] : []),
    ...(onDelete ? [{ label: 'Delete', icon: 'trash-2' as const, onPress: onDelete, danger: true }] : []),
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
      <Avatar initials={comment.fullName.charAt(0).toUpperCase() || '?'} size={32} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T size={12.5} weight={600} lines={1} style={{ flexShrink: 1 }}>{comment.fullName}</T>
          <T size={11.5} color={C.light}>{Format.date(comment.createdAt, '')}</T>
          <View style={{ flex: 1 }} />
          <ActionMenu icon="more-horizontal" items={items} />
        </View>
        <T size={13.5} color={C.text2}>{comment.content}</T>
      </View>
    </View>
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
    <View style={{ gap: 8 }}>
      <Input multiline rows={3} value={text} onChangeText={setText} placeholder={placeholder} />
      <Button size="sm" icon="send" loading={busy} disabled={!text.trim()} onPress={() => void send()} style={{ alignSelf: 'flex-end' }}>Send</Button>
    </View>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
      <Avatar url={avatarUrl} initials={initials} size={36} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 40, backgroundColor: '#f1f3f7', borderRadius: 20, paddingLeft: 14, paddingRight: 5 }}>
        <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={C.light} onSubmitEditing={() => void send()}
          style={{ flex: 1, fontFamily: FONT[400], fontSize: 13, color: C.text, paddingVertical: 8 }} />
        <Pressable onPress={() => void send()} disabled={!active} accessibilityLabel="Send"
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: active ? C.accent : '#d7dbe3', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-up" size={17} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
