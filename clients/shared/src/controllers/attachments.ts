// Task attachments: kinds, labels and link validation.
export type AttachmentKind = 'link' | 'file' | 'gdrive' | 'youtube';

export interface Attachment {
  attachment_type: AttachmentKind | string;
  name: string;
  url: string;
}

export const ATTACHMENT_KINDS: { kind: AttachmentKind; label: string; title: string; hint: string; color: string }[] = [
  { kind: 'link', label: 'Link', title: 'Add Link', hint: 'https://...', color: '#4a90e2' },
  { kind: 'file', label: 'Upload file', title: 'Add File URL', hint: 'https://...', color: '#6b7280' },
  { kind: 'gdrive', label: 'Google Drive', title: 'Add Google Drive Link', hint: 'https://drive.google.com/...', color: '#34a853' },
  { kind: 'youtube', label: 'YouTube', title: 'Add YouTube Video', hint: 'https://youtube.com/...', color: '#ff0000' },
];

/** Validates a link attachment; returns the attachment or an error message. */
export function makeLinkAttachment(kind: AttachmentKind, url: string, name: string): Attachment | string {
  const u = url.trim();
  if (!u || u === 'https://') return 'URL is required';
  if (!/^https?:\/\//.test(u)) return 'Must start with http://';
  let fallback = 'Link';
  if (kind === 'youtube') fallback = 'YouTube Video';
  else if (kind === 'gdrive') fallback = 'Google Drive File';
  else if (kind === 'file') fallback = 'Attached File';
  else {
    try { fallback = new URL(u).host.replace(/^www\./, ''); } catch { /* keep "Link" */ }
  }
  return { attachment_type: kind, name: name.trim() || fallback, url: u };
}
