import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppraisalTabSkeleton } from '../../components/skeletonWidgets';
import { Icon, IconName } from '../../components/ui/Icon';
import { ElevatedButton, IconButton, InkWell, TextButton } from '../../components/ui/buttons';
import { TextField } from '../../components/ui/inputs';
import { CircularProgressIndicator, LinearProgressIndicator } from '../../components/ui/misc';
import { Dialog, showDialog, showSnackBar } from '../../components/ui/overlay';
import { EventForAppraisal } from '../../models/models';
import { ApiService, exceptionText } from '../../services/apiService';
import { AppTheme, Scheme, TextStyles, ts, tsPlain } from '../../theme/appTheme';
import {
  ActionBtn,
  AppraisalStatCard,
  ErrorPanel,
  FilterDropdown,
  GREY,
  HairDivider,
  RED,
  StarRatingRow,
  StatRow,
  StatusChip,
  fmtSlashDate,
  panelStyle,
  tableHeadStyle,
} from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Events Tab
// ─────────────────────────────────────────────────────────────────────────────

function effectiveStatus(e: EventForAppraisal): string {
  if (e.evaluations.length > 0) return 'completed';
  if (e.status === 'approved') return 'awaiting_ratings';
  return e.status;
}

function evidencyColor(pct: number): string {
  if (pct >= 80) return '#16A34A';
  if (pct >= 50) return '#EA580C';
  return '#EF4444';
}

