import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SchoolYearPicker } from '../components/SchoolYearPicker';
import { AppBanner } from '../components/commonWidgets';
import { Icon, IconName } from '../components/ui/Icon';
import { Tap } from '../components/ui/buttons';
import {
  EventForAppraisal,
  Json,
  SchoolYearFilter,
  SpecialTask,
  currentSchoolYear,
  sameSchoolYearFilter,
} from '../models/models';
import { ApiService, exceptionText } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, ts } from '../theme/appTheme';
import { AnalyticsTab } from './appraisal/AnalyticsTab';
import { BadgesTab } from './appraisal/BadgesTab';
import { EventsTab } from './appraisal/EventsTab';
import { SpecialTasksTab } from './appraisal/SpecialTasksTab';
import { TimingPointsTab } from './appraisal/TimingPointsTab';

type AppraisalTab = 'timingPoints' | 'specialTasks' | 'events' | 'badges' | 'analytics';

const TAB_LABELS: Record<AppraisalTab, string> = {
  timingPoints: 'Timing Points',
  specialTasks: 'Special Tasks',
  events: 'Events',
  badges: 'Badges',
  analytics: 'Analytics',
};

const TAB_ICONS: Record<AppraisalTab, IconName> = {
  timingPoints: 'timer_outlined',
  specialTasks: 'assignment_outlined',
  events: 'calendar_month_outlined',
  badges: 'workspace_premium_outlined',
  analytics: 'bar_chart_outlined',
};

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

export default function AppraisalScreen() {
  const app = useAppState();
  // Without school-wide appraisal access (server permission), people see
  // their own / their grade level's records and no Analytics tab.
  const availableTabs = useRef<AppraisalTab[]>(
    app.can('view_all_appraisals')
      ? ['timingPoints', 'specialTasks', 'events', 'badges', 'analytics']
      : ['timingPoints', 'specialTasks', 'events', 'badges'],
  ).current;
  const [activeTab, setActiveTab] = useState<AppraisalTab>(availableTabs[0]);

  const [tasks, setTasks] = useState<SpecialTask[]>([]);
  const [events, setEvents] = useState<EventForAppraisal[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<Json[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // School year / term every tab covers (default: current; ended years are archived).
  const [filter, setFilter] = useState<SchoolYearFilter>(currentSchoolYear);
  const mounted = useRef(true);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    setSubmissionError(null);
    try {
      const s = await ApiService.getReportSubmissions(filter);
      if (mounted.current) setSubmissions(s);
    } catch (e) {
      if (mounted.current) setSubmissionError(exceptionText(e));
    }
    if (mounted.current) setLoadingSubmissions(false);
  }, [filter]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTaskError(null);
    try {
      const t = await ApiService.getSpecialTasks(filter);
      if (mounted.current) setTasks(t);
    } catch (e) {
      if (mounted.current) setTaskError(exceptionText(e));
    }
    if (mounted.current) setLoadingTasks(false);
  }, [filter]);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEventError(null);
    try {
      const e = await ApiService.getEventsForAppraisal(filter);
      if (mounted.current) setEvents(e);
    } catch (e) {
      if (mounted.current) setEventError(exceptionText(e));
    }
    if (mounted.current) setLoadingEvents(false);
  }, [filter]);

  useEffect(() => {
    mounted.current = true;
    loadSubmissions();
    loadTasks();
    loadEvents();
    return () => {
      mounted.current = false;
    };
  }, [loadSubmissions, loadTasks, loadEvents]);

  const changeFilter = (f: SchoolYearFilter) => {
    if (sameSchoolYearFilter(f, filter)) return;
    setFilter(f);
  };

  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const pendingEvents = events.filter((e) => e.status === 'pending' || e.status === 'upcoming').length;

  const tabBar = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
      {availableTabs.map((tab) => {
        const active = tab === activeTab;
        const badge = tab === 'specialTasks' ? pendingTasks : tab === 'events' ? pendingEvents : 0;
        return (
          <View key={tab} style={{ paddingRight: 8 }}>
            <Tap onPress={() => setActiveTab(tab)}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: active ? AppTheme.darkBanner : '#FFFFFF',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: active ? AppTheme.darkBanner : '#E0E0E0',
                }}
              >
                <Icon name={TAB_ICONS[tab]} size={15} color={active ? '#FFFFFF' : AppTheme.textMuted} />
                <View style={{ width: 6 }} />
                <Text style={ts({ size: 13, weight: 500, color: active ? '#FFFFFF' : AppTheme.textMuted })}>
                  {TAB_LABELS[tab]}
                </Text>
                {badge > 0 && (
                  <>
                    <View style={{ width: 6 }} />
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        backgroundColor: active ? 'rgba(255,255,255,0.24)' : '#F44336',
                        borderRadius: 10,
                      }}
                    >
                      <Text style={ts({ size: 10, weight: 700, color: '#FFFFFF' })}>{`${badge}`}</Text>
                    </View>
                  </>
                )}
              </View>
            </Tap>
          </View>
        );
      })}
    </View>
  );

  const body = () => {
    switch (activeTab) {
      case 'timingPoints':
        return (
          <TimingPointsTab submissions={submissions} loading={loadingSubmissions} error={submissionError} onRefresh={loadSubmissions} />
        );
      case 'specialTasks':
        return (
          <SpecialTasksTab
            tasks={tasks}
            loading={loadingTasks}
            error={taskError}
            onRefresh={loadTasks}
            onEvaluated={(u) => setTasks((prev) => prev.map((t) => (t.id === u.id ? u : t)))}
          />
        );
      case 'events':
        return (
          <EventsTab
            events={events}
            loading={loadingEvents}
            error={eventError}
            onRefresh={loadEvents}
            onEvaluated={(u) => setEvents((prev) => prev.map((e) => (e.id === u.id ? u : e)))}
          />
        );
      case 'badges':
        return (
          <BadgesTab
            filter={filter}
            // Principal/admin aren't appraised themselves; supervisors also rank staff.
            showOwn={app.can('receive_tasks')}
            showLeaderboard={app.can('evaluate_appraisal')}
          />
        );
      case 'analytics':
        return <AnalyticsTab tasks={tasks} events={events} />;
    }
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <AppBanner
        title="Performance Appraisal"
        subtitle="Evaluate special tasks and events · Track faculty performance · View annual analytics"
      />
      <View style={{ height: 20 }} />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          columnGap: 12,
          rowGap: 10,
        }}
      >
        {tabBar}
        <SchoolYearPicker value={filter} onChanged={changeFilter} includeTerms />
      </View>
      <View style={{ height: 16 }} />
      <View style={{ flex: 1 }}>{body()}</View>
    </View>
  );
}
