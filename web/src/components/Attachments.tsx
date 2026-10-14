import { useState } from 'react';
import { ActionIcon, Anchor, Box, Button, FileButton, Group, Modal, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconBrandGoogleDrive, IconBrandYoutube, IconFile, IconLink, IconUpload, IconX } from '@tabler/icons-react';
import { api, type Attachment } from '@tasknet/shared';
import { notifyError } from './ui';
import { colors } from '../theme';

const META: Record<Attachment['attachment_type'], { icon: typeof IconLink; color: string; title: string; hint: string; fallback: string }> = {
  link: { icon: IconLink, color: '#4A90E2', title: 'Add Link', hint: 'https://...', fallback: 'Link' },
  gdrive: { icon: IconBrandGoogleDrive, color: '#34A853', title: 'Add Google Drive Link', hint: 'https://drive.google.com/...', fallback: 'Google Drive File' },
  youtube: { icon: IconBrandYoutube, color: '#FF0000', title: 'Add YouTube Video', hint: 'https://youtube.com/...', fallback: 'YouTube Video' },
  file: { icon: IconFile, color: '#6B7280', title: 'Add File URL', hint: 'https://...', fallback: 'Attached File' },
};

export function AttachmentRow({ att, onRemove }: { att: Attachment; onRemove?: () => void }) {
  const m = META[att.attachment_type] ?? META.link;
  const Icon = m.icon;
  return (
    <Group wrap="nowrap" gap={10} px={12} py={10} style={{ background: colors.bg, borderRadius: 8 }}>
      <ThemeIcon variant="light" radius={8} size={32} style={{ background: `${m.color}1F`, color: m.color }}>
        <Icon size={16} />
      </ThemeIcon>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>{att.name || 'Attachment'}</Text>
        {att.url && <Anchor href={att.url} target="_blank" rel="noreferrer" size="xs" truncate display="block">{att.url}</Anchor>}
      </Box>
      {onRemove && (
        <ActionIcon variant="subtle" color="gray" onClick={onRemove} aria-label="Remove attachment"><IconX size={16} /></ActionIcon>
      )}
    </Group>
  );
}

/** Buttons for adding links/files plus the list of what was added. */
export function AttachmentEditor({ value, onChange }: { value: Attachment[]; onChange: (v: Attachment[]) => void }) {
  const [dialog, setDialog] = useState<Attachment['attachment_type'] | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const info = await api.tasks.uploadAttachment(file, file.name);
      onChange([...value, { attachment_type: 'file', name: info.name, url: info.url }]);
    } catch (e) {
      notifyError(e, 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack gap="xs">
      <Group gap={8}>
        <Button variant="default" size="sm" leftSection={<IconLink size={16} />} onClick={() => setDialog('link')}>Link</Button>
        <FileButton onChange={(f) => void upload(f)}>
          {(props) => <Button {...props} variant="default" size="sm" loading={uploading} leftSection={<IconUpload size={16} />}>Upload file</Button>}
        </FileButton>
        <Button variant="default" size="sm" leftSection={<IconBrandGoogleDrive size={16} />} onClick={() => setDialog('gdrive')}>Google Drive</Button>
        <Button variant="default" size="sm" leftSection={<IconBrandYoutube size={16} />} onClick={() => setDialog('youtube')}>YouTube</Button>
      </Group>
      {value.map((a, i) => (
        <AttachmentRow key={`${a.url}-${i}`} att={a} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
      ))}
      {dialog && <AttachmentDialog type={dialog} onClose={() => setDialog(null)}
        onAdd={(a) => { onChange([...value, a]); setDialog(null); }} />}
    </Stack>
  );
}

function AttachmentDialog({ type, onClose, onAdd }: {
  type: Attachment['attachment_type']; onClose: () => void; onAdd: (a: Attachment) => void;
}) {
  const m = META[type];
  const [url, setUrl] = useState('https://');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    const u = url.trim();
    if (!u || u === 'https://') return setError('URL is required');
    if (!/^https?:\/\//i.test(u)) return setError('Must start with http://');
    let fallback = m.fallback;
    if (type === 'link') {
      try { fallback = new URL(u).host.replace(/^www\./, ''); } catch { /* keep default */ }
    }
    onAdd({ attachment_type: type, url: u, name: name.trim() || fallback });
  };

  return (
    <Modal opened onClose={onClose} title={m.title}>
      <Stack gap="sm">
        <TextInput label="URL" placeholder={m.hint} value={url} error={error} data-autofocus
          onChange={(e) => { setUrl(e.currentTarget.value); setError(null); }} />
        <TextInput label="Name (optional)" placeholder="Label for this attachment" value={name}
          onChange={(e) => setName(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="ink.8" onClick={confirm}>Add</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
