import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppBanner } from '../components/commonWidgets';
import { DashboardSkeleton } from '../components/skeletonWidgets';
import { Icon, IconName } from '../components/ui/Icon';
import { IconButton, InkWell, TextButton } from '../components/ui/buttons';
import { LinearProgressIndicator, Tooltip } from '../components/ui/misc';
import { DashboardData, Json, Task, User } from '../models/models';
import { ApiService } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, TextStyles, ts, tsPlain, withOpacity } from '../theme/appTheme';
import { dayKey, parseEventDate } from '../utils/dateParse';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// Indexed by Date.getDay() (Sunday first).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/// "May 22" this year, "May 22, 2025" otherwise.
function fmtDate(d: Date): string {
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/// Task due label; the stored end-of-day default (11:59 PM) is not shown.
function fmtDue(t: Task): string {
  const dl = t.deadline;
  if (dl == null) return 'No deadline';
  const time = (t.dueTime ?? '').trim();
  const showTime = time.length > 0 && time.toUpperCase() !== '11:59 PM';
  return showTime ? `${fmtDate(dl)}, ${time}` : fmtDate(dl);
}

function daysUntil(d: Date): number {
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

interface DayEvents {
  date: Date;
  events: Json[];
}

export default function DashboardScreen() {
  const app = useAppState();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calDate, setCalDate] = useState(() => new Date());
  // Upcoming events grouped by calendar day → dot markers + hover tooltip.
  const [eventsByDay, setEventsByDay] = useState<Map<string, DayEvents>>(new Map());
  const mounted = useRef(true);

  const go = (path: string) => router.push(path as never);

  const load = useCallback(async () => {
    try {
      const d = await ApiService.getDashboard();
      if (mounted.current) {
        setData(d);
        setLoading(false);
      }
    } catch {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const events = await ApiService.getEvents();
      const map = new Map<string, DayEvents>();
      for (const e of events) {
        const status = (e.status ?? '').toString();
        if (status === 'disabled' || status === 'draft') continue;
        const d = parseEventDate(e.target_date?.toString());
        if (d == null) continue;
        const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const key = dayKey(date);
        const entry = map.get(key) ?? { date, events: [] };
        entry.events.push(e);
        map.set(key, entry);
      }
      if (mounted.current) setEventsByDay(map);
    } catch {/* best-effort */}
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    loadEvents();
    return () => {
      mounted.current = false;
    };
  }, [load, loadEvents]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadEvents()]);
    if (mounted.current) setRefreshing(false);
  };

  const eventsFor = (day: number): Json[] =>
    eventsByDay.get(dayKey(new Date(calDate.getFullYear(), calDate.getMonth(), day)))?.events ?? [];

  const eventTooltip = (events: Json[]): string =>
    events
      .map((e) => {
        const when = (e.target_date ?? '').toString().trim();
        const where = (e.venue ?? '').toString().trim();
        const lines: string[] = [(e.title ?? 'Event').toString()];
        if (when.length > 0) lines.push(`When: ${when}`);
        if (where.length > 0) lines.push(`Where: ${where}`);
        return lines.join('\n');
      })
      .join('\n\n');

  // ── Header ──────────────────────────────────────────────────────────────────

  const greeting = (user: User | null): string => {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    // Some accounts store a role-prefixed full name ("Principal Liza Ramos")
    // and no first name; drop the title before taking the first word.
    const name = ((user?.firstName?.trim().length ?? 0) > 0 ? user!.firstName! : user?.fullName ?? '')
      .trim()
      .replace(/^(principal|coordinator|dean|registrar|teacher|admin)\s+/i, '');
    const first = name.split(/\s+/)[0] ?? '';
    return first.length === 0 ? part : `${part}, ${first}`;
  };

  /// One line on what needs attention, built from the same data as the cards.
  const summary = (isApprover: boolean): string => {
    const d = data;
    if (d == null) return 'Here is what is happening today.';
    const parts: string[] = [];
    if (isApprover) {
      if (d.eventsTotal > 0) {
        parts.push(`${d.eventsTotal} event ${d.eventsTotal === 1 ? 'proposal' : 'proposals'} awaiting your approval`);
      }
      if (d.missing > 0) {
        parts.push(`${d.missing} ${d.missing === 1 ? 'assignment' : 'assignments'} past deadline on your tasks`);
      }
      return parts.length === 0 ? 'Nothing needs your attention right now.' : `${parts.join(' · ')}.`;
    }
    const dueSoon = d.myTasks.filter((t) => {
      const dl = t.deadline;
      return dl != null && !t.isOverdue && daysUntil(dl) <= 7;
    }).length;
    if (d.missing > 0) parts.push(`${d.missing} overdue ${d.missing === 1 ? 'task' : 'tasks'}`);
    if (dueSoon > 0) parts.push(`${dueSoon} due this week`);
    if (parts.length === 0) {
      return d.pending > 0
        ? `No deadlines this week — ${d.pending} ${d.pending === 1 ? 'task' : 'tasks'} still open.`
        : 'You are all caught up.';
    }
    return `You have ${parts.join(' and ')}.`;
  };

  // Mirrors the sidebar: approvers (principal/admin) have no My Tasks, and
  // only task creators have a Task Manager.
  // Server-granted permissions decide the sections (as in the sidebar).
  const isApprover = !app.can('receive_tasks');
  const canCreateTasks = app.can('create_tasks');
  if (loading) return <DashboardSkeleton />;

  // ── KPI tiles ───────────────────────────────────────────────────────────────

  const buildKpis = () => {
    const d = data;
    const route = isApprover ? '/tasks' : '/my-tasks';
    const tiles = [
      <KpiTile
        key="pending"
        value={d?.pending ?? 0}
        label="Pending"
        caption={isApprover ? 'Not yet submitted, still on time' : 'Open and still on time'}
        icon="schedule_rounded"
        color={AppTheme.accentBlue}
        tint={AppTheme.blueBg}
        onTap={() => go(route)}
      />,
      <KpiTile
        key="submitted"
        value={d?.submitted ?? 0}
        label="Submitted"
        caption={isApprover ? 'Turned in by assignees' : 'Turned in by you'}
        icon="check_circle_rounded"
        color="#16A34A"
        tint={AppTheme.greenBg}
        onTap={() => go(route)}
      />,
      <KpiTile
        key="missing"
        value={d?.missing ?? 0}
        label="Missing"
        caption="Past deadline, not submitted"
        icon="error_rounded"
        color={AppTheme.redColor}
        tint={AppTheme.redBg}
        alert={(d?.missing ?? 0) > 0}
        onTap={() => go(route)}
      />,
    ];
    if (isMobile) {
      return (
        <View>
          {tiles.map((t, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={{ height: 10 }} />}
              {t}
            </React.Fragment>
          ))}
        </View>
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {tiles.map((t, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={{ width: 16 }} />}
            <View style={{ flex: 1 }}>{t}</View>
          </React.Fragment>
        ))}
      </View>
    );
  };

  // ── Sections ────────────────────────────────────────────────────────────────

  const dueColor = (t: Task): string => {
    if (t.isOverdue) return AppTheme.redColor;
    const dl = t.deadline;
    if (dl != null && daysUntil(dl) <= 2) return AppTheme.amberColor;
    return AppTheme.accentBlue;
  };

  const dueChip = (t: Task) => {
    const dl = t.deadline;
    if (t.isOverdue) return <Chip text="Overdue" fg="#B91C1C" bg={AppTheme.redBg} />;
    if (dl == null) return <Chip text="No deadline" fg={AppTheme.textMuted} bg="#F1F5F9" />;
    const days = daysUntil(dl);
    if (days <= 0) return <Chip text="Due today" fg="#B45309" bg={AppTheme.amberBg} />;
    if (days === 1) return <Chip text="Due tomorrow" fg="#B45309" bg={AppTheme.amberBg} />;
    if (days <= 7) return <Chip text={`In ${days} days`} fg={AppTheme.accentBlue} bg={AppTheme.blueBg} />;
    return <Chip text={fmtDate(dl)} fg={AppTheme.textMuted} bg="#F1F5F9" />;
  };

  // The user's unsubmitted assigned tasks (My Tasks → Pending), soonest first.
  const buildMyTaskSection = () => {
    const tasks = data?.myTasks ?? [];
    return (
      <SectionCard
        icon="assignment_outlined"
        title="My tasks"
        count={tasks.length}
        actionLabel="View all"
        onAction={() => go('/my-tasks')}
        empty={
          tasks.length === 0 ? (
            <EmptyState icon="task_alt_rounded" message="Nothing to submit — you are all caught up." />
          ) : null
        }
        rows={tasks.map((t) => (
          <Row
            key={t.id}
            leading={<StatusDot color={dueColor(t)} />}
            title={t.title}
            meta={`${t.taskCategory === 'special' ? 'Special task' : 'Task'} · Due ${fmtDue(t)}`}
            trailing={dueChip(t)}
            onTap={() => go(t.taskCategory === 'special' ? `/my-special-tasks/${t.id}` : `/my-tasks/${t.id}`)}
          />
        ))}
      />
    );
  };

  // Tasks the user created (Task Manager), with submission progress.
  const buildTaskManagerSection = () => {
    const tasks = data?.taskManagerTasks ?? [];
    return (
      <SectionCard
        icon="fact_check_outlined"
        title="Task manager"
        count={tasks.length}
        actionLabel="View all"
        onAction={() => go('/tasks')}
        empty={
          tasks.length === 0 ? (
            <EmptyState icon="post_add_rounded" message="You have no active tasks. Tasks you create appear here." />
          ) : null
        }
        rows={tasks.map((t) => (
          <Row
            key={t.id}
            leading={<StatusDot color={t.isOverdue ? AppTheme.redColor : AppTheme.accentBlue} />}
            title={t.title}
            meta={
              `${t.taskCategory === 'special' ? 'Special task' : 'Task'} · Due ${fmtDue(t)}` +
              `${(t.teamTotal ?? 0) > 0 ? ` · ${t.teamTotal} assigned` : ''}`
            }
            trailing={
              (t.teamTotal ?? 0) === 0 ? (
                <Chip text="Not assigned" fg={AppTheme.textMuted} bg="#F1F5F9" />
              ) : (
                <Progress done={t.teamSubmitted ?? 0} total={t.teamTotal!} />
              )
            }
            onTap={() => go(t.taskCategory === 'special' ? `/special-tasks/${t.id}` : `/tasks/${t.id}`)}
          />
        ))}
      />
    );
  };

  // Event proposals awaiting approval: the approval queue for approvers,
  // otherwise the user's own proposals.
  const buildPendingSection = () => {
    const events = data?.events ?? [];
    const total = data?.eventsTotal ?? events.length;
    return (
      <SectionCard
        icon="pending_actions_outlined"
        title={isApprover ? 'Awaiting your approval' : 'My pending proposals'}
        count={total}
        actionLabel="View events"
        onAction={() => go('/events')}
        empty={
          events.length === 0 ? (
            <EmptyState
              icon="event_available_rounded"
              message={
                isApprover
                  ? 'No event proposals are waiting for you.'
                  : 'None of your event proposals are waiting for approval.'
              }
            />
          ) : null
        }
        footer={total > events.length ? `+${total - events.length} more in Events` : null}
        rows={events.map((e, i) => (
          <Row
            key={e.id ?? i}
            leading={<DateTile date={parseEventDate(e.target_date?.toString())} />}
            title={(e.title ?? 'Untitled event').toString()}
            meta={[(e.nature ?? '').toString().trim(), (e.venue ?? '').toString().trim()]
              .filter((s) => s.length > 0)
              .join(' · ')}
            trailing={<Chip text="Pending" fg="#B45309" bg={AppTheme.amberBg} />}
            onTap={() => go(e.id != null ? `/events?open=${e.id}` : '/events')}
          />
        ))}
      />
    );
  };

  // ── Calendar ────────────────────────────────────────────────────────────────

  const buildCalendarCard = () => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const firstDay = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineKeys = new Set((data?.deadlineDates ?? []).map((d) => d.getTime()));
    const upcoming = [...eventsByDay.values()]
      .filter((e) => e.date.getTime() >= today.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .flatMap((e) => e.events.map((ev) => ({ date: e.date, event: ev })))
      .slice(0, 3);

    return (
      <Card padding={[16, 14, 16, 16]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[ts({ size: 15, weight: 700, color: AppTheme.textPrimary }), { flex: 1 }]}>
            {`${MONTHS_LONG[calDate.getMonth()]} ${calDate.getFullYear()}`}
          </Text>
          <IconBtn
            icon="chevron_left_rounded"
            tooltip="Previous month"
            onTap={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1))}
          />
          <IconBtn
            icon="chevron_right_rounded"
            tooltip="Next month"
            onTap={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1))}
          />
        </View>
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row' }}>
          {days.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={ts({ size: 11, weight: 600, color: AppTheme.textLight })}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 4 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: firstDay + daysInMonth }, (_, i) => {
            if (i < firstDay) return <View key={i} style={styles.calCell} />;
            const day = i - firstDay + 1;
            const date = new Date(calDate.getFullYear(), calDate.getMonth(), day);
            const isToday = date.getTime() === today.getTime();
            const hasDeadline = deadlineKeys.has(date.getTime());
            const events = eventsFor(day);
            const cell = (
              <View style={[styles.calDay, { backgroundColor: isToday ? AppTheme.darkBanner : 'transparent' }]}>
                <Text style={ts({ size: 12, weight: isToday ? 700 : 500, color: isToday ? '#FFFFFF' : AppTheme.textPrimary })}>
                  {`${day}`}
                </Text>
                <View style={{ height: 3 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                  {events.length > 0 && <Dot color={AppTheme.accentBlue} />}
                  {events.length > 0 && hasDeadline && <View style={{ width: 3 }} />}
                  {hasDeadline && <Dot color={AppTheme.amberColor} />}
                  {events.length === 0 && !hasDeadline && <View style={{ height: 5 }} />}
                </View>
              </View>
            );
            return (
              <View key={i} style={styles.calCell}>
                {events.length > 0 ? (
                  <Tooltip message={eventTooltip(events)} style={{ flex: 1 }}>{cell}</Tooltip>
                ) : (
                  cell
                )}
              </View>
            );
          })}
        </View>
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Dot color={AppTheme.accentBlue} />
          <View style={{ width: 6 }} />
          <Text style={TextStyles.caption}>Event</Text>
          <View style={{ width: 16 }} />
          <Dot color={AppTheme.amberColor} />
          <View style={{ width: 6 }} />
          <Text style={TextStyles.caption}>Task deadline</Text>
        </View>
        <View style={{ paddingVertical: 14 }}>
          <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
        </View>
        <Text style={ts({ size: 13, weight: 700, color: AppTheme.textPrimary })}>Upcoming events</Text>
        <View style={{ height: 10 }} />
        {upcoming.length === 0 ? (
          <Text style={TextStyles.bodySm}>No upcoming events</Text>
        ) : (
          upcoming.map((u, i) => (
            <InkWell
              key={i}
              onPress={() => go(u.event.id != null ? `/events?open=${u.event.id}` : '/events')}
              radius={10}
            >
              <View style={{ paddingVertical: 5, flexDirection: 'row', alignItems: 'center' }}>
                <DateTile date={u.date} compact />
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>
                    {(u.event.title ?? 'Event').toString()}
                  </Text>
                  {(u.event.venue ?? '').toString().trim().length > 0 && (
                    <Text numberOfLines={1} style={TextStyles.caption}>{u.event.venue.toString()}</Text>
                  )}
                </View>
              </View>
            </InkWell>
          ))
        )}
      </Card>
    );
  };

  // ── Build ───────────────────────────────────────────────────────────────────

  const now = new Date();
  const sections: React.ReactNode[] = [];
  if (!isApprover) sections.push(buildMyTaskSection());
  if (canCreateTasks) sections.push(buildTaskManagerSection());
  sections.push(buildPendingSection());
  const main = (
    <View>
      {sections.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={{ height: 16 }} />}
          {s}
        </React.Fragment>
      ))}
    </View>
  );
  const side = buildCalendarCard();

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      contentContainerStyle={{
        paddingLeft: isMobile ? 16 : 24,
        paddingTop: 8,
        paddingRight: isMobile ? 16 : 24,
        paddingBottom: 24,
      }}
    >
      <AppBanner
        title={greeting(app.currentUser)}
        subtitle={`${WEEKDAYS[now.getDay()]}, ${MONTHS_LONG[now.getMonth()]} ${now.getDate()} — ${summary(isApprover)}`}
      />
      <View style={{ height: 16 }} />
      {buildKpis()}
      <View style={{ height: 16 }} />
      {width < 1100 ? (
        <View>
          {main}
          <View style={{ height: 16 }} />
          {side}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>{main}</View>
          <View style={{ width: 16 }} />
          <View style={{ width: 300 }}>{side}</View>
        </View>
      )}
    </ScrollView>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

