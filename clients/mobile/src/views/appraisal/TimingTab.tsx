import { memo, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppraisalController, TimingMode, TimingPoints } from '@shared/controllers/AppraisalControllers';
import { Json } from '@shared/models';
import { C, Card, Empty, Icon, IconButton, Row, Select, T } from '../../ui/kit';
import { ErrorPanel, FilterSelect, Line, Mini, Stat, StatGrid, TabSkeleton, TONE } from './common';

const MODES: { value: TimingMode; label: string }[] = [{ value: 'all', label: 'Show All' }, { value: 'personnel', label: 'By Personnel' }, { value: 'task', label: 'By Task' }];

/** Timing Points: report-submission compliance (scored server-side). */
export function TimingTab({ c }: { c: AppraisalController }) {
  const s = c.state.submissions;
  const [mode, setMode] = useState<TimingMode>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { sum, groups, options } = useMemo(() => {
    const filtered = TimingPoints.filter(s.items, mode, selected);
    return { sum: TimingPoints.summary(filtered), groups: TimingPoints.groups(filtered, mode === 'task'), options: mode === 'all' ? [] : TimingPoints.options(s.items, mode) };
  }, [s.items, mode, selected]);

  if (s.loading) return <TabSkeleton />;
  if (s.error) return <ErrorPanel message={s.error} onRetry={() => void c.loadSubmissions()} />;
  return (
    <View style={{ gap: 14 }}>
      <StatGrid>
        <Stat value={String(sum.total)} label="Reports Submitted" icon="check-square" color="#3b82f6" bg="#eff6ff" />
        <Stat value={`${sum.points} pts`} label="Timing Points" icon="clock" color="#10b981" bg="#ecfdf5" />
        <Stat value={`${sum.compliance.toFixed(1)}%`} label="Compliance Rate" sub="On-time submissions" icon="trending-up" color="#8b5cf6" bg="#f5f3ff"
          valueColor={TONE[TimingPoints.complianceTone(sum.compliance)]} />
      </StatGrid>
      <Card style={{ padding: 0 }}>
        <View style={{ padding: 14, gap: 10 }}>
          <Row><T size={15} weight={700} style={{ flex: 1 }}>Submissions & Compliance</T><IconButton name="refresh-cw" size={17} label="Refresh" onPress={() => void c.loadSubmissions()} /></Row>
          <Row wrap>
            <View style={{ minWidth: 150, flexGrow: 1 }}><Select value={mode} options={MODES} onChange={(m) => { setMode(m); setSelected(null); }} /></View>
            {mode !== 'all' && <FilterSelect label={mode === 'task' ? 'All Tasks' : 'All Personnel'} options={options} selected={selected} onSelect={setSelected} />}
          </Row>
        </View>
        {!groups.length ? <Empty icon="inbox" title="No report submissions yet." /> : groups.map((g) => (
          <Group key={g.key} g={g} showDept={mode !== 'task'} open={open === g.key} onToggle={() => setOpen(open === g.key ? null : g.key)} />
        ))}
      </Card>
    </View>
  );
}

type G = { key: string; subs: Json[]; pct: number; avgPts: number; dept: string | null };

const Group = memo(function Group({ g, showDept, open, onToggle }: { g: G; showDept: boolean; open: boolean; onToggle: () => void }) {
  const tone = TONE[TimingPoints.complianceTone(g.pct)];
  return (
    <View style={{ borderTopWidth: 1, borderColor: C.border }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}><T weight={700} color="#3b82f6">{g.key.charAt(0).toUpperCase() || '?'}</T></View>
        <View style={{ flex: 1 }}>
          <T size={13.5} weight={600} lines={1}>{g.key}</T>
          <T size={11.5} color={C.muted}>{showDept && g.dept ? `${g.dept} · ` : ''}{g.subs.length} submissions</T>
        </View>
        <View style={{ backgroundColor: `${tone}1f`, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}><T size={11.5} weight={700} color={tone}>{g.pct.toFixed(0)}%</T></View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={19} color={C.muted} />
      </Pressable>
      {open && (
        <View style={{ backgroundColor: '#fafbfc', padding: 14, gap: 10 }}>
          <Row wrap>
            <Mini label="Submissions" value={String(g.subs.length)} icon="clipboard" />
            <Mini label="Avg points" value={`${g.avgPts.toFixed(1)}`} icon="clock" />
            <Mini label="Compliance" value={`${g.pct.toFixed(1)}%`} icon="trending-up" />
          </Row>
          {g.subs.map((x, i) => {
            const col = TONE[TimingPoints.statusTone(x.timing_status)];
            return (
              <View key={i} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, gap: 3, borderWidth: 1, borderColor: C.border }}>
                <T size={13} weight={600}>{String(x.task_name ?? '—')}</T>
                <Line label="Deadline" value={TimingPoints.fmt(x.deadline)} />
                <Line label="Submitted" value={TimingPoints.fmt(x.submitted_at)} />
                <Line label="Status" value={`${String(x.timing_status ?? '—')} · ${TimingPoints.points(x)} pts`} color={col} />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});
