import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, View } from 'react-native';
import { PhotoCrop, PhotoPositioner } from '@shared/controllers/ProfileControllers';
import { Button, C, IconButton, Modal, Row, Spinner, T } from '../../ui/kit';

const VIEW = 260;

/** Drag to move, +/- to zoom; resolves with the crop on Save. */
export function PhotoPositionDialog({ sourceUrl, onClose }: { sourceUrl: string; onClose: (crop: PhotoCrop | null) => void }) {
  const [pos, setPos] = useState<PhotoPositioner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);
  const last = useRef({ x: 0, y: 0 });
  useEffect(() => {
    Image.getSize(sourceUrl, (w, h) => setPos(new PhotoPositioner(VIEW, w, h)), () => setError('The photo could not be loaded. Try again.'));
  }, [sourceUrl]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { last.current = { x: 0, y: 0 }; },
    onPanResponderMove: (_, g) => {
      if (!pos) return;
      pos.moveBy(g.dx - last.current.x, g.dy - last.current.y);
      last.current = { x: g.dx, y: g.dy };
      force((n) => n + 1);
    },
  }), [pos]);
  const zoom = (d: number) => { if (pos) { pos.setZoom(pos.zoom + d); force((n) => n + 1); } };

  return (
    <Modal title="Position photo" subtitle="Drag to move. Use + and − to zoom." onClose={() => onClose(null)} scroll={false}
      footer={<><Button variant="ghost" onPress={() => onClose(null)}>Cancel</Button><Button disabled={!pos} onPress={() => onClose(pos!.crop())}>Save position</Button></>}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View {...pan.panHandlers} style={{ width: VIEW, height: VIEW, overflow: 'hidden', borderRadius: 12, backgroundColor: '#111' }}>
          {error ? <T color="#fff" center style={{ marginTop: VIEW / 2 - 10 }}>{error}</T>
            : !pos ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner color="#fff" /></View>
            : (
              <>
                <Image source={{ uri: sourceUrl }} style={{ position: 'absolute', left: pos.x, top: pos.y, width: pos.shownW, height: pos.shownH }} />
                {/* The circle that becomes the avatar. */}
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: VIEW, height: VIEW, borderRadius: VIEW / 2, borderWidth: 2, borderColor: '#fff' }} />
              </>
            )}
        </View>
        <Row gap={18}>
          <IconButton name="zoom-out" label="Zoom out" onPress={() => zoom(-0.25)} bg={C.surface2} />
          <T size={13} color={C.muted}>{pos ? `${Math.round(pos.zoom * 100)}%` : ''}</T>
          <IconButton name="zoom-in" label="Zoom in" onPress={() => zoom(0.25)} bg={C.surface2} />
        </Row>
      </View>
    </Modal>
  );
}