function Card({ children, padding = [18, 18, 18, 18] }: {
  children: React.ReactNode;
  padding?: [number, number, number, number];
}) {
  return (
    <View
      style={[
        styles.card,
        { paddingLeft: padding[0], paddingTop: padding[1], paddingRight: padding[2], paddingBottom: padding[3] },
      ]}
    >
      {children}
    </View>
  );
}

function KpiTile({ value, label, caption, icon, color, tint, alert = false, onTap }: {
  value: number;
  label: string;
  caption: string;
  icon: IconName;
  color: string;
  tint: string;
  alert?: boolean;
  onTap: () => void;
}) {
  return (
    <InkWell onPress={onTap} radius={14}>
      <Card padding={[18, 16, 18, 16]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.kpiIcon, { backgroundColor: tint }]}>
            <Icon name={icon} color={color} size={22} />
          </View>
          <View style={{ width: 14 }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={ts({ size: 26, weight: 800, height: 1.1, color: alert ? color : AppTheme.textPrimary })}>
                {`${value}`}
              </Text>
              <View style={{ width: 8 }} />
              <Text numberOfLines={1} style={[ts({ size: 14, weight: 600, color: AppTheme.textPrimary }), { flexShrink: 1 }]}>
                {label}
              </Text>
            </View>
            <View style={{ height: 2 }} />
            <Text numberOfLines={1} style={TextStyles.caption}>{caption}</Text>
          </View>
          <Icon name="chevron_right_rounded" color={AppTheme.textLight} size={20} />
        </View>
      </Card>
    </InkWell>
  );
}

