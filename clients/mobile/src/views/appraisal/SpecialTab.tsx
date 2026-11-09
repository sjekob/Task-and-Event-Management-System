import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppraisalController, SpecialTaskStats } from '@shared/controllers/AppraisalControllers';
import { SpecialTask } from '@shared/models';
import { printPerformanceSummary } from '../../core/printProposal';
import { useFeedback } from '../../ui/feedback';
import { Badge, Button, C, Card, Empty, Row, T } from '../../ui/kit';
import { EvaluateSpecialTaskDialog, ViewSpecialTaskDialog } from './SpecialTaskDialogs';
import { Chip, ErrorPanel, FilterSelect, Line, Stat, StatGrid, TabSkeleton, TONE } from './common';

/** Special Tasks: IPCRF ratings, filters and the Annual Faculty Performance Summary export. */
export function SpecialTab({ c }: { c: AppraisalController }) {
  const s = c.state.tasks;
  const fb = useFeedback();
  const [dept, setDept] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState<SpecialTask | null>(null);
  const [viewing, setViewing] = useState<SpecialTask | null>(null);
  const [exporting, setExporting] = useState(false);
  const { cards, rows, depts, roles, people } = useMemo(() => ({
    cards: SpecialTaskStats.cards(s.items),
    rows: SpecialTaskStats.filter(s.items, dept, role, person),
    depts: SpecialTaskStats.options(s.items, 'assigneeDepartment'),
    roles: SpecialTaskStats.options(s.items, 'assigneeRole'),
    people: SpecialTaskStats.options(s.items, 'assigneeName'),
  }), [s.items, dept, role, person]);

  if (s.loading) return <TabSkeleton />;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.loadTasks()} />;
  const exportSummary = async () => {
    setExporting(true);
    try { await printPerformanceSummary(await c.performanceSummary()); } catch (e) { fb.error(e); } finally { setExporting(false); }
  };

  return (
    <View style={{ gap: 14 }}>
      <StatGrid>
        <Stat value={String(cards.evaluated)} label="Faculty Evaluated" icon="check-circle" color="#22c55e" bg="#dcfce7" />
        <Stat value={String(cards.flagged)} label="Flagged Personnel" icon="alert-circle" color="#ef4444" bg="#fee2e2" />
        <Stat value={String(cards.departments)} label="Departments" icon="users" color="#8b5cf6" bg="#ede9fe" />
        <Stat value={cards.avg > 0 ? cards.avg.toFixed(0) : '—'} label="School Avg / 100" icon="award" color="#9ca3af" bg="#f3f4f6" />
      </StatGrid>
      <Card style={{ gap: 10 }}>
        <T size={15} weight={700}>Special Task Submissions</T>
        <Row wrap>
          <FilterSelect label="All departments" options={depts} selected={dept} onSelect={setDept} />
          <FilterSelect label="All roles" options={roles} selected={role} onSelect={setRole} />
          <FilterSelect label="All personnel" options={people} selected={person} onSelect={setPerson} />
        </Row>
      </Card>
      {!rows.length ? <Empty icon="clipboard" title="No special tasks to show." /> : rows.map((t) => (
        <TaskCard key={SpecialTaskStats.code(t)} t={t} onEvaluate={() => setEvaluating(t)} onView={() => setViewing(t)} />
      ))}
      <View style={{ padding: 16, borderRadius: 14, backgroundColor: '#FCE8EC', borderWidth: 1, borderColor: '#F4C3CD', gap: 8 }}>
        <T weight={700} color="#A11A33">Annual Faculty Performance Summary</T>
        <T size={12} color="#D92243">Aggregated from all event and special task appraisals. Ready for DepEd Annual Faculty Performance Evaluation.</T>
        <Button icon="download" loading={exporting} style={{ alignSelf: 'flex-start' }} onPress={() => void exportSummary()}>Export Performance Summary</Button>
        <T size={11} color="#D92243">Exports the selected school year as PDF</T>
      </View>
      {evaluating && <EvaluateSpecialTaskDialog task={evaluating} onClose={(u) => { setEvaluating(null); if (u) c.replaceTask(u); }} />}
      {viewing && <ViewSpecialTaskDialog task={viewing} onClose={() => setViewing(null)} />}
    </View>
  );
}

const TaskCard = memo(function TaskCard({ t, onEvaluate, onView }: { t: SpecialTask; onEvaluate: () => void; onView: () => void }) {
  const done = t.status === 'evaluated' || t.status === 'flagged';
  const tone = TONE[SpecialTaskStats.scoreTone(t.scoreOutOf100, t.status === 'flagged')];
  return (
    <Card style={{ gap: 6 }}>
      <Row>
        <T size={11.5} color={C.muted} style={{ flex: 1 }}>{SpecialTaskStats.code(t)}</T>
        <Chip status={t.status} />
      </Row>
      <T weight={700}>{t.title}</T>
      {t.isAutoCredit ? <T size={11.5} color={C.green}>Top score: committee task not automated</T> : null}
      <Line label="Personnel" value={t.assigneeName ?? '—'} />
      <Line label="Department" value={t.assigneeDepartment ?? '—'} />
      <Line label="Assigned by" value={t.assignerName ?? '—'} />
      <Line label="Due" value={SpecialTaskStats.fmtDate(t.dueDate)} />
      <Line label="Submitted" value={t.submittedDate ? SpecialTaskStats.fmtDate(t.submittedDate) : '—'} color={t.submittedDate ? '#16a34a' : undefined} />
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        {done ? <Badge tone={tone === TONE.green ? 'green' : tone === TONE.red ? 'red' : 'amber'}>{`${t.scoreOutOf100}/100`}</Badge> : <View />}
        {done ? <Button size="sm" variant="outline-muted" onPress={onView}>View</Button> : <Button size="sm" onPress={onEvaluate}>Evaluate</Button>}
      </Row>
    </Card>
  );
});
