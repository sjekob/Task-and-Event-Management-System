import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SchoolYearPicker } from '../components/SchoolYearPicker';
import { EventManagementSkeleton } from '../components/skeletonWidgets';
import { Icon, IconName } from '../components/ui/Icon';
import { ElevatedButton, FilledButton, IconButton, InkWell, OutlinedButton, Tap, TextButton } from '../components/ui/buttons';
import { PopupMenuButton, Tooltip, useIsMobile } from '../components/ui/misc';
import { pushPage } from '../components/ui/navigator';
import { Dialog, showDialog, showSnackBar } from '../components/ui/overlay';
import { Json, SchoolYearFilter, currentSchoolYear } from '../models/models';
import { ApiService } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, ts, tsPlain, withOpacity } from '../theme/appTheme';
import { dayKey, parseEventDate } from '../utils/dateParse';
import { printEvent } from '../utils/eventPrintHelper';
import { setRouteExtra } from '../utils/routeExtra';

type EventStatus = 'approved' | 'pendingApproval' | 'disabled' | 'draft';

interface CalEvent {
  id: number | null;
  title: string;
  description: string;
  status: EventStatus;
  /// null when target_date can't be parsed
  date: Date | null;
  creatorName: string;
  createdBy: number | null;
  raw: Json;
}

function mapStatus(s: string | null): EventStatus {
  switch (s) {
    case 'approved': return 'approved';
    case 'disabled': return 'disabled';
    case 'draft': return 'draft';
    default: return 'pendingApproval';
  }
}

interface EventManagementScreenProps {
  onAddEvent: () => void;
  /// When set (e.g. from the dashboard: /events?open=12), that event is
  /// scrolled into view, highlighted, and its details opened once loaded.
  openEventId?: number | null;
}