function SectionCard({ icon, title, count, actionLabel, onAction, rows, empty, footer }: {
  icon: IconName;
  title: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
  rows: React.ReactNode[];
  empty?: React.ReactNode | null;
  footer?: string | null;
}) {
  return (
    <Card padding={[0, 0, 0, 0]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} size={18} color={AppTheme.darkBanner} />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={[ts({ size: 15, weight: 700, color: AppTheme.textPrimary }), { flexShrink: 1 }]}>
            {title}
          </Text>
          {count > 0 && (
            <>
              <View style={{ width: 8 }} />
              <View style={styles.countPill}>
                <Text style={ts({ size: 12, weight: 700, color: AppTheme.textMuted })}>{`${count}`}</Text>
              </View>
            </>
          )}
        </View>
        <TextButton onPress={onAction} foregroundColor={AppTheme.accentBlue} padding={[10, 0]}>
          <Text style={tsPlain({ size: 13, weight: 600, color: AppTheme.accentBlue })}>{actionLabel}</Text>
          <View style={{ width: 2 }} />
          <Icon name="arrow_forward_rounded" size={16} color={AppTheme.accentBlue} />
        </TextButton>
      </View>
      <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
      {empty != null
        ? empty
        : rows.map((row, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={{ height: 1, marginHorizontal: 18, backgroundColor: '#F0F2F6' }} />}
              {row}
            </React.Fragment>
          ))}
      {footer != null && (
        <View style={{ paddingLeft: 18, paddingTop: 4, paddingRight: 18, paddingBottom: 14 }}>
          <Text style={TextStyles.caption}>{footer}</Text>
        </View>
      )}
      {empty == null && footer == null && <View style={{ height: 4 }} />}
    </Card>
  );
}

