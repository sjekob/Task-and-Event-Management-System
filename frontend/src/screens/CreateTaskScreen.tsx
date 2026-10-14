import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AssignPickerDialog } from '../components/AssignPickerDialog';
import { Icon, IconName } from '../components/ui/Icon';
import { ElevatedButton, IconButton, InkWell, OutlinedButton, Tap } from '../components/ui/buttons';
import { Checkbox, InputDecoration, TextField } from '../components/ui/inputs';
import { Chip, CircleAvatar, CircularProgressIndicator } from '../components/ui/misc';
import { Dialog, showDialog, showSnackBar } from '../components/ui/overlay';
import {
  TimeOfDay,
  formatTimeOfDay,
  lightPickerColors,
  showDatePicker,
  showTimePicker,
  timeOfDayNow,
} from '../components/ui/pickers';
import { Task, TaskTemplate, User, tryParseDate } from '../models/models';
import { ApiService, ScannedItem, errorMessage, exceptionText } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, TextStyles, isCompactDensity, ts, tsAvatar, tsField, tsPlain, withOpacity } from '../theme/appTheme';
import { pickFile } from '../utils/files';

export interface Attachment {
  attachment_type: string;
  name: string;
  url: string;
}

interface CreateTaskScreenProps {
  onBack?: () => void;
  onCreated?: () => void;
  isTemplate?: boolean;
  /// when set ('special'/'common'), force it and hide the toggle
  lockedCategory?: string;
  /// Closes the screen when it was pushed as a page (Navigator.pop).
  onClose?: (created?: boolean) => void;
  /// When set, the form edits this task instead of creating a new one.
  editTask?: Task;
}

function parseDate(s: string | null): Date | null {
  if (s == null || s.length === 0) return null;
  return tryParseDate(s);
}

