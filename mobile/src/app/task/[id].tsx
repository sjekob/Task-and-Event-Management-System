import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, assigneeStatus, formatDateTime, formatDue, parseTimestamp, qk, reportPoints, resolveUrl, roleLabel, teamProgress,
  timeAgo, useSession, useUser, type Comment, type Report, type Task,
} from '@tasknet/shared';
import {
  Avatar, Button, Card, confirm, ErrorView, Gap, IconButton, InfoLine, Loading, notifyError, notifySuccess, Pill, Row, Screen,
  SectionHeader, Segmented, T,
} from '@/components/ui';
import { colors } from '@/theme';

const openUrl = (url: string) => WebBrowser.openBrowserAsync(/^https?:/i.test(url) ? url : `https://${url}`);

export default function TaskDetailScreen() {
  const { id, own } = useLocalSearchParams<{ id: string; own?: string }>();
  const taskId = Number(id);
  const me = useUser();
  const { can } = useSession();
  const qc = useQueryClient();
  const task = useQuery({ queryKey: qk.task(taskId), queryFn: () => api.tasks.get(taskId) });

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: qk.task(taskId) }),
    qc.invalidateQueries({ queryKey: qk.allTasks }),
    qc.invalidateQueries({ queryKey: qk.dashboard }),
  ]);

  if (task.isPending) return <Loading />;
  if (task.isError) return <ErrorView error={task.error} onRetry={() => task.refetch()} />;
  const t = task.data;

  const assignedToMe = (t.assigned_users ?? []).some((u) => u.id === me.id);
  // From "Assigned to me" (or a notification about a task you hold) show your own submission.
  const ownView = own != null ? own === '1' && assignedToMe : assignedToMe;
  const reviewing = !ownView && (can('assign_tasks') || can('review_submissions'));

  const sendComment = async (content: string, type: 'public' | 'private', reportId?: number) => {
    try {
      await api.tasks.addComment(taskId, content, type, reportId);
      await refresh();
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t.task_category === 'special' ? 'Special task' : 'Task' }} />
      <Screen onRefresh={() => task.refetch()}>
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <T v="h2" style={{ flex: 1 }}>{t.title}</T>
            {t.status === 'disabled' && <Pill label="Disabled" />}
          </Row>
          <Gap size={6} />
          <InfoLine icon="time-outline">Due {formatDue(t)}</InfoLine>
          {t.created_by_name && <InfoLine icon="person-outline">Created by {t.created_by_name}</InfoLine>}
          {t.subject && <InfoLine icon="book-outline">{t.subject}</InfoLine>}
          {t.task_type && <InfoLine icon="pricetag-outline">{t.task_type}</InfoLine>}
          {t.instructions ? (
            <>
              <Gap size={12} />
              <T v="label">Instructions</T>
              <T style={{ marginTop: 4, lineHeight: 21 }}>{t.instructions}</T>
            </>
          ) : null}
          {!!t.attachments?.length && (
            <>
              <Gap size={12} />
              <T v="label">Attachments</T>
              {t.attachments.map((a, i) => (
                <Pressable key={`${a.url}-${i}`} onPress={() => void openUrl(resolveUrl(a.url))} accessibilityRole="link"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                  <Ionicons name={a.attachment_type === 'file' ? 'document-attach-outline' : 'link-outline'} size={18} color={colors.accent} />
                  <T style={{ color: colors.accent, flex: 1 }} numberOfLines={1}>{a.name || a.url}</T>
                </Pressable>
              ))}
            </>
          )}
        </Card>

        {ownView && <Submission task={t} onChanged={refresh} />}
        {reviewing && <Team task={t} viewerId={me.id} onChanged={refresh} onSend={sendComment} />}

        <SectionHeader title={`Comments${t.public_comments?.length ? ` (${t.public_comments.length})` : ''}`} />
        <Card>
          <T v="small">Visible to everyone assigned to this task.</T>
          <Comments comments={t.public_comments ?? []} meId={me.id} onChanged={refresh} />
          <CommentInput placeholder="Add a comment…" onSend={(c) => sendComment(c, 'public')} />
        </Card>

        {ownView && (
          <>
            <SectionHeader title="Private comments" />
            <Card>
              <T v="small">Only you and the people reviewing your work see these.</T>
              <Comments comments={t.private_comments ?? []} meId={me.id} onChanged={refresh} />
              <CommentInput placeholder="Add a private comment…" onSend={(c) => sendComment(c, 'private')} />
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

// ── Your submission ──────────────────────────────────────────────────────────

function Submission({ task, onChanged }: { task: Task; onChanged: () => Promise<unknown> }) {
  const report = task.my_report;
  const [kind, setKind] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!res.canceled) setFile(res.assets[0]);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.tasks.submitReport(task.id, {
        report_title: kind === 'link' ? link.trim() : file?.name ?? 'File submission',
        report_type: kind,
        ...(kind === 'link' ? { report_link_url: link.trim() } : {}),
      });
      if (kind === 'file' && file) {
        try {
          // Web previews hand back a real File; native gives a {uri, name, type} the RN FormData understands.
          await api.tasks.uploadReportFile(task.id,
            file.file ?? { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' }, file.name);
        } catch (e) {
          notifyError(e, 'The report was submitted but the file upload failed');
        }
      }
      setFile(null);
      setLink('');
      notifySuccess('Report submitted');
      await onChanged();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const unsubmit = async (r: Report) => {
    if (!(await confirm('Unsubmit report', 'Remove your submission so you can submit again?', 'Unsubmit', true))) return;
    setBusy(true);
    try {
      await api.reports.remove(r.id);
      await onChanged();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  if (report) {
    const { points, reason } = reportPoints(task, report);
    return (
      <>
        <SectionHeader title="Your submission" />
        <Card style={{ gap: 10 }}>
          <Row style={{ backgroundColor: colors.greenBg, borderRadius: 10, padding: 12 }}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700', color: colors.green }}>Submitted · {report.report_status}</T>
              <T v="small" style={{ color: colors.green }}>{formatDateTime(parseTimestamp(report.report_date, false))}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T style={{ fontWeight: '800', color: colors.green }}>{points} pts</T>
              <T v="small" style={{ color: colors.green }}>{reason}</T>
            </View>
          </Row>
          <ReportBody r={report} />
          {report.report_status !== 'Completed' && (
            <Button title="Unsubmit" kind="outline" icon="arrow-undo-outline" loading={busy} onPress={() => void unsubmit(report)} />
          )}
        </Card>
      </>
    );
  }

  if (task.submission_status === 'submitted') {
    // Recorded in the task log without a report (e.g. marked done before reports existed).
    return (
      <>
        <SectionHeader title="Your submission" />
        <Card>
          <Row style={{ backgroundColor: colors.greenBg, borderRadius: 10, padding: 12 }}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700', color: colors.green }}>Submitted</T>
              <T v="small" style={{ color: colors.green }}>Recorded in the task log; there is no report file to show.</T>
            </View>
          </Row>
        </Card>
      </>
    );
  }

  const ready = kind === 'file' ? !!file : !!link.trim();
  return (
    <>
      <SectionHeader title="Submit your report" />
      <Card style={{ gap: 12 }}>
        <Segmented value={kind} onChange={setKind} options={[{ value: 'file', label: 'File' }, { value: 'link', label: 'Link' }]} />
        {kind === 'file' ? (
          <Button title={file ? file.name : 'Select a file'} kind="outline" icon="document-attach-outline" onPress={() => void pick()} />
        ) : (
          <TextInput placeholder="https://drive.google.com/…" placeholderTextColor={colors.light} value={link} onChangeText={setLink}
            autoCapitalize="none" keyboardType="url" style={inputStyle} />
        )}
        <Button title="Submit report" icon="send" onPress={() => void submit()} disabled={!ready || task.status === 'disabled'} loading={busy} />
        <PointsTable task={task} />
      </Card>
    </>
  );
}

function PointsTable({ task: t }: { task: Task }) {
  const rows: [string, number | undefined][] = [
    ['A day or more early', t.points_early], ['On time', t.points_ontime],
    ['Late (within 24h)', t.points_late24], ['Late (after 24h)', t.points_after24],
  ];
  return (
    <View style={{ backgroundColor: colors.dark, borderRadius: 12, padding: 12, gap: 4 }}>
      <T style={{ color: '#fff', fontWeight: '700', marginBottom: 2 }}>Points you can earn</T>
      {rows.map(([label, v]) => (
        <Row key={label} style={{ justifyContent: 'space-between' }}>
          <T v="small" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</T>
          <T style={{ color: '#fff', fontWeight: '700' }}>{v ?? '—'}</T>
        </Row>
      ))}
    </View>
  );
}

function ReportBody({ r }: { r: Report }) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontWeight: '600' }}>{r.report_title}</T>
      {r.report_description ? <T v="muted">{r.report_description}</T> : null}
      {r.report_file_path && (
        <Button title={r.report_filename || 'Open file'} kind="outline" small icon="download-outline"
          onPress={() => void openUrl(resolveUrl(r.report_file_path))} />
      )}
      {r.report_link_url && (
        <Button title={r.report_link_url} kind="outline" small icon="open-outline" onPress={() => void openUrl(r.report_link_url!)} />
      )}
    </View>
  );
}

// ── Reviewer: the team's submissions ─────────────────────────────────────────

function Team({ task, viewerId, onChanged, onSend }: {
  task: Task; viewerId: number; onChanged: () => Promise<unknown>;
  onSend: (content: string, type: 'public' | 'private', reportId?: number) => Promise<void>;
}) {
  const p = teamProgress(task, viewerId);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reportFor = (uid: number) => task.reports?.find((r) => r.personnel_id === uid);

  const mark = async (r: Report, status: 'Completed' | 'Missing') => {
    setBusy(status);
    try {
      await api.reports.setStatus(r.id, status);
      await onChanged();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SectionHeader title={p.mineOnly ? 'People you assigned' : 'Assignees'}
        right={<T v="small">{p.submitted}/{p.total} submitted{p.missing ? ` · ${p.missing} missing` : ''}</T>} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {p.team.length === 0 && <T v="muted" style={{ padding: 16 }}>No one is assigned yet.</T>}
        {p.team.map((u, i) => {
          const r = reportFor(u.id);
          const st = assigneeStatus(u, r, p.pastDue);
          const expanded = open === u.id && !!r;
          const comments = r ? (task.private_comments ?? []).filter((c) =>
            c.user_id === r.personnel_id || (c.report_id != null && c.report_id === r.id)) : [];
          return (
            <View key={u.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Pressable onPress={() => r && setOpen(expanded ? null : u.id)} disabled={!r} accessibilityRole="button"
                accessibilityState={{ expanded }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                <Avatar name={u.full_name} size={34} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }} numberOfLines={1}>{u.full_name}</T>
                  <T v="small">{[roleLabel(u.target_role || u.role), u.grade_level].filter(Boolean).join(' · ')}</T>
                </View>
                <Pill label={st.label} tone={st.tone} />
                {r && <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.light} />}
              </Pressable>
              {expanded && r && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                  <T v="small">Submitted {formatDateTime(parseTimestamp(r.report_date, false))} · {reportPoints(task, r).points} pts</T>
                  <ReportBody r={r} />
                  {isActiveTask(task) && (
                    <Row gap={8}>
                      <Button title="Completed" kind="success" small icon="checkmark" style={{ flex: 1 }}
                        loading={busy === 'Completed'} disabled={r.report_status === 'Completed'} onPress={() => void mark(r, 'Completed')} />
                      <Button title="Missing" kind="danger" small icon="close" style={{ flex: 1 }}
                        loading={busy === 'Missing'} disabled={r.report_status === 'Missing'} onPress={() => void mark(r, 'Missing')} />
                    </Row>
                  )}
                  <T v="label">Private comments with {u.full_name.split(' ')[0]}</T>
                  <Comments comments={comments} meId={viewerId} onChanged={onChanged} />
                  <CommentInput placeholder="Add a private comment…" onSend={(c) => onSend(c, 'private', r.id)} />
                </View>
              )}
            </View>
          );
        })}
      </Card>
    </>
  );
}

