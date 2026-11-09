import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppraisalAnalytics, AppraisalController } from '@shared/controllers/AppraisalControllers';
import { C, Card, Progress, Row, T } from '../../ui/kit';
import { Stat, StatGrid, TONE } from './common';
import { Segmented } from './EventDialogs';

/** School-wide performance (principal/admin). */
export function AnalyticsTab({ c }: { c: AppraisalController }) {
  const tasks = c.state.tasks.items;
  const events = c.state.events.items;
  const a = useMemo(() => AppraisalAnalytics.compute(tasks, events), [tasks, events]);
  // Department or Individual performance (Lok's toggle).
  const [mode, setMode] = useState<'department' | 'individual'>('department');
  const list = mode === 'department' ? a.departments : a.individuals;
  return (
    <View style={{ gap: 14 }}>
      <StatGrid>
        <Stat value={a.overallAvg > 0 ? `${a.overallAvg.toFixed(1)}%` : '—'} label="Overall Performance" icon="award" color="#10b981" bg="#ecfdf5" />
        <Stat value={String(a.uniquePersonnel)} label="Total Personnel" icon="users" color="#3b82f6" bg="#eff6ff" />
        <Stat value={String(a.evaluatedCount)} label="Special Tasks" sub="Evaluated" icon="clipboard" color="#f59e0b" bg="#fef3c7" />
        <Stat value={String(a.eventEvalCount)} label="Events Evaluated" icon="calendar" color="#8b5cf6" bg="#ede9fe" />
      </StatGrid>
      <Card style={{ gap: 12 }}>
        <T weight={700}>Monthly Performance Trend</T>
        <Row style={{ height: 150, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {a.monthly.map((m) => (
            <View key={m.month} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
              <View style={{ width: '60%', maxWidth: 26, height: m.avg ? Math.max(14, Math.min(120, (m.avg / 100) * 120)) : 20, borderRadius: 4, backgroundColor: m.avg ? C.dark : '#eeeeee' }} />
              <T size={10} color={C.muted}>{m.month}</T>
            </View>
          ))}
        </Row>
      </Card>
      <Card style={{ gap: 12 }}>
        <T weight={700}>{mode === 'department' ? 'Department' : 'Individual'} Performance</T>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'department', label: 'Department' }, { value: 'individual', label: 'Individual' }]} />
        {!list.length ? <T color={C.muted}>No data yet.</T> : list.map((d) => {
          const col = TONE[AppraisalAnalytics.deptTone(d.avg)];
          const sub = [mode === 'individual' ? d.dept : null, `${d.count} rated item${d.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
          return (
            <View key={d.name} style={{ gap: 4 }}>
              <Row><View style={{ flex: 1 }}><T size={13} weight={600}>{d.name}</T><T size={11} color={C.muted}>{sub}</T></View><T size={13} weight={700} color={col}>{d.avg.toFixed(1)}%</T></Row>
              <Progress value={Math.min(100, d.avg) / 100} color={col} />
            </View>
          );
        })}
      </Card>
      <Card style={{ gap: 10 }}>
        <T weight={700}>Top Performers</T>
        {!a.performers.length ? <T color={C.muted}>No data yet.</T> : a.performers.map((p, i) => (
          <Row key={p.name} gap={10}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: AppraisalAnalytics.rankColor(i + 1), alignItems: 'center', justifyContent: 'center' }}><T size={10} weight={700} color="#fff">#{i + 1}</T></View>
            <View style={{ flex: 1 }}><T size={13} weight={600}>{p.name}</T><T size={11} color={C.muted}>{p.count} rated item{p.count !== 1 ? 's' : ''}</T></View>
            <T size={13} weight={700} color={TONE[AppraisalAnalytics.performerTone(p.avg)]}>{p.avg.toFixed(1)}%</T>
          </Row>
        ))}
      </Card>
    </View>
  );
}