function Row({ leading, title, meta, trailing, onTap }: {
  leading: React.ReactNode;
  title: string;
  meta: string;
  trailing: React.ReactNode;
  onTap: () => void;
}) {
  return (
    <InkWell onPress={onTap} hoverColor="#F6F8FC">
      <View style={{ paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
        {leading}
        <View style={{ width: 14 }} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={ts({ size: 14, weight: 600, color: AppTheme.textPrimary })}>{title}</Text>
          {meta.length > 0 && (
            <>
              <View style={{ height: 2 }} />
              <Text numberOfLines={1} style={TextStyles.caption}>{meta}</Text>
            </>
          )}
        </View>
        <View style={{ width: 12 }} />
        {trailing}
      </View>
    </InkWell>
  );
}

function EmptyState({ icon, message }: { icon: IconName; message: string }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingVertical: 20, flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={20} color={AppTheme.textLight} />
      <View style={{ width: 10 }} />
      <Text style={[TextStyles.bodyMd, { flex: 1 }]}>{message}</Text>
    </View>
  );
}

function Chip({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: bg, borderRadius: 20 }}>
      <Text style={ts({ size: 12, weight: 600, color: fg })}>{text}</Text>
    </View>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const complete = done >= total;
  return (
    <View style={{ width: 120, alignItems: 'flex-end' }}>
      <Text style={ts({ size: 12, weight: 600, color: complete ? '#16A34A' : AppTheme.textMuted })}>
        {`${done}/${total} submitted`}
      </Text>
      <View style={{ height: 5 }} />
      <LinearProgressIndicator
        value={total === 0 ? 0 : done / total}
        minHeight={6}
        radius={4}
        backgroundColor="#EEF2FA"
        color={complete ? AppTheme.greenColor : AppTheme.accentBlue}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        boxShadow: `0px 0px 0px 3px ${withOpacity(color, 0.25)}`,
      }}
    />
  );
}

