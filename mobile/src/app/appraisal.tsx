import { useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import {
  api, BADGE_TIER_COLORS, CURRENT_YEAR, formatDateTime, parseTimestamp, qk, rateColor, type AppraisalBadge,
} from '@tasknet/shared';
import { Card, Empty, ErrorView, Loading, Row, Screen, SectionHeader, Segmented, StatTile, T, type IconName } from '@/components/ui';
import { colors } from '@/theme';

const BADGE_ICONS: Record<string, IconName> = {
  schedule: 'time', wb_sunny: 'sunny', local_fire_department: 'flame', verified: 'shield-checkmark',
  star: 'star', emoji_events: 'trophy', groups: 'people',
};
const badgeColor = (b: AppraisalBadge) => (!b.earned ? '#CBD5E1' : BADGE_TIER_COLORS[b.tier ?? ''] ?? colors.accent);
const TIMING_COLORS: Record<string, string> = { 'On Time': '#16A34A', 'Late within 24 hours': '#EA580C' };

export default function AppraisalScreen() {
  const [tab, setTab] = useState<'badges' | 'timing'>('badges');
  const filter = CURRENT_YEAR;
  const badges = useQuery({ queryKey: qk.appraisal('badges', filter), queryFn: () => api.appraisal.badges({ filter }) });
  const subs = useQuery({ queryKey: qk.appraisal('submissions', filter), queryFn: () => api.appraisal.reportSubmissions(filter) });

  return (
    <Screen onRefresh={() => Promise.all([badges.refetch(), subs.refetch()])}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'badges', label: 'Badges' }, { value: 'timing', label: 'Timing points' }]} />
      <T v="small" style={{ marginTop: 8 }}>Current school year</T>
      {tab === 'badges' ? (
        badges.isPending ? <Loading /> : badges.isError ? <ErrorView error={badges.error} onRetry={() => badges.refetch()} /> : (
          <>
            <SectionHeader title="My badges" right={<T v="small">{badges.data.filter((b) => b.earned).length} of {badges.data.length} earned</T>} />
            {[...badges.data].sort((a, b) => (a.earned !== b.earned ? (a.earned ? -1 : 1)
              : (b.target ? b.progress / b.target : 0) - (a.target ? a.progress / a.target : 0))).map((b) => <BadgeRow key={b.code} b={b} />)}
          </>
        )
      ) : subs.isPending ? <Loading /> : subs.isError ? <ErrorView error={subs.error} onRetry={() => subs.refetch()} /> : (() => {
        const list = subs.data;
        const onTime = list.filter((s) => s.timing_status === 'On Time').length;
        const rate = list.length ? (onTime / list.length) * 100 : 0;
        return (
          <>
            <Row gap={10} style={{ marginTop: 12 }}>
              <StatTile value={list.length} label="Reports" icon="document-text-outline" tone="blue" />
              <StatTile value={list.reduce((a, s) => a + (s.timing_points ?? 0), 0)} label="Points" icon="timer-outline" tone="green" />
              <StatTile value={`${rate.toFixed(0)}%`} label="On time" icon="trending-up-outline" tone="violet" />
            </Row>
            <SectionHeader title="Submissions" />
            {list.length === 0 ? <Empty title="No report submissions yet" /> : list.map((s) => (
              <Card key={s.id} style={{ marginBottom: 8 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T style={{ fontWeight: '600', flex: 1 }}>{s.task_name}</T>
                  <T style={{ fontWeight: '800' }}>{s.timing_points} pts</T>
                </Row>
                <T v="small" style={{ color: TIMING_COLORS[s.timing_status] ?? '#EF4444', fontWeight: '700', marginTop: 2 }}>{s.timing_status}</T>
                <T v="small">Submitted {formatDateTime(parseTimestamp(s.submitted_at))}</T>
              </Card>
            ))}
            {list.length > 0 && <T v="small" style={{ color: rateColor(rate) }}>Compliance {rate.toFixed(1)}%</T>}
          </>
        );
      })()}
    </Screen>
  );
}

function BadgeRow({ b }: { b: AppraisalBadge }) {
  const c = badgeColor(b);
  const pct = b.target ? Math.min(1, b.progress / b.target) : 0;
  return (
    <Card style={{ marginBottom: 8, flexDirection: 'row', gap: 12, backgroundColor: b.earned ? '#fff' : '#F8FAFC' }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: c, alignItems: 'center', justifyContent: 'center',
        backgroundColor: b.earned ? `${c}24` : '#F1F5F9' }}>
        <Ionicons name={b.earned ? BADGE_ICONS[b.icon] ?? 'ribbon' : 'lock-closed'} size={22} color={b.earned ? c : '#94A3B8'} />
      </View>
      <View style={{ flex: 1 }}>
        <Row gap={6}>
          <T style={{ fontWeight: '700', color: b.earned ? colors.text : colors.muted }}>{b.name}</T>
          {b.earned && b.tier ? <T v="small" style={{ color: c, fontWeight: '700', textTransform: 'capitalize' }}>{b.tier}</T> : null}
        </Row>
        <T v="small">{b.description}</T>
        {b.earned ? <T v="small" style={{ color: c, fontWeight: '700', marginTop: 4 }}>Earned</T> : (
          <View style={{ marginTop: 8 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' }}
              accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: b.target, now: b.progress }}>
              <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: colors.accent }} />
            </View>
            <T v="small" style={{ marginTop: 3 }}>{b.progress} / {b.target}</T>
          </View>
        )}
      </View>
    </Card>
  );
}
