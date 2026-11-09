import { ReactNode, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Link2, Paperclip } from 'lucide-react';
import { StatusTone } from '@shared/controllers/TaskDetailController';
import { Comment, Report } from '@shared/models';
import { useMediaUrl } from '../../app/AppContext';
import { FileViewerDialog } from '../../ui/FileViewerDialog';
import { Bone } from '../../ui/kit';

// Small pieces of the task detail page.
export const TONE: Record<StatusTone, [string, string]> = {
  green: ['#15803d', 'var(--green-bg)'], red: ['#b91c1c', 'var(--red-bg)'], blue: ['var(--accent)', 'var(--blue-bg)'],
  amber: ['#92400e', 'var(--amber-bg)'], gray: ['var(--muted)', 'var(--surface-3)'],
};

export function Pill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const [fg, bg] = TONE[tone];
  return <span className="badge" style={{ color: fg, background: bg, fontSize: 12 }}>{children}</span>;
}

export type Run = (fn: () => Promise<unknown>, done?: string) => Promise<void>;

export type CommentProps = (c: Comment) => { onEdit?: () => void; onDelete?: () => void };

export function ReportAttachments({ r }: { r: Report }) {
  const media = useMediaUrl();
  const [viewing, setViewing] = useState(false);
  const url = r.reportFilePath ? media(r.reportFilePath) : null;
  return (
    <>
      {r.reportFilename && url && (
        <div className="td-file mt-8">
          <FileText size={14} color="var(--green)" />
          <button className="grow ellipsis td-file-name" title="View file" onClick={() => setViewing(true)}>{r.reportFilename}</button>
          <button className="td-dl" onClick={() => setViewing(true)}><Eye size={12} />View</button>
          <a className="td-dl" href={url} download={r.reportFilename} target="_blank" rel="noreferrer"><Download size={12} />Download</a>
        </div>
      )}
      {viewing && r.reportFilename && url && <FileViewerDialog filename={r.reportFilename} url={url} onClose={() => setViewing(false)} />}
      {r.reportLinkUrl && (
        <a className="td-link mt-8" href={/^https?:/.test(r.reportLinkUrl) ? r.reportLinkUrl : `https://${r.reportLinkUrl}`} target="_blank" rel="noreferrer">
          <Link2 size={14} /><span className="grow ellipsis">{r.reportLinkUrl}</span><ExternalLink size={13} />
        </a>
      )}
    </>
  );
}

export function SubmissionType({ type }: { type: string | null }) {
  const file = type === 'file';
  return (
    <span className="badge" style={{ borderRadius: 6, padding: '4px 8px', fontSize: 10, color: file ? 'var(--green)' : 'var(--accent)', background: file ? '#f0fdf4' : 'var(--blue-bg)' }}>
      {file ? <Paperclip size={11} /> : <Link2 size={11} />}{file ? 'File Attachment' : 'Link Submission'}
    </span>
  );
}

export function ReportStatusChip({ status }: { status: string }) {
  const [fg, bg] = status === 'Completed' ? ['var(--green)', 'var(--green-bg)'] : status === 'Missing' ? ['var(--red)', 'var(--red-bg)'] : ['#92400e', 'var(--amber-bg)'];
  return <span className="badge" style={{ color: fg, background: bg, fontSize: 10, padding: '3px 8px' }}>{status}</span>;
}

export function Meta({ icon, label, value, danger, note }: { icon: ReactNode; label: string; value: string; danger?: boolean; note?: string }) {
  return (
    <div className="row gap-8">
      <span style={{ color: 'var(--muted)', display: 'flex' }}>{icon}</span>
      <div>
        <div className="caption">{label}</div>
        <div className="row gap-8">
          <span style={{ fontSize: 14, fontWeight: 600, color: danger ? 'var(--red)' : 'var(--text)' }}>{value}</span>
          {note && <span className="badge red" style={{ fontSize: 12 }}>{note}</span>}
        </div>
      </div>
    </div>
  );
}

export function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="row gap-6">
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span className="body-sm" style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{count}</span>
    </span>
  );
}

export function DetailSkeleton() {
  return (
    <div className="td-layout">
      <div className="td-main col gap-16"><Bone w={34} h={34} r={17} /><Bone h={150} r={14} /><Bone h={120} r={14} /><Bone h={200} r={14} /></div>
      <aside className="td-side"><Bone h={160} r={12} /><Bone h={220} r={12} style={{ marginTop: 14 }} /></aside>
    </div>
  );
}
