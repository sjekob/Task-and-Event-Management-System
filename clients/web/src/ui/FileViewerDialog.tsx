import { useEffect, useState } from 'react';
import { Download, FileQuestion, FileWarning, FileText } from 'lucide-react';
import { fileKind } from '@shared/utils/fileKind';
import { Button, Modal, Spinner } from './kit';

/** Previews a submitted file in the app (images, PDFs, text, audio/video); anything else offers a download. */
export function FileViewerDialog({ filename, url, onClose }: { filename: string; url: string; onClose: () => void }) {
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

  const download = <a className="btn primary" href={url} download={filename} target="_blank" rel="noreferrer"><Download size={16} />Download</a>;
  let body;
  if (available === null) body = <div className="center-fill" style={{ height: 300 }}><Spinner /></div>;
  else if (!available) body = <Notice icon={<FileWarning size={48} color="var(--red)" />} text="This file is no longer on the server." />;
  else if (kind === 'image') body = <img src={url} alt={filename} style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: '0 auto', objectFit: 'contain' }} />;
  else if (kind === 'frame') body = <iframe src={url} title={filename} style={{ width: '100%', height: '70vh', border: 0, borderRadius: 8, background: '#f8fafc' }} />;
  else body = <Notice icon={<FileQuestion size={48} color="var(--muted)" />} text="This type of file can't be previewed here. Download it to open it." />;

  return (
    <Modal title={filename} icon={<FileText size={20} />} size="xwide" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button>{available !== false && download}</>}>
      {body}
    </Modal>
  );
}

function Notice({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="col" style={{ alignItems: 'center', gap: 12, padding: '40px 16px', textAlign: 'center' }}>{icon}<div className="body-md">{text}</div></div>;
}
