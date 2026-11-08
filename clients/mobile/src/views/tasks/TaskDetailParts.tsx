import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Comment, Report } from '@shared/models';
import { useMediaUrl } from '../../core/AppModel';
import { Badge, C, FeatherName, Icon, Row, T } from '../../ui/kit';
import { openUrl } from '../../ui/files';
import { FileViewer } from '../common/FileViewer';

// Small pieces of the task detail screen.
export type Run = (fn: () => Promise<unknown>, done?: string) => Promise<void>;

export type CommentProps = (c: Comment) => { onEdit?: () => void; onDelete?: () => void };

/** A report's file (opens the viewer) and link. */
export function ReportAttachments({ r }: { r: Report }) {
  const media = useMediaUrl();
  const [viewing, setViewing] = useState(false);
  const url = r.reportFilePath ? media(r.reportFilePath) : null;
  return (
    <View style={{ gap: 8 }}>
      {r.reportFilename && url ? (
        <Pressable onPress={() => setViewing(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }}>
          <Icon name="file-text" size={15} color={C.green} />
          <T size={12.5} lines={1} style={{ flex: 1 }}>{r.reportFilename}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.green, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Icon name="eye" size={12} color="#fff" /><T size={10.5} weight={600} color="#fff">View</T>
          </View>
        </Pressable>
      ) : null}
      {r.reportLinkUrl ? (
        <Pressable onPress={() => void openUrl(r.reportLinkUrl!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, backgroundColor: C.blueBg }}>
          <Icon name="link-2" size={14} color={C.accent} />
          <T size={12.5} color={C.accent} lines={1} style={{ flex: 1, textDecorationLine: 'underline' }}>{r.reportLinkUrl}</T>
          <Icon name="external-link" size={13} color={C.accent} />
        </Pressable>
      ) : null}
      {viewing && r.reportFilename && url && <FileViewer filename={r.reportFilename} url={url} onClose={() => setViewing(false)} />}
    </View>
  );
}

export function SubmissionType({ type }: { type: string | null }) {
  const file = type === 'file';
  return <Badge tone={file ? 'green' : 'blue'} icon={file ? 'paperclip' : 'link-2'}>{file ? 'File Attachment' : 'Link Submission'}</Badge>;
}

export function ReportStatusChip({ status }: { status: string }) {
  return <Badge tone={status === 'Completed' ? 'green' : status === 'Missing' ? 'red' : 'amber'}>{status}</Badge>;
}

export function Meta({ icon, label, value, danger, note }: { icon: FeatherName; label: string; value: string; danger?: boolean; note?: string }) {
  return (
    <Row gap={10} style={{ alignItems: 'flex-start' }}>
      <Icon name={icon} size={17} color={C.muted} />
      <View style={{ flex: 1 }}>
        <T size={11.5} color={C.muted}>{label}</T>
        <Row wrap gap={6}>
          <T size={14} weight={600} color={danger ? C.red : C.text}>{value}</T>
          {note ? <Badge tone="red">{note}</Badge> : null}
        </Row>
      </View>
    </Row>
  );
}

export function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <Row gap={6}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <T size={12} color={C.muted}>{label}</T>
      <T size={12} weight={700}>{count}</T>
    </Row>
  );
}

/** White card used for each block of the detail screen. */
export function Block({ children, title, right }: { children: React.ReactNode; title?: string; right?: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 }}>
      {title ? <Row><T size={15} weight={700} style={{ flex: 1 }}>{title}</T>{right}</Row> : null}
      {children}
    </View>
  );
}
