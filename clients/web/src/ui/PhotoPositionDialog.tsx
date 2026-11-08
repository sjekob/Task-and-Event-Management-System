import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { PhotoCrop, PhotoPositioner } from '@shared/controllers/ProfileControllers';
import { Button, Modal, Spinner } from './kit';

const VIEW = 280;

/** Drag to move, slider or wheel to zoom; resolves with the crop on Save. */
export function PhotoPositionDialog({ sourceUrl, onClose }: { sourceUrl: string; onClose: (crop: PhotoCrop | null) => void }) {
  const [pos, setPos] = useState<PhotoPositioner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const rerender = () => force((n) => n + 1);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setPos(new PhotoPositioner(VIEW, img.naturalWidth, img.naturalHeight));
    img.onerror = () => setError('The photo could not be loaded. Try again.');
    img.src = sourceUrl;
  }, [sourceUrl]);

  return (
    <Modal title="Position photo" subtitle="Drag to move. Use the slider or scroll to zoom." onClose={() => onClose(null)}
      footer={<><Button variant="ghost" onClick={() => onClose(null)}>Cancel</Button><Button disabled={!pos} onClick={() => onClose(pos!.crop())}>Save position</Button></>}>
      <div className="col center" style={{ alignItems: 'center' }}>
        <div
          style={{ width: VIEW, height: VIEW, position: 'relative', overflow: 'hidden', borderRadius: 12, background: '#111', touchAction: 'none', cursor: pos ? 'grab' : 'default' }}
          onPointerDown={(e) => { if (!pos) return; drag.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            if (!pos || !drag.current) return;
            pos.moveBy(e.clientX - drag.current.x, e.clientY - drag.current.y);
            drag.current = { x: e.clientX, y: e.clientY };
            rerender();
          }}
          onPointerUp={() => { drag.current = null; }}
          onWheel={(e) => { if (!pos) return; pos.setZoom(pos.zoom - e.deltaY / 400); rerender(); }}
        >
          {error ? <div className="center-fill" style={{ color: '#fff', height: '100%', textAlign: 'center' }}>{error}</div>
            : !pos ? <div className="center-fill" style={{ height: '100%' }}><Spinner light /></div>
            : (
              <>
                <img src={sourceUrl} alt="" draggable={false}
                  style={{ position: 'absolute', left: pos.x, top: pos.y, width: pos.shownW, height: pos.shownH, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }} />
                {/* Dim everything outside the circle that becomes the avatar. */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 400px rgba(0,0,0,0.6)', border: '2px solid #fff', pointerEvents: 'none' }} />
              </>
            )}
        </div>
        <div className="row gap-8 mt-12" style={{ width: VIEW }}>
          <ZoomOut size={18} color="var(--muted)" />
          <input type="range" min={1} max={PhotoPositioner.MAX_ZOOM} step={0.01} value={pos?.zoom ?? 1} disabled={!pos}
            onChange={(e) => { pos?.setZoom(Number(e.target.value)); rerender(); }} style={{ flex: 1, accentColor: 'var(--accent)' }} />
          <ZoomIn size={18} color="var(--muted)" />
        </div>
      </div>
    </Modal>
  );
}