export default function EventManagementScreen({ onAddEvent, openEventId = null }: EventManagementScreenProps) {
  const app = useAppState();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedTab, setSelectedTab] = useState(0);
  const [focusedDay, setFocusedDay] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  // Current school year by default; earlier years are archived.
  const [filter, setFilter] = useState<SchoolYearFilter>(currentSchoolYear);
  const cardOffsets = useRef(new Map<number, number>()).current;
  const scrollRef = useRef<ScrollView>(null);
  const listOffset = useRef(0);
  const mounted = useRef(true);
  const opened = useRef(false);

  // Permissions come from the backend, which enforces them on every action.
  const canManage = app.can('manage_events');
  const canApprove = app.can('approve_events');
  // Oversight-only accounts (approve but don't propose events).
  const isPrincipal = canApprove && !canManage;
  const myId = app.currentUser?.id ?? null;

  const setStatus = (event: CalEvent, status: EventStatus) =>
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status } : e)));

  const disable = async (event: CalEvent) => {
    if (event.id != null) {
      try { await ApiService.disableEvent(event.id); } catch {}
    }
    setStatus(event, 'disabled');
  };

  const enable = async (event: CalEvent) => {
    if (event.id != null) {
      try { await ApiService.enableEvent(event.id); } catch {}
    }
    setStatus(event, 'pendingApproval');
  };

  const approve = async (event: CalEvent) => {
    if (event.id != null) {
      try {
        const { created, unmatched } = await ApiService.approveEvent(event.id);
        if (created > 0 || unmatched.length > 0) {
          const parts: string[] = [];
          if (created > 0) parts.push(`${created} special task${created === 1 ? '' : 's'} created for the committee.`);
          if (unmatched.length > 0) parts.push(`No account found for: ${unmatched.join(', ')}.`);
          showSnackBar(parts.join(' '), { duration: 6000 });
        }
      } catch {}
    }
    setStatus(event, 'approved');
  };

  const confirmDisable = async (event: CalEvent) => {
    const confirmed = await showDialog<boolean>((pop) => (
      <ConfirmDialog title="Confirm Disable" message={`Disable "${event.title}"?`} action="Disable" pop={pop} />
    ));
    if (confirmed === true) disable(event);
  };

  const deleteDraft = async (event: CalEvent) => {
    if (event.id != null) {
      try { await ApiService.deleteEvent(event.id); } catch {}
    }
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
  };

  const confirmDeleteDraft = async (event: CalEvent) => {
    const title = event.title.trim().length === 0 ? 'Untitled Draft' : event.title;
    const confirmed = await showDialog<boolean>((pop) => (
      <ConfirmDialog title="Delete Draft" message={`Delete "${title}"? This cannot be undone.`} action="Delete" pop={pop} />
    ));
    if (confirmed === true) deleteDraft(event);
  };

  const editEvent = (event: CalEvent) => {
    setRouteExtra(event.raw);
    router.push(`/events/${event.id}/edit` as never);
  };

  /// Details popup with the actions that fit the event's status.
  const openDetail = (e: CalEvent) => {
    const pending = e.status !== 'approved' && e.status !== 'disabled';
    pushPage((pop) => (
      <EventDetailPage
        event={e}
        canApprove={pending ? canApprove : false}
        isPrincipal={isPrincipal}
        onApprove={pending ? () => approve(e) : undefined}
        onDisable={pending ? () => confirmDisable(e) : undefined}
        onClose={() => pop()}
      />
    ));
  };

  const loadEvents = useCallback(async (): Promise<CalEvent[]> => {
    try {
      const data = await ApiService.getEvents(filter.schoolYear === 'current' ? null : filter.schoolYear);
      const mapped = data.map<CalEvent>((e) => ({
        id: (e.id as number | null) ?? null,
        title: e.title ?? '',
        description: e.rationale ?? e.title ?? '',
        status: mapStatus((e.status as string | null) ?? null),
        date: parseEventDate((e.target_date as string | null) ?? null),
        creatorName: e.creator_name ?? '',
        createdBy: (e.created_by as number | null) ?? null,
        raw: e,
      }));
      if (mounted.current) {
        setEvents(mapped);
        setIsLoading(false);
      }
      return mapped;
    } catch {
      if (mounted.current) setIsLoading(false);
      return [];
    }
  }, [filter]);

  useEffect(() => {
    mounted.current = true;
    loadEvents().then((loaded) => {
      // Open the event the dashboard asked for, once.
      if (openEventId == null || opened.current || !mounted.current) return;
      opened.current = true;
      const event = loaded.find((e) => e.id === openEventId);
      if (event == null) {
        showSnackBar('That event is no longer available.');
        return;
      }
      setHighlightId(openEventId);
      setSelectedTab(0);
      setTimeout(() => {
        if (!mounted.current) return;
        const y = cardOffsets.get(openEventId);
        if (y != null) {
          scrollRef.current?.scrollTo({ y: Math.max(0, listOffset.current + y - windowHeight * 0.2), animated: true });
        }
        setTimeout(() => {
          if (!mounted.current) return;
          openDetail(event);
          setTimeout(() => {
            if (mounted.current) setHighlightId((current) => (current === openEventId ? null : current));
          }, 4000);
        }, 400);
      }, 50);
    });
    return () => {
      mounted.current = false;
    };
    // The requested event is opened once, after the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEvents]);

  const activeEvents = events.filter((e) => e.status !== 'disabled' && e.status !== 'draft');
  const disabledEvents = events.filter((e) => e.status === 'disabled');
  const draftEvents = events.filter((e) => e.status === 'draft' && e.createdBy === myId);
  const filteredActive = selectedTab === 1 ? activeEvents.filter((e) => e.createdBy === myId) : activeEvents;
  const forStatus = (s: EventStatus) => filteredActive.filter((e) => e.status === s);

  // Active events grouped by calendar day — powers the dot markers and the
  // hover tooltip (title / when / where) on the side calendar.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (e.status === 'disabled' || e.status === 'draft') continue;
      if (e.date == null) continue; // undated → no calendar marker
      const key = dayKey(e.date);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

  /// Tracks the card's position for scrolling and outlines it while highlighted.
  const trackable = (e: CalEvent, card: React.ReactNode) => {
    if (e.id == null) return <React.Fragment key={`u${e.title}`}>{card}</React.Fragment>;
    const on = e.id === highlightId;
    const id = e.id;
    return (
      <View
        key={id}
        onLayout={(ev) => cardOffsets.set(id, ev.nativeEvent.layout.y)}
        style={[
          { borderRadius: 14, borderWidth: 2, borderColor: on ? '#2563EB' : 'transparent' },
          on && { boxShadow: `0px 0px 12px 2px ${withOpacity('#2563EB', 0.18)}` },
        ]}
      >
        {card}
      </View>
    );
  };

  const sectionLabel = (text: string) => (
    <View style={{ paddingBottom: 2 }}>
      <Text style={ts({ size: 13, weight: 500, color: '#718096' })}>{text}</Text>
    </View>
  );

  const calendar = (
    <SideCalendar
      focusedDay={focusedDay}
      selectedDay={selectedDay}
      eventsByDay={eventsByDay}
      onDaySelected={(day) => {
        setSelectedDay(day);
        setFocusedDay(day);
      }}
      onPageChanged={setFocusedDay}
    />
  );

  const approved = forStatus('approved');
  const pending = forStatus('pendingApproval');

  const eventList = (
    <View onLayout={(e) => { listOffset.current = e.nativeEvent.layout.y; }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 10 }}>
        <TabChip label="All Events" active={selectedTab === 0} onTap={() => setSelectedTab(0)} />
        {!isPrincipal && <TabChip label="My Events" active={selectedTab === 1} onTap={() => setSelectedTab(1)} />}
        <SchoolYearPicker value={filter} onChanged={setFilter} />
      </View>
      <View style={{ height: 20 }} />

      {events.length === 0 && (
        <View style={{ padding: 40, backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center' }}>
          <Text style={ts({ size: 14, color: '#718096', align: 'center' })}>No events yet.</Text>
        </View>
      )}

      {/* Approved events — no actions */}
      {approved.length > 0 && (
        <>
          {sectionLabel('Upcoming / Approved Events')}
          <View style={{ height: 10 }} />
          {approved.map((e) =>
            trackable(
              e,
              <EventCard
                event={e}
                canManage={false}
                canApprove={false}
                isPrincipal={isPrincipal}
                onEdit={() => {}}
                onDisable={() => {}}
                onApprove={() => {}}
                onPrint={() => printEvent(e.raw)}
                onTap={() => openDetail(e)}
              />,
            ),
          )}
          <View style={{ height: 20 }} />
        </>
      )}

      {/* Pending approval events */}
      {pending.length > 0 && (
        <>
          {sectionLabel('Pending Approval')}
          <View style={{ height: 10 }} />
          {pending.map((e) =>
            trackable(
              e,
              <EventCard
                event={e}
                canManage={canManage}
                canApprove={canApprove}
                isPrincipal={isPrincipal}
                onEdit={() => editEvent(e)}
                onDisable={() => confirmDisable(e)}
                onApprove={() => approve(e)}
                onPrint={() => printEvent(e.raw)}
                onTap={() => openDetail(e)}
              />,
            ),
          )}
          <View style={{ height: 20 }} />
        </>
      )}

      {/* Disabled events */}
      {disabledEvents.length > 0 && selectedTab === 0 && (
        <>
          {sectionLabel('Disabled Events')}
          <View style={{ height: 10 }} />
          {disabledEvents.map((e) =>
            trackable(
              e,
              <DisabledEventCard
                event={e}
                canManage={canManage}
                onEnable={() => enable(e)}
                onPrint={() => printEvent(e.raw)}
                onTap={() => openDetail(e)}
              />,
            ),
          )}
          <View style={{ height: 20 }} />
        </>
      )}

      {/* Drafts — private to the creator, never shown to other users */}
      {draftEvents.length > 0 && (
        <>
          {sectionLabel('Drafts')}
          <View style={{ height: 10 }} />
          {draftEvents.map((e, i) => (
            <DraftEventCard key={e.id ?? i} event={e} onContinue={() => editEvent(e)} onDelete={() => confirmDeleteDraft(e)} />
          ))}
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.bgColor }}>
      {isLoading ? (
        <EventManagementSkeleton />
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingLeft: 24, paddingTop: 20, paddingRight: 24, paddingBottom: 24 }}>
          <Banner />
          <View style={{ height: 20 }} />
          {isMobile ? (
            eventList
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>{eventList}</View>
              <View style={{ width: 20 }} />
              <View style={{ width: 290 }}>{calendar}</View>
            </View>
          )}
          {isMobile && (
            <>
              <View style={{ height: 20 }} />
              {sectionLabel('Calendar')}
              <View style={{ height: 10 }} />
              {calendar}
            </>
          )}
        </ScrollView>
      )}
      {canManage && (
        <View style={styles.fab}>
          <InkWell onPress={onAddEvent} radius={16} hoverColor="rgba(255,255,255,0.08)">
            <View style={styles.fabInner}>
              <Icon name="add" size={20} color="#FFFFFF" />
              <View style={{ width: 8 }} />
              <Text style={tsPlain({ weight: 600, size: 13, color: '#FFFFFF' })}>Add Event</Text>
            </View>
          </InkWell>
        </View>
      )}
    </View>
  );
}

