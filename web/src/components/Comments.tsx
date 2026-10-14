import { useState } from 'react';
import { ActionIcon, Box, Button, Group, Menu, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconDots, IconPencil, IconSend, IconTrash } from '@tabler/icons-react';
import { formatDate, parseTimestamp, type Comment } from '@tasknet/shared';
import { UserAvatar } from './ui';

export function CommentItem({ comment, onEdit, onDelete }: {
  comment: Comment; onEdit?: () => void; onDelete?: () => void;
}) {
  return (
    <Group wrap="nowrap" align="flex-start" gap={10} mb={12}>
      <UserAvatar name={comment.full_name} size={32} />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" fw={600} truncate>{comment.full_name}</Text>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{formatDate(parseTimestamp(comment.created_at), '')}</Text>
          {(onEdit || onDelete) && (
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Comment actions"><IconDots size={16} /></ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {onEdit && <Menu.Item leftSection={<IconPencil size={15} />} onClick={onEdit}>Edit</Menu.Item>}
                {onDelete && <Menu.Item color="red" leftSection={<IconTrash size={15} />} onClick={onDelete}>Delete</Menu.Item>}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
        <Text size="sm" c="dimmed" className="tn-prewrap" mt={2}>{comment.content}</Text>
      </Box>
    </Group>
  );
}

export function CommentInput({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<void> | void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box style={{ border: '1px solid var(--tn-border)', borderRadius: 10, background: 'white' }}>
      <Textarea variant="unstyled" px={14} pt={6} autosize minRows={3} maxRows={6} placeholder={placeholder}
        value={text} onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); }} />
      <Group justify="flex-end" px={10} py={8} style={{ borderTop: '1px solid var(--tn-border)' }}>
        <Button size="sm" color="ink.8" leftSection={<IconSend size={15} />} loading={busy}
          disabled={!text.trim()} onClick={() => void send()}>Send</Button>
      </Group>
    </Box>
  );
}

export function EditCommentModal({ initial, onClose, onSave }: {
  initial: string; onClose: () => void; onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Modal opened onClose={onClose} title="Edit Comment">
      <Stack>
        <Textarea autosize minRows={4} value={text} onChange={(e) => setText(e.currentTarget.value)} data-autofocus />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="ink.8" loading={busy} disabled={!text.trim()}
            onClick={async () => { setBusy(true); try { await onSave(text.trim()); onClose(); } finally { setBusy(false); } }}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
