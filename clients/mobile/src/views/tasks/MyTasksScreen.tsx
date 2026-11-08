import { useEffect } from 'react';
import { View } from 'react-native';
import { MyTasksController, StatusFilter } from '@shared/controllers/MyTasksController';
import { TaskCategory } from '@shared/models';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { openTask } from '../../core/routes';
import { Badge, Banner, Bone, Button, C, Card, Empty, ErrorBox, Icon, IconTile, Row, Screen, SearchBox, Spinner, T, Tabs } from '../../ui/kit';
import { SchoolYearPicker } from '../common/SchoolYearPicker';

/** /my-tasks and /my-special-tasks: tasks assigned to me. */
export default function MyTasksScreen({ category }: { category: TaskCategory }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new MyTasksController(services, category), [category]);
  useEffect(() => { void c.load(); }, [c]);
  const base = category === 'special' ? '/my-special-tasks' : '/my-tasks';
  const tasks = c.filtered;

  return (
    <Screen onRefresh={() => c.load()}>
      <Banner title={c.title} subtitle={c.subtitle} />
      <SearchBox value={s.search} onChange={(v) => c.setSearch(v)} placeholder="Search tasks..." />
      <Tabs<StatusFilter> value={s.status} onChange={(f) => c.setStatus(f)}
        tabs={(['all', 'pending', 'submitted'] as StatusFilter[]).map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))} />
      <SchoolYearPicker value={s.filter} onChange={(f) => c.setFilter(f)} />
      {s.error && <ErrorBox message={s.error} onRetry={() => void c.load()} />}
      {s.loading ? [0, 1, 2].map((i) => <Bone key={i} h={84} r={14} />)
        : tasks.length === 0 ? <Empty icon="clipboard" title={c.emptyText} />
        : tasks.map((t) => {
          const overdue = t.isOverdue;
          const due = MyTasksController.dueText(t);
          return (
            <Card key={t.id} onPress={() => openTask(t.id, base)} style={{ flexDirection: 'row', gap: 12, borderWidth: overdue ? 1.5 : 0, borderColor: 'rgba(239,68,68,0.35)' }}>
              <IconTile name={t.isSubmitted ? 'check-circle' : 'clipboard'} tone={t.isSubmitted ? 'green' : 'blue'} size={42} />
              <View style={{ flex: 1, gap: 3 }}>
                <T size={14} weight={600}>{t.title}</T>
                {t.subject ? <T size={11.5} weight={500} color={C.accent}>{t.subject}</T> : null}
                {due ? (
                  <Row gap={4}>
                    <Icon name="calendar" size={12} color={overdue ? C.red : C.light} />
                    <T size={11.5} weight={500} color={overdue ? C.red : C.light}>{due}</T>
                    {overdue && <Badge tone="red">Overdue</Badge>}
                  </Row>
                ) : null}
                {t.instructions ? <T size={13} color={C.text2} lines={2}>{MyTasksController.preview(t)}</T> : null}
              </View>
              {t.isSubmitted ? <Badge tone="green">Submitted</Badge> : <Badge tone="blue">Pending</Badge>}
            </Card>
          );
        })}
      {!s.loading && s.hasMore && !s.search && (
        <View style={{ alignItems: 'center', padding: 8 }}>
          {s.loadingMore ? <Spinner /> : <Button variant="outline-muted" onPress={() => void c.loadMore()}>Load more</Button>}
        </View>
      )}
    </Screen>
  );
}
