import { View } from 'react-native';
import { CALENDAR_KIND, CalendarScanController } from '@shared/controllers/CalendarScanController';
import { useControllerState } from '../../core/hooks';
import { useFeedback } from '../../ui/feedback';
import type { CalendarTaskProposal } from '@shared/models';
import { Badge, Button, C, Check, DateField, Icon, IconButton, Input, Modal, Select, T } from '../../ui/kit';
import { pickFile } from '../../ui/files';

const TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/*'];

/** Principal/admin: read a school calendar and post the tasks it lists (Task Manager). */
export function CalendarScanButton({ c, onPosted }: { c: CalendarScanController; onPosted: () => void }) {
  const fb = useFeedback();
  const s = useControllerState(c);
  const pick = async () => {
    const file = await pickFile(TYPES);
    if (!file) return;
    const err = await c.scan(file);
    if (err) fb.toast(err, 'error');
  };
  return (
    <>
      <Button variant="outline" size="sm" icon="calendar" loading={s.scanning} onPress={() => void pick()}>
        {s.scanning ? 'Reading calendar…' : 'Scan school calendar'}
      </Button>
      {s.rows && <CalendarTasksDialog c={c} onPosted={onPosted} />}
    </>
  );
}

function CalendarTasksDialog({ c, onPosted }: { c: CalendarScanController; onPosted: () => void }) {
  const fb = useFeedback();
  const s = useControllerState(c);
  const post = async () => {
    const r = await c.post();
    fb.toast(r.message, r.error ? 'error' : 'success');
    if (r.posted > 0) onPosted();
  };
  return (
    <Modal title="Tasks from the school calendar" subtitle={`Read from ${s.fileName}`} icon="calendar" locked={s.posting} onClose={() => c.close()}
      footer={<>
        <Button variant="ghost" disabled={s.posting} onPress={() => c.close()}>Cancel</Button>
        <Button loading={s.posting} disabled={!c.chosen.length} onPress={() => void post()}>{`Post ${c.chosen.length}`}</Button>
      </>}>
      <T size={12.5} color={C.muted}>These are the reports the calendar calls for, grouped under the calendar entry they come from: "End of Term 1" means teachers submit their Term 1 grades. "Teachers → their dean" assigns every teacher, each submitting to the dean of their grade.</T>
      <T size={12} weight={600} color={C.text2}>{c.summary}</T>
      {c.groups.map((g) => (
        <View key={`${g.source}-${g.date}`} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name="calendar" size={14} color={C.accent} />
            <T size={13} weight={700} style={{ flexShrink: 1 }}>{g.source}</T>
          </View>
          {g.date ? <T size={12} color={C.muted}>{g.date}</T> : null}
          {g.items.map(({ row: r, index: i }) => <CalendarTaskRow key={i} c={c} r={r} i={i} posting={s.posting} />)}
          <Button variant="ghost" size="sm" icon="plus" disabled={s.posting} onPress={() => c.addTask(g.items[g.items.length - 1].index)}>Add a task</Button>
        </View>
      ))}
      {!(s.rows ?? []).length ? <T size={12.5} color={C.muted}>None of the calendar's entries call for a report.</T> : null}
    </Modal>
  );
}

function CalendarTaskRow({ c, r, i, posting }: { c: CalendarScanController; r: CalendarTaskProposal; i: number; posting: boolean }) {
  const k = CALENDAR_KIND[r.kind] ?? CALENDAR_KIND.other;
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, opacity: r.selected ? 1 : 0.6 }}>
      <View style={{ marginTop: 8 }}><Check checked={r.selected} disabled={posting} onChange={() => c.update(i, { selected: !r.selected })} /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <Input value={r.title} editable={!posting} placeholder="Task title" onChangeText={(v) => c.update(i, { title: v })} style={{ fontWeight: '600' }} />
          </View>
          {r.kind === 'manual' ? <IconButton name="x" size={18} label="Remove this task" onPress={() => c.remove(i)} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone={k.tone}>{k.label}</Badge>
          {r.past ? <T size={12} color={C.muted}>Already past</T> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={11.5} color={C.muted}>Start</T>
            <DateField value={r.startDate} onChange={(v) => v && c.setDate(i, 'startDate', v)} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={11.5} color={C.muted}>Due (5:00 PM)</T>
            <DateField value={r.endDate} onChange={(v) => v && c.setDate(i, 'endDate', v)} />
          </View>
        </View>
        {r.selected ? <Select value={r.route} options={c.routeOptions} disabled={posting} onChange={(v) => c.update(i, { route: v })} /> : null}
        {r.selected ? (
          <Input multiline rows={3} value={r.instructions} editable={!posting} placeholder="Description — written for you once the title is filled in"
            onChangeText={(v) => c.setDescription(i, v)} style={{ fontSize: 13 }} />
        ) : null}
      </View>
    </View>
  );
}