// ─── Banner with the cube pattern ─────────────────────────────────────────────

function cubePaths(width: number, height: number): { top: string; left: string; right: string } {
  const w = 40.0;
  const h = 22.0;
  let top = '';
  let left = '';
  let right = '';
  for (let row = -1; row < height / h + 2; row++) {
    for (let col = -1; col < width / w + 2; col++) {
      const cx = col * w + (row % 2 === 0 ? 0 : w / 2) + w / 2;
      const cy = row * h * 0.75;
      top += `M${cx} ${cy}L${cx + w / 2} ${cy + h / 2}L${cx} ${cy + h}L${cx - w / 2} ${cy + h / 2}Z`;
      left += `M${cx - w / 2} ${cy + h / 2}L${cx} ${cy + h}L${cx} ${cy + h * 1.6}L${cx - w / 2} ${cy + h * 1.1}Z`;
      right += `M${cx + w / 2} ${cy + h / 2}L${cx} ${cy + h}L${cx} ${cy + h * 1.6}L${cx + w / 2} ${cy + h * 1.1}Z`;
    }
  }
  return { top, left, right };
}

function Banner() {
  const [width, setWidth] = useState(0);
  const paths = useMemo(() => cubePaths(width, 148), [width]);
  const stroke = 'rgba(255,255,255,0.06)';
  return (
    <View style={styles.banner} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={148} style={StyleSheet.absoluteFill}>
          <Path d={paths.top} fill="rgba(255,255,255,0.07)" stroke={stroke} strokeWidth={0.5} />
          <Path d={paths.left} fill="rgba(255,255,255,0.04)" stroke={stroke} strokeWidth={0.5} />
          <Path d={paths.right} fill="rgba(255,255,255,0.02)" stroke={stroke} strokeWidth={0.5} />
        </Svg>
      )}
      <View style={{ flex: 1, paddingHorizontal: 28, paddingVertical: 24, justifyContent: 'center', alignItems: 'flex-start' }}>
        <Text style={ts({ color: '#FFFFFF', size: 32, weight: 700, spacing: -0.3 })}>Event Calendar</Text>
        <View style={{ height: 6 }} />
        <Text style={ts({ color: 'rgba(255,255,255,0.6)', size: 13 })}>
          Great things are on the horizon — stay active, stay organized!
        </Text>
      </View>
    </View>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

function TabChip({ label, active, onTap }: { label: string; active: boolean; onTap: () => void }) {
  return (
    <Tap onPress={onTap}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          backgroundColor: active ? '#1E2126' : '#FFFFFF',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: active ? '#1E2126' : '#DDE3ED',
        }}
      >
        <Text style={ts({ size: 13, weight: 600, color: active ? '#FFFFFF' : '#4A5568' })}>{label}</Text>
      </View>
    </Tap>
  );
}

// ─── Event Detail Page ────────────────────────────────────────────────────────

const notEmpty = (v: unknown): boolean => v != null && String(v).trim().length > 0;

