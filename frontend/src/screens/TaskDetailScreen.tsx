import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AssignPickerDialog } from '../components/AssignPickerDialog';
import { AssignRoleSelector } from '../components/AssignRoleSelector';
import { CommentInputField, CommentItem } from '../components/commonWidgets';
import { showFileViewer } from '../components/FileViewerDialog';
import { TaskDetailSkeleton } from '../components/skeletonWidgets';
import { Icon, IconName } from '../components/ui/Icon';
import { ElevatedButton, FilledButton, IconButton, InkWell, OutlinedButton, Tap, TextButton } from '../components/ui/buttons';
import { TextField } from '../components/ui/inputs';
import { CircleAvatar, CircularProgressIndicator, LinearProgressIndicator, Tooltip, useIsMobile } from '../components/ui/misc';
import { pushPage } from '../components/ui/navigator';
import { AlertDialog, Dialog, showDialog, showSnackBar } from '../components/ui/overlay';
import { Report, Task, User, tryParseDate } from '../models/models';
import { ApiService, PickedFile, errorMessage, exceptionText } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, TextStyles, ts, tsAvatar, tsField, tsPlain, withOpacity } from '../theme/appTheme';
import { openUrl, pickFile } from '../utils/files';
import EditTaskScreen from './EditTaskScreen';

interface TaskDetailScreenProps {
  taskId: number;
  onBack?: () => void;
  /// True when opened from "My Tasks" — the viewer is acting as a submitter
  /// working on their own assigned task, so assign/review UI (which reveals
  /// who else the task is assigned to) is hidden.
  ownTaskView?: boolean;
  /// Closes the screen when it was pushed as a page (Navigator.pop).
  onClose?: () => void;
}

type Status = [label: string, fg: string, bg: string];

const cardTitle = ts({ size: 15, weight: 700, color: AppTheme.textPrimary });

function showSnack(msg: string, error = false) {
  showSnackBar(msg, {
    backgroundColor: error ? AppTheme.redColor : AppTheme.darkBanner,
    floating: true,
    radius: 8,
  });
}

