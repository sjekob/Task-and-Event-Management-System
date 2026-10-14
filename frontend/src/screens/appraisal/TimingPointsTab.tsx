import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppraisalTabSkeleton } from '../../components/skeletonWidgets';
import { Icon, IconName } from '../../components/ui/Icon';
import { IconButton, InkWell } from '../../components/ui/buttons';
import { CircleAvatar } from '../../components/ui/misc';
import { Json } from '../../models/models';
import { AppTheme, ts, withOpacity } from '../../theme/appTheme';
import {
  AppraisalStatCard,
  ErrorPanel,
  FilterDropdown,
  GREY,
  HairDivider,
  StatRow,
  panelStyle,
  tableHeadStyle,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Timing Points Tab  (report-submission compliance; all scoring computed server-side)
// ─────────────────────────────────────────────────────────────────────────────

const points = (s: Json): number => (typeof s.timing_points === 'number' ? Math.trunc(s.timing_points) : 0);
const onTime = (s: Json): boolean => s.timing_status === 'On Time';
const sum = (list: Json[]): number => list.reduce((a, s) => a + points(s), 0);

function statusColor(status: string | null): string {
  switch (status) {
    case 'On Time': return '#16A34A';
    case 'Late within 24 hours': return '#EA580C';
    default: return '#EF4444';
  }
}

function complianceColor(pct: number): string {
  if (pct >= 80) return '#16A34A';
  if (pct >= 50) return '#EA580C';
  return '#EF4444';
}

function fmt(raw: unknown): string {
  if (raw == null) return '—';
  const s = String(raw);
  return s.length >= 16 ? s.substring(0, 16).replace('T', ' ') : s;
}

const unique = (values: string[]): string[] => [...new Set(values)].sort();

export function TimingPointsTab({ submissions, loading, error, onRefresh }: {
  submissions: Json[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [mode, setMode] = useState('all'); // all | personnel | task
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading) return <AppraisalTabSkeleton />;
  if (error != null) return <ErrorPanel message={error} onRetry={onRefresh} />;

  let filtered = submissions;
  if (mode === 'personnel' && selected != null) {
    filtered = filtered.filter((s) => `${s.personnel_name}` === selected);
  } else if (mode === 'task' && selected != null) {
    filtered = filtered.filter((s) => `${s.task_name}` === selected);
  }
  const groupByTask = mode === 'task';

  const total = filtered.length;
  const totalPts = sum(filtered);
  const onTimeCount = filtered.filter(onTime).length;
  const compliance = total > 0 ? (onTimeCount / total) * 100 : 0.0;

  const groups = new Map<string, Json[]>();
  for (const s of filtered) {
    const key = groupByTask ? `${s.task_name}` : `${s.personnel_name}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const keys = [...groups.keys()].sort();

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const miniStat = (label: string, value: string, icon: IconName) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: GREY[200] }}>
      <Icon name={icon} size={16} color={AppTheme.textMuted} />
      <View style={{ width: 8 }} />
      <View style={{ flex: 1 }}>
        <Text style={ts({ size: 10, color: AppTheme.textMuted })}>{label}</Text>
        <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>{value}</Text>
      </View>
    </View>
  );

  const head = tableHeadStyle(10, 0.4);

  const historyRow = (s: Json, i: number) => {
    const status = (s.timing_status as string | null) ?? null;
    const color = statusColor(status);
    const cq = s.content_quality_score;
    const fc = s.format_compliance_score;
    const cp = s.completeness_score;
    const hasRubric = cq != null || fc != null || cp != null;
    const small = ts({ size: 10, color: AppTheme.textMuted });
    return (
      <View key={i} style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Text style={[ts({ size: 12, color: AppTheme.textPrimary }), { flex: 3 }]}>{`${s.task_name ?? '—'}`}</Text>
        <Text style={[ts({ size: 11, color: AppTheme.textMuted }), { flex: 2 }]}>{fmt(s.deadline)}</Text>
        <Text style={[ts({ size: 11, color: AppTheme.textMuted }), { flex: 2 }]}>{fmt(s.submitted_at)}</Text>
        <View style={{ flex: 2, alignItems: 'flex-start' }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: withOpacity(color, 0.12), borderRadius: 6 }}>
            <Text style={ts({ size: 10, weight: 600, color })}>{status ?? '—'}</Text>
          </View>
        </View>
        <View style={{ width: 70, alignItems: 'center' }}>
          <Text style={ts({ size: 11, weight: 700, color })}>{`${points(s)} pts`}</Text>
        </View>
        <View style={{ width: 110 }}>
          {hasRubric ? (
            <>
              <Text style={small}>{`Content: ${cq ?? '—'}`}</Text>
              <Text style={small}>{`Format: ${fc ?? '—'}`}</Text>
              <Text style={small}>{`Completeness: ${cp ?? '—'}`}</Text>
            </>
          ) : (
            <Text style={ts({ size: 10, color: AppTheme.textLight, italic: true })}>Not scored</Text>
          )}
        </View>
      </View>
    );
  };

  const groupRow = (key: string, subs: Json[]) => {
    const isOpen = expanded.has(key);
    const count = subs.length;
    const pct = count > 0 ? (subs.filter(onTime).length / count) * 100 : 0.0;
    const avgPts = count > 0 ? sum(subs) / count : 0.0;
    const dept = (subs[0].personnel_department as string | null) ?? null;
    const initial = key.length > 0 ? key[0].toUpperCase() : '?';
    return (
      <View key={key}>
        <InkWell onPress={() => toggle(key)}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
            <CircleAvatar radius={16} backgroundColor="#EFF6FF">
              <Text style={ts({ size: 13, weight: 700, color: '#3B82F6', height: 1.5, spacing: 0.15 })}>{initial}</Text>
            </CircleAvatar>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{key}</Text>
              {!groupByTask && dept != null && dept.length > 0 && (
                <Text style={ts({ size: 11, color: AppTheme.textMuted })}>{dept}</Text>
              )}
            </View>
            <Text style={ts({ size: 12, color: AppTheme.textMuted })}>{`Subs: ${count}`}</Text>
            <View style={{ width: 12 }} />
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: withOpacity(complianceColor(pct), 0.12), borderRadius: 20 }}>
              <Text style={ts({ size: 11, weight: 700, color: complianceColor(pct) })}>{`${pct.toFixed(0)}% Compliant`}</Text>
            </View>
            <View style={{ width: 8 }} />
            <Icon name={isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={20} color={AppTheme.textMuted} />
          </View>
        </InkWell>
        {isOpen && (
          <View style={{ backgroundColor: '#FAFBFC', paddingLeft: 20, paddingTop: 16, paddingRight: 20, paddingBottom: 20 }}>
            <StatRow>
              {[
                miniStat('Total Submissions', `${subs.length}`, 'assignment_outlined'),
                miniStat('Avg Timing Points', `${avgPts.toFixed(1)} / 100`, 'timer_outlined'),
                miniStat('Compliance Rate', `${pct.toFixed(1)}%`, 'trending_up'),
              ]}
            </StatRow>
            <View style={{ height: 16 }} />
            <Text style={ts({ size: 13, weight: 700, color: AppTheme.textPrimary })}>Submission History</Text>
            <View style={{ height: 8 }} />
            <View style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[head, { flex: 3 }]}>TASK NAME</Text>
              <Text style={[head, { flex: 2 }]}>DEADLINE</Text>
              <Text style={[head, { flex: 2 }]}>SUBMITTED AT</Text>
              <Text style={[head, { flex: 2 }]}>TIMING STATUS</Text>
              <Text style={[head, { width: 70, textAlign: 'center' }]}>POINTS</Text>
              <Text style={[head, { width: 110 }]}>RUBRIC SCORES</Text>
            </View>
            <HairDivider />
            {subs.map(historyRow)}
          </View>
        )}
        <HairDivider />
      </View>
    );
  };

  return (
    <ScrollView>
      <StatRow>
        {[
          <AppraisalStatCard
            key="total"
            value={`${total}`}
            label="Total Reports Submitted"
            subtitle="Across all tracked tasks"
            icon="assignment_turned_in_outlined"
            iconColor="#3B82F6"
            iconBg="#EFF6FF"
          />,
          <AppraisalStatCard
            key="points"
            value={`${totalPts} pts`}
            label="Total Timing Points"
            subtitle="Earned from all submissions"
            icon="timer_outlined"
            iconColor="#10B981"
            iconBg="#ECFDF5"
          />,
          <AppraisalStatCard
            key="compliance"
            value={`${compliance.toFixed(1)}%`}
            label="Compliance Rate"
            subtitle="On-Time submissions"
            valueColor={complianceColor(compliance)}
            icon="trending_up"
            iconColor="#8B5CF6"
            iconBg="#F5F3FF"
          />,
        ]}
      </StatRow>
      <View style={{ height: 20 }} />
      <View style={panelStyle}>
        <View style={{ paddingLeft: 20, paddingTop: 16, paddingRight: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[ts({ size: 15, weight: 700, color: AppTheme.textPrimary }), { flex: 1 }]}>
            {'Teacher Submissions & Compliance'}
          </Text>
          <FilterDropdown
            icon="tune_rounded"
            label={mode === 'personnel' ? 'By Personnel' : mode === 'task' ? 'By Task' : 'Show All'}
            options={['Show All', 'By Personnel', 'By Task']}
            selected={null}
            onSelect={(v) => {
              setMode(v === 'By Personnel' ? 'personnel' : v === 'By Task' ? 'task' : 'all');
              setSelected(null);
            }}
          />
          {mode !== 'all' && (
            <>
              <View style={{ width: 8 }} />
              <FilterDropdown
                icon={null}
                label={selected ?? (mode === 'task' ? 'All Tasks' : 'All Personnel')}
                options={
                  mode === 'task'
                    ? unique(submissions.map((s) => `${s.task_name}`))
                    : unique(submissions.map((s) => `${s.personnel_name}`))
                }
                selected={selected}
                onSelect={setSelected}
              />
            </>
          )}
          <View style={{ width: 8 }} />
          <IconButton
            tooltip="Refresh"
            size={18}
            icon={<Icon name="refresh" size={18} color={AppTheme.textMuted} />}
            onPress={onRefresh}
          />
        </View>
        <HairDivider />
        {keys.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={ts({ size: 13, color: AppTheme.textMuted })}>No report submissions yet.</Text>
          </View>
        ) : (
          keys.map((k) => groupRow(k, groups.get(k)!))
        )}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
