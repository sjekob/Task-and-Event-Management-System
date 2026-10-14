import React, { useEffect, useState } from 'react';
import { Image, Platform, Text, View, useWindowDimensions } from 'react-native';
import { AppTheme, TextStyles, ts } from '../theme/appTheme';
import { downloadUrl } from '../utils/files';
import { Icon } from './ui/Icon';
import { FilledButton, IconButton } from './ui/buttons';
import { CircularProgressIndicator } from './ui/misc';
import { Dialog, showDialog } from './ui/overlay';

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
// What a browser can show in a frame without downloading it.
const FRAME_TYPES = ['pdf', 'txt', 'csv', 'mp4', 'webm', 'mp3', 'wav'];

const extensionOf = (filename: string) => filename.split('.').pop()?.toLowerCase() ?? '';

function FileViewerDialog({ filename, url, pop }: { filename: string; url: string; pop: () => void }) {
  const window = useWindowDimensions();
  const ext = extensionOf(filename);
  const isImage = IMAGE_TYPES.includes(ext);
  const inFrame = Platform.OS === 'web' && FRAME_TYPES.includes(ext);
  // Whether the server still has the file: null while checking.
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: 'HEAD' })
      // Only "not found" means the file is gone; a server that refuses the
      // check itself (405) may still serve the file.
      .then((res) => !cancelled && setAvailable(res.status !== 404 && res.status !== 410))
      // Can't tell (offline, or the check itself was blocked): try to show it.
      .catch(() => !cancelled && setAvailable(true));
    return () => {
      cancelled = true;
    };
  }, [url]);
  const width = Math.min(960, window.width - 32);
  const height = Math.min(window.height - 48, 760);

  return (
    <Dialog backgroundColor="#FFFFFF" radius={14} clip insetPadding={{ horizontal: 16, vertical: 24 }} style={{ width, height }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 8,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: AppTheme.borderColor,
        }}
      >
        <Icon name="insert_drive_file_outlined" size={18} color={AppTheme.greenColor} />
        <View style={{ width: 8 }} />
        <Text numberOfLines={1} style={[ts({ size: 14, weight: 600, color: AppTheme.textPrimary }), { flex: 1 }]}>{filename}</Text>
        <View style={{ width: 8 }} />
        <IconButton icon="download_rounded" size={20} color={AppTheme.textMuted} tooltip="Download" onPress={() => downloadUrl(url, filename)} />
        <IconButton icon="close" size={20} color={AppTheme.textMuted} tooltip="Close" onPress={pop} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
        {available == null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgressIndicator />
          </View>
        ) : !available ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Icon name="error_outline" size={48} color={AppTheme.redColor} />
            <View style={{ height: 12 }} />
            <Text style={[TextStyles.bodyMd, { textAlign: 'center' }]}>
              This file is no longer on the server, so it can't be shown. Ask the submitter to upload it again.
            </Text>
          </View>
        ) : isImage ? (
          <Image
            source={{ uri: url }}
            resizeMode="contain"
            style={{ flex: 1 }}
            accessibilityLabel={filename}
            onError={() => setAvailable(false)}
          />
        ) : inFrame ? (
          React.createElement('iframe', {
            src: url,
            title: filename,
            style: { border: 'none', width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
          })
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Icon name="insert_drive_file_outlined" size={48} color={AppTheme.textLight} />
            <View style={{ height: 12 }} />
            <Text style={[TextStyles.bodyMd, { textAlign: 'center' }]}>
              {`This type of file (.${ext || 'unknown'}) can't be previewed here.`}
            </Text>
            <View style={{ height: 16 }} />
            <FilledButton icon="download_rounded" iconSize={18} backgroundColor={AppTheme.darkBanner} onPress={() => downloadUrl(url, filename)}>
              Download to open
            </FilledButton>
          </View>
        )}
      </View>
    </Dialog>
  );
}

/// Shows a submitted file inside the app: images and (on web) PDFs, text,
/// audio and video render in place; other types offer a download.
export function showFileViewer(filename: string, url: string): void {
  showDialog((pop) => <FileViewerDialog filename={filename} url={url} pop={() => pop()} />);
}