// Reviewing is allowed for active tasks; disabled ones are read-only.
const isActiveTask = (t: Task) => t.status !== 'disabled';

// ── Comments ─────────────────────────────────────────────────────────────────

function Comments({ comments, meId, onChanged }: { comments: Comment[]; meId: number; onChanged: () => Promise<unknown> }) {
  const remove = async (c: Comment) => {
    if (!(await confirm('Delete comment', 'Delete this comment?', 'Delete', true))) return;
    try {
      await api.tasks.deleteComment(c.id);
      await onChanged();
    } catch (e) {
      notifyError(e);
    }
  };
  if (!comments.length) return <T v="muted" style={{ marginVertical: 10 }}>No comments yet.</T>;
  return (
    <View style={{ marginVertical: 8, gap: 12 }}>
      {comments.map((c) => (
        <Row key={c.id} gap={10} style={{ alignItems: 'flex-start' }}>
          <Avatar name={c.full_name} size={30} />
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <T style={{ fontWeight: '700', fontSize: 14 }}>{c.full_name}</T>
              <T v="small">{timeAgo(parseTimestamp(c.created_at))}</T>
            </Row>
            <T style={{ fontSize: 14.5 }}>{c.content}</T>
          </View>
          {c.user_id === meId && <IconButton icon="trash-outline" size={17} color={colors.light} label="Delete comment" onPress={() => void remove(c)} />}
        </Row>
      ))}
    </View>
  );
}

function CommentInput({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const c = text.trim();
    if (!c) return;
    setBusy(true);
    try {
      await onSend(c);
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Row gap={8} style={{ marginTop: 6 }}>
      <TextInput placeholder={placeholder} placeholderTextColor={colors.light} value={text} onChangeText={setText} multiline
        style={[inputStyle, { flex: 1, borderRadius: 20, paddingVertical: 9 }]} />
      <IconButton icon="send" color={text.trim() && !busy ? colors.accent : colors.light} label="Send comment" onPress={() => void send()} />
    </Row>
  );
}

const inputStyle = {
  backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text,
} as const;
