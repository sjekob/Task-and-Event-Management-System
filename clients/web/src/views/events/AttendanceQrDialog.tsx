import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, Printer, QrCode } from 'lucide-react';
import { AttendanceQrController } from '@shared/controllers/AttendanceQrController';
import { useServices } from '../../app/AppContext';
import { useScreenController } from '../../app/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, Modal, Spinner } from '../../ui/kit';
import { shareOrigin } from '../../app/shareOrigin';

const SHEET_CSS = `
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 12mm; color: #111; }
  h1 { font-size: 18pt; margin: 0 0 2mm; } .sub { color: #555; margin-bottom: 8mm; }
  .qr-act { break-inside: avoid; border: 1px solid #ccc; border-radius: 3mm; padding: 5mm; margin-bottom: 6mm; }
  .qr-act h2 { font-size: 13pt; margin: 0; } .qr-when { color: #555; font-size: 10pt; margin: 1mm 0 4mm; }
  .qr-pair { display: flex; gap: 10mm; justify-content: center; } .qr-cell { text-align: center; }
  .qr-link { display: block; margin: 2mm auto 0; max-width: 120mm; font-family: 'Courier New', monospace; font-size: 8pt; color: #333; word-break: break-all; text-decoration: none; }
  .qr-cell b { display: block; margin-top: 2mm; font-size: 12pt; } .qr-warn, .qr-task { font-size: 9pt; color: #555; margin-top: 3mm; }
  .no-print { display: none; }
  @page { size: A4; margin: 0; }
`;

/** One attendance QR per activity (Time In, then the evaluation as Time Out), with a printable sheet. */
export function AttendanceQrDialog({ eventId, onClose }: { eventId: number; onClose: () => void }) {
  const services = useServices();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new AttendanceQrController(services, eventId, shareOrigin()), [eventId]);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => { void c.load(); }, [c]);

  const print = () => {
    if (!sheet.current || !s.data) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attendance QR – ${s.data.title}</title><style>${SHEET_CSS}</style></head>`
      + `<body><h1>Attendance QR Codes</h1><div class="sub">${sheet.current.dataset.title ?? ''}</div>${sheet.current.innerHTML}`
      + '<script>window.onload = () => setTimeout(() => window.print(), 300);</script></body></html>';
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    if (!window.open(url, '_blank')) fb.toast('Allow pop-ups for this site to print the QR codes.', 'error');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Modal title="Attendance QR Codes" subtitle={s.data?.title} icon={<QrCode size={20} />} size="wide" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button icon={<Printer size={16} />} disabled={!s.data?.activities.length} onClick={print}>Print QR sheet</Button>
      </>}>
      {s.loading ? <div className="center-fill" style={{ height: 180 }}><Spinner /></div>
        : s.error ? <div className="field-error" style={{ textAlign: 'center', padding: 24 }}>{s.error}</div>
        : !s.data?.activities.length ? <div className="caption" style={{ textAlign: 'center', padding: 24 }}>This event has no Activity Matrix rows.</div> : (
          <>
            <div className="caption mb-12">{AttendanceQrController.HOW}</div>
            <div ref={sheet} data-title={s.data.title} className="col gap-12">
              {s.data.activities.map((a) => (
                <div key={a.index} className="qr-act" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{AttendanceQrController.title(a)}</h2>
                  <div className="qr-when caption">{AttendanceQrController.when(a) || 'No schedule'}</div>
                  <div className="qr-pair row wrap gap-24" style={{ justifyContent: 'center', marginTop: 10 }}>
                    <div className="qr-cell" style={{ textAlign: 'center', maxWidth: '100%' }}>
                      <QRCodeSVG value={c.link(a)} size={200} marginSize={1} />
                      <b style={{ display: 'block', marginTop: 6 }}>{AttendanceQrController.LABEL}</b>
                      <a className="qr-link" href={c.link(a)} target="_blank" rel="noreferrer"
                        style={{ display: 'block', marginTop: 6, maxWidth: 460, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11.5,
                          color: 'var(--text-2)', wordBreak: 'break-all' }}>{c.link(a)}</a>
                    </div>
                  </div>
                  {!a.schedule_readable && (
                    <div className="qr-warn row gap-6 mt-8" style={{ color: 'var(--amber)', fontSize: 12 }}>
                      <AlertTriangle size={14} />The day/time of this row can't be read, so scans will be refused. Fix it in the Activity Matrix.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
    </Modal>
  );
}
