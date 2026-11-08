import { Linking, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { FilePart } from '@shared/services/ApiClient';

/** Picks one document; [types] are MIME types ("*\/*" for anything). Null when cancelled. */
export async function pickFile(types: string | string[] = '*/*'): Promise<FilePart | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.length) return null;
  return toPart(r.assets[0]);
}

/** Picks one or more documents (e.g. a proposal's page photos). Empty when cancelled. */
export async function pickFiles(types: string | string[] = '*/*'): Promise<FilePart[]> {
  const r = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: true });
  return r.canceled || !r.assets?.length ? [] : r.assets.map(toPart);
}

/** Picks one photo from the library. Null when cancelled. */
export async function pickImage(): Promise<FilePart | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const name = a.fileName ?? `photo-${Date.now()}.jpg`;
  if (Platform.OS === 'web' && a.file) return { name, type: a.mimeType ?? a.file.type, blob: a.file };
  return { name, type: a.mimeType ?? 'image/jpeg', uri: a.uri };
}

function toPart(a: DocumentPicker.DocumentPickerAsset): FilePart {
  // The web preview hands back a real File; phones give a local file URI.
  if (Platform.OS === 'web' && a.file) return { name: a.name, type: a.mimeType ?? a.file.type, blob: a.file };
  return { name: a.name, type: a.mimeType ?? 'application/octet-stream', uri: a.uri };
}

/** Opens a link in the browser (or the app that handles it). */
export async function openUrl(url: string) {
  const full = /^[a-z]+:/i.test(url) ? url : `https://${url}`;
  if (Platform.OS === 'web') { window.open(full, '_blank'); return; }
  await Linking.openURL(full);
}

/**
 * Prints an HTML document: the system print sheet on phones (which also
 * offers "Save as PDF"), a new tab in the web preview.
 */
export async function printHtml(html: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const ok = !!window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return ok;
  }
  await Print.printAsync({ html });
  return true;
}

/** Renders HTML to a PDF and opens the share sheet (save to Files, send, …). */
export async function shareHtmlAsPdf(html: string, title: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
}

/** Shows downloaded bytes: a new tab on web; on phones, saved to the cache and handed to the share/open sheet. */
export async function openBlob(blob: Blob, filename: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(blob);
  });
  const file = new File(Paths.cache, filename.replace(/[^\w.-]+/g, '_') || 'file');
  if (file.exists) file.delete();
  file.create();
  file.write(dataUrl.slice(dataUrl.indexOf(',') + 1), { encoding: 'base64' });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: blob.type || undefined });
}
