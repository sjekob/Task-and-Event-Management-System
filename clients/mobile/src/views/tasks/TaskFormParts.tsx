import { ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ATTACHMENT_KINDS, Attachment, AttachmentKind, makeLinkAttachment, TemplatePickerController } from '@shared/controllers/TaskFormController';
import { TaskScanController } from '@shared/controllers/TaskScanController';
import { TaskTemplate } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useControllerState, useScreenController } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import { Button, C, Check, Empty, FeatherName, Field, Icon, IconTile, Input, Loading, Modal, T } from '../../ui/kit';
import { pickFile } from '../../ui/files';

// Section cards, attachments, the template picker and "Scan a file" for the task form.
export const ATT_ICON: Record<string, FeatherName> = { link: 'link-2', file: 'file-text', gdrive: 'hard-drive', youtube: 'play-circle' };

export function Section({ icon, title, children }: { icon: FeatherName; title: string; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconTile name={icon} tone="gray" size={30} />
        <T size={15} weight={700}>{title}</T>
      </View>
      {children}
    </View>
  );
}

export function AttachmentRow({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  const color = ATTACHMENT_KINDS.find((k) => k.kind === a.attachment_type)?.color ?? '#4a90e2';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, backgroundColor: C.surface2 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={ATT_ICON[a.attachment_type] ?? 'link-2'} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={12.5} weight={600} lines={1}>{a.name}</T>
        {a.url ? <T size={11.5} color={C.accent} lines={1}>{a.url}</T> : null}
      </View>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove"><Icon name="x" size={17} color={C.muted} /></Pressable>
    </View>
  );
}

/** Asks for a link (URL + optional name) of the given kind. */
export function AttachmentDialog({ kind, onClose, onAdd }: { kind: AttachmentKind; onClose: () => void; onAdd: (a: Attachment) => void }) {
  const meta = ATTACHMENT_KINDS.find((k) => k.kind === kind)!;
  const [url, setUrl] = useState('https://');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const confirm = () => {
    const r = makeLinkAttachment(kind, url, name);
    if (typeof r === 'string') { setError(r); return; }
    onAdd(r);
    onClose();
  };
  return (
    <Modal title={meta.title} onClose={onClose} footer={<><Button variant="outline-muted" onPress={onClose}>Cancel</Button><Button onPress={confirm}>Add</Button></>}>
      <Field label="URL" error={error}><Input autoFocus autoCapitalize="none" keyboardType="url" value={url} placeholder={meta.hint} invalid={!!error} onChangeText={setUrl} /></Field>
      <Field label="Name (optional)"><Input value={name} placeholder="Label for this attachment" onChangeText={setName} /></Field>
    </Modal>
  );
}

export function TemplatePicker({ onClose, onPick }: { onClose: () => void; onPick: (t: TaskTemplate) => void }) {
  const services = useServices();
  const [, s] = useScreenController(() => new TemplatePickerController(services), []);
  return (
    <Modal title="Use a Template" icon="book" onClose={onClose}>
      {s.loading ? <Loading /> : s.templates.length === 0 ? <Empty icon="book" title="No templates yet." /> : s.templates.map((t) => (
        <Pressable key={t.id} onPress={() => onPick(t)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border }}>
          <IconTile name="file-text" size={38} />
          <View style={{ flex: 1 }}>
            <T weight={600}>{t.title}</T>
            {t.instructions ? <T size={12} color={C.muted} lines={1}>{t.instructions.replace(/\n/g, ' ')}</T> : null}
            {t.createdByName ? <T size={10.5} color={C.muted}>By {t.createdByName}</T> : null}
          </View>
          <Icon name="chevron-right" size={16} color={C.muted} />
        </Pressable>
      ))}
    </Modal>
  );
}

const SCAN_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/*'];

/** "Scan a file": fills the form from a PDF, Word file, text file or photo; schedules open a row picker. */
export function ScanFileButton({ scan, onTemplatesMade }: { scan: TaskScanController; onTemplatesMade: () => void }) {
  const fb = useFeedback();
  const s = useControllerState(scan);
  const pick = async () => {
    const file = await pickFile(SCAN_TYPES);
    if (!file) return;
    const r = await scan.scan(file);
    if (r) fb.toast(r.message, r.error ? 'error' : 'success');
  };
  const apply = async () => {
    const r = await scan.apply();
    fb.toast(r.message, r.error ? 'error' : 'success');
    if (r.templatesMade > 0) onTemplatesMade();
  };
  const items = s.items ?? [];
  const multiple = scan.isTemplateForm;
  return (
    <>
      <Button variant="outline" icon="file-plus" loading={s.scanning} onPress={() => void pick()}>{s.scanning ? 'Reading file…' : 'Scan a file'}</Button>
      {s.items && (
        <Modal title="Schedule found" subtitle={`${items.length} dated items in ${s.fileName}`} icon="calendar" onClose={() => scan.close()}
          footer={<>
            <Button variant="ghost" onPress={() => scan.close()}>Cancel</Button>
            <Button disabled={s.checked.size === 0} onPress={() => void apply()}>{multiple ? `Create ${s.checked.size} template${s.checked.size === 1 ? '' : 's'}` : 'Fill the form'}</Button>
          </>}>
          <T size={12.5} color={C.muted}>{multiple ? 'Each ticked row becomes its own template, dated from the file.' : 'Pick the row this task is for; it fills the title and dates.'}</T>
          {multiple && <Check checked={s.checked.size === items.length} onChange={() => scan.toggleAll()} label="Select all" />}
          {items.map((item, i) => (
            <Pressable key={i} onPress={() => scan.toggle(i)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.border }}>
              <Check checked={s.checked.has(i)} radio={!multiple} onChange={() => scan.toggle(i)} />
              <View style={{ flex: 1 }}>
                <T size={13.5} weight={600}>{item.title}</T>
                <T size={12} color={C.accent}>{TaskScanController.dates(item)}</T>
              </View>
            </Pressable>
          ))}
        </Modal>
      )}
    </>
  );
}
