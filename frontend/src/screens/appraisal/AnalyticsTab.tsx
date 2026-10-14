import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Icon } from '../../components/ui/Icon';
import { LinearProgressIndicator } from '../../components/ui/misc';
import { EventForAppraisal, SpecialTask, tryParseDate } from '../../models/models';
import { AppTheme, ts } from '../../theme/appTheme';
import { AppraisalStatCard, GREY, StatRow, panelStyle } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Tab
// ─────────────────────────────────────────────────────────────────────────────

interface Group {
  key: string;
  avg: number;
  count: number;
}

function groupAverages(tasks: SpecialTask[], keyOf: (t: SpecialTask) => string): Group[] {
  const map = new Map<string, number[]>();
  for (const t of tasks) {
    const key = keyOf(t);
    map.set(key, [...(map.get(key) ?? []), t.scoreOutOf100]);
  }
  return [...map.entries()]
    .map(([key, scores]) => ({ key, avg: scores.reduce((a, b) => a + b) / scores.length, count: scores.length }))
    .sort((a, b) => b.avg - a.avg);
}

const title14 = ts({ size: 14, weight: 700, color: AppTheme.textPrimary });
const noData = ts({ size: 13, color: AppTheme.textMuted });

export function AnalyticsTab({ tasks, events }: { tasks: SpecialTask[]; events: EventForAppraisal[] }) {
  const evaluated = tasks.filter((t) => t.evaluation?.weightedAverage != null);
  const overallAvg =
    evaluated.length > 0 ? evaluated.map((t) => t.scoreOutOf100).reduce((a, b) => a + b) / evaluated.length : 0;
  const uniquePersonnel = new Set(tasks.map((t) => t.assigneeId).filter((id): id is number => id != null)).size;
  const eventEvalCount = events.reduce((s, e) => s + e.evaluations.length, 0);

  // Department performance
  const deptPerf = groupAverages(evaluated, (t) => t.assigneeDepartment ?? 'Unknown');
  // Top performers
  const topPerformers = groupAverages(evaluated, (t) => t.assigneeName ?? 'Unknown');

  return (
    <ScrollView>
      {/* Stat cards */}
      <StatRow>
        {[
          <AppraisalStatCard
            key="a"
            value={overallAvg > 0 ? `${overallAvg.toFixed(1)}%` : '—'}
            label="Overall Performance"
            subLabel="Real-time avg"
            icon="emoji_events_outlined"
            iconColor="#10B981"
            iconBg="#ECFDF5"
          />,
          <AppraisalStatCard key="b" value={`${uniquePersonnel}`} label="Total Personnel" subLabel="In your scope" icon="group_outlined" iconColor="#3B82F6" iconBg="#EFF6FF" />,
          <AppraisalStatCard key="c" value={`${evaluated.length}`} label="Special Tasks" subLabel="Evaluated tasks" icon="assignment_outlined" iconColor="#F59E0B" iconBg="#FEF3C7" />,
          <AppraisalStatCard key="d" value={`${eventEvalCount}`} label="Events Evaluated" subLabel="Real-time count" icon="calendar_month_outlined" iconColor="#8B5CF6" iconBg="#EDE9FE" />,
        ]}
      </StatRow>
      <View style={{ height: 16 }} />

      {/* Monthly trend */}
      <View style={[panelStyle, { padding: 20 }]}>
        <Text style={title14}>Monthly Performance Trend</Text>
        <View style={{ height: 16 }} />
        <MonthlyTrendChart tasks={tasks} />
      </View>
      <View style={{ height: 16 }} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Department Performance */}
        <View style={[panelStyle, { flex: 1, padding: 20 }]}>
          <Text style={title14}>Department Performance</Text>
          <View style={{ height: 16 }} />
          {deptPerf.length === 0 ? (
            <Text style={noData}>No data yet.</Text>
          ) : (
            deptPerf.map((d) => <DeptPerformanceRow key={d.key} dept={d.key} avg={d.avg} count={d.count} />)
          )}
        </View>
        <View style={{ width: 16 }} />
        {/* Top Performers */}
        <View style={[panelStyle, { flex: 1, padding: 20 }]}>
          <Text style={title14}>Top Performers</Text>
          <View style={{ height: 16 }} />
          {topPerformers.length === 0 ? (
            <Text style={noData}>No data yet.</Text>
          ) : (
            topPerformers
              .slice(0, 5)
              .map((p, i) => <TopPerformerRow key={p.key} rank={i + 1} name={p.key} avg={p.avg} taskCount={p.count} />)
          )}
        </View>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const TREND_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
const MONTH_KEYS: Record<number, string> = { 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec', 1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr' };

function MonthlyTrendChart({ tasks }: { tasks: SpecialTask[] }) {
  const monthScores = new Map<string, number[]>(TREND_MONTHS.map((m) => [m, []]));
  for (const t of tasks) {
    if (t.evaluation?.weightedAverage == null) continue;
    const dt = tryParseDate((t.submittedDate ?? '').split(' ')[0]);
    if (dt == null) continue;
    monthScores.get(MONTH_KEYS[dt.getMonth() + 1] ?? '')?.push(t.scoreOutOf100);
  }
  const axis = ts({ size: 11, color: AppTheme.textMuted });

  return (
    <View style={{ height: 180, flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={axis}>100%</Text>
        <Text style={axis}>50%</Text>
        <Text style={axis}>0%</Text>
      </View>
      <View style={{ width: 8 }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly' }}>
        {TREND_MONTHS.map((m) => {
          const scores = monthScores.get(m) ?? [];
          const avg = scores.length === 0 ? 0 : Math.trunc(scores.reduce((a, b) => a + b) / scores.length);
          const h = avg === 0 ? 30.0 : Math.min(Math.max((avg / 100.0) * 140, 20.0), 140.0);
          return (
            <View key={m} style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ width: 32, height: h, backgroundColor: avg === 0 ? GREY[200] : AppTheme.darkBanner, borderRadius: 4 }} />
              <View style={{ height: 6 }} />
              <Text style={axis}>{m}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DeptPerformanceRow({ dept, avg, count }: { dept: string; avg: number; count: number }) {
  const color = avg >= 80 ? '#22C55E' : avg >= 60 ? '#3B82F6' : '#EF4444';
  return (
    <View style={{ paddingBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{dept}</Text>
          <Text style={ts({ size: 11, color: AppTheme.textMuted })}>{`${count} tasks evaluated`}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="trending_up" size={14} color={color} />
          <View style={{ width: 2 }} />
          <Text style={ts({ size: 13, weight: 700, color })}>{`${avg.toFixed(1)}%`}</Text>
        </View>
      </View>
      <View style={{ height: 6 }} />
      <LinearProgressIndicator value={avg / 100.0} minHeight={6} radius={4} backgroundColor={GREY[200]} color={color} />
    </View>
  );
}

function TopPerformerRow({ rank, name, avg, taskCount }: { rank: number; name: string; avg: number; taskCount: number }) {
  const color = avg >= 90 ? '#22C55E' : avg >= 75 ? '#3B82F6' : AppTheme.textPrimary;
  const badgeColor = rank === 1 ? '#F59E0B' : rank === 2 ? '#9CA3AF' : '#CD7F32';
  return (
    <View style={{ paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: badgeColor, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={ts({ size: 10, weight: 700, color: '#FFFFFF' })}>{`#${rank}`}</Text>
      </View>
      <View style={{ width: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{name}</Text>
        <Text style={ts({ size: 11, color: AppTheme.textMuted })}>{`${taskCount} task${taskCount !== 1 ? 's' : ''}`}</Text>
      </View>
      <Text style={ts({ size: 13, weight: 700, color })}>{`${avg.toFixed(1)}%`}</Text>
    </View>
  );
}
