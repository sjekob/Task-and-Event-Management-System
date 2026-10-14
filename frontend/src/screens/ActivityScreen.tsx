import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SchoolYearPicker } from '../components/SchoolYearPicker';
import { AppBanner } from '../components/commonWidgets';
import { ActivitySkeleton } from '../components/skeletonWidgets';
import { Icon } from '../components/ui/Icon';
import { IconButton, InkWell, TextButton } from '../components/ui/buttons';
import { Divider, useIsMobile } from '../components/ui/misc';
import { Dialog, showDialog } from '../components/ui/overlay';
import { Json, SchoolYearFilter, currentSchoolYear, sameSchoolYearFilter, tryParseDate } from '../models/models';
import { ApiService, exceptionText } from '../services/apiService';
import { AppTheme, TextStyles, ts } from '../theme/appTheme';
import {
  formatActivityMatrix,
  formatCommittee,
  formatMethodology,
  formatOutputs,
  formatParticipants,
  formatTwg,
} from '../utils/eventFormat';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(raw: unknown): string {
  if (raw == null) return '';
  const d = tryParseDate(String(raw));
  if (d == null) return String(raw);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function statusColor(status: string | null): string {
  switch (status) {
    case 'approved': return '#15803D';
    case 'disabled': return '#6B7280';
    default: return '#92400E';
  }
}

function statusBg(status: string | null): string {
  switch (status) {
    case 'approved': return AppTheme.greenBg;
    case 'disabled': return AppTheme.borderColor;
    default: return AppTheme.amberBg;
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'disabled': return 'Disabled';
    case 'pending_approval': return 'Pending Approval';
    default: return status ?? 'Unknown';
  }
}

export default function ActivityScreen() {
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<Json[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Current school year by default; earlier years are archived.
  const [filter, setFilter] = useState<SchoolYearFilter>(currentSchoolYear);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getEvents(filter.schoolYear === 'current' ? null : filter.schoolYear);
      if (mounted.current) {
        setEvents(data);
        setLoading(false);
      }
    } catch (e) {
      if (mounted.current) {
        setError(exceptionText(e));
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const viewEvent = (ev: Json) => {
    showDialog((pop) => <EventDetailDialog event={ev} onClose={() => pop()} />);
  };

  if (loading) return <ActivitySkeleton />;

  return (
    <ScrollView
      contentContainerStyle={{ paddingLeft: isMobile ? 14 : 24, paddingRight: isMobile ? 14 : 24, paddingBottom: 24 }}
    >
      <View style={{ height: 4 }} />
      <AppBanner title="Activity Calendar" subtitle="View all scheduled events and activities." />
      <View style={{ height: 20 }} />
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={TextStyles.heading3}>
            {sameSchoolYearFilter(filter, currentSchoolYear) ? 'Upcoming Events' : 'Events'}
          </Text>
          <View style={{ flex: 1 }} />
          <SchoolYearPicker value={filter} onChanged={setFilter} />
          <View style={{ width: 4 }} />
          <IconButton onPress={load} icon="refresh" size={18} tooltip="Refresh" color={AppTheme.textMuted} padding={0} minSize={0} />
        </View>
        <View style={{ height: 12 }} />
        {error != null ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Icon name="error_outline" color={AppTheme.redColor} size={36} />
            <View style={{ height: 8 }} />
            <Text style={TextStyles.labelMd}>Failed to load events</Text>
            <View style={{ height: 4 }} />
            <Text style={[TextStyles.bodyMd, { textAlign: 'center' }]}>{error}</Text>
            <View style={{ height: 12 }} />
            <TextButton onPress={load}>Retry</TextButton>
          </View>
        ) : events.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Icon name="event_busy" color={AppTheme.textLight} size={40} />
            <View style={{ height: 8 }} />
            <Text style={TextStyles.bodyMd}>No events yet</Text>
          </View>
        ) : (
          events.map((e, i) => {
            const status = (e.status as string | null) ?? null;
            return (
              <InkWell key={e.id ?? i} onPress={() => viewEvent(e)} radius={6}>
                <View style={styles.row}>
                  <Icon name="event_note" size={16} color={AppTheme.textLight} />
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={TextStyles.labelMd}>{(e.title as string | null) ?? 'Untitled'}</Text>
                    <View style={{ height: 2 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {e.target_date != null && (
                        <>
                          <Icon name="calendar_today" size={11} color={AppTheme.textLight} />
                          <View style={{ width: 3 }} />
                          <Text style={TextStyles.bodySm}>{formatDate(e.target_date)}</Text>
                        </>
                      )}
                      {e.venue != null && e.venue.toString().length > 0 && (
                        <>
                          <View style={{ width: 8 }} />
                          <Icon name="location_on" size={11} color={AppTheme.textLight} />
                          <View style={{ width: 3 }} />
                          <Text numberOfLines={1} style={[TextStyles.bodySm, { flexShrink: 1 }]}>{e.venue as string}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: statusBg(status), borderRadius: 20 }}>
                      <Text style={[TextStyles.labelSm, { color: statusColor(status) }]}>{statusLabel(status)}</Text>
                    </View>
                    <View style={{ height: 3 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Icon name="chevron_right" size={14} color={AppTheme.textLight} />
                      <Text style={TextStyles.caption}>View details</Text>
                    </View>
                  </View>
                </View>
              </InkWell>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

// ── Event Detail Dialog ──────────────────────────────────────────────────────

const hasVal = (v: unknown): boolean => v != null && String(v).trim().length > 0;

function EventDetailDialog({ event, onClose }: { event: Json; onClose: () => void }) {
  const status = (event.status as string | null) ?? null;
  const section = (label: string, body: string) => (
    <>
      <View style={{ height: 16 }} />
      <SectionLabel text={label} />
      <View style={{ height: 6 }} />
      <TextBlock text={body} />
    </>
  );

  return (
    <Dialog radius={12} insetPadding={{ horizontal: 24, vertical: 32 }} clip>
      <View style={{ maxWidth: 640, flexShrink: 1 }}>
        {/* Header */}
        <View style={styles.dialogHeader}>
          <Icon name="event" color="rgba(255,255,255,0.7)" size={18} />
          <View style={{ width: 8 }} />
          <Text numberOfLines={1} style={[ts({ color: '#FFFFFF', weight: 600, size: 15 }), { flex: 1 }]}>
            {(event.title as string | null) ?? 'Event Details'}
          </Text>
          <View style={{ width: 8 }} />
          <StatusChip status={status} />
          <View style={{ width: 8 }} />
          <IconButton
            onPress={onClose}
            size={18}
            padding={0}
            minSize={0}
            icon={<Icon name="close" color="rgba(255,255,255,0.7)" size={18} />}
          />
        </View>
        {/* Body */}
        <ScrollView style={{ flexShrink: 1, flexGrow: 0 }} contentContainerStyle={{ padding: 20, alignItems: 'flex-start' }}>
          {/* Basic info grid */}
          <SectionLabel text="Event Information" />
          <View style={{ height: 10 }} />
          <InfoGrid
            items={[
              ['Nature', event.nature],
              ['Target Date', formatDate(event.target_date)],
              ['Venue', event.venue],
              ['Fund Source', event.fund_source],
              ['Proposed Budget', event.proposed_budget != null ? `₱${event.proposed_budget}` : null],
            ]}
          />

          {hasVal(event.participants) && section('Participants', formatParticipants(String(event.participants)))}

          {hasVal(event.focal_name) && (
            <>
              <View style={{ height: 16 }} />
              <SectionLabel text="Focal Person" />
              <View style={{ height: 10 }} />
              <InfoGrid
                items={[
                  ['Name', event.focal_name],
                  ['Role', event.focal_role],
                  ['Contact', event.focal_contact],
                ]}
              />
            </>
          )}

          {hasVal(event.rationale) && section('Rationale', String(event.rationale))}
          {hasVal(event.objectives) && section('Objectives', String(event.objectives))}
          {hasVal(event.expected_outputs) && section('Expected Outputs', formatOutputs(String(event.expected_outputs)))}

          {(hasVal(event.phase1) || hasVal(event.phase2) || hasVal(event.phase3)) && (
            <>
              <View style={{ height: 16 }} />
              <SectionLabel text="Implementation Phases" />
              <View style={{ height: 10 }} />
              {hasVal(event.phase1) && <PhaseItem title="Phase 1 – Pre-Activity" content={formatMethodology(String(event.phase1))} />}
              {hasVal(event.phase2) && <PhaseItem title="Phase 2 – During Activity" content={formatMethodology(String(event.phase2))} />}
              {hasVal(event.phase3) && <PhaseItem title="Phase 3 – Post-Activity" content={formatMethodology(String(event.phase3))} />}
            </>
          )}

          {hasVal(event.activity_matrix) && section('Activity Matrix', formatActivityMatrix(String(event.activity_matrix)))}
          {hasVal(event.exec_committee) && section('Executive Committee', formatCommittee(String(event.exec_committee)))}
          {hasVal(event.twg_groups) && section('TWG Groups', formatTwg(String(event.twg_groups)))}
          {hasVal(event.monitoring_criteria) && section('Monitoring Criteria', String(event.monitoring_criteria))}
          {hasVal(event.indicators) && section('Indicators', String(event.indicators))}
          {hasVal(event.comments) && section('Comments / Notes', String(event.comments))}

          {hasVal(event.creator_name) && (
            <>
              <View style={{ height: 16 }} />
              <View style={{ alignSelf: 'stretch' }}>
                <Divider color={AppTheme.borderColor} />
              </View>
              <View style={{ height: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                <Icon name="person_outline" size={14} color={AppTheme.textLight} />
                <View style={{ width: 6 }} />
                <Text style={TextStyles.caption}>{'Created by '}</Text>
                <Text numberOfLines={1} style={[TextStyles.captionMd, { flexShrink: 1 }]}>
                  {`${event.creator_name}${hasVal(event.creator_role) ? ` (${event.creator_role})` : ''}`}
                </Text>
                {hasVal(event.created_at) && (
                  <>
                    <Text style={TextStyles.caption}>{'  ·  '}</Text>
                    <Text style={TextStyles.caption}>{formatDate(event.created_at)}</Text>
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>
        {/* Footer */}
        <View style={styles.dialogFooter}>
          <TextButton onPress={onClose}>Close</TextButton>
        </View>
      </View>
    </Dialog>
  );
}

// ── Helper widgets ───────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string | null }) {
  const [bg, fg, label] =
    status === 'approved'
      ? [AppTheme.greenBg, '#15803D', 'Approved']
      : status === 'disabled'
        ? [AppTheme.borderColor, AppTheme.textMuted, 'Disabled']
        : [AppTheme.amberBg, '#92400E', 'Pending Approval'];
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: bg, borderRadius: 20 }}>
      <Text style={[TextStyles.labelSm, { color: fg, fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={[TextStyles.labelMd, { color: AppTheme.accentBlue, fontSize: 12 }]}>{text}</Text>;
}

function InfoGrid({ items }: { items: [label: string, value: unknown][] }) {
  const filtered = items.filter(([, value]) => value != null && String(value).trim().length > 0);
  if (filtered.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
      {filtered.map(([label, value]) => (
        <View key={label} style={{ width: 200 }}>
          <Text style={TextStyles.caption}>{label}</Text>
          <View style={{ height: 2 }} />
          <Text style={TextStyles.labelMd}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function TextBlock({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'stretch', padding: 10, backgroundColor: AppTheme.bgColor, borderRadius: 6 }}>
      <Text style={TextStyles.bodyMd}>{text}</Text>
    </View>
  );
}

function PhaseItem({ title, content }: { title: string; content: string }) {
  return (
    <View style={{ paddingBottom: 10, alignSelf: 'stretch' }}>
      <Text style={[TextStyles.captionMd, { color: AppTheme.textPrimary }]}>{title}</Text>
      <View style={{ height: 4 }} />
      <TextBlock text={content} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 12,
    boxShadow: AppTheme.cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.borderColor,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingTop: 16,
    paddingRight: 12,
    paddingBottom: 16,
    backgroundColor: AppTheme.darkBanner,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  dialogFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: AppTheme.borderColor,
  },
});