function fmtDate(d: string): string {
  if (d.length === 0) return '';
  const dt = tryParseDate(d);
  if (dt == null) return d;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

export default function TaskDetailScreen({ taskId, onBack, ownTaskView = false, onClose }: TaskDetailScreenProps) {
  const app = useAppState();
  const isMobile = useIsMobile();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const t = await ApiService.getTask(taskId);
      if (mounted.current) {
        setTask(t);
        setLoading(false);
        if (t.reports.length > 0) setSelectedReport(t.reports[0]);
      }
    } catch {
      if (mounted.current) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const sendComment = async (content: string, type: string, reportId?: number) => {
    try {
      await ApiService.addComment(taskId, content, type, reportId);
      load();
    } catch (e) {
      showSnack(exceptionText(e), true);
    }
  };

  const deleteComment = async (commentId: number) => {
    try {
      await ApiService.deleteComment(commentId);
      if (mounted.current) load();
    } catch (e) {
      if (mounted.current) showSnack(exceptionText(e), true);
    }
  };

  const editComment = async (commentId: number, current: string) => {
    const result = await showDialog<string>((pop) => <EditCommentDialog initial={current} pop={pop} />);
    if (!mounted.current) return;
    if (result != null && result.length > 0) {
      try {
        await ApiService.editComment(commentId, result);
        if (mounted.current) load();
      } catch (e) {
        if (mounted.current) showSnack(exceptionText(e), true);
      }
    }
  };

  const user = app.currentUser;
  if (user == null) return null;

  // Separation of duties is route-based: in Task Manager (/tasks) the assigner
  // sees who is assigned and team submissions; in My Tasks (/my-tasks,
  // ownTaskView) those are hidden so the user only sees their own work.
  const canAssign = user.canAssign && !ownTaskView;
  const canReview = user.canReviewSubmissions && !ownTaskView;
  // Opened from Task Manager the viewer is handling the task, so the side
  // panel reviews assignees' submissions; their own submission (if they are
  // also assigned) is done from My Tasks (ownTaskView).
  const isReviewOnly = canReview || canAssign;

  const page = (child: React.ReactNode) =>
    onBack != null ? child : <View style={{ flex: 1, backgroundColor: AppTheme.bgColor }}>{child}</View>;

  if (loading) return <TaskDetailSkeleton hasBack={onBack != null} />;

  if (task == null) {
    return page(
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={TextStyles.bodyMd}>Task not found</Text>
      </View>,
    );
  }

  const t = task;
  const back = <BackButton onBack={onBack ?? onClose} />;

  const buildMainContent = () => {
    const canManage = t.canEdit;
    const isLeaf = user.can('receive_tasks');
    const reviewing = canAssign || canReview;
    const deadline = t.deadline;
    const pastDue = deadline != null && deadline.getTime() < Date.now();

    // Per-assignee status for reviewers: their report (if visible) decides
    // Completed / Pending review / Marked missing; otherwise Submitted (log
    // only), Missing (past deadline) or Not submitted.
    const reportsBy = new Map<number, Report>(t.reports.map((r) => [r.personnelId, r]));
    // A coordinator/dean who only delegated part of the task tracks the people
    // they assigned (team_scope 'mine'); everything below uses that same set.
    const mineOnly = t.teamScope === 'mine';
    const team = mineOnly ? t.assignedUsers.filter((u) => t.assignedByOf.get(u.id) === user.id) : t.assignedUsers;
    const submitted = team.filter((u) => t.submittedAssigneeIds.has(u.id)).length;
    const total = team.length;
    const missing = pastDue ? total - submitted : 0;
    const noInstructions = (t.instructions ?? '').trim().length === 0;

    const statusFor = (u: User): Status => {
      const r = reportsBy.get(u.id);
      if (r != null) {
        switch (r.reportStatus) {
          case 'Completed': return ['Completed', '#15803D', AppTheme.greenBg];
          case 'Missing': return ['Marked missing', '#B91C1C', AppTheme.redBg];
          default: return ['Pending review', AppTheme.accentBlue, AppTheme.blueBg];
        }
      }
      if (t.submittedAssigneeIds.has(u.id)) return ['Submitted', '#15803D', AppTheme.greenBg];
      return pastDue ? ['Missing', '#B91C1C', AppTheme.redBg] : ['Not submitted', '#92400E', AppTheme.amberBg];
    };

    return (
      <View style={{ alignSelf: 'stretch' }}>
        {/* ── Header ── */}
        <DetailCard>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={styles.headerIcon}>
              <Icon
                name={t.taskCategory === 'special' ? 'star_outline_rounded' : 'assignment_outlined'}
                color={AppTheme.darkBanner}
                size={24}
              />
            </View>
            <View style={{ width: 14 }} />
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Text style={ts({ size: 22, weight: 700, color: AppTheme.textPrimary, height: 1.25 })}>{t.title}</Text>
              <View style={{ height: 8 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Pill text={t.taskCategory === 'special' ? 'Special task' : 'Task'} fg={AppTheme.textMuted} bg="#F1F5F9" />
                {t.status !== 'active' && <Pill text="Disabled" fg={AppTheme.textMuted} bg="#F1F5F9" />}
                {isLeaf && !reviewing &&
                  (t.isSubmitted ? (
                    <Pill text="Submitted" fg="#15803D" bg={AppTheme.greenBg} />
                  ) : pastDue ? (
                    <Pill text="Missing" fg="#B91C1C" bg={AppTheme.redBg} />
                  ) : (
                    <Pill text="Not submitted" fg="#92400E" bg={AppTheme.amberBg} />
                  ))}
              </View>
            </View>
            {canManage && (
              <OutlinedButton
                onPress={() => pushPage<boolean>((pop) => <EditTaskScreen task={t} onClose={pop} />).then(() => load())}
                icon="edit_outlined"
                iconSize={16}
                foregroundColor={AppTheme.textPrimary}
                side={{ color: AppTheme.borderColor }}
                radius={8}
              >
                Edit task
              </OutlinedButton>
            )}
          </View>
          <View style={{ height: 16 }} />
          <View style={styles.divider} />
          <View style={{ height: 14 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 32, rowGap: 12 }}>
            <MetaItem
              icon="play_circle_outline"
              label="Start"
              value={(t.startDate ?? '').length === 0 ? 'Not set' : fmtDate(t.startDate!)}
            />
            <MetaItem
              icon="flag_outlined"
              label="Deadline"
              value={
                deadline == null
                  ? 'No deadline'
                  : `${fmtDate(t.endDate!)}` +
                    `${(t.dueTime ?? '').length > 0 && t.dueTime!.toUpperCase() !== '11:59 PM' ? `, ${t.dueTime}` : ''}`
              }
              emphasis={pastDue ? AppTheme.redColor : AppTheme.textPrimary}
              note={pastDue ? 'Past deadline' : null}
            />
            {reviewing && (
              <MetaItem
                icon="groups_outlined"
                label={mineOnly ? 'Assigned by you' : 'Assigned'}
                value={
                  mineOnly
                    ? `${total} of ${t.assignedUsers.length} people`
                    : `${total} ${total === 1 ? 'person' : 'people'}`
                }
              />
            )}
          </View>
        </DetailCard>
        <View style={{ height: 16 }} />

        {/* ── Submission progress (reviewers) ── */}
        {reviewing && (total > 0 || mineOnly) && (
          <>
            <DetailCard>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={cardTitle}>Submission progress</Text>
                <View style={{ flex: 1 }} />
                <Text style={ts({ size: 14, weight: 700, color: submitted >= total ? '#15803D' : AppTheme.textPrimary })}>
                  {`${submitted} of ${total} submitted`}
                </Text>
              </View>
              {mineOnly && (
                <>
                  <View style={{ height: 2 }} />
                  <Text style={TextStyles.caption}>
                    {`Counting the ${total} ${total === 1 ? 'person' : 'people'} you assigned ` +
                      `(${t.assignedUsers.length} on this task in total).`}
                  </Text>
                </>
              )}
              <View style={{ height: 12 }} />
              <LinearProgressIndicator
                value={total === 0 ? 0 : submitted / total}
                minHeight={10}
                radius={6}
                backgroundColor="#EEF2FA"
                color={submitted >= total ? AppTheme.greenColor : AppTheme.accentBlue}
              />
              <View style={{ height: 12 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 8 }}>
                <Legend color={AppTheme.greenColor} label="Submitted" count={submitted} />
                <Legend
                  color={AppTheme.amberColor}
                  label="Not yet submitted"
                  count={Math.min(Math.max(total - submitted - missing, 0), total)}
                />
                <Legend color={AppTheme.redColor} label="Missing (past deadline)" count={missing} />
              </View>
            </DetailCard>
            <View style={{ height: 16 }} />
          </>
        )}

        {/* ── Instructions ── */}
        <DetailCard>
          <Text style={cardTitle}>Instructions</Text>
          <View style={{ height: 10 }} />
          <Text
            style={[
              TextStyles.bodyLg,
              { lineHeight: 16 * 1.6, color: noInstructions ? AppTheme.textLight : AppTheme.textPrimary },
            ]}
          >
            {noInstructions ? 'No instructions provided.' : t.instructions}
          </Text>
        </DetailCard>
        <View style={{ height: 16 }} />

        {/* ── Assignees with their status (reviewers) ── */}
        {reviewing && (
          <>
            <AssigneesCard
              taskId={t.id}
              task={t}
              assignedUsers={team}
              allAssigned={t.assignedUsers}
              title={mineOnly ? 'People you assigned' : 'Assigned personnel'}
              canEdit={canAssign}
              statusFor={statusFor}
              selectedUserId={selectedReport?.personnelId ?? null}
              onSelect={(u) => {
                const r = reportsBy.get(u.id);
                if (r != null) setSelectedReport(r);
              }}
              hasReport={(u) => reportsBy.has(u.id)}
              onChanged={load}
            />
            <View style={{ height: 16 }} />
          </>
        )}

        {/* ── Public comments ── */}
        <DetailCard>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="chat_bubble_outline" size={18} color={AppTheme.textMuted} />
            <View style={{ width: 8 }} />
            <Text style={cardTitle}>Public comments</Text>
            {t.publicComments.length > 0 && (
              <>
                <View style={{ width: 8 }} />
                <Pill text={`${t.publicComments.length}`} fg={AppTheme.textMuted} bg="#F1F5F9" />
              </>
            )}
          </View>
          <View style={{ height: 4 }} />
          <Text style={TextStyles.caption}>Visible to everyone assigned to this task.</Text>
          <View style={{ height: 12 }} />
          {t.publicComments.length > 0 && (
            <>
              {t.publicComments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onEdit={c.userId === user.id ? () => editComment(c.id, c.content) : undefined}
                  onDelete={c.userId === user.id ? () => deleteComment(c.id) : undefined}
                />
              ))}
              <View style={{ height: 8 }} />
            </>
          )}
          <CommentInputField placeholder="Add a comment..." onSend={(c) => sendComment(c, 'public')} />
        </DetailCard>
      </View>
    );
  };

  // Sidebar for roles that can only review (principal/admin/coordinator)
  const buildReviewSidebar = () => {
    if (selectedReport == null) {
      return (
        <View style={{ paddingTop: 6 }}>
          <Text style={cardTitle}>Submission</Text>
          <View style={{ height: 24 }} />
          <View style={{ alignItems: 'center' }}>
            <View style={styles.emptyReport}>
              <Icon name="description_outlined" color={AppTheme.textMuted} />
            </View>
            <View style={{ height: 12 }} />
            <Text style={TextStyles.labelMd}>
              {t.reports.length === 0 ? 'No submissions yet' : 'No submission selected'}
            </Text>
            <View style={{ height: 4 }} />
            <Text style={[TextStyles.bodySm, { textAlign: 'center' }]}>
              {t.reports.length === 0
                ? 'Reports appear here once assignees submit.'
                : 'Choose someone marked "Pending review" or "Completed" to read their report.'}
            </Text>
          </View>
        </View>
      );
    }
    const r = selectedReport;
    // Comments from the submitter or tagged to this report.
    const comments = t.privateComments.filter(
      (c) => c.userId === r.personnelId || (c.reportId != null && c.reportId === r.id),
    );
    return (
      <View style={{ alignItems: 'flex-start' }}>
        <View style={{ height: 6 }} />
        <Text style={TextStyles.caption}>Submission</Text>
        <View style={{ height: 6 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={cardTitle}>{r.fullName ?? ''}</Text>
            {r.gradeLevel != null && <Text style={TextStyles.bodySm}>{r.gradeLevel}</Text>}
          </View>
          <StatusChip status={r.reportStatus} small />
        </View>
        <View style={{ height: 16 }} />
        <View style={styles.reportBox}>
          <SubmissionTypeLabel type={r.reportType} />
          <View style={{ height: 6 }} />
          <Text style={[TextStyles.labelMd, wrapAnywhere]}>{r.reportTitle}</Text>
          {r.reportDescription != null && (
            <>
              <View style={{ height: 6 }} />
              <Text style={[TextStyles.bodyMd, wrapAnywhere]}>{r.reportDescription}</Text>
            </>
          )}
          {r.reportFilename != null && r.reportFilePath != null && (
            <>
              <View style={{ height: 8 }} />
              <FileItem filename={r.reportFilename} url={`${ApiService.baseUrl}${r.reportFilePath}`} />
            </>
          )}
          {r.reportLinkUrl != null && (
            <>
              <View style={{ height: 8 }} />
              <LinkItem url={r.reportLinkUrl} />
            </>
          )}
        </View>
        <View style={{ height: 12 }} />
        <Text style={TextStyles.caption}>Mark this submission as</Text>
        <View style={{ height: 6 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <OutlinedButton
            onPress={async () => {
              await ApiService.updateReportStatus(r.id, 'Completed');
              load();
            }}
            foregroundColor={AppTheme.greenColor}
            side={{ color: AppTheme.greenColor }}
            padding={[12, 6]}
            compact
            shrinkWrap
            radius={6}
            textStyle={tsPlain({ size: 12, weight: 600 })}
          >
            Completed
          </OutlinedButton>
          <View style={{ width: 8 }} />
          <OutlinedButton
            onPress={async () => {
              await ApiService.updateReportStatus(r.id, 'Missing');
              load();
            }}
            foregroundColor={AppTheme.redColor}
            side={{ color: AppTheme.redColor }}
            padding={[12, 6]}
            compact
            shrinkWrap
            radius={6}
            textStyle={tsPlain({ size: 12, weight: 600 })}
          >
            Missing
          </OutlinedButton>
        </View>
        <View style={{ height: 20 }} />
        <View style={[styles.divider, { alignSelf: 'stretch' }]} />
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="lock_outline" size={15} color={AppTheme.textMuted} />
          <View style={{ width: 6 }} />
          <Text style={[cardTitle, { flexShrink: 1 }]}>Private comments</Text>
        </View>
        <View style={{ height: 4 }} />
        <Text style={TextStyles.bodySm}>Only visible to the submitter and reviewers.</Text>
        <View style={{ height: 10 }} />
        {comments.length === 0 ? (
          <View style={{ paddingBottom: 6 }}>
            <Text style={TextStyles.bodyMd}>No private comments yet.</Text>
          </View>
        ) : (
          <View style={{ alignSelf: 'stretch' }}>
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                onEdit={c.userId === user.id ? () => editComment(c.id, c.content) : undefined}
                onDelete={c.userId === user.id ? () => deleteComment(c.id) : undefined}
              />
            ))}
          </View>
        )}
        <View style={{ height: 8 }} />
        <View style={{ alignSelf: 'stretch' }}>
          <CommentInputField placeholder="Add private comment..." onSend={(c) => sendComment(c, 'private', r.id)} />
        </View>
      </View>
    );
  };

  // Sidebar for submitters (teacher/registrar/dean)
  const buildSubmitSidebar = (showHeader = true) => (
    <View>
      {showHeader && (
        <View style={{ paddingLeft: 4, paddingBottom: 14 }}>
          <Text style={ts({ size: 16, weight: 700, color: AppTheme.textPrimary })}>Your Submission</Text>
        </View>
      )}
      {/* ── Points preview (only when not yet submitted) ── */}
      {t.myReport == null && <PointsPreviewCard task={t} />}
      {t.myReport == null && <View style={{ height: 14 }} />}
      <ReportForm
        taskId={taskId}
        task={t}
        existingReport={t.myReport}
        onSubmitted={() => load()}
        onError={(msg) => showSnack(msg, true)}
        onUnsubmit={async () => {
          try {
            await ApiService.deleteReport(t.myReport!.id);
            load();
          } catch (e) {
            if (mounted.current) showSnack(exceptionText(e), true);
          }
        }}
      />
      <View style={{ height: 14 }} />
      {/* ── Private Comments card ── */}
      <View style={styles.privateCard}>
        <View style={{ paddingLeft: 16, paddingTop: 16, paddingRight: 16, paddingBottom: 10 }}>
          <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>Private Comments</Text>
        </View>
        {t.privateComments.length === 0 ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={TextStyles.bodyMd}>No private comments yet.</Text>
          </View>
        ) : (
          t.privateComments.map((c) => (
            <View key={c.id} style={{ paddingHorizontal: 16 }}>
              <CommentItem
                comment={c}
                onEdit={c.userId === user.id ? () => editComment(c.id, c.content) : undefined}
                onDelete={c.userId === user.id ? () => deleteComment(c.id) : undefined}
              />
            </View>
          ))
        )}
        <View style={styles.divider} />
        <InlineCommentInput userInitials={user.initials} onSend={(c) => sendComment(c, 'private')} />
      </View>
    </View>
  );

  if (!isMobile) {
    return page(
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'stretch' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingLeft: 28, paddingTop: 14, paddingRight: 28, paddingBottom: 28, alignItems: 'flex-start' }}
        >
          {back}
          {buildMainContent()}
        </ScrollView>
        <View
          style={{
            width: 320,
            backgroundColor: isReviewOnly ? '#FFFFFF' : AppTheme.bgColor,
            borderLeftWidth: 1,
            borderLeftColor: AppTheme.borderColor,
          }}
        >
          <ScrollView contentContainerStyle={{ paddingLeft: 16, paddingTop: 20, paddingRight: 16, paddingBottom: 24 }}>
            {isReviewOnly ? buildReviewSidebar() : buildSubmitSidebar()}
          </ScrollView>
        </View>
      </View>,
    );
  }

  const deadlineText =
    (t.endDate ?? '').length === 0 ? 'No due date' : `Due ${fmtDate(t.endDate!)}, ${t.dueTime ?? '11:59 PM'}`;

  return page(
    <WorkSheet
      base={
        // ── Base: task details (scrolls behind the sheet) ──
        <ScrollView contentContainerStyle={{ paddingLeft: 16, paddingTop: 16, paddingRight: 16, paddingBottom: 300, alignItems: 'flex-start' }}>
          {back}
          {buildMainContent()}
        </ScrollView>
      }
      header={
        // Header: "Your work" + due date
        <View style={{ paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <Text style={TextStyles.heading3}>Your work</Text>
          <View style={{ flex: 1 }} />
          <Text numberOfLines={1} style={[TextStyles.bodyMd, { textAlign: 'right', flexShrink: 1 }]}>{deadlineText}</Text>
        </View>
      }
    >
      {isReviewOnly ? buildReviewSidebar() : buildSubmitSidebar(false)}
    </WorkSheet>,
  );
}

// ── Draggable "Your work" sheet ───────────────────────────────────────────────

const SHEET_INITIAL = 0.42;
const SHEET_MIN = 0.14;
const SHEET_MAX = 0.92;

/// The bottom sheet over the task on phones: starts at 42% of the height and
/// drags between 14% and 92% by its handle and header.
function WorkSheet({ base, header, children }: { base: React.ReactNode; header: React.ReactNode; children: React.ReactNode }) {
  const [height, setHeight] = useState(0);
  const [fraction, setFraction] = useState(SHEET_INITIAL);
  const start = useRef(SHEET_INITIAL);
  const current = useRef(SHEET_INITIAL);
  const total = useRef(0);
  total.current = height;
  current.current = fraction;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
          start.current = current.current;
        },
        onPanResponderMove: (_, g) => {
          if (total.current <= 0) return;
          const next = start.current - g.dy / total.current;
          setFraction(Math.min(SHEET_MAX, Math.max(SHEET_MIN, next)));
        },
      }),
    [],
  );

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {base}
      <View style={[styles.sheet, { height: height * fraction }]}>
        <View {...pan.panHandlers} style={{ alignItems: 'center', cursor: 'grab' } as object}>
          {/* Drag handle */}
          <View style={{ paddingTop: 10, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, backgroundColor: AppTheme.borderColor, borderRadius: 2 }} />
          </View>
          {header}
        </View>
        <View style={styles.divider} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingLeft: 16, paddingTop: 14, paddingRight: 16, paddingBottom: 24 }}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

