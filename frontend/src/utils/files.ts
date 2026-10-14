import * as DocumentPicker from 'expo-document-picker';
import { Linking, Platform } from 'react-native';
import { PickedFile } from '../services/apiService';

/// Lets the user choose one file.
/// Resolves to null when the picker is cancelled.
export async function pickFile(types?: string[]): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: types ?? '*/*',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || result.assets == null || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return {
    name: asset.name,
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
    file: (asset as { file?: Blob }).file ?? null,
  };
}

/// Opens a URL in a new browser tab (web) or the system handler (native).
export function openUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

/// Downloads a URL under the given filename. Native platforms hand the link
/// to the system, which downloads or previews it.
export function downloadUrl(url: string, filename: string): void {
  if (Platform.OS === 'web') {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', filename);
    anchor.click();
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

/// Open in-memory file data (e.g. a PDF fetched with auth headers) in a new tab.
/// Returns false where that is not possible, so the caller can say so.
export function openBlob(blob: Blob): boolean {
  if (Platform.OS !== 'web') return false;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  return true;
}