function Dot({ color }: { color: string }) {
  return <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }} />;
}

/// Month/day tile for an event date ("OCT / 2"); a calendar icon if unknown.
function DateTile({ date, compact = false }: { date: Date | null; compact?: boolean }) {
  const size = compact ? 38.0 : 44.0;
  return (
    <View style={[styles.dateTile, { width: size, height: size }]}>
      {date == null ? (
        <Icon name="event_rounded" size={18} color={AppTheme.textMuted} />
      ) : (
        <>
          <Text style={ts({ size: compact ? 9 : 10, weight: 700, color: AppTheme.accentBlue, spacing: 0.4, height: 1.1 })}>
            {MONTHS[date.getMonth()].toUpperCase()}
          </Text>
          <Text style={ts({ size: compact ? 14 : 16, weight: 800, color: AppTheme.textPrimary, height: 1.15 })}>
            {`${date.getDate()}`}
          </Text>
        </>
      )}
    </View>
  );
}

function IconBtn({ icon, tooltip, onTap }: { icon: IconName; tooltip: string; onTap: () => void }) {
  return (
    <IconButton
      onPress={onTap}
      tooltip={tooltip}
      icon={<Icon name={icon} size={20} color={AppTheme.textMuted} />}
      size={20}
      compact
      padding={0}
      minSize={32}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F3',
    boxShadow: '0px 2px 6px rgba(26,26,46,0.04)',
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingTop: 14,
    paddingRight: 10,
    paddingBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#EEF2FA',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#EEF2FA',
    borderRadius: 20,
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  calDay: {
    flex: 1,
    margin: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTile: {
    backgroundColor: '#EEF2FA',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