function EditCommentDialog({ initial, pop }: { initial: string; pop: (result?: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <Dialog radius={14}>
      <View style={{ width: 380, maxWidth: '100%', padding: 24 }}>
        <Text style={ts({ size: 16, weight: 700 })}>Edit Comment</Text>
        <View style={{ height: 14 }} />
        <TextField
          value={text}
          onChangeText={setText}
          maxLines={4}
          minLines={4}
          autoFocus
          decoration={{ contentPadding: [12, 12] }}
        />
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TextButton onPress={() => pop()}>
            <Text style={TextStyles.labelMd}>Cancel</Text>
          </TextButton>
          <View style={{ width: 8 }} />
          <ElevatedButton onPress={() => pop(text.trim())} backgroundColor={AppTheme.darkBanner}>Save</ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

// ── Assign Users Section ──────────────────────────────────────────────────────

/// Everyone assigned to the task with their submission status. Picking someone
/// who has a report opens it in the review panel; assigners can add/remove.
function AssigneesCard({
  taskId,
  assignedUsers: users,
  title = 'Assigned personnel',
  allAssigned = [],
  canEdit,
  statusFor,
  hasReport,
  selectedUserId,
  onSelect,
  onChanged,
  task,
}: {
  taskId: number;
  assignedUsers: User[];
  title?: string;
  /// Everyone on the task (the list above may show only the viewer's team);
  /// the Assign dialog leaves all of them out.
  allAssigned?: User[];
  canEdit: boolean;
  statusFor: (u: User) => Status;
  hasReport: (u: User) => boolean;
  selectedUserId: number | null;
  onSelect: (u: User) => void;
  onChanged: () => void;
  task?: Task;
}) {
  const openAssignDialog = async () => {
    const result = await showDialog<boolean>((pop) => (
      <AssignDialog taskId={taskId} alreadyAssigned={allAssigned.length === 0 ? users : allAssigned} task={task} pop={pop} />
    ));
    if (result === true) onChanged();
  };

  const unassign = async (u: User) => {
    const ok = await showDialog<boolean>((pop) => (
      <AlertDialog
        title={`Remove ${u.fullName}?`}
        content="They will no longer see this task. Anything they already submitted stays on record."
        actions={
          <>
            <TextButton onPress={() => pop(false)}>Keep assigned</TextButton>
            <FilledButton onPress={() => pop(true)} backgroundColor={AppTheme.redColor}>
              {`Remove ${u.fullName.split(' ')[0]}`}
            </FilledButton>
          </>
        }
      />
    ));
    if (ok !== true) return;
    try {
      await ApiService.unassignTask(taskId, u.id);
      onChanged();
    } catch (e) {
      showSnackBar(errorMessage(e), { backgroundColor: AppTheme.redColor });
    }
  };

  const row = (u: User, first: boolean, last: boolean) => {
    const [label, fg, bg] = statusFor(u);
    const selectable = hasReport(u);
    const selected = selectedUserId === u.id;
    const sub = [u.roleLabel, ...(u.gradeLevel != null ? [u.gradeLevel] : [])].join(' · ');
    return (
      <InkWell
        onPress={selectable ? () => onSelect(u) : null}
        style={{
          backgroundColor: selected ? '#EFF6FF' : 'transparent',
          borderTopLeftRadius: first ? 10 : 0,
          borderTopRightRadius: first ? 10 : 0,
          borderBottomLeftRadius: last ? 10 : 0,
          borderBottomRightRadius: last ? 10 : 0,
        }}
      >
        <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
          <CircleAvatar radius={17} backgroundColor={AppTheme.sidebarActive}>
            <Text style={tsAvatar(13, 700, '#FFFFFF')}>{u.initials}</Text>
          </CircleAvatar>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={ts({ size: 14, weight: 600, color: AppTheme.textPrimary })}>{u.fullName}</Text>
            <Text style={TextStyles.caption}>{sub}</Text>
          </View>
          <Pill text={label} fg={fg} bg={bg} />
          {selectable && (
            <>
              <View style={{ width: 4 }} />
              <Tooltip message={`View ${u.fullName.split(' ')[0]}'s report`}>
                <Icon name="chevron_right_rounded" color={selected ? AppTheme.accentBlue : AppTheme.textLight} />
              </Tooltip>
            </>
          )}
          {canEdit && (
            <IconButton
              tooltip={`Remove ${u.fullName}`}
              onPress={() => unassign(u)}
              size={18}
              compact
              icon={<Icon name="person_remove_outlined" size={18} color={AppTheme.textMuted} />}
            />
          )}
        </View>
      </InkWell>
    );
  };

  return (
    <DetailCard>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={ts({ size: 15, weight: 700, color: AppTheme.textPrimary })}>{title}</Text>
        <View style={{ width: 8 }} />
        <Pill text={`${users.length}`} fg={AppTheme.textMuted} bg="#F1F5F9" />
        <View style={{ flex: 1 }} />
        {canEdit && (
          <FilledButton
            onPress={openAssignDialog}
            icon="person_add_alt_1_outlined"
            iconSize={16}
            backgroundColor={AppTheme.darkBanner}
            padding={[14, 10]}
            radius={8}
          >
            Assign
          </FilledButton>
        )}
      </View>
      <View style={{ height: 12 }} />
      {users.length === 0 ? (
        <View style={{ paddingVertical: 8 }}>
          <Text style={TextStyles.bodyMd}>No one is assigned yet.</Text>
        </View>
      ) : (
        <View style={{ borderRadius: 10, borderWidth: 1, borderColor: AppTheme.borderColor }}>
          {users.map((u, i) => (
            <React.Fragment key={u.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: '#F0F2F6' }} />}
              {row(u, i === 0, i === users.length - 1)}
            </React.Fragment>
          ))}
        </View>
      )}
    </DetailCard>
  );
}

// ── Assign Dialog ──────────────────────────────────────────────────────────────

function AssignDialog({ taskId, alreadyAssigned, task: t, pop }: {
  taskId: number;
  alreadyAssigned: User[];
  /// The task being assigned, for skill/workload suggestions.
  task?: Task;
  pop: (result?: boolean) => void;
}) {
  const app = useAppState();
  const roleOptions = useRef(app.assignableRoles).current;
  const [available, setAvailable] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState(roleOptions.length === 0 ? 'teacher' : roleOptions[0]);

  useEffect(() => {
    let mounted = true;
    ApiService.getAssignableUsers(targetRole)
      .then((users) => {
        const assignedIds = new Set(alreadyAssigned.map((u) => u.id));
        if (mounted) {
          setAvailable(users.filter((u) => !assignedIds.has(u.id)));
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(exceptionText(e));
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
    // People are reloaded only when the target role changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRole]);

  const setRole = (r: string) => {
    if (r === targetRole) return;
    setTargetRole(r);
    setLoading(true);
  };

  const roleSelector =
    roleOptions.length > 1 ? (
      <View style={{ alignItems: 'flex-start' }}>
        <Text style={TextStyles.labelSm}>Assign as</Text>
        <View style={{ height: 6 }} />
        <AssignRoleSelector options={roleOptions} value={targetRole} onChanged={setRole} />
      </View>
    ) : null;

  if (loading || error != null || available.length === 0) {
    return (
      <Dialog backgroundColor="#FFFFFF" radius={20}>
        <View style={{ width: 520, maxWidth: '100%', padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={TextStyles.heading3}>Assign Users</Text>
            <View style={{ flex: 1 }} />
            <IconButton onPress={() => pop()} icon="close" color={AppTheme.textMuted} />
          </View>
          {roleSelector != null && (
            <>
              <View style={{ height: 8 }} />
              {roleSelector}
            </>
          )}
          <View style={{ height: 24 }} />
          <View style={{ alignItems: 'center' }}>
            {loading ? (
              <CircularProgressIndicator color={AppTheme.accentBlue} />
            ) : (
              <Text style={TextStyles.bodyMd}>{error ?? 'Everyone with this role is already assigned.'}</Text>
            )}
          </View>
          <View style={{ height: 24 }} />
        </View>
      </Dialog>
    );
  }

  return (
    <AssignPickerDialog
      // A new role reloads the people, so start the picker afresh.
      key={targetRole}
      pop={pop}
      title="Assign Users"
      header={roleSelector}
      users={available}
      selected={new Set()}
      onChanged={() => {}}
      hasTaskText={t != null && [t.title, t.subject, t.instructions].some((v) => (v ?? '').trim().length > 0)}
      loadSuggestions={
        t == null
          ? undefined
          : () =>
              ApiService.getAssigneeSuggestions({
                targetRole,
                title: t.title,
                subject: t.subject ?? '',
                instructions: t.instructions ?? '',
                taskCategory: t.taskCategory,
                startDate: t.startDate,
                endDate: t.endDate,
                dueTime: t.dueTime,
              })
      }
      onConfirm={async (ids) => {
        await ApiService.assignTask(taskId, [...ids], targetRole);
      }}
    />
  );
}

// ── Report submission form ────────────────────────────────────────────────────

function ReportForm({ taskId, task, existingReport, onSubmitted, onError, onUnsubmit }: {
  taskId: number;
  task: Task;
  existingReport: Report | null;
  onSubmitted: () => void;
  onError: (msg: string) => void;
  onUnsubmit?: () => void;
}) {
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null); // 'file' or 'link'
  const [link, setLink] = useState('');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fileName = pickedFile?.name ?? null;
  const hasContent = fileName != null || link.trim().length > 0;

  const choose = async () => {
    const result = await pickFile();
    if (result != null && mounted.current) {
      setPickedFile(result);
      setShowAddOptions(false);
    }
  };

  const submit = async () => {
    if (!hasContent) return;
    setSubmitting(true);
    try {
      const title = selectedType === 'link' ? link.trim() : fileName ?? 'File submission';
      await ApiService.submitReport(taskId, {
        reportTitle: title,
        reportType: selectedType,
        reportLinkUrl: selectedType === 'link' ? link.trim() : null,
      });
      // Upload file bytes if file was picked
      if (selectedType === 'file' && pickedFile != null) {
        try {
          await ApiService.uploadReportFile(taskId, pickedFile);
        } catch {} // file upload failure is non-critical
      }
      if (mounted.current) onSubmitted();
    } catch (e) {
      onError(exceptionText(e));
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  if (existingReport != null) {
    const r = existingReport;

    const calcPoints = (): number => {
      if (task.endDate == null || r.reportDate.length === 0) return 0;
      const due = tryParseDate(task.endDate);
      const submitted = tryParseDate(r.reportDate);
      if (due == null || submitted == null) return 0;
      const hours = Math.trunc((submitted.getTime() - due.getTime()) / 3600000);
      if (hours <= -24) return task.pointsEarly ?? 100;
      if (hours <= 0) return task.pointsOntime ?? 100;
      if (hours <= 24) return task.pointsLate24 ?? 50;
      return task.pointsAfter24 ?? 0;
    };

    const pointsReason = (points: number): string => {
      if (points >= 100) return 'On time';
      if (points >= 50) return 'Late (within 24h)';
      return 'Late (after 24h)';
    };

    const fmtDateTime = (dt: string): string => {
      const d = tryParseDate(dt);
      if (d == null) return dt;
      const h = d.getHours() > 12 ? d.getHours() - 12 : d.getHours() === 0 ? 12 : d.getHours();
      const m = `${d.getMinutes()}`.padStart(2, '0');
      const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}, ${h}:${m} ${ampm}`;
    };

    const points = calcPoints();
    return (
      <View>
        {/* ── Submitted badge ── */}
        <View style={styles.submittedBadge}>
          <Icon name="check_circle" color={AppTheme.greenColor} size={20} />
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={ts({ size: 14, weight: 700, color: AppTheme.greenColor })}>Submitted</Text>
            <Text style={ts({ size: 11, color: withOpacity(AppTheme.greenColor, 0.75) })}>Your report has been received</Text>
          </View>
        </View>
        <View style={{ height: 10 }} />
        {/* ── Submitted content card ── */}
        <View style={styles.submittedCard}>
          <View style={{ flexDirection: 'row' }}>
            <SubmissionTypeLabel type={r.reportType} />
          </View>
          <View style={{ height: 8 }} />
          <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{r.reportTitle}</Text>
          {r.reportFilename != null && r.reportFilePath != null && (
            <>
              <View style={{ height: 8 }} />
              <FileItem filename={r.reportFilename} url={`${ApiService.baseUrl}${r.reportFilePath}`} />
            </>
          )}
          {r.reportLinkUrl != null && (
            <>
              <View style={{ height: 8 }} />
              <LinkItem url={r.reportLinkUrl} />
            </>
          )}
        </View>
        <View style={{ height: 10 }} />
        {/* ── Points card ── */}
        <View style={{ padding: 16, backgroundColor: AppTheme.darkBanner, borderRadius: 12 }}>
          <Text style={ts({ size: 12, weight: 500, color: 'rgba(255,255,255,0.65)' })}>Points Earned</Text>
          <View style={{ height: 6 }} />
          <Text style={ts({ size: 28, weight: 800, color: '#FFFFFF' })}>{`+${points}`}</Text>
          <Text style={ts({ size: 12, color: 'rgba(255,255,255,0.65)' })}>{pointsReason(points)}</Text>
          {r.reportDate.length > 0 && (
            <>
              <View style={{ height: 10 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="access_time" size={12} color="rgba(255,255,255,0.5)" />
                <View style={{ width: 4 }} />
                <Text style={ts({ size: 11, color: 'rgba(255,255,255,0.55)' })}>{`Submitted: ${fmtDateTime(r.reportDate)}`}</Text>
              </View>
            </>
          )}
        </View>
        <View style={{ height: 10 }} />
        {/* ── Unsubmit ── */}
        <ElevatedButton
          onPress={onUnsubmit}
          backgroundColor="#3D4350"
          foregroundColor="#FFFFFF"
          padding={[0, 14]}
          radius={12}
          textStyle={tsPlain({ size: 14, weight: 600 })}
        >
          Unsubmit
        </ElevatedButton>
      </View>
    );
  }

  const addedPreview = () => {
    if (selectedType === 'link' && link.trim().length > 0) {
      return (
        <View style={styles.preview}>
          <Icon name="link_rounded" size={14} color={AppTheme.accentBlue} />
          <View style={{ width: 6 }} />
          <Text numberOfLines={1} style={[TextStyles.bodySm, { color: AppTheme.accentBlue, flex: 1 }]}>{link.trim()}</Text>
        </View>
      );
    }
    if (fileName != null) {
      return (
        <View style={styles.preview}>
          <Icon name="insert_drive_file_outlined" size={14} color={AppTheme.accentBlue} />
          <View style={{ width: 6 }} />
          <Text numberOfLines={1} style={[TextStyles.bodySm, { color: AppTheme.textPrimary, flex: 1 }]}>{fileName}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View>
      {/* ── Files & Links card ── */}
      <View style={styles.filesCard}>
        <View style={{ paddingLeft: 16, paddingTop: 14, paddingRight: 16, paddingBottom: 4 }}>
          <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>{'Files & Links'}</Text>
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          {hasContent ? addedPreview() : <Text style={TextStyles.bodySm}>No files added yet</Text>}
        </View>
        <View style={{ paddingLeft: 12, paddingTop: 4, paddingRight: 12, paddingBottom: 12 }}>
          <OutlinedButton
            onPress={() => {
              const next = !showAddOptions;
              setShowAddOptions(next);
              if (!next) setSelectedType(null);
            }}
            foregroundColor={AppTheme.textPrimary}
            side={{ color: AppTheme.borderColor }}
            backgroundColor="#FFFFFF"
            padding={[0, 11]}
            minimumSize={{ height: 0 }}
            radius={10}
            textStyle={tsPlain({ size: 13, weight: 500 })}
          >
            + Add File or Link
          </OutlinedButton>
        </View>
        {showAddOptions && (
          <>
            <View style={styles.divider} />
            <OptionRow
              icon="insert_drive_file_outlined"
              label="Files"
              onTap={() => {
                setSelectedType('file');
                setShowAddOptions(false);
              }}
            />
            <View style={[styles.divider, { marginHorizontal: 16 }]} />
            <OptionRow
              icon="link_rounded"
              label="Links"
              onTap={() => {
                setSelectedType('link');
                setShowAddOptions(false);
              }}
            />
          </>
        )}
        {selectedType === 'file' && (
          <>
            <View style={styles.divider} />
            <View style={{ paddingLeft: 12, paddingTop: 10, paddingRight: 12, paddingBottom: 12 }}>
              <OutlinedButton
                onPress={choose}
                foregroundColor={AppTheme.textPrimary}
                side={{ color: AppTheme.borderColor }}
                backgroundColor="#FFFFFF"
                padding={[0, 11]}
                minimumSize={{ height: 0 }}
                radius={10}
              >
                <Icon name="insert_drive_file_outlined" size={16} color={AppTheme.textPrimary} />
                <View style={{ width: 8 }} />
                <Text style={tsPlain({ size: 13, weight: 500, color: AppTheme.textPrimary })}>Select A File</Text>
              </OutlinedButton>
            </View>
          </>
        )}
        {selectedType === 'link' && (
          <>
            <View style={styles.divider} />
            <View style={{ paddingLeft: 12, paddingTop: 10, paddingRight: 12, paddingBottom: 12 }}>
              <TextField
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
                decoration={{
                  hintText: 'www.example.com',
                  hintStyle: TextStyles.bodyMd,
                  suffixIcon: <Icon name="link_rounded" size={18} color={AppTheme.textMuted} />,
                  filled: true,
                  fillColor: '#FFFFFF',
                  contentPadding: [12, 10],
                  radius: 8,
                  borderColor: AppTheme.borderColor,
                  borderWidth: 1,
                  focusedBorderColor: AppTheme.accentBlue,
                  focusedBorderWidth: 1,
                }}
              />
            </View>
          </>
        )}
      </View>
      <View style={{ height: 10 }} />
      {/* ── Submit button ── */}
      <ElevatedButton
        onPress={hasContent && !submitting ? submit : null}
        icon={
          submitting ? (
            <CircularProgressIndicator size={15} strokeWidth={2} color="#FFFFFF" />
          ) : (
            <Icon name="send_outlined" size={16} color="#FFFFFF" />
          )
        }
        backgroundColor={hasContent ? AppTheme.darkBanner : '#CBD5E1'}
        disabledBackgroundColor="#CBD5E1"
        foregroundColor="#FFFFFF"
        disabledForegroundColor="#FFFFFF"
        padding={[0, 14]}
        radius={12}
        textStyle={tsPlain({ size: 14, weight: 600 })}
      >
        Submit Report
      </ElevatedButton>
    </View>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function StatusChip({ status, small = false }: { status: string; small?: boolean }) {
  const [bg, fg] =
    status === 'Completed'
      ? [AppTheme.greenBg, AppTheme.greenColor]
      : status === 'Missing' ? [AppTheme.redBg, AppTheme.redColor] : [AppTheme.amberBg, '#92400E'];
  return (
    <View style={{ paddingHorizontal: small ? 8 : 10, paddingVertical: small ? 3 : 5, backgroundColor: bg, borderRadius: 20 }}>
      <Text style={ts({ size: small ? 10 : 12, weight: 600, color: fg })}>{status}</Text>
    </View>
  );
}

// Fill the box's width and break long unspaced text instead of overflowing it.
const wrapAnywhere = { alignSelf: 'stretch', overflowWrap: 'anywhere' } as object;

function LinkItem({ url }: { url: string }) {
  return (
    <Tap onPress={() => openUrl(url)} style={{ alignSelf: 'stretch' }}>
      <View style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: AppTheme.blueBg, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="link" size={14} color={AppTheme.accentBlue} />
        <View style={{ width: 6 }} />
        <Text
          numberOfLines={1}
          style={[TextStyles.bodySm, { color: AppTheme.accentBlue, textDecorationLine: 'underline', flex: 1 }]}
        >
          {url}
        </Text>
        <View style={{ width: 6 }} />
        <Icon name="open_in_new" size={13} color={AppTheme.accentBlue} />
      </View>
    </Tap>
  );
}

function FileItem({ filename, url }: { filename: string; url: string }) {
  return (
    <View style={styles.fileItem}>
      <Icon name="insert_drive_file_outlined" size={14} color={AppTheme.greenColor} />
      <View style={{ width: 6 }} />
      <Text numberOfLines={1} style={[TextStyles.bodySm, { color: AppTheme.textPrimary, flex: 1 }]}>{filename}</Text>
      <View style={{ width: 6 }} />
      <Tap onPress={() => showFileViewer(filename, url)}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: AppTheme.greenColor, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="visibility_outlined" size={12} color="#FFFFFF" />
          <View style={{ width: 4 }} />
          <Text style={ts({ size: 10, weight: 600, color: '#FFFFFF' })}>View</Text>
        </View>
      </Tap>
    </View>
  );
}

function SubmissionTypeLabel({ type }: { type: string | null }) {
  const isFile = type === 'file';
  const color = isFile ? AppTheme.greenColor : AppTheme.accentBlue;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: isFile ? '#F0FDF4' : AppTheme.blueBg,
        borderRadius: 6,
      }}
    >
      <Icon name={isFile ? 'attach_file_rounded' : 'link_rounded'} size={11} color={color} />
      <View style={{ width: 4 }} />
      <Text style={ts({ size: 10, weight: 600, color })}>{isFile ? 'File Attachment' : 'Link Submission'}</Text>
    </View>
  );
}

function BackButton({ onBack }: { onBack?: () => void }) {
  return (
    <Tap onPress={() => onBack?.()}>
      <View style={styles.backButton}>
        <Icon name="arrow_back" size={16} />
      </View>
    </Tap>
  );
}

function OptionRow({ icon, label, onTap }: { icon: IconName; label: string; onTap: () => void }) {
  return (
    <InkWell onPress={onTap} radius={8}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center' }}>
        <Icon name={icon} size={18} color={AppTheme.textMuted} />
        <View style={{ width: 10 }} />
        <Text style={TextStyles.labelMd}>{label}</Text>
      </View>
    </InkWell>
  );
}

function InlineCommentInput({ userInitials, onSend }: { userInitials: string; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const h = 40;
  const active = text.trim().length > 0;

  const send = () => {
    if (text.trim().length === 0) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View style={{ paddingLeft: 12, paddingTop: 10, paddingRight: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
      <CircleAvatar radius={h / 2} backgroundColor={AppTheme.sidebarActive}>
        <Text style={tsAvatar(12, 700, '#FFFFFF')}>{userInitials}</Text>
      </CircleAvatar>
      <View style={{ width: 10 }} />
      <View style={{ flex: 1, height: h, paddingLeft: 2, paddingRight: 5, backgroundColor: '#F1F3F7', borderRadius: h / 2, flexDirection: 'row', alignItems: 'center' }}>
        <TextField
          style={{ flex: 1 }}
          value={text}
          onChangeText={setText}
          textStyle={tsField({ size: 12.5, color: AppTheme.textPrimary })}
          onSubmitEditing={send}
          decoration={{
            hintText: 'Add a private comment…',
            hintStyle: tsField({ size: 12.5, color: AppTheme.textLight }),
            border: 'none',
            filled: false,
            isDense: true,
            contentPadding: [0, 0],
          }}
        />
        <View style={{ width: 6 }} />
        {/* Send button — fills with accent once there's text to send. */}
        <InkWell onPress={active ? send : null} radius={15}>
          <View style={[styles.sendButton, { backgroundColor: active ? AppTheme.accentBlue : '#D7DBE3' }]}>
            <Icon name="arrow_upward_rounded" size={17} color="#FFFFFF" />
          </View>
        </InkWell>
      </View>
    </View>
  );
}

// ── Points preview card (shown in sidebar before submission) ─────────────────

function PointsPreviewCard({ task }: { task: Task }) {
  const row = (label: string, value: string, valueColor: string) => (
    <View style={{ paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[ts({ size: 12, color: 'rgba(255,255,255,0.7)' }), { flex: 1 }]}>{label}</Text>
      <Text style={ts({ size: 13, weight: 700, color: valueColor })}>{value}</Text>
    </View>
  );
  return (
    <View style={{ padding: 14, backgroundColor: AppTheme.darkBanner, borderRadius: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="bolt_rounded" color="#FFC107" size={16} />
        <View style={{ width: 6 }} />
        <Text style={ts({ size: 13, weight: 700, color: '#FFFFFF' })}>Points You Can Earn</Text>
      </View>
      <View style={{ height: 10 }} />
      {row('Early Submission', `+${task.pointsEarly}`, '#6EE7B7')}
      {row('On Time', `+${task.pointsOntime}`, '#93C5FD')}
      {row('Late (within 24h)', `+${task.pointsLate24}`, '#FCD34D')}
      {row('Late (after 24h)', `${task.pointsAfter24}`, '#F87171')}
    </View>
  );
}

// ── Layout pieces ─────────────────────────────────────────────────────────────

function DetailCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.detailCard}>{children}</View>;
}

function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: bg, borderRadius: 20 }}>
      <Text style={ts({ size: 12, weight: 600, color: fg })}>{text}</Text>
    </View>
  );
}

function MetaItem({ icon, label, value, emphasis = AppTheme.textPrimary, note }: {
  icon: IconName;
  label: string;
  value: string;
  emphasis?: string;
  note?: string | null;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={18} color={AppTheme.textMuted} />
      <View style={{ width: 8 }} />
      <View style={{ alignItems: 'flex-start' }}>
        <Text style={TextStyles.caption}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={ts({ size: 14, weight: 600, color: emphasis })}>{value}</Text>
          {note != null && (
            <>
              <View style={{ width: 8 }} />
              <Pill text={note} fg="#B91C1C" bg={AppTheme.redBg} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <View style={{ width: 6 }} />
      <Text style={[TextStyles.bodySm, { color: AppTheme.textMuted }]}>{`${label} `}</Text>
      <Text style={ts({ size: 12, weight: 700, color: AppTheme.textPrimary })}>{`${count}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: AppTheme.borderColor,
  },
  headerIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#EEF2FA',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyReport: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBox: {
    alignSelf: 'stretch',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.borderColor,
    alignItems: 'flex-start',
  },
  privateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    boxShadow: AppTheme.cardShadow,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: AppTheme.bgColor,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    boxShadow: '0px -4px 16px rgba(0,0,0,0.133)',
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: AppTheme.greenBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withOpacity(AppTheme.greenColor, 0.3),
  },
  submittedCard: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    boxShadow: AppTheme.cardShadow,
    alignItems: 'flex-start',
  },
  filesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    boxShadow: AppTheme.cardShadow,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: AppTheme.bgColor,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.borderColor,
  },
  fileItem: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: withOpacity(AppTheme.greenColor, 0.25),
  },
  backButton: {
    width: 34,
    height: 34,
    marginBottom: 10,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: AppTheme.borderColor,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F3',
  },
});
