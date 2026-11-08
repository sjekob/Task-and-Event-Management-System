import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CalendarScanController } from '@shared/controllers/CalendarScanController';
import { TaskListController } from '@shared/controllers/TaskListController';
import { SchoolYearFilter, Task, TaskCategory } from '@shared/models';
import { useServices, useSession } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { openTask } from '../../core/routes';
import { useFeedback } from '../../ui/feedback';
import { ActionMenu, Badge, Banner, Bone, Button, C, Card, Empty, ErrorBox, Icon, Progress, Row, Screen, SearchBox, T, Tabs } from '../../ui/kit';
import { SchoolYearPicker } from '../common/SchoolYearPicker';
import { DepedTaskDialog } from '../deped/DepedDialogs';
import { CalendarScanButton } from './CalendarScan';

const DOT = { gray: C.light, green: C.green, red: C.red, blue: C.accent };

/** /tasks and /special-tasks: the tasks this person created (or all, for principal/admin). */
export default function TaskManagerScreen({ category, advisory = false }: { category: TaskCategory; advisory?: boolean }) {
  const services = useServices();
  const { user } = useSession();
  const fb = useFeedback();
  const [c, s] = useScreenController(() => new TaskListController(services, category, user, advisory), [category, user?.id, advisory]);
  const [depedOpen, setDepedOpen] = useState(false);
  const [calendar] = useScreenController(() => new CalendarScanController(services, user), [user?.id]);
  useEffect(() => { void c.load(); }, [c]);

  const base = c.base;
  const canDeped = !advisory && category === 'common' && (user?.can('manage_deped_calendar') ?? false);
  const canScan = !advisory && category === 'common' && calendar.canScan;
  const edit = (t: Task) => router.push({ pathname: '/task-form', params: { mode: 'edit', id: String(t.id), base } });
  const disable = async (t: Task) => {
    if (!(await fb.confirm({ title: 'Confirm Disable', message: 'Are you sure you want to disable the task?', confirmLabel: 'Yes', cancelLabel: 'No' }))) return;
    try { await c.setEnabled(t.id, false); fb.toast('Task disabled'); } catch (e) { fb.error(e); }
  };
  const enable = async (t: Task) => {
    try { await c.setEnabled(t.id, true); fb.toast('Task enabled'); } catch (e) { fb.error(e); }
  };
  const active = c.active;
  const disabled = c.disabled;

  return (
    <Screen onRefresh={() => c.load()}>
      <Banner title={c.title} subtitle={c.subtitle} />
      {c.canViewAll && (
        <Tabs value={s.scope} onChange={(v) => c.setScope(v)} tabs={[{ value: 'mine', label: 'My Created Tasks' }, { value: 'all', label: 'All Tasks' }]} />
      )}
      <Row wrap>
        <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
        {canScan && <CalendarScanButton c={calendar} onPosted={() => void c.load()} />}
        {canDeped && <Button variant="ghost" size="sm" icon="calendar" onPress={() => setDepedOpen(true)}>From DepEd calendar</Button>}
      </Row>
      <SearchBox value={s.search} onChange={(v) => c.setSearch(v)} placeholder="Search tasks by title..." />
      {s.error && <ErrorBox message={`Failed to load tasks: ${s.error}`} onRetry={() => void c.load()} />}

      {s.loading ? [0, 1, 2].map((i) => <Bone key={i} h={92} r={14} />)
        : !s.error && !active.length && !disabled.length ? (
          <Empty icon="clipboard" title={s.search ? `No tasks match "${s.search}"` : advisory ? 'No class tasks yet' : 'No tasks in this school year'}>
            {advisory && !s.search ? 'When the principal or registrar posts the school calendar, the tasks your subject teachers submit to you appear here.'
              : !s.search && s.filter.equals(SchoolYearFilter.current) ? 'Tasks from earlier school years are archived. Choose a year above to see them.' : undefined}
          </Empty>
        ) : (
          <>
            {active.length > 0 && <SectionLabel text={category === 'special' ? 'Active special tasks' : 'Active tasks'} count={active.length} />}
            {active.map((t) => (
              <TaskRow key={t.id} task={t} onOpen={() => openTask(t.id, base)} menu={t.canEdit ? (
                <ActionMenu items={[
                  { label: 'Edit task', icon: 'edit-2', onPress: () => edit(t) },
                  { label: 'Disable task', icon: 'slash', danger: true, onPress: () => void disable(t) },
                ]} />
              ) : null} />
            ))}
            {disabled.length > 0 && <SectionLabel text="Disabled" count={disabled.length} />}
            {disabled.map((t) => (
              <TaskRow key={t.id} task={t} onOpen={() => openTask(t.id, base)}
                menu={t.canEdit ? <Button variant="ghost" size="sm" onPress={() => void enable(t)}>Enable</Button> : null} />
            ))}
          </>
        )}
      {depedOpen && <DepedTaskDialog onClose={() => { setDepedOpen(false); void c.load(); }} />}
    </Screen>
  );
}

export function SectionLabel({ text, count }: { text: string; count: number }) {
  return (
    <Row style={{ marginTop: 4 }}>
      <T size={14} weight={700}>{text}</T>
      <View style={{ backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1 }}><T size={12} weight={700}>{count}</T></View>
    </Row>
  );
}

function TaskRow({ task, onOpen, menu }: { task: Task; onOpen: () => void; menu: React.ReactNode }) {
  const r = TaskListController.rowInfo(task);
  return (
    <Card onPress={onOpen} style={{ flexDirection: 'row', gap: 12, opacity: r.disabled ? 0.7 : 1 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: DOT[r.dot] }} />
      <View style={{ flex: 1, gap: 6 }}>
        <T size={15} weight={700} lines={2} color={r.disabled ? C.muted : C.text}>{task.title}</T>
        <Row wrap gap={6}>
          <Icon name="flag" size={13} color={r.overdue ? C.red : C.light} />
          <T size={12.5} weight={r.overdue ? 600 : 500} color={r.overdue ? C.red : C.muted}>{r.due}</T>
          {r.overdue && <Badge tone="red">Overdue</Badge>}
          {r.complete && !r.disabled && <Badge tone="green">All submitted</Badge>}
          {r.disabled && <Badge tone="gray">Disabled</Badge>}
        </Row>
        {r.instructions ? <T size={13} color={C.text2} lines={1}>{r.instructions}</T> : null}
        {r.total === 0 ? <Badge tone="gray">Not assigned</Badge> : (
          <View style={{ gap: 4 }}>
            <T size={12} weight={600} color={r.complete ? '#16a34a' : C.muted}>{r.done} of {r.total} submitted</T>
            <Progress value={r.done / r.total} color={r.complete ? C.green : C.accent} />
          </View>
        )}
      </View>
      {menu}
    </Card>
  );
}