/// "6:05 PM" / "18:05" → time of day.
function parseTime(s: string | null): TimeOfDay | null {
  if (s == null || s.length === 0) return null;
  const parts = s.split(':');
  if (parts.length < 2) return null;
  let hour = parseInt(parts[0], 10);
  const rest = parts[1].split(' ');
  const minute = parseInt(rest[0], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  const period = rest.length > 1 ? rest[1].toUpperCase() : '';
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
}

const pad2 = (n: number) => `${n}`.padStart(2, '0');
export const fmtApiDate = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function fmtLongDate(d: Date): string {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${w[d.getDay()]}, ${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function showSnack(msg: string, error = false) {
  showSnackBar(msg, {
    backgroundColor: error ? AppTheme.redColor : AppTheme.darkBanner,
    floating: true,
    radius: 8,
  });
}

export const taskInputDecoration = (hint: string): InputDecoration => ({
  hintText: hint,
  hintStyle: [TextStyles.bodyMd, { color: AppTheme.textLight }],
  filled: true,
  fillColor: '#FFFFFF',
  contentPadding: [14, 13],
  radius: 8,
  borderColor: AppTheme.borderColor,
  borderWidth: 1,
  focusedBorderColor: AppTheme.accentBlue,
  focusedBorderWidth: 1.5,
});

export function attIcon(type: string): IconName {
  switch (type) {
    case 'gdrive': return 'storage_outlined';
    case 'youtube': return 'play_circle_outline';
    case 'file': return 'insert_drive_file_outlined';
    default: return 'link';
  }
}

export function attColor(type: string): string {
  switch (type) {
    case 'gdrive': return '#34A853';
    case 'youtube': return '#FF0000';
    case 'file': return '#6B7280';
    default: return '#4A90E2';
  }
}

function roleLabel(r: string): string {
  switch (r) {
    case 'teacher': return 'Teacher';
    case 'dean': return 'Dean';
    case 'coordinator': return 'Coordinator';
    case 'registrar': return 'Registrar';
    default: return r;
  }
}

export default function CreateTaskScreen({ onBack, onCreated, isTemplate = false, lockedCategory, onClose, editTask }: CreateTaskScreenProps) {
  const app = useAppState();
  const { width } = useWindowDimensions();
  const isEditing = editTask != null;
  const [title, setTitle] = useState(editTask?.title ?? '');
  const [subject] = useState(editTask?.subject ?? '');
  const [instructions, setInstructions] = useState(editTask?.instructions ?? '');
  const [startDate, setStartDate] = useState<Date | null>(() => parseDate(editTask?.startDate ?? null));
  const [endDate, setEndDate] = useState<Date | null>(() => parseDate(editTask?.endDate ?? null));
  const [dueTime, setDueTime] = useState<TimeOfDay | null>(() => parseTime(editTask?.dueTime ?? null));
  const [allAssignable, setAllAssignable] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set((editTask?.assignedUsers ?? []).map((u) => u.id)));
  // Editing: who was assigned when the form opened, and the identity each
  // newly added person receives the task as (remembered per person in case the
  // "Assign as" choice changes mid-edit).
  const originalIds = useRef(new Set((editTask?.assignedUsers ?? []).map((u) => u.id))).current;
  const addedAs = useRef(new Map<number, string>()).current;
  const taskCategory = editTask?.taskCategory ?? lockedCategory ?? 'common'; // 'common' | 'special'
  // Which target identities the current creator may assign to.
  // From the backend (login / /me): the roles this session may assign to.
  const targetRoleOptions = app.assignableRoles;
  // which identity the assignees receive the task as
  const [targetRole, setTargetRole] = useState<string | null>(targetRoleOptions.length > 0 ? targetRoleOptions[0] : null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [scanning, setScanning] = useState(false);
  const mounted = useRef(true);

  const loadUsers = useCallback(async (role: string | null) => {
    try {
      const users = await ApiService.getAssignableUsers(role);
      if (mounted.current) {
        setAllAssignable(users);
        setLoadingUsers(false);
      }
    } catch {
      // Who may be assigned is decided by the server only.
      if (mounted.current) {
        setAllAssignable([]);
        setLoadingUsers(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadUsers(targetRole);
    return () => {
      mounted.current = false;
    };
    // Reloaded explicitly when the target role changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickDate = async (isStart: boolean) => {
    const d = await showDatePicker({
      initialDate: (isEditing ? (isStart ? startDate : endDate) : null) ?? new Date(),
      firstDate: new Date(2024, 0, 1),
      lastDate: new Date(2030, 0, 1),
      colors: lightPickerColors(AppTheme.accentBlue),
    });
    if (d != null) (isStart ? setStartDate : setEndDate)(d);
  };

  const pickTime = async () => {
    const t = await showTimePicker({
      initialTime: (isEditing ? dueTime : null) ?? timeOfDayNow(),
      colors: lightPickerColors(AppTheme.accentBlue),
    });
    if (t != null) setDueTime(t);
  };

  /// Editing: keep `addedAs` in step with the people newly ticked or unticked.
  const trackAdded = (ids: Set<number>) => {
    if (!isEditing) return;
    for (const id of ids) {
      if (!originalIds.has(id) && targetRole != null && !addedAs.has(id)) addedAs.set(id, targetRole);
    }
    for (const id of [...addedAs.keys()]) {
      if (!ids.has(id)) addedAs.delete(id);
    }
  };

  const openAssignPicker = async () => {
    if (loadingUsers || allAssignable.length === 0) return;
    await showDialog<boolean>((pop) => (
      <AssignPickerDialog
        pop={pop}
        users={allAssignable}
        selected={selectedIds}
        onChanged={(ids) => {
          setSelectedIds(new Set(ids));
          trackAdded(ids);
        }}
        hasTaskText={[title, subject, instructions].some((c) => c.trim().length > 0)}
        loadSuggestions={() =>
          ApiService.getAssigneeSuggestions({
            targetRole,
            title,
            subject,
            instructions,
            taskCategory,
            startDate: startDate != null ? fmtApiDate(startDate) : null,
            endDate: endDate != null ? fmtApiDate(endDate) : null,
            dueTime: dueTime != null ? formatTimeOfDay(dueTime) : null,
          })
        }
      />
    ));
  };

  const openAttachmentInput = async (type: string) => {
    if (type === 'file') {
      try {
        const file = await pickFile();
        if (file == null) return;
        setSubmitting(true);
        const info = await ApiService.uploadAttachmentFile(file);
        if (mounted.current) {
          setAttachments((prev) => [...prev, { attachment_type: 'file', name: info.name, url: info.url }]);
        }
      } catch (e) {
        if (mounted.current) showSnack(`File upload failed: ${exceptionText(e)}`, true);
      } finally {
        if (mounted.current) setSubmitting(false);
      }
      return;
    }
    const result = await showDialog<Attachment>((pop) => <AttachmentDialog type={type} pop={pop} />);
    if (result != null) setAttachments((prev) => [...prev, result]);
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      showSnack(`${isTemplate ? 'Template' : 'Task'} title is required`, true);
      return;
    }
    setSubmitting(true);
    try {
      const schedule: Record<string, string> = {};
      if (startDate != null) schedule.start_date = fmtApiDate(startDate);
      if (endDate != null) schedule.end_date = fmtApiDate(endDate);
      if (dueTime != null) schedule.due_time = formatTimeOfDay(dueTime);
      if (editTask != null) {
        await ApiService.updateTask(editTask.id, {
          title: trimmed,
          ...(subject.trim().length > 0 ? { subject: subject.trim() } : {}),
          ...(instructions.trim().length > 0 ? { instructions: instructions.trim() } : {}),
          ...schedule,
          ...(attachments.length > 0 ? { attachments } : {}),
        });
        // Assignment changes go through the assign endpoints, which enforce the
        // hierarchy (the task update endpoint does not touch assignments).
        const byRole = new Map<string, number[]>();
        addedAs.forEach((role, id) => byRole.set(role, [...(byRole.get(role) ?? []), id]));
        let skipped = 0;
        for (const [role, ids] of byRole) {
          skipped += await ApiService.assignTask(editTask.id, ids, role);
        }
        for (const id of originalIds) {
          if (!selectedIds.has(id)) await ApiService.unassignTask(editTask.id, id);
        }
        if (skipped > 0) {
          showSnack(
            `${skipped} ${skipped === 1 ? 'person was' : 'people were'} not assigned — ` +
              'outside what your role may assign.',
            true,
          );
        }
      } else if (isTemplate) {
        await ApiService.createTemplate({
          title: trimmed,
          ...(instructions.trim().length > 0 ? { instructions: instructions.trim() } : {}),
          ...schedule,
        });
      } else {
        await ApiService.createTask({
          title: trimmed,
          task_category: taskCategory,
          ...(targetRole != null ? { target_role: targetRole } : {}),
          ...(subject.trim().length > 0 ? { subject: subject.trim() } : {}),
          ...(instructions.trim().length > 0 ? { instructions: instructions.trim() } : {}),
          ...schedule,
          assigned_user_ids: [...selectedIds],
          attachments,
        });
      }
      if (mounted.current) {
        if (onCreated != null) {
          onCreated();
        } else {
          onClose?.(true);
        }
      }
    } catch (e) {
      showSnack(`Failed: ${exceptionText(e)}`, true);
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  /// Reads a document describing a task and fills the form from it. The file
  /// itself is not attached or stored.
  const scanFile = async () => {
    let file;
    try {
      file = await pickFile();
    } catch {
      return;
    }
    if (file == null) return;
    setScanning(true);
    try {
      const found = await ApiService.scanTaskFile(file);
      if (!mounted.current) return;
      setScanning(false);
      if (found.items.length > 0) {
        // The file is a schedule: several dated rows rather than one task.
        const chosen = await showDialog<ScannedItem[]>((pop) => (
          <ScheduleItemsDialog items={found.items} fileName={file.name} multiple={isTemplate} pop={pop} />
        ));
        if (chosen == null || chosen.length === 0 || !mounted.current) return;
        if (isTemplate) {
          setSubmitting(true);
          let made = 0;
          try {
            for (const item of chosen) {
              await ApiService.createTemplate({
                title: item.title,
                instructions: `Scanned from ${file.name}.`,
                ...(item.startDate != null ? { start_date: item.startDate } : {}),
                ...(item.endDate != null ? { end_date: item.endDate } : {}),
              });
              made++;
            }
          } catch (e) {
            showSnack(`Stopped after ${made} of ${chosen.length}: ${errorMessage(e)}`, true);
          } finally {
            if (mounted.current) setSubmitting(false);
          }
          if (made > 0) {
            showSnack(`${made} template${made === 1 ? '' : 's'} created from ${file.name}.`);
            if (mounted.current) {
              if (onCreated != null) onCreated();
              else onClose?.(true);
            }
          }
          return;
        }
        // Creating a task: the chosen row fills the form.
        const item = chosen[0];
        setTitle(item.title);
        setStartDate(parseDate(item.startDate));
        setEndDate(parseDate(item.endDate));
        showSnack(`Filled from ${file.name}. Please review before saving.`);
        return;
      }
      const filled: string[] = [];
      if (found.title != null) {
        setTitle(found.title);
        filled.push('title');
      }
      if (found.instructions != null) {
        setInstructions(found.instructions);
        filled.push('instructions');
      }
      const start = parseDate(found.startDate);
      if (start != null) {
        setStartDate(start);
        filled.push('start date');
      }
      const end = parseDate(found.endDate);
      if (end != null) {
        setEndDate(end);
        filled.push('due date');
      }
      const time = parseTime(found.dueTime);
      if (time != null) {
        setDueTime(time);
        filled.push('due time');
      }
      showSnack(
        filled.length === 0
          ? 'Nothing that looks like a task was found in that file.'
          : `Filled from ${file.name}: ${filled.join(', ')}. Please review before saving.`,
        filled.length === 0,
      );
    } catch (e) {
      if (mounted.current) showSnack(errorMessage(e), true);
    } finally {
      if (mounted.current) setScanning(false);
    }
  };

  const openTemplatePicker = async () => {
    const template = await showDialog<TaskTemplate>((pop) => <TemplatePickerDialog pop={pop} />);
    if (template != null && mounted.current) {
      setTitle(template.title);
      setInstructions(template.instructions ?? '');
      if (template.startDate != null) {
        const d = tryParseDate(template.startDate);
        if (d != null) setStartDate(d);
      }
      if (template.endDate != null) {
        const d = tryParseDate(template.endDate);
        if (d != null) setEndDate(d);
      }
      if (template.dueTime != null) {
        const parts = template.dueTime.split(/[: ]/);
        if (parts.length >= 2) {
          let h = parseInt(parts[0], 10);
          if (isNaN(h)) h = 0;
          let m = parseInt(parts[1], 10);
          if (isNaN(m)) m = 0;
          const isPm = template.dueTime.toUpperCase().includes('PM');
          if (isPm && h !== 12) h += 12;
          if (!isPm && h === 12) h = 0;
          setDueTime({ hour: h, minute: m });
        }
      }
    }
  };

  const changeTargetRole = (r: string) => {
    if (targetRole === r) return;
    setTargetRole(r);
    // Editing only filters who can be added; people already assigned stay.
    if (!isEditing) setSelectedIds(new Set());
    setLoadingUsers(true);
    loadUsers(r);
  };

  const selectedUsers = [
    ...allAssignable.filter((u) => selectedIds.has(u.id)),
    // Already-assigned people who are outside the current "Assign as" list.
    ...(editTask?.assignedUsers ?? []).filter((u) => selectedIds.has(u.id) && !allAssignable.some((a) => a.id === u.id)),
  ];
  const wide = width >= 1100;
  const isSpecial = taskCategory === 'special' && !isTemplate;
  const pageTitle = isEditing
    ? isSpecial ? 'Edit Special Task' : 'Edit Task'
    : isTemplate ? 'Create Template' : isSpecial ? 'Create Special Task' : 'Create Task';
  const subtitle = isEditing
    ? 'Update the details, the schedule, or who is assigned.'
    : isTemplate
    ? 'Save a reusable task outline.'
    : isSpecial
      ? 'Special tasks are appraised separately from regular duties.'
      : 'Describe the task, set when it is due, then choose who does it.';

  // ── Task details ──
  const details = (
    <SectionCard icon="description_outlined" title="Task details">
      <FieldLabel text={isTemplate ? 'Template name' : 'Title'} />
      <View style={{ height: 6 }} />
      <TextField
        value={title}
        onChangeText={setTitle}
        textStyle={tsField({ size: 14 })}
        decoration={taskInputDecoration(isTemplate ? 'e.g. Quarterly report' : 'e.g. First aid station for the sports fest')}
      />
      <View style={{ height: 16 }} />
      <FieldLabel text="Instructions" />
      <View style={{ height: 6 }} />
      <TextField
        value={instructions}
        onChangeText={setInstructions}
        minLines={7}
        maxLines={14}
        textStyle={tsField({ size: 14, height: 1.5 })}
        decoration={taskInputDecoration('What needs to be done, what to submit, and anything the assignee should know.')}
      />
      <View style={{ height: 18 }} />
      <FieldLabel text="Attachments" />
      <View style={{ height: 8 }} />
      <View style={styles.wrap8}>
        <AttachButton icon="link" label="Link" onTap={() => openAttachmentInput('link')} />
        <AttachButton icon="upload_file_outlined" label="Upload file" onTap={() => openAttachmentInput('file')} />
        <AttachButton icon="add_to_drive_outlined" label="Google Drive" onTap={() => openAttachmentInput('gdrive')} />
        <AttachButton icon="play_circle_outline" label="YouTube" onTap={() => openAttachmentInput('youtube')} />
      </View>
      {attachments.length > 0 && (
        <>
          <View style={{ height: 12 }} />
          {attachments.map((att, i) => (
            <AttachmentRow key={i} att={att} onRemove={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} />
          ))}
        </>
      )}
    </SectionCard>
  );

  // ── Schedule ──
  const schedule = (
    <SectionCard icon="event_outlined" title="Schedule">
      <PickerField
        icon="calendar_today_outlined"
        label="Start date"
        value={startDate == null ? null : fmtLongDate(startDate)}
        onTap={() => pickDate(true)}
      />
      <View style={{ height: 10 }} />
      <PickerField
        icon="event_available_outlined"
        label="Due date"
        value={endDate == null ? null : fmtLongDate(endDate)}
        onTap={() => pickDate(false)}
      />
      <View style={{ height: 10 }} />
      <PickerField
        icon="schedule_outlined"
        label="Due time"
        value={dueTime == null ? null : formatTimeOfDay(dueTime)}
        onTap={pickTime}
      />
    </SectionCard>
  );

  // ── Assignment ──
  const roleOpts = isTemplate ? [] : targetRoleOptions;
  const chipAvatar = isCompactDensity ? 8 : 12;
  const assignment = isTemplate ? null : (
    <SectionCard icon="groups_outlined" title="Assignment">
      {roleOpts.length >= 2 && (
        <>
          <FieldLabel text="Assign as" />
          <View style={{ height: 6 }} />
          <View style={styles.wrap8}>
            {roleOpts.map((r) => {
              const selected = targetRole === r;
              return (
                <Tap key={r} onPress={() => changeTargetRole(r)}>
                  <View
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: selected ? AppTheme.darkBanner : '#FFFFFF',
                        borderColor: selected ? AppTheme.darkBanner : AppTheme.borderColor,
                      },
                    ]}
                  >
                    <Text style={ts({ size: 13, weight: 600, color: selected ? '#FFFFFF' : AppTheme.textMuted })}>
                      {roleLabel(r)}
                    </Text>
                  </View>
                </Tap>
              );
            })}
          </View>
          {isEditing && (
            <>
              <View style={{ height: 4 }} />
              <Text style={TextStyles.bodySm}>Filters who you can add. People already assigned stay assigned.</Text>
            </>
          )}
          <View style={{ height: 16 }} />
        </>
      )}
      <FieldLabel text="People" />
      <View style={{ height: 8 }} />
      {selectedUsers.length === 0 ? (
        <Text style={TextStyles.bodySm}>No one selected yet.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {selectedUsers.map((u) => (
            <Chip
              key={u.id}
              avatar={
                <CircleAvatar radius={chipAvatar} backgroundColor={AppTheme.sidebarActive}>
                  <Text style={tsAvatar(10, 700, '#FFFFFF')}>{u.initials}</Text>
                </CircleAvatar>
              }
              label={<Text style={tsPlain({ size: 12.5, weight: 600, color: AppTheme.textMuted })}>{u.fullName}</Text>}
              onDeleted={() => {
                const next = new Set(selectedIds);
                next.delete(u.id);
                setSelectedIds(next);
                trackAdded(next);
              }}
              backgroundColor="#FFFFFF"
              side={{ color: AppTheme.borderColor }}
            />
          ))}
        </View>
      )}
      <View style={{ height: 12 }} />
      <OutlinedButton
        onPress={loadingUsers ? null : openAssignPicker}
        icon={
          loadingUsers ? (
            <CircularProgressIndicator size={14} strokeWidth={2} />
          ) : (
            <Icon name="auto_awesome" size={16} color={AppTheme.accentBlue} />
          )
        }
        foregroundColor={AppTheme.accentBlue}
        side={{ color: AppTheme.accentBlue }}
        padding={[0, 13]}
        radius={8}
        textStyle={tsPlain({ size: 13, weight: 600 })}
      >
        {selectedUsers.length === 0 ? 'Choose people' : 'Change people'}
      </OutlinedButton>
      <View style={{ height: 8 }} />
      <Text style={[TextStyles.bodySm, { fontSize: 11.5 }]}>
        Suggestions match the title and instructions against each person's skills and certifications, and weigh
        their current workload.
      </Text>
    </SectionCard>
  );

  const side = (
    <View>
      {schedule}
      {assignment != null && (
        <>
          <View style={{ height: 16 }} />
          {assignment}
        </>
      )}
    </View>
  );

  const actions = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }} />
      <OutlinedButton
        onPress={() => {
          if (onBack != null) {
            onBack();
          } else {
            onClose?.();
          }
        }}
        foregroundColor={AppTheme.textPrimary}
        side={{ color: AppTheme.borderColor }}
        backgroundColor="#FFFFFF"
        padding={[22, 14]}
        radius={8}
        textStyle={tsPlain({ weight: 600 })}
      >
        Cancel
      </OutlinedButton>
      <View style={{ width: 10 }} />
      <ElevatedButton
        onPress={submitting ? null : submit}
        backgroundColor={AppTheme.darkBanner}
        foregroundColor="#FFFFFF"
        padding={[26, 14]}
        radius={8}
        textStyle={tsPlain({ weight: 700 })}
      >
        {submitting ? (
          <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" />
        ) : isEditing ? 'Save changes' : isTemplate ? 'Save template' : isSpecial ? 'Create special task' : 'Create task'}
      </ElevatedButton>
    </View>
  );

  const body = (
    <ScrollView
      style={{ backgroundColor: AppTheme.bgColor }}
      contentContainerStyle={{ paddingLeft: 28, paddingTop: 20, paddingRight: 28, paddingBottom: 28, alignItems: 'center' }}
    >
      <View style={{ width: '100%', maxWidth: 1240 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={ts({ size: 24, weight: 800, color: AppTheme.textPrimary })}>{pageTitle}</Text>
            <View style={{ height: 4 }} />
            <Text style={TextStyles.bodyMd}>{subtitle}</Text>
          </View>
          {!isEditing && (
            <>
              <OutlinedButton
                onPress={scanning ? null : scanFile}
                icon={scanning ? <CircularProgressIndicator size={14} strokeWidth={2} /> : 'upload_file_outlined'}
                iconSize={16}
                foregroundColor={AppTheme.accentBlue}
                backgroundColor="#FFFFFF"
                side={{ color: AppTheme.accentBlue }}
                padding={[14, 12]}
                radius={8}
                textStyle={tsPlain({ size: 13, weight: 600 })}
                tooltip="Fill this form from a PDF, Word file or photo that describes the task"
              >
                {scanning ? 'Reading file…' : 'Scan a file'}
              </OutlinedButton>
              {!isTemplate && <View style={{ width: 10 }} />}
            </>
          )}
          {!isTemplate && !isEditing && (
            <OutlinedButton
              onPress={openTemplatePicker}
              icon="library_books_outlined"
              iconSize={16}
              foregroundColor={AppTheme.accentBlue}
              backgroundColor="#FFFFFF"
              side={{ color: AppTheme.accentBlue }}
              padding={[14, 12]}
              radius={8}
              textStyle={tsPlain({ size: 13, weight: 600 })}
            >
              Use template
            </OutlinedButton>
          )}
        </View>
        <View style={{ height: 20 }} />
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 3 }}>{details}</View>
            <View style={{ width: 20 }} />
            <View style={{ flex: 2 }}>{side}</View>
          </View>
        ) : (
          <>
            {details}
            <View style={{ height: 16 }} />
            {side}
          </>
        )}
        <View style={{ height: 20 }} />
        {actions}
      </View>
    </ScrollView>
  );

  if (onBack != null) return body;
  return <SafeAreaView style={{ flex: 1, backgroundColor: AppTheme.bgColor }}>{body}</SafeAreaView>;
}