function money(v: unknown): string {
  const s = (v ?? '').toString().trim();
  const cleaned = s.replace(/,/g, '').replace(/₱/g, '').trim();
  const n = cleaned.length === 0 ? NaN : Number(cleaned);
  if (isNaN(n)) return s;
  const parts = n.toFixed(2).split('.');
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱${whole}.${parts[1]}`;
}

const fallbackText = ts({ size: 12, color: '#4A5568' });
const stripBullet = (s: string) => s.trim().replace(/^[•\-*·●○]\s*/, '');

function EventDetailPage({ event, canApprove = false, isPrincipal = false, onApprove, onDisable, onClose }: {
  event: CalEvent;
  canApprove?: boolean;
  isPrincipal?: boolean;
  onApprove?: () => void;
  onDisable?: () => void;
  onClose: () => void;
}) {
  const raw = event.raw;
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const pending = event.status === 'pendingApproval';
  const showApprove = canApprove && pending;
  const showDisable = isPrincipal && pending;

  const hasFocal = notEmpty(raw.focal_name);
  const hasParticipants = notEmpty(raw.participants);
  const focalCard = (
    <DetailCard icon="badge_outlined" title="Focal person">
      <PropField label="Name" value={raw.focal_name} />
      <PropField label="Role" value={raw.focal_role} />
      <PropField label="Contact" value={raw.focal_contact} />
    </DetailCard>
  );
  const participantsCard = (
    <DetailCard icon="groups_outlined" title="Target participants">
      <ParticipantsTable raw={(raw.participants ?? '').toString()} />
    </DetailCard>
  );

  // Numbered proposal sections, only those with content.
  const sections: [string, IconName, React.ReactNode][] = [];
  if (notEmpty(raw.rationale)) sections.push(['Rationale', 'lightbulb_outline', <PropBody key="r" text={String(raw.rationale)} />]);
  if (notEmpty(raw.objectives)) sections.push(['Objectives', 'flag_outlined', <PropBullets key="o" text={String(raw.objectives)} />]);
  if (notEmpty(raw.phase1) || notEmpty(raw.phase2) || notEmpty(raw.phase3)) {
    sections.push([
      'Methodology / Work plan',
      'route_outlined',
      <View key="m">
        {notEmpty(raw.phase1) && <Methodology raw={String(raw.phase1)} />}
        {notEmpty(raw.phase2) && <PropField label="Phase 2" value={raw.phase2} />}
        {notEmpty(raw.phase3) && <PropField label="Phase 3" value={raw.phase3} />}
      </View>,
    ]);
  }
  if (notEmpty(raw.activity_matrix)) {
    sections.push(['Activity matrix', 'view_timeline_outlined', <ActivityMatrix key="a" raw={String(raw.activity_matrix)} />]);
  }
  if (notEmpty(raw.training_materials) || notEmpty(raw.snacks)) {
    sections.push([
      'Budget',
      'payments_outlined',
      <View key="b">
        {notEmpty(raw.training_materials) && (
          <>
            <SubHeading text="Training materials" />
            <BudgetTable raw={String(raw.training_materials)} columns={[['item', 'Item'], ['qty', 'Qty'], ['cost', 'Cost'], ['total', 'Total']]} />
          </>
        )}
        {notEmpty(raw.snacks) && (
          <>
            <View style={{ height: 16 }} />
            <SubHeading text="Meals / snacks" />
            <BudgetTable raw={String(raw.snacks)} columns={[['item', 'Item'], ['pax', 'Participants'], ['cost', 'Cost/Day'], ['total', 'Total']]} />
          </>
        )}
      </View>,
    ]);
  }
  if (notEmpty(raw.exec_committee) || notEmpty(raw.twg_groups)) {
    sections.push([
      'Committees',
      'account_tree_outlined',
      <View key="c">
        {notEmpty(raw.exec_committee) && (
          <>
            <SubHeading text="Executive committee" />
            <CommitteeList raw={String(raw.exec_committee)} />
          </>
        )}
        {notEmpty(raw.twg_groups) && (
          <>
            <View style={{ height: 14 }} />
            <SubHeading text="Technical working groups" />
            <TwgGroups raw={String(raw.twg_groups)} />
          </>
        )}
      </View>,
    ]);
  }
  if (notEmpty(raw.monitoring_criteria) || notEmpty(raw.indicators)) {
    sections.push([
      'Monitoring & evaluation',
      'fact_check_outlined',
      <View key="e">
        {notEmpty(raw.monitoring_criteria) && <PropBody text={String(raw.monitoring_criteria)} />}
        {notEmpty(raw.indicators) && (
          <>
            <SubHeading text="Indicators" />
            <Indicators raw={String(raw.indicators)} />
          </>
        )}
      </View>,
    ]);
  }
  if (notEmpty(raw.comments)) sections.push(['Signatories', 'draw_outlined', <Signatories key="s" raw={String(raw.comments)} />]);

  const facts: [string, IconName, string][] = [
    ['Nature', 'category_outlined', (raw.nature ?? '').toString()],
    ['Venue', 'place_outlined', (raw.venue ?? '').toString()],
    ['Proposed budget', 'account_balance_wallet_outlined', money(raw.proposed_budget)],
    ['Fund source', 'savings_outlined', (raw.fund_source ?? '').toString()],
  ];

  const pad = width < 600 ? 16.0 : 28.0;
  const actionText = tsPlain({ size: 14, weight: 600 });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5FB' }}>
      <ScrollView contentContainerStyle={{ paddingLeft: pad, paddingTop: 20, paddingRight: pad, paddingBottom: 32, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1100 }}>
          {/* ── Header ── */}
          <Panel>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <IconButton
                tooltip="Back to events"
                onPress={onClose}
                icon="arrow_back_rounded"
                color="#1A1A2E"
                backgroundColor="#F1F5F9"
              />
              <View style={{ width: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={ts({ size: 11, weight: 700, spacing: 0.8, color: '#718096' })}>EVENT PROPOSAL</Text>
                <View style={{ height: 4 }} />
                <Text style={ts({ size: 24, weight: 800, color: '#1A1A2E', height: 1.2 })}>{event.title}</Text>
              </View>
              <View style={{ width: 12 }} />
              <StatusBadge status={event.status} />
            </View>
            <View style={{ height: 16 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 10 }}>
              {event.creatorName.length > 0 && <PropMeta icon="person_outline" text={`Proposed by ${event.creatorName}`} />}
              {notEmpty(raw.target_date) && <PropMeta icon="event_outlined" text={String(raw.target_date)} />}
              {notEmpty(raw.venue) && <PropMeta icon="place_outlined" text={String(raw.venue)} />}
            </View>
            <View style={{ height: 18 }} />
            <View style={{ height: 1, backgroundColor: '#E2E8F0' }} />
            <View style={{ height: 14 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {showApprove && (
                <FilledButton
                  onPress={() => {
                    onClose();
                    onApprove?.();
                  }}
                  icon="check_circle_outline"
                  iconSize={18}
                  backgroundColor="#16A34A"
                  padding={[18, 14]}
                  radius={10}
                >
                  Approve event
                </FilledButton>
              )}
              {showDisable && (
                <OutlinedButton
                  onPress={() => {
                    onClose();
                    onDisable?.();
                  }}
                  icon="block"
                  iconSize={18}
                  foregroundColor="#DC2626"
                  side={{ color: '#FCA5A5' }}
                  padding={[18, 14]}
                  radius={10}
                  textStyle={actionText}
                >
                  Disable event
                </OutlinedButton>
              )}
              <OutlinedButton
                onPress={() => printEvent(raw)}
                icon="print_outlined"
                iconSize={18}
                foregroundColor="#1A1A2E"
                side={{ color: '#E2E8F0' }}
                padding={[18, 14]}
                radius={10}
                textStyle={actionText}
              >
                Print proposal
              </OutlinedButton>
            </View>
          </Panel>
          <View style={{ height: 16 }} />

          {/* ── Key facts ── */}
          <FactGrid facts={facts} />
          <View style={{ height: 16 }} />

          {/* ── Focal person + participants ── */}
          {(hasFocal || hasParticipants) && (
            <>
              {wide && hasFocal && hasParticipants ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 320 }}>{focalCard}</View>
                  <View style={{ width: 16 }} />
                  <View style={{ flex: 1 }}>{participantsCard}</View>
                </View>
              ) : (
                <>
                  {hasFocal && focalCard}
                  {hasFocal && hasParticipants && <View style={{ height: 16 }} />}
                  {hasParticipants && participantsCard}
                </>
              )}
              <View style={{ height: 16 }} />
            </>
          )}

          {notEmpty(raw.expected_outputs) && (
            <>
              <DetailCard icon="checklist_rounded" title="Expected outputs">
                <Outputs raw={String(raw.expected_outputs)} />
              </DetailCard>
              <View style={{ height: 16 }} />
            </>
          )}

          {/* ── Numbered sections ── */}
          {sections.map(([title, icon, child], i) => (
            <React.Fragment key={title}>
              {/* I. is the proposal brief shown above */}
              <ProposalSection number={i + 2} icon={icon} title={title}>{child}</ProposalSection>
              <View style={{ height: 16 }} />
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

function DetailCard({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name={icon} size={18} color="#4A5568" />
        <View style={{ width: 8 }} />
        <Text style={ts({ size: 15, weight: 700, color: '#1A1A2E' })}>{title}</Text>
      </View>
      <View style={{ height: 14 }} />
      {children}
    </Panel>
  );
}

function FactGrid({ facts }: { facts: [string, IconName, string][] }) {
  const [maxWidth, setMaxWidth] = useState(0);
  const cols = maxWidth >= 800 ? 4 : maxWidth >= 340 ? 2 : 1;
  const w = (maxWidth - 12 * (cols - 1)) / cols;
  return (
    <View onLayout={(e) => setMaxWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {maxWidth > 0 &&
        facts.map(([label, icon, value]) => (
          <View key={label} style={[styles.factTile, { width: w }]}>
            <View style={styles.factIcon}>
              <Icon name={icon} size={19} color="#1A1A2E" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={ts({ size: 11.5, color: '#718096' })}>{label}</Text>
              <View style={{ height: 2 }} />
              <Text numberOfLines={2} style={ts({ size: 14.5, weight: 700, color: '#1A1A2E' })}>
                {value.trim().length === 0 ? '—' : value}
              </Text>
            </View>
          </View>
        ))}
    </View>
  );
}

function SubHeading({ text }: { text: string }) {
  return (
    <View style={{ paddingBottom: 8 }}>
      <Text style={ts({ size: 13, weight: 700, color: '#4A5568' })}>{text}</Text>
    </View>
  );
}

// ── Data tables ───────────────────────────────────────────────────────────────

interface TableColumn {
  /// Flex factor, or a fixed pixel width.
  flex?: number;
  width?: number;
}

interface TableRowData {
  cells: string[];
  bold?: boolean;
  background?: string;
}

/// Rounded, bordered container for the proposal's data tables. On narrow
/// screens the table keeps a readable width and scrolls sideways.
function DataTable({ columns, rows }: { columns: TableColumn[]; rows: TableRowData[] }) {
  const [maxWidth, setMaxWidth] = useState(0);
  const minWidth = 560.0;
  const narrow = maxWidth > 0 && maxWidth < minWidth;
  const table = (
    <View style={[styles.tableFrame, { width: narrow ? minWidth : '100%' }]}>
      {rows.map((row, r) => (
        <View
          key={r}
          style={[
            { flexDirection: 'row', backgroundColor: row.background },
            r > 0 && { borderTopWidth: 1, borderTopColor: '#EDF2F7' },
          ]}
        >
          {columns.map((col, c) => (
            <View
              key={c}
              style={[
                col.width != null ? { width: col.width } : { flex: col.flex ?? 1 },
                { paddingHorizontal: 12, paddingVertical: 10 },
                c > 0 && { borderLeftWidth: 1, borderLeftColor: '#EDF2F7' },
              ]}
            >
              <Text style={ts({ size: 13, weight: row.bold ? 600 : 400, color: row.bold ? '#1A1A2E' : '#4A5568' })}>
                {row.cells[c] ?? ''}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
  return (
    <View onLayout={(e) => setMaxWidth(e.nativeEvent.layout.width)}>
      {narrow ? <ScrollView horizontal>{table}</ScrollView> : table}
    </View>
  );
}

const cell = (v: unknown): string => v?.toString() ?? '';

function ParticipantsTable({ raw }: { raw: string }) {
  try {
    const data = JSON.parse(raw) as Json;
    const rows = (data.rows as Json[] | null) ?? [];
    const tots = (data.totals as Json | null) ?? null;
    if (rows.length === 0) return null;
    return (
      <DataTable
        columns={[{ flex: 3 }, { flex: 1 }, { flex: 1 }, { flex: 1 }]}
        rows={[
          { cells: ['Category', 'Male', 'Female', 'Total'], bold: true, background: '#F8FAFC' },
          ...rows.map((r) => ({ cells: [cell(r.category), cell(r.male), cell(r.female), cell(r.total)] })),
          ...(tots != null
            ? [{ cells: ['Total', cell(tots.male), cell(tots.female), cell(tots.total)], bold: true, background: '#EFF6FF' }]
            : []),
        ]}
      />
    );
  } catch {
    return <PropField label="Participants" value={raw} />;
  }
}

function ActivityMatrix({ raw }: { raw: string }) {
  try {
    const rows = JSON.parse(raw) as Json[];
    if (rows.length === 0) return null;
    return (
      <DataTable
        columns={[{ width: 120 }, { width: 96 }, { flex: 2 }, { flex: 2 }]}
        rows={[
          { cells: ['Day', 'Time', 'Activity', 'Speaker/Facilitator'], bold: true, background: '#F8FAFC' },
          ...rows.map((r) => ({ cells: [cell(r.day), cell(r.time), cell(r.event), cell(r.speaker)] })),
        ]}
      />
    );
  } catch {
    return <Text style={fallbackText}>{raw}</Text>;
  }
}

// columns: list of (dataKey, headerLabel). Decoupling the two lets the same
// data key (e.g. 'cost') carry a different header per table (Cost vs Cost/Day).
function BudgetTable({ raw, columns }: { raw: string; columns: [string, string][] }) {
  try {
    const rows = JSON.parse(raw) as Json[];
    if (rows.length === 0) return null;
    return (
      <DataTable
        columns={columns.map((_, i) => ({ flex: i === 0 ? 2 : 1 }))}
        rows={[
          { cells: columns.map((c) => c[1]), bold: true, background: '#F8FAFC' },
          ...rows.map((r) => ({ cells: columns.map((c) => cell(r[c[0]])) })),
        ]}
      />
    );
  } catch {
    return <Text style={fallbackText}>{raw}</Text>;
  }
}

function CommitteeList({ raw }: { raw: string }) {
  try {
    const members = JSON.parse(raw) as Json[];
    return (
      <View>
        {members.map((m, i) => {
          // Exec-committee members store 'position'; TWG members use 'designation'.
          const pos = (m.position ?? m.designation ?? '').toString();
          return (
            <View key={i} style={{ paddingBottom: 4, flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={ts({ size: 12, color: '#718096' })}>{'• '}</Text>
              <Text style={[fallbackText, { flex: 1 }]}>{`${m.name ?? ''}${pos.length > 0 ? ` — ${pos}` : ''}`}</Text>
            </View>
          );
        })}
      </View>
    );
  } catch {
    return <Text style={fallbackText}>{raw}</Text>;
  }
}

function Methodology({ raw }: { raw: string }) {
  try {
    const list = JSON.parse(raw) as Json[];
    const sections: React.ReactNode[] = [];
    for (const m of list) {
      const stage = (m.stage ?? '').toString().trim();
      const activities = (m.activities ?? '').toString().trim();
      if (stage.length === 0 && activities.length === 0) continue;
      const step = sections.length + 1;
      sections.push(
        <View key={step} style={{ paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={styles.step}>
            <Text style={ts({ size: 12, weight: 700, color: '#1A1A2E' })}>{`${step}`}</Text>
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            {stage.length > 0 && <Text style={ts({ size: 14, weight: 700, color: '#1A1A2E' })}>{stage}</Text>}
            <View style={{ height: 4 }} />
            {activities
              .split('\n')
              .filter((l: string) => l.trim().length > 0)
              .map((l: string, i: number) => (
                <View key={i} style={{ paddingTop: 3 }}>
                  <Text style={ts({ size: 13.5, color: '#4A5568', height: 1.4 })}>{`• ${l.trim()}`}</Text>
                </View>
              ))}
          </View>
        </View>,
      );
    }
    if (sections.length === 0) return null;
    return <View>{sections}</View>;
  } catch {
    return <Text style={fallbackText}>{raw}</Text>;
  }
}

function Outputs({ raw }: { raw: string }) {
  // expected_outputs is stored as a JSON array, but legacy data may be newline text.
  let items: string[];
  const t = raw.trim();
  if (t.startsWith('[')) {
    try {
      const decoded = JSON.parse(t);
      items = Array.isArray(decoded) ? decoded.map((e) => String(e)) : [raw];
    } catch {
      items = [raw];
    }
  } else {
    items = raw.split('\n');
  }
  items = items.filter((s) => s.trim().length > 0);
  if (items.length === 0) return null;
  return (
    <View>
      {items.map((s, i) => (
        <View key={i} style={{ paddingBottom: 3 }}>
          <Text style={ts({ size: 13, color: '#1A1A2E', height: 1.4 })}>{`• ${stripBullet(s)}`}</Text>
        </View>
      ))}
    </View>
  );
}

function Signatories({ raw }: { raw: string }) {
  try {
    const decoded = JSON.parse(raw);
    const list = (Array.isArray(decoded) ? decoded : decoded.signatories) as Json[];
    const rows: React.ReactNode[] = [];
    list.forEach((m, i) => {
      const role = (m.role ?? '').toString().trim();
      const name = (m.name ?? '').toString().trim();
      const title = (m.title ?? '').toString().trim();
      if (role.length === 0 && name.length === 0 && title.length === 0) return;
      rows.push(
        <View key={i} style={styles.signatory}>
          {role.length > 0 && <Text style={ts({ size: 10.5, weight: 700, spacing: 0.5, color: '#718096' })}>{role.toUpperCase()}</Text>}
          <View style={{ height: 6 }} />
          <Text style={ts({ size: 14, weight: 700, color: '#1A1A2E' })}>{name.length > 0 ? name : '—'}</Text>
          {title.length > 0 && <Text style={ts({ size: 12.5, color: '#4A5568' })}>{title}</Text>}
        </View>,
      );
    });
    if (rows.length === 0) return null;
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{rows}</View>;
  } catch {
    // Fall back to raw text for any legacy free-text comments.
    return <Text style={fallbackText}>{raw}</Text>;
  }
}

function TwgGroups({ raw }: { raw: string }) {
  try {
    const list = JSON.parse(raw) as Json[];
    const sections: React.ReactNode[] = [];
    list.forEach((g, gi) => {
      const title = g.title?.toString() ?? '';
      const members = (g.members as Json[] | null) ?? [];
      if (title.length > 0) {
        sections.push(
          <View key={`t${gi}`} style={{ paddingTop: 6, paddingBottom: 4 }}>
            <Text style={ts({ size: 11, weight: 600, color: '#718096', spacing: 0.3 })}>{title}</Text>
          </View>,
        );
      }
      members.forEach((m, mi) => {
        const name = m.name?.toString() ?? '';
        const desig = m.designation?.toString() ?? '';
        sections.push(
          <View key={`m${gi}-${mi}`} style={{ paddingBottom: 3, paddingLeft: 8 }}>
            <Text style={fallbackText}>{`• ${name}${desig.length > 0 ? ` — ${desig}` : ''}`}</Text>
          </View>,
        );
      });
    });
    return <View>{sections}</View>;
  } catch {
    return <Text style={fallbackText}>{raw}</Text>;
  }
}

function Indicators({ raw }: { raw: string }) {
  try {
    const list = JSON.parse(raw) as Json[];
    const items = list.map((v, i) => `${i + 1}. ${v.label?.toString() ?? ''}`).filter((s) => s.trim().length > 3);
    if (items.length === 0) return null;
    return (
      <View>
        {items.map((s, i) => (
          <View key={i} style={{ paddingBottom: 3 }}>
            <Text style={fallbackText}>{s}</Text>
          </View>
        ))}
      </View>
    );
  } catch {
    return <Text style={fallbackText}>{raw}</Text>;
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function StatusBadge({ status }: { status: EventStatus }) {
  const color = status === 'disabled' ? '#E53E3E' : status === 'draft' ? '#718096' : status === 'approved' ? '#48BB78' : '#ED8936';
  const label = status === 'disabled' ? 'Disabled' : status === 'draft' ? 'Draft' : status === 'approved' ? 'Approved' : 'Pending';
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: withOpacity(color, 0.12), borderRadius: 6 }}>
      <Text style={ts({ size: 12, color, weight: 600 })}>{label}</Text>
    </View>
  );
}

// ─── Proposal Detail Widgets ──────────────────────────────────────────────────

function PropMeta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={16} color="#718096" />
      <View style={{ width: 6 }} />
      <Text style={ts({ size: 13.5, color: '#4A5568' })}>{text}</Text>
    </View>
  );
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/// A numbered proposal section (II. Rationale, III. Objectives, ...) as a card.
function ProposalSection({ number, icon, title, children }: {
  number: number;
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#1A1A2E', borderRadius: 6 }}>
          <Text style={ts({ size: 11.5, weight: 800, color: '#FFFFFF', spacing: 0.4 })}>
            {number <= ROMAN.length ? ROMAN[number - 1] : `${number}`}
          </Text>
        </View>
        <View style={{ width: 10 }} />
        <Icon name={icon} size={18} color="#4A5568" />
        <View style={{ width: 6 }} />
        <Text style={[ts({ size: 15.5, weight: 700, color: '#1A1A2E' }), { flex: 1 }]}>{title}</Text>
      </View>
      <View style={{ height: 14 }} />
      {children}
    </Panel>
  );
}

function PropField({ label, value }: { label: string; value: unknown }) {
  const v = value?.toString() ?? '';
  if (v.trim().length === 0) return null;
  return (
    <View style={{ paddingBottom: 8, alignItems: 'flex-start' }}>
      <Text style={ts({ size: 12, weight: 500, color: '#718096' })}>{label}</Text>
      <View style={{ height: 2 }} />
      <Text style={ts({ size: 14.5, weight: 600, color: '#1A1A2E', height: 1.4 })}>{v}</Text>
    </View>
  );
}

function PropBody({ text }: { text: string }) {
  if (text.trim().length === 0) return null;
  return (
    <View style={{ paddingBottom: 8 }}>
      <Text style={ts({ size: 14.5, color: '#1A1A2E', height: 1.65 })}>{text}</Text>
    </View>
  );
}

function PropBullets({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  return (
    <View>
      {lines.map((l, i) => (
        <View key={i} style={{ paddingBottom: 4, flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={ts({ size: 14.5, color: '#718096' })}>{'•  '}</Text>
          <Text style={[ts({ size: 14.5, color: '#1A1A2E', height: 1.5 }), { flex: 1 }]}>{stripBullet(l)}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

const pdfButton = (onPrint: () => void) => (
  <IconButton
    icon={<Icon name="picture_as_pdf_outlined" size={18} color="#718096" />}
    size={18}
    onPress={onPrint}
    tooltip="Print / Save as PDF"
    padding={0}
    minSize={32}
  />
);

function EventCard({ event, canManage, canApprove, isPrincipal, onEdit, onDisable, onApprove, onPrint, onTap }: {
  event: CalEvent;
  canManage: boolean;
  canApprove: boolean;
  isPrincipal: boolean;
  onEdit: () => void;
  onDisable: () => void;
  onApprove: () => void;
  onPrint?: () => void;
  onTap?: () => void;
}) {
  const approved = event.status === 'approved';
  const tagColor = approved ? '#48BB78' : '#ED8936';
  const menuIcon = <Icon name="more_vert" size={20} color="#718096" />;
  return (
    <Tap onPress={onTap}>
      <View style={styles.eventCard}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
            <Text style={[ts({ size: 14, weight: 600, color: '#1A1A2E' }), { flexShrink: 1 }]}>{event.title}</Text>
            <View style={{ width: 8 }} />
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: withOpacity(tagColor, 0.12), borderRadius: 4 }}>
              <Text style={ts({ size: 11, color: tagColor, weight: 500 })}>{approved ? 'Approved' : 'Pending'}</Text>
            </View>
          </View>
          <View style={{ height: 3 }} />
          <Text numberOfLines={2} style={ts({ size: 12, color: '#718096' })}>{event.description}</Text>
          {event.creatorName.length > 0 && (
            <>
              <View style={{ height: 4 }} />
              <Text style={ts({ size: 11, color: '#B0B7C3' })}>{`By ${event.creatorName}`}</Text>
            </>
          )}
        </View>

        {/* Print / Save as PDF — available to all roles for all statuses */}
        {onPrint != null && pdfButton(onPrint)}

        {/* Principal: Approve + Disable for pending events */}
        {isPrincipal && canApprove && event.status === 'pendingApproval' ? (
          <PopupMenuButton<string>
            icon={menuIcon}
            offsetY={30}
            radius={8}
            padding={0}
            onSelected={(v) => {
              if (v === 'approve') onApprove();
              if (v === 'disable') onDisable();
            }}
            items={[
              { value: 'approve', height: 40, child: <Text style={ts({ size: 13, color: '#48BB78' })}>Approve</Text> },
              {
                value: 'disable',
                height: 40,
                padding: 0,
                child: (
                  <View
                    style={{
                      alignSelf: 'stretch',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      backgroundColor: '#E53E3E',
                      borderBottomLeftRadius: 8,
                      borderBottomRightRadius: 8,
                    }}
                  >
                    <Text style={ts({ size: 13, color: '#FFFFFF', weight: 500 })}>Disable</Text>
                  </View>
                ),
              },
            ]}
          />
        ) : canManage && event.status === 'pendingApproval' ? (
          // Coordinator/Dean/Admin: Edit only for pending events (no disable)
          <PopupMenuButton<string>
            icon={menuIcon}
            offsetY={30}
            radius={8}
            padding={0}
            onSelected={(v) => {
              if (v === 'edit') onEdit();
            }}
            items={[{ value: 'edit', height: 40, child: <Text style={ts({ size: 13, color: '#1A1A2E' })}>Edit</Text> }]}
          />
        ) : null}
      </View>
    </Tap>
  );
}

// ─── Disabled Event Card ──────────────────────────────────────────────────────

function DisabledEventCard({ event, canManage, onEnable, onPrint, onTap }: {
  event: CalEvent;
  canManage: boolean;
  onEnable: () => void;
  onPrint?: () => void;
  onTap?: () => void;
}) {
  return (
    <Tap onPress={onTap}>
      <View style={[styles.eventCard, { borderWidth: 1, borderColor: withOpacity('#E53E3E', 0.3) }]}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
            <Text style={[ts({ size: 14, weight: 600, color: '#9CA3AF', decoration: 'line-through' }), { flexShrink: 1 }]}>
              {event.title}
            </Text>
            <View style={{ width: 8 }} />
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: withOpacity('#E53E3E', 0.1), borderRadius: 4 }}>
              <Text style={ts({ size: 11, color: '#E53E3E', weight: 500 })}>Disabled</Text>
            </View>
          </View>
          <View style={{ height: 3 }} />
          <Text style={ts({ size: 12, color: '#B0B7C3' })}>{event.description}</Text>
        </View>
        {onPrint != null && pdfButton(onPrint)}
        {canManage && (
          <TextButton onPress={onEnable} foregroundColor="#48BB78" textStyle={tsPlain({ size: 12, weight: 600 })}>
            Enable
          </TextButton>
        )}
      </View>
    </Tap>
  );
}

// ─── Draft Event Card ─────────────────────────────────────────────────────────

function DraftEventCard({ event, onContinue, onDelete }: { event: CalEvent; onContinue: () => void; onDelete: () => void }) {
  const title = event.title.trim().length === 0 ? 'Untitled Draft' : event.title;
  return (
    <View style={[styles.eventCard, { borderWidth: 1, borderColor: '#DDE3ED' }]}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <Text style={[ts({ size: 14, weight: 600, color: '#1A1A2E' }), { flexShrink: 1 }]}>{title}</Text>
          <View style={{ width: 8 }} />
          <StatusBadge status="draft" />
        </View>
        <View style={{ height: 3 }} />
        <Text style={ts({ size: 12, color: '#718096' })}>Continue where you left off.</Text>
      </View>
      <TextButton onPress={onContinue} foregroundColor="#1E2126" textStyle={tsPlain({ size: 12, weight: 600 })}>
        Continue Editing
      </TextButton>
      <IconButton
        icon={<Icon name="delete_outline" size={18} color="#E53E3E" />}
        size={18}
        onPress={onDelete}
        tooltip="Delete draft"
        padding={0}
        minSize={32}
      />
    </View>
  );
}

// ─── Confirm Disable / Delete Dialog ──────────────────────────────────────────

function ConfirmDialog({ title, message, action, pop }: {
  title: string;
  message: string;
  action: string;
  pop: (result?: boolean) => void;
}) {
  const label = tsPlain({ weight: 600 });
  return (
    <Dialog radius={16}>
      <View style={{ width: 320, maxWidth: '100%', padding: 28, alignItems: 'center' }}>
        <Text style={ts({ size: 18, weight: 700, color: '#1A1A2E' })}>{title}</Text>
        <View style={{ height: 12 }} />
        <Text style={ts({ size: 13, color: '#718096', align: 'center' })}>{message}</Text>
        <View style={{ height: 24 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <ElevatedButton
            style={{ flex: 1, height: 44 }}
            onPress={() => pop(true)}
            backgroundColor="#E53E3E"
            foregroundColor="#FFFFFF"
            elevation={0}
            radius={8}
            shrinkWrap
            textStyle={label}
          >
            {action}
          </ElevatedButton>
          <View style={{ width: 12 }} />
          <OutlinedButton
            style={{ flex: 1, height: 44 }}
            onPress={() => pop(false)}
            foregroundColor="#4A5568"
            side={{ color: '#DDE3ED' }}
            radius={8}
            shrinkWrap
            textStyle={label}
          >
            Cancel
          </OutlinedButton>
        </View>
      </View>
    </Dialog>
  );
}

// ─── Side Calendar ────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const sameDay = (a: Date | null, b: Date) =>
  a != null && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function SideCalendar({ focusedDay, selectedDay, eventsByDay, onDaySelected, onPageChanged }: {
  focusedDay: Date;
  selectedDay: Date | null;
  eventsByDay: Map<string, CalEvent[]>;
  onDaySelected: (day: Date) => void;
  onPageChanged: (focused: Date) => void;
}) {
  const year = focusedDay.getFullYear();
  const month = focusedDay.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((firstWeekday + daysInMonth) / 7);
  const today = new Date();
  const canPrev = new Date(year, month, 1) > new Date(2020, 0, 1);
  const canNext = new Date(year, month + 1, 1) <= new Date(2030, 0, 1);
  const weekdayStyle = ts({ size: 12, weight: 500, color: '#718096' });

  // Hover tooltip text: title · when · where for each event on the day.
  const tooltipText = (events: CalEvent[]) =>
    events
      .map((e) => {
        const when = (e.raw.target_date ?? '').toString().trim();
        const where = (e.raw.venue ?? '').toString().trim();
        const lines = [e.title];
        if (when.length > 0) lines.push(`When: ${when}`);
        if (where.length > 0) lines.push(`Where: ${where}`);
        return lines.join('\n');
      })
      .join('\n\n');

  const dayCell = (day: Date) => {
    const events = eventsByDay.get(dayKey(day)) ?? [];
    const isSelected = sameDay(selectedDay, day);
    const isToday = sameDay(today, day);
    const bg = isSelected ? '#1E2126' : isToday ? '#ACC2DF' : null;
    const marked = isSelected || isToday;
    const content = (
      <View style={{ flex: 1, margin: 4, alignItems: 'center', justifyContent: 'center' }}>
        {bg != null && <View style={{ position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: bg }} />}
        <Text style={ts({ size: 13, color: marked ? '#FFFFFF' : '#1A1A2E', weight: marked ? 600 : 400 })}>{`${day.getDate()}`}</Text>
        {events.length > 0 && (
          <View style={{ position: 'absolute', bottom: 1, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#48BB78' }} />
        )}
      </View>
    );
    return (
      <Tap key={day.getDate()} onPress={() => onDaySelected(day)} style={{ flex: 1, height: 38 }}>
        {events.length > 0 ? <Tooltip message={tooltipText(events)} style={{ flex: 1 }}>{content}</Tooltip> : content}
      </Tap>
    );
  };

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, paddingBottom: 8 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
        <Tap onPress={canPrev ? () => onPageChanged(new Date(year, month - 1, 1)) : null} style={styles.chevron}>
          <Icon name="chevron_left" size={20} color="#4A5568" />
        </Tap>
        <Text style={[ts({ size: 15, weight: 700, color: '#1A1A2E', align: 'center' }), { flex: 1 }]}>
          {`${MONTH_NAMES[month]}\n${year}`}
        </Text>
        <Tap onPress={canNext ? () => onPageChanged(new Date(year, month + 1, 1)) : null} style={styles.chevron}>
          <Icon name="chevron_right" size={20} color="#4A5568" />
        </Tap>
      </View>
      {/* Days of week */}
      <View style={{ flexDirection: 'row', height: 28 }}>
        {WEEKDAY_LABELS.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={weekdayStyle}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Weeks; days outside the month are not shown */}
      {Array.from({ length: weeks }, (_, week) => (
        <View key={week} style={{ flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, weekday) => {
            const dayNumber = week * 7 + weekday - firstWeekday + 1;
            if (dayNumber < 1 || dayNumber > daysInMonth) return <View key={`e${weekday}`} style={{ flex: 1, height: 38 }} />;
            return dayCell(new Date(year, month, dayNumber));
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 148,
    backgroundColor: '#1E2126',
    borderRadius: 12,
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#1E2126',
    borderRadius: 16,
    boxShadow: '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px rgba(0,0,0,0.14), 0px 1px 18px rgba(0,0,0,0.12)',
  },
  fabInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 20,
  },
  panel: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F3',
  },
  factTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E9F3',
  },
  factIcon: {
    width: 38,
    height: 38,
    backgroundColor: '#EEF2FA',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableFrame: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  step: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EEF2FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatory: {
    width: 240,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  chevron: {
    marginHorizontal: 8,
    padding: 12,
  },
});