export function EventsTab({ events, loading, error, onRefresh, onEvaluated }: {
  events: EventForAppraisal[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onEvaluated: (event: EventForAppraisal) => void;
}) {
  const [filterTitle, setFilterTitle] = useState<string | null>(null);

  if (loading) return <AppraisalTabSkeleton />;
  if (error != null) return <ErrorPanel message={error} onRetry={onRefresh} />;

  const filtered = filterTitle != null ? events.filter((e) => e.title === filterTitle) : events;
  const titleOptions = [...new Set(events.map((e) => e.title).filter((n) => n.length > 0))].sort();

  const pending = events.filter((e) => e.status === 'pending_approval').length;
  const withEvals = events.filter((e) => e.evaluations.length > 0);
  const avgPct =
    withEvals.length === 0 ? null : withEvals.map((e) => e.evidencyRate).reduce((a, b) => a + b) / withEvals.length;
  const avgColor = avgPct == null ? AppTheme.textMuted : evidencyColor(avgPct);

  const showEventEvalDialog = async (event: EventForAppraisal) => {
    const updated = await showDialog<EventForAppraisal>((pop) => (
      <EventEvalDialog event={event} onSubmitted={onEvaluated} pop={pop} />
    ));
    if (updated != null) onEvaluated(updated);
  };

  const head = tableHeadStyle(11, 0.5);
  const muted12 = ts({ size: 12, color: AppTheme.textMuted });

  const eventRow = (event: EventForAppraisal, idx: number) => {
    const hasEvals = event.evaluations.length > 0;
    const pct = hasEvals ? event.evidencyRate : null;
    const responses =
      event.expectedAttendees != null
        ? `${event.evaluations.length} / ${event.expectedAttendees}`
        : `${event.evaluations.length}`;
    return (
      <View
        key={event.id}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: idx % 2 === 1 ? '#FAFAFB' : '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: GREY[100],
          paddingHorizontal: 20,
          paddingVertical: 14,
        }}
      >
        <Text numberOfLines={1} style={[ts({ size: 13, weight: 600, color: AppTheme.textPrimary }), { flex: 4 }]}>{event.title}</Text>
        <Text style={[muted12, { width: 90 }]}>{fmtSlashDate(event.targetDate)}</Text>
        <Text numberOfLines={1} style={[muted12, { width: 110 }]}>{event.department ?? '—'}</Text>
        <Text numberOfLines={1} style={[muted12, { flex: 2 }]}>{event.organizerName ?? '—'}</Text>
        <View style={{ width: 90, alignItems: 'center' }}>
          <Text style={ts({ size: 12, color: AppTheme.textPrimary })}>{responses}</Text>
        </View>
        <View style={{ width: 110, alignItems: 'center' }}>
          <Text style={ts({ size: 13, weight: 700, color: pct != null ? evidencyColor(pct) : AppTheme.textMuted })}>
            {pct != null ? `${pct.toFixed(0)}%` : '—'}
          </Text>
        </View>
        <View style={{ width: 130, alignItems: 'center' }}>
          <View>
            <StatusChip status={effectiveStatus(event)} />
          </View>
        </View>
        <View style={{ width: 100, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <IconButton
            tooltip="Evaluation options"
            padding={0}
            minSize={28}
            size={20}
            icon={<Icon name="assignment_outlined" size={20} color="#3B82F6" />}
            onPress={() => showDialog((pop) => <EvaluationOptionsDialog event={event} onClose={() => pop()} />)}
          />
          <IconButton
            tooltip="Evaluator demographics"
            padding={0}
            minSize={28}
            size={20}
            icon={<Icon name="groups_outlined" size={20} color={hasEvals ? '#3B82F6' : GREY[400]} />}
            onPress={() => showDialog((pop) => <DemographicsDialog event={event} onClose={() => pop()} />)}
          />
        </View>
        <View style={{ width: 120, alignItems: 'flex-end' }}>
          {hasEvals ? (
            <ActionBtn label="View Results" dark onTap={() => showEventEvalDialog(event)} />
          ) : (
            <Text style={muted12}>No Data</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView>
      <StatRow>
        {[
          <AppraisalStatCard
            key="a"
            value={`${events.length}`}
            label="Total Events"
            subtitle={`${events.length} total · ${pending} awaiting ratings`}
            icon="event_note_outlined"
            iconColor={AppTheme.textMuted}
            iconBg="#F3F4F6"
          />,
          <AppraisalStatCard
            key="b"
            value={`${withEvals.length}`}
            label="Rated Events"
            icon="assignment_turned_in_outlined"
            iconColor="#10B981"
            iconBg="#ECFDF5"
          />,
          <AppraisalStatCard
            key="c"
            value={avgPct == null ? '—' : `${avgPct.toFixed(0)}%`}
            label="Avg Evidency Rate"
            valueColor={avgColor}
            icon="percent_rounded"
            iconColor={avgColor}
            iconBg="#F3F4F6"
          />,
        ]}
      </StatRow>
      <View style={{ height: 16 }} />

      {/* Evidency legend */}
      <View style={{ padding: 16, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 0.8, borderColor: '#E2E8F0' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="info_outline_rounded" color="#64748B" size={18} />
          <View style={{ width: 8 }} />
          <Text style={ts({ size: 13, weight: 700, color: '#334155' })}>Evidency Rate Legend</Text>
        </View>
        <View style={{ height: 12 }} />
        <StatRow>
          {[
            <EvidencyBadge key="g" color="#16A34A" label="Green" desc="High (≥ 80%)" />,
            <EvidencyBadge key="y" color="#EA580C" label="Yellow" desc="Mid (50% - 79%)" />,
            <EvidencyBadge key="r" color="#EF4444" label="Red" desc="Low (< 50%)" />,
          ]}
        </StatRow>
      </View>
      <View style={{ height: 16 }} />

      {/* Events table */}
      <View style={panelStyle}>
        <View style={{ paddingLeft: 20, paddingTop: 16, paddingRight: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={ts({ size: 15, weight: 700, color: AppTheme.textPrimary })}>School-Wide Events</Text>
          <View style={{ flex: 1 }} />
          <FilterDropdown
            icon="tune_rounded"
            label={filterTitle ?? 'Show All'}
            options={titleOptions}
            selected={filterTitle}
            onSelect={setFilterTitle}
          />
        </View>
        <HairDivider />
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={[head, { flex: 4 }]}>EVENT NAME</Text>
          <Text style={[head, { width: 90 }]}>DATE</Text>
          <Text style={[head, { width: 110 }]}>DEPARTMENT</Text>
          <Text style={[head, { flex: 2 }]}>ORGANIZER</Text>
          <Text style={[head, { width: 90, textAlign: 'center' }]}>RESPONSES</Text>
          <Text style={[head, { width: 110, textAlign: 'center' }]}>EVIDENCY RATE</Text>
          <Text style={[head, { width: 130, textAlign: 'center' }]}>STATUS</Text>
          <Text style={[head, { width: 100, textAlign: 'center' }]}>EVALUATION</Text>
          <Text style={[head, { width: 120, textAlign: 'right' }]}>ACTION</Text>
        </View>
        <HairDivider />
        {filtered.map(eventRow)}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Evaluation Dialog
// ─────────────────────────────────────────────────────────────────────────────

function EventEvalDialog({ event, onSubmitted, pop }: {
  event: EventForAppraisal;
  onSubmitted: (event: EventForAppraisal) => void;
  pop: (result?: EventForAppraisal) => void;
}) {
  const [scores, setScores] = useState({ planning: 0, objectives: 0, personnel: 0, timeMgmt: 0, engagement: 0, resource: 0 });
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const average =
    (scores.planning + scores.objectives + scores.personnel + scores.timeMgmt + scores.engagement + scores.resource) / 6.0;
  const set = (key: keyof typeof scores) => (v: number) => setScores((prev) => ({ ...prev, [key]: v }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const updated = await ApiService.evaluateEvent(event.id, {
        evaluator_name: 'Evaluator',
        evaluator_role: 'Coordinator',
        planning_score: scores.planning,
        objectives_score: scores.objectives,
        personnel_score: scores.personnel,
        time_mgmt_score: scores.timeMgmt,
        engagement_score: scores.engagement,
        resource_score: scores.resource,
        feedback_comments: comments.trim(),
      });
      onSubmitted(updated);
      pop(updated);
    } catch (e) {
      showSnackBar(`Error: ${exceptionText(e)}`, { backgroundColor: RED });
      setSubmitting(false);
    }
  };

  return (
    <Dialog radius={12}>
      <View style={{ width: 500, maxWidth: '100%', height: 680, maxHeight: '100%' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            backgroundColor: AppTheme.darkBanner,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <Icon name="rate_review_outlined" color="#FFFFFF" size={18} />
          <View style={{ width: 8 }} />
          <Text style={[ts({ color: '#FFFFFF', size: 15, weight: 700 }), { flex: 1 }]}>{`Evaluate: ${event.title}`}</Text>
          <IconButton onPress={() => pop()} size={18} icon={<Icon name="close" color="#FFFFFF" size={18} />} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, alignItems: 'flex-start' }}>
          <Text style={ts({ size: 13, weight: 700, color: AppTheme.darkBanner })}>Rating Criteria</Text>
          <View style={{ height: 10 }} />
          <StarRatingRow label={'Planning & Preparation'} value={scores.planning} onChanged={set('planning')} />
          <StarRatingRow label="Achievement of Objectives" value={scores.objectives} onChanged={set('objectives')} />
          <StarRatingRow label="Personnel Management" value={scores.personnel} onChanged={set('personnel')} />
          <StarRatingRow label="Time Management" value={scores.timeMgmt} onChanged={set('timeMgmt')} />
          <StarRatingRow label="Audience Engagement" value={scores.engagement} onChanged={set('engagement')} />
          <StarRatingRow label="Resource Management" value={scores.resource} onChanged={set('resource')} />
          {scores.planning > 0 && (
            <>
              <View style={{ height: 6 }} />
              <View style={{ padding: 10, backgroundColor: '#E3F2FD', borderRadius: 8 }}>
                <Text style={ts({ size: 13, weight: 600, color: '#2196F3' })}>{`Average Score: ${average.toFixed(2)} / 5`}</Text>
              </View>
            </>
          )}
          <View style={{ height: 10 }} />
          <TextField
            style={{ alignSelf: 'stretch' }}
            value={comments}
            onChangeText={setComments}
            maxLines={6}
            minLines={6}
            decoration={{ labelText: 'Comments (optional)', filled: true, fillColor: '#FFFFFF' }}
          />
        </ScrollView>
        <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TextButton onPress={() => pop()}>Cancel</TextButton>
          <View style={{ width: 8 }} />
          <ElevatedButton onPress={submitting ? null : submit} backgroundColor={AppTheme.darkBanner} foregroundColor="#FFFFFF">
            {submitting ? <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" /> : 'Submit'}
          </ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Evaluation QR Code Dialog
// ─────────────────────────────────────────────────────────────────────────────

/// The public evaluation page for an event (the QR code's target).
function evalUrlFor(event: EventForAppraisal): string {
  if (Platform.OS === 'web') return `${window.location.origin}/eval/${event.id}`;
  return Linking.createURL(`/eval/${event.id}`);
}

function organizerLine(event: EventForAppraisal): string {
  const org = event.organizerName?.trim();
  const dept = event.department?.trim();
  const parts: string[] = [];
  if (org != null && org.length > 0) parts.push(`Organizer: ${org}`);
  if (dept != null && dept.length > 0) parts.push(dept);
  return parts.join(' · ');
}

function SmallDialogHeader({ title, size, onClose }: { title: string; size: number; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
      <Text style={[ts({ size, weight: 700, color: AppTheme.textPrimary }), { flex: 1 }]}>{title}</Text>
      <IconButton padding={0} minSize={28} size={18} icon={<Icon name="close" size={18} color={Scheme.onSurfaceVariant} />} onPress={onClose} />
    </View>
  );
}

function EventQrDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const url = evalUrlFor(event);
  const orgLine = organizerLine(event);
  return (
    <Dialog radius={16}>
      <View style={{ width: 360, maxWidth: '100%', padding: 24, alignItems: 'center' }}>
        <SmallDialogHeader title="Event Evaluation QR Code" size={15} onClose={onClose} />
        <View style={{ height: 12 }} />
        <Text style={ts({ size: 15, weight: 700, color: AppTheme.textPrimary, align: 'center' })}>{event.title}</Text>
        {orgLine.length > 0 && (
          <>
            <View style={{ height: 2 }} />
            <Text style={ts({ size: 12, color: AppTheme.textMuted, align: 'center' })}>{orgLine}</Text>
          </>
        )}
        <View style={{ height: 20 }} />
        <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: GREY[200], borderRadius: 12 }}>
          <QRCode value={url} size={200} />
        </View>
        <View style={{ height: 16 }} />
        <Text style={ts({ size: 11, color: AppTheme.textMuted, align: 'center' })}>{`Event ID: ${event.id}`}</Text>
        <View style={{ height: 4 }} />
        <Text selectable style={ts({ size: 11, color: '#3B82F6', decoration: 'underline', align: 'center' })}>{url}</Text>
      </View>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Options Dialog (QR code vs. direct link)
// ─────────────────────────────────────────────────────────────────────────────

function EvaluationOptionsDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const orgLine = organizerLine(event);
  return (
    <Dialog radius={16}>
      <View style={{ width: 360, maxWidth: '100%', padding: 24, alignItems: 'center' }}>
        <SmallDialogHeader title="Evaluation Options" size={16} onClose={onClose} />
        <View style={{ height: 12 }} />
        <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary, align: 'center' })}>{event.title}</Text>
        {orgLine.length > 0 && (
          <>
            <View style={{ height: 2 }} />
            <Text style={ts({ size: 12, color: AppTheme.textMuted, align: 'center' })}>{orgLine}</Text>
          </>
        )}
        <View style={{ height: 20 }} />
        <OptionCard
          icon="qr_code_2_rounded"
          title="Show QR Code"
          subtitle="Generate a QR code for attendees to scan on their devices"
          onTap={() => {
            onClose();
            showDialog((pop) => <EventQrDialog event={event} onClose={() => pop()} />);
          }}
        />
        <View style={{ height: 12 }} />
        <OptionCard
          icon="link_rounded"
          title="Get Evaluation Link"
          subtitle="Copy the direct URL link to the evaluation web page"
          onTap={() => {
            onClose();
            showDialog((pop) => <EvaluationLinkDialog event={event} onClose={() => pop()} />);
          }}
        />
      </View>
    </Dialog>
  );
}

function OptionCard({ icon, title, subtitle, onTap }: { icon: IconName; title: string; subtitle: string; onTap: () => void }) {
  return (
    <InkWell onPress={onTap} radius={12} style={{ alignSelf: 'stretch' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          backgroundColor: '#F8FAFC',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E5E7EB',
        }}
      >
        <View style={{ padding: 10, backgroundColor: '#EFF2FF', borderRadius: 10 }}>
          <Icon name={icon} size={20} color="#3B82F6" />
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={ts({ size: 13, weight: 700, color: AppTheme.textPrimary })}>{title}</Text>
          <View style={{ height: 2 }} />
          <Text style={ts({ size: 11, color: AppTheme.textMuted })}>{subtitle}</Text>
        </View>
        <Icon name="chevron_right" size={20} color={AppTheme.textMuted} />
      </View>
    </InkWell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Link Dialog (copy direct URL)
// ─────────────────────────────────────────────────────────────────────────────

function EvaluationLinkDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const url = evalUrlFor(event);
  return (
    <Dialog radius={16}>
      <View style={{ width: 420, maxWidth: '100%', padding: 24, alignItems: 'flex-start' }}>
        <Text style={ts({ size: 16, weight: 700, color: AppTheme.textPrimary })}>Evaluation Link</Text>
        <View style={{ height: 8 }} />
        <Text style={ts({ size: 12, color: AppTheme.textMuted })}>{`Direct evaluation form link for "${event.title}":`}</Text>
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
          <View
            style={{
              flex: 1,
              paddingHorizontal: 12,
              paddingVertical: 12,
              backgroundColor: '#F8FAFC',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Text selectable numberOfLines={1} style={ts({ size: 12, color: AppTheme.textPrimary })}>{url}</Text>
          </View>
          <View style={{ width: 8 }} />
          <ElevatedButton
            onPress={async () => {
              await Clipboard.setStringAsync(url);
              showSnackBar('Evaluation link copied to clipboard', { backgroundColor: '#22C55E' });
            }}
            icon="copy"
            iconSize={15}
            backgroundColor="#3B82F6"
            foregroundColor="#FFFFFF"
          >
            Copy
          </ElevatedButton>
        </View>
        <View style={{ height: 12 }} />
        <View style={{ alignSelf: 'stretch', alignItems: 'flex-end' }}>
          <TextButton onPress={onClose}>
            <Text style={tsPlain({ size: 13, color: AppTheme.textMuted })}>Close</Text>
          </TextButton>
        </View>
      </View>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidency Rate Legend Badge
// ─────────────────────────────────────────────────────────────────────────────

function EvidencyBadge({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 0.8,
        borderColor: '#E5E7EB',
      }}
    >
      <View style={{ width: 10, height: 10, marginTop: 2, borderRadius: 5, backgroundColor: color }} />
      <View style={{ width: 8 }} />
      <Text style={[ts({ size: 12, color: '#4B5563', height: 1.3, spacing: 0 }), { flex: 1 }]}>
        <Text style={ts({ size: 12, weight: 700, color, height: 1.3, spacing: 0 })}>{`${label}: `}</Text>
        {desc}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator demographics (event evaluations)
// ─────────────────────────────────────────────────────────────────────────────

function DemographicsDialog({ event, onClose }: { event: EventForAppraisal; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const d = event.demographics;
  const total = typeof d.total === 'number' ? Math.trunc(d.total) : 0;
  const counts = (k: string): [string, number][] =>
    Object.entries((d[k] ?? {}) as Record<string, number>).map(([key, v]) => [key, Math.trunc(v)]);

  const breakdown = (title: string, entries: [string, number][]) => (
    <View style={{ paddingBottom: 20 }}>
      <Text style={ts({ size: 14, weight: 700 })}>{title}</Text>
      <View style={{ height: 8 }} />
      {entries.map(([key, value]) => (
        <View key={key} style={{ paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Text
            numberOfLines={1}
            style={[ts({ size: 13, color: key === 'Not specified' ? AppTheme.textLight : AppTheme.textPrimary }), { width: 150 }]}
          >
            {key.length === 0 ? '—' : key[0].toUpperCase() + key.substring(1)}
          </Text>
          <LinearProgressIndicator
            style={{ flex: 1 }}
            value={value / total}
            minHeight={10}
            radius={4}
            backgroundColor="#EEF2FA"
            color={key === 'Not specified' ? '#CBD5E1' : AppTheme.accentBlue}
          />
          <View style={{ width: 12 }} />
          <Text style={[TextStyles.captionMd, { width: 90, textAlign: 'right' }]}>
            {`${value} · ${((value * 100) / total).toFixed(0)}%`}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <Dialog radius={16}>
      <View style={{ width: 720, maxWidth: '100%', maxHeight: height * 0.85, padding: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={ts({ size: 18, weight: 700 })}>Evaluator demographics</Text>
            <Text style={TextStyles.bodySm}>{`${event.title} · ${total} ${total === 1 ? 'evaluation' : 'evaluations'}`}</Text>
          </View>
          <IconButton onPress={onClose} tooltip="Close" icon="close" />
        </View>
        <View style={{ height: 16 }} />
        {total === 0 ? (
          <Text style={TextStyles.bodyMd}>No evaluations yet.</Text>
        ) : (
          <ScrollView style={{ flexShrink: 1, flexGrow: 0 }}>
            {breakdown('By role', counts('by_role'))}
            {breakdown('By sex', counts('by_sex'))}
            {breakdown('By age group', counts('by_age_group'))}
          </ScrollView>
        )}
      </View>
    </Dialog>
  );
}