// ── Small helpers ──────────────────────────────────────────────────────────────

export function FieldLabel({ text }: { text: string }) {
  return <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{text}</Text>;
}

/// A titled white card grouping related fields.
export function SectionCard({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} size={16} color={AppTheme.darkBanner} />
        </View>
        <View style={{ width: 10 }} />
        <Text style={ts({ size: 15, weight: 700, color: AppTheme.textPrimary })}>{title}</Text>
      </View>
      <View style={{ height: 14 }} />
      <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
      <View style={{ height: 16 }} />
      {children}
    </View>
  );
}

/// Labeled button for adding an attachment.
export function AttachButton({ icon, label, onTap }: { icon: IconName; label: string; onTap: () => void }) {
  return (
    <OutlinedButton
      onPress={onTap}
      icon={icon}
      iconSize={16}
      foregroundColor={AppTheme.textPrimary}
      side={{ color: AppTheme.borderColor }}
      padding={[12, 10]}
      radius={8}
      textStyle={tsPlain({ size: 12.5, weight: 600 })}
    >
      {label}
    </OutlinedButton>
  );
}

/// A tappable field showing a picked date/time (or a prompt when empty).
export function PickerField({ icon, label, value, onTap }: {
  icon: IconName;
  label: string;
  value: string | null;
  onTap: () => void;
}) {
  return (
    <InkWell onPress={onTap} radius={8}>
      <View style={styles.pickerField}>
        <Icon name={icon} size={18} color={value == null ? AppTheme.textLight : AppTheme.accentBlue} />
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={ts({ size: 11, color: AppTheme.textLight, weight: 500 })}>{label}</Text>
          <View style={{ height: 2 }} />
          <Text style={ts({ size: 13.5, weight: 600, color: value == null ? AppTheme.textMuted : AppTheme.textPrimary })}>
            {value ?? 'Not set'}
          </Text>
        </View>
        <Icon name="chevron_right" size={18} color={AppTheme.textLight} />
      </View>
    </InkWell>
  );
}

