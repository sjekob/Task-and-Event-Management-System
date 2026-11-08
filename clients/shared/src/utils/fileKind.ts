// How a submitted file can be previewed in the app.

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
// What a browser can show in a frame without downloading it.
const FRAME_TYPES = ['pdf', 'txt', 'csv', 'mp4', 'webm', 'mp3', 'wav'];

export type FileKind = 'image' | 'frame' | 'other';

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function fileKind(filename: string): FileKind {
  const ext = extensionOf(filename);
  return IMAGE_TYPES.includes(ext) ? 'image' : FRAME_TYPES.includes(ext) ? 'frame' : 'other';
}
