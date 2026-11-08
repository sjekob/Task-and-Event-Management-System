import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { fileKind } from '@shared/utils/fileKind';
import { Button, C, Empty, Icon, Loading, Modal, T } from '../../ui/kit';
import { openUrl } from '../../ui/files';

/**
 * Previews a submitted file: images in the app; PDFs, text and media open in
 * the phone's viewer; anything else can be downloaded. Missing files say so.
 */
export function FileViewer({ filename, url, onClose }: { filename: string; url: string; onClose: () => void }) {
  const kind = fileKind(filename);
  // Whether the server still has the file: null while checking.
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: 'HEAD' })
      // Only "not found" means the file is gone; a server that refuses the check (405) may still serve it.
      .then((res) => { if (!cancelled) setAvailable(res.status !== 404 && res.status !== 410); })
      .catch(() => { if (!cancelled) setAvailable(true); });
    return () => { cancelled = true; };
  }, [url]);

  let body;
  if (available === null) body = <Loading />;
  else if (!available) body = <Empty icon="alert-triangle" title="This file is no longer on the server." />;
  else if (kind === 'image') body = <Image source={{ uri: url }} resizeMode="contain" style={{ width: '100%', height: 420, backgroundColor: C.surface2, borderRadius: 10 }} />;
  else {
    body = (
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <Icon name="file-text" size={46} color={C.muted} />
        <T center color={C.text2}>{kind === 'frame' ? 'Opens in your phone\'s viewer.' : 'This type of file can\'t be previewed here. Open it to download.'}</T>
      </View>
    );
  }
  return (
    <Modal title={filename} icon="file-text" onClose={onClose}
      footer={<>
        <Button variant="ghost" onPress={onClose}>Close</Button>
        {available !== false && <Button icon={kind === 'image' ? 'download' : 'external-link'} onPress={() => void openUrl(url)}>{kind === 'image' ? 'Download' : 'Open'}</Button>}
      </>}>
      {body}
    </Modal>
  );
}
