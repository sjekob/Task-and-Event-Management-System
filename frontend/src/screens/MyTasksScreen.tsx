import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SchoolYearPicker } from '../components/SchoolYearPicker';
import { AppBanner, StatusBadge } from '../components/commonWidgets';
import { MyTasksSkeleton } from '../components/skeletonWidgets';
import { Icon } from '../components/ui/Icon';
import { OutlinedButton, Tap } from '../components/ui/buttons';
import { TextField } from '../components/ui/inputs';
import { CircularProgressIndicator, useIsMobile } from '../components/ui/misc';
import { pushPage } from '../components/ui/navigator';
import { SchoolYearFilter, Task, currentSchoolYear, tryParseDate } from '../models/models';
import { ApiService } from '../services/apiService';
import { AppTheme, TextStyles, ts, tsField, withOpacity } from '../theme/appTheme';
import TaskDetailScreen from './TaskDetailScreen';

const PAGE_SIZE = 30;

interface MyTasksScreenProps {
  onSelectTask?: (id: number) => void;
  /// 'common' | 'special'
  category?: string;
}

export default function MyTasksScreen({ onSelectTask, category = 'common' }: MyTasksScreenProps) {
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'submitted'
  // Current school year by default; past years hold the user's archived work.
  const [filter, setFilter] = useState<SchoolYearFilter>(currentSchoolYear);
  const mounted = useRef(true);
  const busy = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setHasMore(true);
    try {
      const page = await ApiService.getAssignedTasksPage({ category, limit: PAGE_SIZE, offset: 0, filter });
      if (mounted.current) {
        setTasks(page.items);
        setHasMore(page.hasMore);
        setLoading(false);
      }
    } catch {
      if (mounted.current) setLoading(false);
    }
  }, [category, filter]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const loadMore = async () => {
    if (busy.current || loading || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const page = await ApiService.getAssignedTasksPage({
        category,
        limit: PAGE_SIZE,
        offset: tasks.length,
        filter,
      });
      if (mounted.current) {
        setTasks((prev) => [...prev, ...page.items]);
        setHasMore(page.hasMore);
        setLoadingMore(false);
      }
    } catch {
      if (mounted.current) setLoadingMore(false);
    } finally {
      busy.current = false;
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y >= contentSize.height - layoutMeasurement.height - 300) loadMore();
  };

  const filtered = tasks.filter((t) => {
    if (search.length > 0 && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'pending' && t.isSubmitted) return false;
    if (statusFilter === 'submitted' && !t.isSubmitted) return false;
    return true;
  });

  if (loading) return <MyTasksSkeleton />;

  return (
    <ScrollView
      onScroll={onScroll}
      scrollEventThrottle={100}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      contentContainerStyle={{
        paddingLeft: isMobile ? 14 : 24,
        paddingTop: 8,
        paddingRight: isMobile ? 14 : 24,
        paddingBottom: 24,
      }}
    >
      {/* ── Banner ── */}
      <AppBanner
        title={category === 'special' ? 'My Special Tasks' : 'My Tasks'}
        subtitle={
          category === 'special'
            ? 'Track special tasks assigned to you and submit reports on time.'
            : 'Track your assigned tasks and submit reports on time.'
        }
      />
      <View style={{ height: 20 }} />

      {/* ── Search bar ── */}
      <View style={styles.search}>
        <Icon name="search" size={16} color={AppTheme.textLight} />
        <View style={{ width: 8 }} />
        <TextField
          style={{ flex: 1 }}
          value={search}
          onChangeText={setSearch}
          textStyle={tsField({ size: 14 })}
          decoration={{
            hintText: 'Search tasks...',
            hintStyle: TextStyles.bodyMd,
            // Only `border` is cleared here, so the theme's outline
            // still draws around the field.
            isDense: true,
            contentPadding: [0, 0],
          }}
        />
      </View>
      <View style={{ height: 12 }} />

      {/* ── Status filter pills + school year (archived work) ── */}
      <View style={styles.wrap}>
        <FilterPill label="All" active={statusFilter === 'all'} onTap={() => setStatusFilter('all')} />
        <FilterPill label="Pending" active={statusFilter === 'pending'} onTap={() => setStatusFilter('pending')} />
        <FilterPill label="Submitted" active={statusFilter === 'submitted'} onTap={() => setStatusFilter('submitted')} />
        <View style={{ width: 4 }} />
        <SchoolYearPicker value={filter} onChanged={setFilter} />
      </View>
      <View style={{ height: 16 }} />

      {/* ── Empty ── */}
      {filtered.length === 0 && (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Icon name="assignment_outlined" size={48} color={AppTheme.textLight} />
          <View style={{ height: 12 }} />
          <Text style={TextStyles.bodyMd}>
            {tasks.length === 0 ? 'No tasks assigned yet.' : 'No tasks match your filter.'}
          </Text>
        </View>
      )}

      {/* ── Task cards ── */}
      {filtered.map((t) => (
        <MyTaskCard
          key={t.id}
          task={t}
          onTap={() => {
            if (onSelectTask != null) {
              onSelectTask(t.id);
            } else {
              pushPage((pop) => <TaskDetailScreen taskId={t.id} onClose={() => pop()} />).then(() => load());
            }
          }}
        />
      ))}

      {/* ── Load more (infinite scroll footer) ── */}
      {hasMore && search.length === 0 && (
        <View style={{ paddingTop: 8, paddingBottom: 16, alignItems: 'center' }}>
          {loadingMore ? (
            <CircularProgressIndicator size={22} strokeWidth={2} />
          ) : (
            <OutlinedButton onPress={loadMore}>Load more</OutlinedButton>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────

function FilterPill({ label, active, onTap }: { label: string; active: boolean; onTap: () => void }) {
  return (
    <Tap onPress={onTap}>
      <View
        style={[
          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
          { backgroundColor: active ? AppTheme.darkBanner : AppTheme.cardColor },
          !active && { boxShadow: AppTheme.cardShadow },
        ]}
      >
        <Text style={ts({ size: 12, weight: 600, color: active ? '#FFFFFF' : AppTheme.textMuted })}>{label}</Text>
      </View>
    </Tap>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d: string | null): string {
  if (d == null || d.length === 0) return '';
  const dt = tryParseDate(d);
  if (dt == null) return d;
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

function MyTaskCard({ task, onTap }: { task: Task; onTap: () => void }) {
  const overdue = task.isOverdue;
  const instructions = (task.instructions ?? '').replace(/\n/g, ' ');
  return (
    <Tap onPress={onTap}>
      <View
        style={[
          styles.card,
          overdue && { borderWidth: 1.5, borderColor: withOpacity(AppTheme.redColor, 0.35) },
        ]}
      >
        {/* Icon column */}
        <View style={[styles.cardIcon, { backgroundColor: task.isSubmitted ? AppTheme.greenBg : AppTheme.blueBg }]}>
          <Icon
            name={task.isSubmitted ? 'check_circle_outline' : 'assignment_outlined'}
            size={22}
            color={task.isSubmitted ? AppTheme.greenColor : AppTheme.accentBlue}
          />
        </View>
        <View style={{ width: 14 }} />

        {/* Content */}
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Text style={ts({ size: 14, weight: 600, color: AppTheme.textPrimary })}>{task.title}</Text>
          <View style={{ height: 4 }} />
          {task.subject != null && (
            <Text style={ts({ size: 11, weight: 500, color: AppTheme.accentBlue })}>{task.subject}</Text>
          )}
          {task.endDate != null && task.endDate.length > 0 && (
            <>
              <View style={{ height: 3 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon
                  name="calendar_today_outlined"
                  size={11}
                  color={overdue ? AppTheme.redColor : AppTheme.textLight}
                />
                <View style={{ width: 4 }} />
                <Text style={ts({ size: 11, weight: 500, color: overdue ? AppTheme.redColor : AppTheme.textLight })}>
                  {`Due ${fmtDate(task.endDate)}`}
                </Text>
                {overdue && (
                  <>
                    <View style={{ width: 6 }} />
                    <View style={styles.overdue}>
                      <Text style={ts({ size: 10, weight: 600, color: AppTheme.redColor })}>Overdue</Text>
                    </View>
                  </>
                )}
              </View>
            </>
          )}
          {instructions.length > 0 && (
            <>
              <View style={{ height: 4 }} />
              <Text style={TextStyles.bodyMd}>
                {instructions.length > 80 ? `${instructions.substring(0, 80)}...` : instructions}
              </Text>
            </>
          )}
        </View>
        <View style={{ width: 10 }} />

        {/* Status badge */}
        {task.isSubmitted ? <StatusBadge.submitted /> : <StatusBadge.pending />}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 8,
    boxShadow: AppTheme.cardShadow,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    padding: 16,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 12,
    boxShadow: AppTheme.cardShadow,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdue: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: AppTheme.redBg,
    borderRadius: 4,
  },
});
