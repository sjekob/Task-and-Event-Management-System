import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ATTACHMENT_KINDS, AttachmentKind, TaskFormController, TaskFormMode } from '@shared/controllers/TaskFormController';
import { TaskScanController } from '@shared/controllers/TaskScanController';
import { Task, TaskCategory } from '@shared/models';
import { useServices, useSession } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { useDirty, useUnsavedGuard } from '../../core/unsaved';
import { useFeedback } from '../../ui/feedback';
import { Avatar, Button, C, DateField, ErrorBox, Field, Input, Loading, Row, Screen, T } from '../../ui/kit';
import { pickFile } from '../../ui/files';
import { AssignPickerDialog, AssignRoleSelector } from '../common/AssignPicker';
import { ATT_ICON, AttachmentDialog, AttachmentRow, ScanFileButton, Section, TemplatePicker } from './TaskFormParts';

/** /task-form?mode=create|template|edit&category=…&id=… */
export default function TaskFormScreen() {
  const { mode = 'create', category, id, base } = useLocalSearchParams<{ mode?: string; category?: TaskCategory; id?: string; base?: string }>();
  const services = useServices();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    services.tasks.get(Number(id)).then(setTask).catch((e) => setError(e.message));
  }, [mode, id, services]);

  const back = base ?? (category === 'special' ? '/special-tasks' : '/tasks');
  if (mode === 'edit') {
    if (error) return <Screen><ErrorBox message={error} /></Screen>;
    if (!task) return <Screen><Loading /></Screen>;
    return <TaskForm back={back} mode={{ kind: 'edit', task }} />;
  }
  return <TaskForm back={back} mode={mode === 'template' ? { kind: 'template' } : { kind: 'create', lockedCategory: category === 'special' ? 'special' : undefined }} />;
}

function TaskForm({ back, mode }: { back: string; mode: TaskFormMode }) {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new TaskFormController(services, user, mode), []);
  const [scan] = useScreenController(() => new TaskScanController(services, c), [c]);
  const [picker, setPicker] = useState(false);
  const [linkKind, setLinkKind] = useState<AttachmentKind | null>(null);
  const [templates, setTemplates] = useState(false);
  // Leaving with unsaved changes asks first (back arrow, Android back, swipe).
  const dirty = useDirty({ t: s.title, i: s.instructions, sd: s.startDate, ed: s.endDate, dt: s.dueTime, cat: s.category,
    who: s.selectedIds, files: s.attachments.length });
  const guard = useUnsavedGuard(dirty, { what: mode.kind === 'template' ? 'template' : 'task' });
  const leave = () => { guard.release(); if (router.canGoBack()) router.back(); else router.replace(back as never); };

  const addAttachment = async (kind: AttachmentKind) => {
    if (kind !== 'file') { setLinkKind(kind); return; }
    const file = await pickFile('*/*');
    if (!file) return;
    try { await c.uploadAttachment(file); } catch (e) { fb.error(e); }
  };
  const submit = async () => {
    try {
      const warning = await c.submit();
      if (warning) fb.toast(warning, 'error');
      else fb.toast(c.isEdit ? 'Task updated' : c.isTemplate ? 'Template saved' : 'Task created', 'success');
      leave();
    } catch (e) { fb.error(e); }
  };
  const selected = c.selectedUsers;

  return (
    <Screen>
      <Stack.Screen options={{ title: c.pageTitle }} />
      {guard.dialog}
      <T size={13} color={C.muted}>{c.subtitle}</T>
      {mode.kind !== 'edit' && (
        <Row wrap>
          <ScanFileButton scan={scan} onTemplatesMade={leave} />
          {mode.kind === 'create' && <Button variant="outline" icon="book" onPress={() => setTemplates(true)}>Use template</Button>}
        </Row>
      )}

      <Section icon="file-text" title="Task details">
        <Field label={c.isTemplate ? 'Template name' : 'Title'} required>
          <Input value={s.title} onChangeText={(v) => c.setTitle(v)} placeholder={c.isTemplate ? 'e.g. Quarterly report' : 'e.g. First aid station for the sports fest'} />
        </Field>
        <Field label="Instructions">
          <Input multiline rows={6} value={s.instructions} onChangeText={(v) => c.setInstructions(v)} placeholder="What needs to be done, what to submit, and anything the assignee should know." />
        </Field>
        <Field label="Attachments">
          <Row wrap>
            {ATTACHMENT_KINDS.map((k) => (
              <Button key={k.kind} variant="outline-muted" size="sm" icon={k.kind === 'file' ? 'upload' : ATT_ICON[k.kind]} loading={k.kind === 'file' && s.uploading} onPress={() => void addAttachment(k.kind)}>{k.label}</Button>
            ))}
          </Row>
          {s.attachments.map((a, i) => <AttachmentRow key={i} a={a} onRemove={() => c.removeAttachment(i)} />)}
        </Field>
      </Section>

      <Section icon="calendar" title="Schedule">
        <Field label="Start date"><DateField value={s.startDate} onChange={(v) => c.setStartDate(v)} clearable /></Field>
        <Field label="Due date"><DateField value={s.endDate} min={s.startDate} onChange={(v) => c.setEndDate(v)} clearable /></Field>
        <Field label="Due time"><DateField mode="time" value={s.dueTime} onChange={(v) => c.setDueTime(v)} clearable /></Field>
      </Section>

      {!c.isTemplate && (
        <Section icon="users" title="Assignment">
          {c.roleOptions.length >= 2 && (
            <Field label="Assign as" help={c.isEdit ? 'Filters who you can add. People already assigned stay assigned.' : undefined}>
              <AssignRoleSelector options={c.roleOptions} value={s.targetRole} onChange={(r) => c.setTargetRole(r)} />
            </Field>
          )}
          <Field label="People">
            {selected.length === 0 ? <T size={12.5} color={C.muted}>No one selected yet.</T> : (
              <Row wrap gap={6}>
                {selected.map((u) => (
                  <Pressable key={u.id} onPress={() => c.unselect(u.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' }}>
                    <Avatar url={u.avatarUrl} initials={u.initials} size={22} />
                    <T size={12.5} weight={600}>{u.fullName}</T>
                    <T size={13} color={C.muted}>×</T>
                  </Pressable>
                ))}
              </Row>
            )}
          </Field>
          <Button variant="outline" icon="zap" block loading={s.loadingUsers} disabled={!s.assignable.length} onPress={() => setPicker(true)}>
            {selected.length ? 'Change people' : 'Choose people'}
          </Button>
          {!s.loadingUsers && !s.assignable.length && <T size={12} color={C.muted}>There is no one you can assign as this role.</T>}
          <T size={11.5} color={C.muted}>Suggestions match the title and instructions against each person's skills and certifications, and weigh their current workload.</T>
        </Section>
      )}

      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline-muted" size="lg" onPress={leave}>Cancel</Button>
        <Button size="lg" loading={s.submitting} onPress={() => void submit()}>{c.submitLabel}</Button>
      </View>

      {picker && (
        <AssignPickerDialog onClose={() => setPicker(false)} onDone={(ids) => c.setSelected(ids)}
          options={{ users: s.assignable, selected: s.selectedIds, hasTaskText: c.hasTaskText, loadSuggestions: c.loadSuggestions }} />
      )}
      {linkKind && <AttachmentDialog kind={linkKind} onClose={() => setLinkKind(null)} onAdd={(a) => c.addAttachment(a)} />}
      {templates && <TemplatePicker onClose={() => setTemplates(false)} onPick={(t) => { c.applyTemplate(t); setTemplates(false); }} />}
    </Screen>
  );
}