export function AttachmentRow({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const icon = attIcon(att.attachment_type ?? 'link');
  const iconColor = attColor(att.attachment_type ?? 'link');
  return (
    <View style={styles.attachmentRow}>
      <View style={[styles.attachmentIcon, { backgroundColor: withOpacity(iconColor, 0.12) }]}>
        <Icon name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ width: 10 }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={ts({ size: 12.5, weight: 600, color: AppTheme.textPrimary })}>
          {att.name ?? 'Attachment'}
        </Text>
        {(att.url ?? '').length > 0 && (
          <Text numberOfLines={1} style={[TextStyles.bodySm, { color: AppTheme.accentBlue }]}>{att.url}</Text>
        )}
      </View>
      <IconButton
        tooltip="Remove"
        onPress={onRemove}
        size={16}
        icon={<Icon name="close" size={16} color={AppTheme.textMuted} />}
      />
    </View>
  );
}

// ── Scanned schedule dialog ────────────────────────────────────────────────────

function scannedDates(item: ScannedItem): string {
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const one = (d: Date) => `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (start == null && end == null) return 'No date';
  if (start == null || end == null || start.getTime() === end.getTime()) return one((end ?? start) as Date);
  return `${one(start)} – ${one(end)}`;
}

/// Lists the dated rows found in a scanned schedule. With `multiple`, the user
/// ticks the rows to turn into templates; otherwise tapping a row picks it.
function ScheduleItemsDialog({ items, fileName, multiple, pop }: {
  items: ScannedItem[];
  fileName: string;
  multiple: boolean;
  pop: (result?: ScannedItem[]) => void;
}) {
  const { height } = useWindowDimensions();
  const [checked, setChecked] = useState<Set<number>>(() => new Set(items.map((_, i) => i)));
  const allChecked = checked.size === items.length;
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Dialog backgroundColor="#FFFFFF" radius={14} insetPadding={{ horizontal: 16, vertical: 24 }} style={{ width: '100%', maxWidth: 620, maxHeight: height * 0.88 }}>
      <View style={{ paddingLeft: 22, paddingTop: 20, paddingRight: 22, paddingBottom: 16, flexShrink: 1 }}>
        <Text style={ts({ size: 18, weight: 700, color: AppTheme.textPrimary })}>
          {`${items.length} dated items found`}
        </Text>
        <View style={{ height: 4 }} />
        <Text style={TextStyles.bodySm}>
          {multiple
            ? `From ${fileName}. Tick the ones to save; each becomes a template with its dates.`
            : `From ${fileName}. Choose the one this task is for.`}
        </Text>
        <View style={{ height: 12 }} />
        {multiple && (
          <Tap onPress={() => setChecked(allChecked ? new Set() : new Set(items.map((_, i) => i)))}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6 }}>
              <Checkbox value={allChecked} onChanged={() => setChecked(allChecked ? new Set() : new Set(items.map((_, i) => i)))} activeColor={AppTheme.darkBanner} />
              <View style={{ width: 4 }} />
              <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>Select all</Text>
            </View>
          </Tap>
        )}
        <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
        <ScrollView style={{ flexShrink: 1 }}>
          {items.map((item, i) => (
            <InkWell key={i} onPress={() => (multiple ? toggle(i) : pop([item]))}>
              <View style={styles.scanRow}>
                {multiple && (
                  <>
                    <Checkbox value={checked.has(i)} onChanged={() => toggle(i)} activeColor={AppTheme.darkBanner} />
                    <View style={{ width: 4 }} />
                  </>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={ts({ size: 13.5, weight: 600, color: AppTheme.textPrimary })}>{item.title}</Text>
                  <View style={{ height: 2 }} />
                  <Text style={[TextStyles.bodySm, { color: AppTheme.accentBlue }]}>{scannedDates(item)}</Text>
                </View>
                {!multiple && <Icon name="chevron_right" size={18} color={AppTheme.textLight} />}
              </View>
            </InkWell>
          ))}
        </ScrollView>
        <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
        <View style={{ height: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <OutlinedButton
            onPress={() => pop()}
            foregroundColor={AppTheme.textPrimary}
            side={{ color: AppTheme.borderColor }}
            padding={[18, 12]}
            radius={8}
            textStyle={tsPlain({ weight: 600 })}
          >
            Cancel
          </OutlinedButton>
          {multiple && (
            <>
              <View style={{ width: 10 }} />
              <ElevatedButton
                onPress={checked.size === 0 ? null : () => pop(items.filter((_, i) => checked.has(i)))}
                backgroundColor={AppTheme.darkBanner}
                foregroundColor="#FFFFFF"
                padding={[20, 12]}
                radius={8}
                textStyle={tsPlain({ weight: 700 })}
              >
                {`Create ${checked.size} template${checked.size === 1 ? '' : 's'}`}
              </ElevatedButton>
            </>
          )}
        </View>
      </View>
    </Dialog>
  );
}

// ── Attachment dialog ──────────────────────────────────────────────────────────

export function AttachmentDialog({ type, pop }: { type: string; pop: (result?: Attachment) => void }) {
  const [url, setUrl] = useState('https://');
  const [name, setName] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const title =
    type === 'link' ? 'Add Link' : type === 'gdrive' ? 'Add Google Drive Link' : type === 'youtube' ? 'Add YouTube Video' : 'Add File URL';
  const urlHint =
    type === 'gdrive' ? 'https://drive.google.com/...' : type === 'youtube' ? 'https://youtube.com/...' : 'https://...';

  const validate = (): boolean => {
    const u = url.trim();
    if (u.length === 0 || u === 'https://') {
      setUrlError('URL is required');
      return false;
    }
    if (!u.startsWith('http')) {
      setUrlError('Must start with http://');
      return false;
    }
    setUrlError(null);
    return true;
  };

  const defaultName = (u: string): string => {
    switch (type) {
      case 'youtube': return 'YouTube Video';
      case 'gdrive': return 'Google Drive File';
      case 'file': return 'Attached File';
      default: {
        const host = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]*)/i.exec(u)?.[1];
        return host != null ? host.replace('www.', '') : 'Link';
      }
    }
  };

  const confirm = () => {
    if (!validate()) return;
    const u = url.trim();
    pop({ attachment_type: type, name: name.trim().length === 0 ? defaultName(u) : name.trim(), url: u });
  };

  const decoration = (hint: string, errorText?: string | null): InputDecoration => ({
    hintText: hint,
    hintStyle: TextStyles.bodyMd,
    errorText,
    filled: true,
    fillColor: AppTheme.bgColor,
    contentPadding: [12, 12],
    radius: 8,
    borderColor: AppTheme.borderColor,
    borderWidth: 1,
    focusedBorderColor: AppTheme.accentBlue,
    focusedBorderWidth: 1.5,
  });

  return (
    <Dialog radius={16}>
      <View style={{ padding: 24, alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <Text style={TextStyles.heading3}>{title}</Text>
          <View style={{ flex: 1 }} />
          <IconButton
            onPress={() => pop()}
            size={20}
            padding={0}
            minSize={0}
            icon={<Icon name="close" size={20} color={AppTheme.textMuted} />}
          />
        </View>
        <View style={{ height: 16 }} />
        <Text style={TextStyles.labelSm}>URL</Text>
        <View style={{ height: 6 }} />
        <TextField
          style={{ alignSelf: 'stretch' }}
          value={url}
          onChangeText={setUrl}
          autoFocus
          autoCapitalize="none"
          textStyle={tsField({ size: 14 })}
          decoration={decoration(urlHint, urlError)}
        />
        <View style={{ height: 12 }} />
        <Text style={TextStyles.labelSm}>Name (optional)</Text>
        <View style={{ height: 6 }} />
        <TextField
          style={{ alignSelf: 'stretch' }}
          value={name}
          onChangeText={setName}
          textStyle={tsField({ size: 14 })}
          decoration={decoration('Label for this attachment')}
        />
        <View style={{ height: 20 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', alignSelf: 'stretch' }}>
          <OutlinedButton onPress={() => pop()} side={{ color: AppTheme.borderColor }} radius={8}>
            <Text style={TextStyles.labelMd}>Cancel</Text>
          </OutlinedButton>
          <View style={{ width: 10 }} />
          <ElevatedButton onPress={confirm} backgroundColor={AppTheme.darkBanner} radius={8}>Add</ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

// ── Template picker dialog ─────────────────────────────────────────────────────

function TemplatePickerDialog({ pop }: { pop: (result?: TaskTemplate) => void }) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    ApiService.getTemplates()
      .then((t) => {
        if (mounted) {
          setTemplates(t);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Dialog radius={16} clip>
      <View style={{ width: 420, maxWidth: '100%', alignItems: 'center' }}>
        <View style={{ paddingLeft: 24, paddingTop: 20, paddingRight: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <Icon name="library_books_outlined" size={20} color={AppTheme.accentBlue} />
          <View style={{ width: 10 }} />
          <Text style={[TextStyles.heading3, { flex: 1 }]}>Use a Template</Text>
          <IconButton
            onPress={() => pop()}
            size={20}
            padding={0}
            minSize={0}
            icon={<Icon name="close" size={20} color={AppTheme.textMuted} />}
          />
        </View>
        <View style={{ height: 1, backgroundColor: AppTheme.borderColor, alignSelf: 'stretch' }} />
        {loading ? (
          <View style={{ padding: 32 }}>
            <CircularProgressIndicator color={AppTheme.accentBlue} />
          </View>
        ) : templates.length === 0 ? (
          <View style={{ padding: 32 }}>
            <Text style={TextStyles.bodyMd}>No templates yet.</Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 380, alignSelf: 'stretch', flexGrow: 0 }}>
            {templates.map((t, i) => (
              <React.Fragment key={t.id}>
                {i > 0 && <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />}
                <InkWell onPress={() => pop(t)}>
                  <View style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.templateIcon}>
                      <Icon name="description_outlined" size={18} color={AppTheme.accentBlue} />
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={TextStyles.labelMd}>{t.title}</Text>
                      {t.instructions != null && t.instructions.length > 0 && (
                        <Text numberOfLines={1} style={TextStyles.bodySm}>{t.instructions.replace(/\n/g, ' ')}</Text>
                      )}
                      {t.createdByName != null && <Text style={TextStyles.captionSm}>{`By ${t.createdByName}`}</Text>}
                    </View>
                    <Icon name="arrow_forward_ios" size={14} color={AppTheme.textMuted} />
                  </View>
                </InkWell>
              </React.Fragment>
            ))}
          </ScrollView>
        )}
        <View style={{ height: 8 }} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  wrap8: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionCard: {
    paddingLeft: 20,
    paddingTop: 18,
    paddingRight: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F3',
  },
  sectionIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#EEF2FA',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.borderColor,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AppTheme.bgColor,
    borderRadius: 8,
  },
  attachmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateIcon: {
    width: 38,
    height: 38,
    backgroundColor: AppTheme.blueBg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
